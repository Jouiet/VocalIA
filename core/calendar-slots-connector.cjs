#!/usr/bin/env node
/**
 * VocalIA - Calendar Slots Connector
 *
 * Dynamic slot management integrating with Google Calendar API v3 for real-time availability.
 * Supports multi-tenant configuration with business hours and service durations.
 *
 * Based on official Google Calendar API documentation:
 * - FreeBusy API: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
 * - Events API: https://developers.google.com/workspace/calendar/api/v3/reference/events
 *
 * Rate Limits (per official docs):
 * - 600 requests/minute per user
 * - 10,000 requests/minute per application
 * - 1,000,000 queries per day
 * - Uses exponential backoff on 403/429 errors
 *
 * Personas covered:
 * - healer, dental, stylist, hairdresser, gym, trainer, cleaner
 *
 * Inspired by:
 * - Cal.com (https://github.com/calcom/cal.com) - leading open-source scheduler
 * - Easy!Appointments (https://github.com/alextselegidis/easyappointments)
 *
 * Version: 1.1.0 | Session 250.72 | 03/02/2026
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration based on industry best practices
const CONFIG = {
  defaultSlotDuration: 60, // minutes (Cal.com default)
  bufferTime: 5, // minutes between appointments (industry standard)
  minAdvanceBooking: 24 * 60, // 24 hours in minutes (common constraint)
  defaultBusinessHours: {
    start: '09:00',
    end: '18:00'
  },
  defaultWorkDays: [1, 2, 3, 4, 5, 6], // Mon-Sat (0=Sun)
  maxSlotsPerDay: 10,
  lookAheadDays: 14,
  cacheDir: path.join(__dirname, '../data/calendars'),
  // Google Calendar API limits (from official docs)
  apiLimits: {
    calendarExpansionMax: 50, // max calendars for free/busy info
    groupExpansionMax: 100, // max calendar IDs per group
    requestsPerMinute: 600 // per user limit
  },
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000, // exponential backoff starting delay
    maxDelayMs: 10000
  }
};

// Try to load SecretVault for tenant credentials
let SecretVault = null;
try {
  SecretVault = require('./SecretVault.cjs');
} catch (e) {
  console.log('[CalendarSlots] SecretVault not available, using env vars');
}

/**
 * Exponential backoff retry wrapper
 * Based on Google's recommended error handling for rate limits
 * @see https://developers.google.com/workspace/calendar/api/guides/errors
 */
async function withRetry(fn, context = 'operation') {
  let lastError;
  for (let attempt = 0; attempt < CONFIG.retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error.response?.status || error.code;

      // Only retry on rate limit errors (403/429)
      if (status === 403 || status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
        const delay = Math.min(
          CONFIG.retryConfig.initialDelayMs * Math.pow(2, attempt),
          CONFIG.retryConfig.maxDelayMs
        );
        console.log(`[CalendarSlots] Rate limit hit for ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${CONFIG.retryConfig.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry other errors
      throw error;
    }
  }
  throw lastError;
}

/**
 * Calendar Slots Connector
 * Generates real-time availability slots from Google Calendar
 */
class CalendarSlotsConnector {
  constructor(tenantId, config = {}) {
    this.tenantId = tenantId;
    this.calendarId = config.calendarId || 'primary';
    this.businessHours = config.businessHours || CONFIG.defaultBusinessHours;
    this.workDays = config.workDays || CONFIG.defaultWorkDays;
    this.slotDuration = config.slotDuration || CONFIG.defaultSlotDuration;
    this.services = config.services || [];
    this.timezone = config.timezone || 'Africa/Casablanca';
    this.lookAheadDays = config.lookAheadDays || CONFIG.lookAheadDays;

    this.calendar = null;
    this.connected = false;
    this.lastSync = null;
    this.cachedSlots = null;
  }

  /**
   * Get Google credentials for this tenant
   */
  async _getCredentials() {
    if (SecretVault) {
      try {
        const creds = await SecretVault.loadCredentials(this.tenantId);
        if (creds.GOOGLE_CLIENT_ID && creds.GOOGLE_CLIENT_SECRET && creds.GOOGLE_REFRESH_TOKEN) {
          return {
            clientId: creds.GOOGLE_CLIENT_ID,
            clientSecret: creds.GOOGLE_CLIENT_SECRET,
            refreshToken: creds.GOOGLE_REFRESH_TOKEN,
            redirectUri: creds.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
          };
        }
      } catch (e) {
        // Fall through to env vars
      }
    }

    // Fallback to environment
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    };
  }

  /**
   * Connect to Google Calendar API
   */
  async connect() {
    try {
      const creds = await this._getCredentials();

      if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        console.log(`[CalendarSlots] ${this.tenantId}: No Google credentials, using static slots`);
        this.connected = false;
        return false;
      }

      const oAuth2Client = new google.auth.OAuth2(
        creds.clientId,
        creds.clientSecret,
        creds.redirectUri
      );
      oAuth2Client.setCredentials({ refresh_token: creds.refreshToken });

      this.calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
      this.connected = true;

      console.log(`✅ [CalendarSlots] ${this.tenantId}: Connected to Google Calendar`);
      return true;
    } catch (error) {
      console.error(`❌ [CalendarSlots] ${this.tenantId}: Connection failed: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from Google Calendar
   */
  async disconnect() {
    this.calendar = null;
    this.connected = false;
    this.cachedSlots = null;
    console.log(`[CalendarSlots] ${this.tenantId}: Disconnected`);
  }

  /**
   * Get busy periods from Google Calendar FreeBusy API
   * @see https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
   *
   * POST https://www.googleapis.com/calendar/v3/freeBusy
   * Required scopes: calendar.readonly, calendar, calendar.events.freebusy, or calendar.freebusy
   *
   * @param {Date} startDate - Start date (timeMin)
   * @param {Date} endDate - End date (timeMax)
   * @returns {Array} Array of {start, end} busy periods in RFC3339 format
   */
  async _getBusyPeriods(startDate, endDate) {
    if (!this.connected || !this.calendar) {
      return [];
    }

    // Validate time range per API specs
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    if (new Date(timeMin) >= new Date(timeMax)) {
      console.warn(`[CalendarSlots] ${this.tenantId}: Invalid time range (timeMin >= timeMax)`);
      return [];
    }

    try {
      const response = await withRetry(async () => {
        return await this.calendar.freebusy.query({
          requestBody: {
            timeMin,
            timeMax,
            timeZone: this.timezone,
            items: [{ id: this.calendarId }],
            // Respect API limits
            calendarExpansionMax: CONFIG.apiLimits.calendarExpansionMax,
            groupExpansionMax: CONFIG.apiLimits.groupExpansionMax
          }
        });
      }, `freebusy-${this.tenantId}`);

      // Handle possible API errors in response
      const calendarData = response.data.calendars?.[this.calendarId];
      if (calendarData?.errors?.length > 0) {
        const error = calendarData.errors[0];
        console.error(`[CalendarSlots] ${this.tenantId}: FreeBusy error - ${error.reason}: ${error.domain}`);
        // Possible reasons: groupTooBig, tooManyCalendarsRequested, notFound, internalError
        return [];
      }

      return calendarData?.busy || [];
    } catch (error) {
      console.error(`[CalendarSlots] ${this.tenantId}: FreeBusy query failed: ${error.message}`);
      // Return empty array to allow fallback to static slots
      return [];
    }
  }

  /**
   * Generate time slots for a date based on business hours
   * Implements industry-standard slot generation with buffer times
   *
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {Array} Array of slot objects with time, startTime, endTime, available, service_ids
   */
  _generateDaySlots(dateStr) {
    const slots = [];
    const [startHour, startMin] = this.businessHours.start.split(':').map(Number);
    const [endHour, endMin] = this.businessHours.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Calculate slot interval (duration + buffer)
    const slotInterval = this.slotDuration + (this.bufferTime || CONFIG.bufferTime);

    let currentMinute = startMinutes;
    while (currentMinute + this.slotDuration <= endMinutes) {
      const hours = Math.floor(currentMinute / 60);
      const mins = currentMinute % 60;
      const time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const startTime = new Date(`${dateStr}T${time}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + this.slotDuration);

      // Check minimum advance booking requirement
      const now = new Date();
      const minAdvanceTime = new Date(now.getTime() + CONFIG.minAdvanceBooking * 60 * 1000);
      const isPastMinAdvance = startTime <= minAdvanceTime;

      slots.push({
        time,
        startTime,
        endTime,
        durationMinutes: this.slotDuration,
        bufferMinutes: this.bufferTime || CONFIG.bufferTime,
        available: !isPastMinAdvance, // Will be updated by busy period check
        blocked_reason: isPastMinAdvance ? 'min_advance_booking' : null,
        service_ids: this.services.map(s => s.id)
      });

      currentMinute += slotInterval;
    }

    return slots;
  }

  /**
   * Check if a slot overlaps with busy periods
   * @param {object} slot - Slot object
   * @param {array} busyPeriods - Array of busy periods
   */
  _isSlotBusy(slot, busyPeriods) {
    for (const busy of busyPeriods) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      // Check overlap
      if (slot.startTime < busyEnd && slot.endTime > busyStart) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get available slots for a date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD), optional
   */
  async getAvailableSlots(startDate, endDate = null) {
    const start = new Date(startDate);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + this.lookAheadDays * 24 * 60 * 60 * 1000);

    // Get busy periods from Google Calendar
    const busyPeriods = await this._getBusyPeriods(start, end);

    const slotsByDate = {};
    const availableDates = [];

    // Generate slots for each day
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();

      // Skip non-work days
      if (!this.workDays.includes(dayOfWeek)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      const dateStr = current.toISOString().split('T')[0];
      const daySlots = this._generateDaySlots(dateStr);

      // BL26 fix: Mark slots as unavailable if they overlap with busy periods
      // Preserve min_advance_booking check from _generateDaySlots (AND, not overwrite)
      for (const slot of daySlots) {
        slot.available = slot.available && !this._isSlotBusy(slot, busyPeriods);
        // Remove Date objects for JSON serialization
        delete slot.startTime;
        delete slot.endTime;
      }

      // Only include days with at least one available slot
      const hasAvailable = daySlots.some(s => s.available);
      if (hasAvailable) {
        availableDates.push(dateStr);
        slotsByDate[dateStr] = daySlots;
      }

      current.setDate(current.getDate() + 1);
    }

    this.cachedSlots = {
      available_dates: availableDates,
      slots_by_date: slotsByDate,
      last_sync: new Date().toISOString(),
      source: this.connected ? 'google_calendar' : 'static'
    };

    this.lastSync = new Date();
    return this.cachedSlots;
  }

  /**
   * Get slots for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   */
  async getSlotsForDate(date) {
    // Ensure we have slots cached
    if (!this.cachedSlots || this._isCacheStale()) {
      await this.getAvailableSlots(date);
    }

    return {
      date,
      slots: this.cachedSlots?.slots_by_date?.[date] || [],
      source: this.cachedSlots?.source || 'unknown'
    };
  }

  /**
   * Get the next available slot
   * @param {string} serviceId - Optional service ID filter
   */
  async getNextAvailableSlot(serviceId = null) {
    const today = new Date().toISOString().split('T')[0];

    if (!this.cachedSlots || this._isCacheStale()) {
      await this.getAvailableSlots(today);
    }

    for (const date of this.cachedSlots.available_dates) {
      const slots = this.cachedSlots.slots_by_date[date];
      for (const slot of slots) {
        if (slot.available) {
          // Filter by service if provided
          if (serviceId && slot.service_ids && !slot.service_ids.includes(serviceId)) {
            continue;
          }
          return { date, slot, source: this.cachedSlots.source };
        }
      }
    }

    return null;
  }

  /**
   * Book a slot (create calendar event)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {object} booking - Booking details
   */
  async bookSlot(date, time, booking) {
    if (!this.connected || !this.calendar) {
      return {
        success: false,
        error: 'calendar_not_connected',
        voiceResponse: 'Je ne peux pas confirmer la réservation en ce moment.'
      };
    }

    try {
      const startDateTime = `${date}T${time}:00`;
      const endDateTime = new Date(`${date}T${time}:00`);
      endDateTime.setMinutes(endDateTime.getMinutes() + (booking.duration || this.slotDuration));

      const event = {
        summary: booking.summary || `Rendez-vous - ${booking.clientName || 'Client'}`,
        description: booking.description || `Service: ${booking.serviceName || 'N/A'}\nClient: ${booking.clientName || 'N/A'}\nTéléphone: ${booking.clientPhone || 'N/A'}`,
        start: {
          dateTime: startDateTime,
          timeZone: this.timezone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: this.timezone
        },
        attendees: booking.clientEmail ? [{ email: booking.clientEmail }] : []
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendUpdates: booking.clientEmail ? 'all' : 'none'
      });

      // Invalidate cache
      this.cachedSlots = null;

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        voiceResponse: `Parfait, votre rendez-vous est confirmé pour le ${this._formatDate(date)} à ${time}. Vous recevrez une confirmation par email.`
      };
    } catch (error) {
      console.error(`[CalendarSlots] ${this.tenantId}: Booking failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        voiceResponse: 'Désolé, une erreur est survenue lors de la réservation. Veuillez réessayer.'
      };
    }
  }

  /**
   * Cancel a booking
   * @param {string} eventId - Calendar event ID
   */
  async cancelBooking(eventId) {
    if (!this.connected || !this.calendar) {
      return { success: false, error: 'calendar_not_connected' };
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId
      });

      // Invalidate cache
      this.cachedSlots = null;

      return {
        success: true,
        voiceResponse: 'Le rendez-vous a été annulé avec succès.'
      };
    } catch (error) {
      console.error(`[CalendarSlots] ${this.tenantId}: Cancel failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if cache is stale (older than 5 minutes)
   */
  _isCacheStale() {
    if (!this.lastSync) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.lastSync < fiveMinutesAgo;
  }

  /**
   * Format date for voice response
   * @param {string} dateStr - Date in YYYY-MM-DD format
   */
  _formatDate(dateStr) {
    const date = new Date(dateStr);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  /**
   * Generate voice-optimized slots summary
   * @param {string} date - Date in YYYY-MM-DD format
   */
  async getSlotsSummary(date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    const { slots, source } = await this.getSlotsForDate(date);
    const available = slots.filter(s => s.available);

    if (available.length === 0) {
      // Find next available date
      const next = await this.getNextAvailableSlot();
      if (next) {
        return {
          date,
          availableCount: 0,
          voiceSummary: `Aucun créneau disponible pour ${this._formatDate(date)}. Le prochain créneau est ${this._formatDate(next.date)} à ${next.slot.time}.`,
          nextAvailable: next
        };
      }
      return {
        date,
        availableCount: 0,
        voiceSummary: `Aucun créneau disponible pour les ${this.lookAheadDays} prochains jours.`
      };
    }

    const times = available.slice(0, 5).map(s => s.time).join(', ');
    const more = available.length > 5 ? ` et ${available.length - 5} autres créneaux` : '';

    return {
      date,
      availableCount: available.length,
      slots: available,
      source,
      voiceSummary: `Pour ${this._formatDate(date)}, nous avons des créneaux à ${times}${more}. Quel horaire vous conviendrait?`
    };
  }

  /**
   * Get connector status
   */
  getStatus() {
    return {
      tenantId: this.tenantId,
      connected: this.connected,
      source: this.connected ? 'google_calendar' : 'static',
      calendarId: this.calendarId,
      businessHours: this.businessHours,
      slotDuration: this.slotDuration,
      workDays: this.workDays,
      lastSync: this.lastSync?.toISOString() || null,
      servicesCount: this.services.length
    };
  }
}

/**
 * Calendar Slots Store
 * Manages multiple tenant calendar connections
 */
const MAX_CALENDAR_CONNECTORS = 200;

class CalendarSlotsStore {
  constructor() {
    this.connectors = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the store
   */
  async init() {
    if (this.initialized) return;

    // Ensure cache directory exists
    if (!fs.existsSync(CONFIG.cacheDir)) {
      fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
    }

    this.initialized = true;
    console.log('[CalendarSlotsStore] Initialized');
  }

  /**
   * Register a tenant with calendar configuration
   * @param {string} tenantId - Tenant identifier
   * @param {object} config - Calendar configuration
   */
  async registerTenant(tenantId, config) {
    await this.init();

    // BL26 fix: Bound connectors Map to prevent unbounded memory growth
    if (this.connectors.size >= MAX_CALENDAR_CONNECTORS && !this.connectors.has(tenantId)) {
      // Evict oldest connector (LRU)
      const firstKey = this.connectors.keys().next().value;
      const old = this.connectors.get(firstKey);
      if (old) await old.disconnect();
      this.connectors.delete(firstKey);
    }

    const connector = new CalendarSlotsConnector(tenantId, config);
    await connector.connect();

    this.connectors.set(tenantId, connector);
    console.log(`[CalendarSlotsStore] Registered: ${tenantId}`);

    return connector;
  }

  /**
   * Get connector for tenant
   * @param {string} tenantId - Tenant identifier
   */
  getConnector(tenantId) {
    return this.connectors.get(tenantId);
  }

  /**
   * Get or create connector for tenant
   * @param {string} tenantId - Tenant identifier
   * @param {object} config - Optional configuration
   */
  async getOrCreateConnector(tenantId, config = {}) {
    if (!this.connectors.has(tenantId)) {
      await this.registerTenant(tenantId, config);
    }
    return this.connectors.get(tenantId);
  }

  /**
   * Get available slots for tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {object} options - Options
   */
  async getSlots(tenantId, date, options = {}) {
    const connector = await this.getOrCreateConnector(tenantId, options);
    return connector.getSlotsSummary(date);
  }

  /**
   * Book a slot for tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} date - Date
   * @param {string} time - Time
   * @param {object} booking - Booking details
   */
  async bookSlot(tenantId, date, time, booking) {
    const connector = this.getConnector(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }
    return connector.bookSlot(date, time, booking);
  }

  /**
   * Get store statistics
   */
  getStats() {
    const tenants = [];
    for (const [tenantId, connector] of this.connectors) {
      tenants.push(connector.getStatus());
    }

    return {
      tenantsCount: this.connectors.size,
      connectedCount: tenants.filter(t => t.connected).length,
      tenants
    };
  }
}

// Singleton instance
let calendarSlotsStoreInstance = null;

function getCalendarSlotsStore() {
  if (!calendarSlotsStoreInstance) {
    calendarSlotsStoreInstance = new CalendarSlotsStore();
  }
  return calendarSlotsStoreInstance;
}

// Export
module.exports = {
  CalendarSlotsConnector,
  CalendarSlotsStore,
  getCalendarSlotsStore,
  CONFIG
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Calendar Slots Connector - VocalIA

Usage:
  node calendar-slots-connector.cjs [options]

Options:
  --test-slots     Generate test slots for today
  --tenant=ID      Specify tenant ID (default: demo)
  --date=YYYY-MM-DD  Specify date (default: today)
  --help           Show this help

Examples:
  node calendar-slots-connector.cjs --test-slots
  node calendar-slots-connector.cjs --tenant=garage_aziz --date=2026-02-05
`);
    process.exit(0);
  }

  const tenantId = args.find(a => a.startsWith('--tenant='))?.split('=')[1] || 'demo';
  const date = args.find(a => a.startsWith('--date='))?.split('=')[1] || new Date().toISOString().split('T')[0];

  (async () => {
    console.log(`\n🗓️  Calendar Slots Connector Test\n`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Date: ${date}`);
    console.log(`---`);

    const connector = new CalendarSlotsConnector(tenantId, {
      services: [{ id: 'SRV-001', name: 'Consultation' }]
    });

    await connector.connect();

    const summary = await connector.getSlotsSummary(date);
    console.log(`\nAvailable slots: ${summary.availableCount}`);
    console.log(`Source: ${summary.source || 'static'}`);
    console.log(`\nVoice summary:`);
    console.log(`"${summary.voiceSummary}"`);

    if (summary.slots) {
      console.log(`\nSlots:`);
      summary.slots.forEach(s => {
        console.log(`  ${s.time} - ${s.available ? '✅ Available' : '❌ Busy'}`);
      });
    }

    console.log(`\n✅ Test complete`);
  })();
}
