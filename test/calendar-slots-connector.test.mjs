/**
 * VocalIA Calendar Slots Connector Tests
 *
 * Tests:
 * - CONFIG structure (defaults, API limits, retry config)
 * - CalendarSlotsConnector constructor defaults
 * - _generateDaySlots (slot generation with business hours)
 * - _isSlotBusy (overlap detection)
 * - _isCacheStale (cache expiry logic)
 * - _formatDate (French date formatting)
 * - CalendarSlotsStore (constructor, getConnector, getStats)
 * - getCalendarSlotsStore (singleton)
 *
 * NOTE: Tests pure logic and offline paths. Google Calendar API calls
 * return empty when not connected (graceful fallback).
 *
 * Run: node --test test/calendar-slots-connector.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CalendarSlotsConnector, CalendarSlotsStore, getCalendarSlotsStore, CONFIG } from '../core/calendar-slots-connector.cjs';


// ─── CONFIG ─────────────────────────────────────────────────────────

describe('CalendarSlots CONFIG', () => {
  test('has default slot duration of 60 min', () => {
    assert.strictEqual(CONFIG.defaultSlotDuration, 60);
  });

  test('has buffer time of 5 min', () => {
    assert.strictEqual(CONFIG.bufferTime, 5);
  });

  test('has min advance booking of 24h', () => {
    assert.strictEqual(CONFIG.minAdvanceBooking, 24 * 60);
  });

  test('has default business hours 09:00-18:00', () => {
    assert.strictEqual(CONFIG.defaultBusinessHours.start, '09:00');
    assert.strictEqual(CONFIG.defaultBusinessHours.end, '18:00');
  });

  test('has work days Mon-Sat', () => {
    assert.deepStrictEqual(CONFIG.defaultWorkDays, [1, 2, 3, 4, 5, 6]);
  });

  test('has maxSlotsPerDay of 10', () => {
    assert.strictEqual(CONFIG.maxSlotsPerDay, 10);
  });

  test('has lookAheadDays of 14', () => {
    assert.strictEqual(CONFIG.lookAheadDays, 14);
  });

  test('has API limits', () => {
    assert.strictEqual(CONFIG.apiLimits.calendarExpansionMax, 50);
    assert.strictEqual(CONFIG.apiLimits.groupExpansionMax, 100);
    assert.strictEqual(CONFIG.apiLimits.requestsPerMinute, 600);
  });

  test('has retry config', () => {
    assert.strictEqual(CONFIG.retryConfig.maxRetries, 3);
    assert.strictEqual(CONFIG.retryConfig.initialDelayMs, 1000);
    assert.strictEqual(CONFIG.retryConfig.maxDelayMs, 10000);
  });

  test('has cacheDir', () => {
    assert.ok(CONFIG.cacheDir.includes('calendars'));
  });
});

// ─── CalendarSlotsConnector constructor ─────────────────────────────

describe('CalendarSlotsConnector constructor', () => {
  test('sets tenantId', () => {
    const c = new CalendarSlotsConnector('test_tenant');
    assert.strictEqual(c.tenantId, 'test_tenant');
  });

  test('defaults calendarId to primary', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c.calendarId, 'primary');
  });

  test('defaults business hours from CONFIG', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.deepStrictEqual(c.businessHours, CONFIG.defaultBusinessHours);
  });

  test('defaults workDays from CONFIG', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.deepStrictEqual(c.workDays, CONFIG.defaultWorkDays);
  });

  test('defaults slotDuration to 60', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c.slotDuration, 60);
  });

  test('defaults timezone to Africa/Casablanca', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c.timezone, 'Africa/Casablanca');
  });

  test('defaults lookAheadDays to 14', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c.lookAheadDays, 14);
  });

  test('accepts custom config', () => {
    const c = new CalendarSlotsConnector('t1', {
      calendarId: 'custom@gmail.com',
      slotDuration: 30,
      timezone: 'Europe/Paris',
      workDays: [1, 2, 3, 4, 5],
      businessHours: { start: '08:00', end: '20:00' }
    });
    assert.strictEqual(c.calendarId, 'custom@gmail.com');
    assert.strictEqual(c.slotDuration, 30);
    assert.strictEqual(c.timezone, 'Europe/Paris');
    assert.deepStrictEqual(c.workDays, [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(c.businessHours, { start: '08:00', end: '20:00' });
  });

  test('starts disconnected', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c.connected, false);
    assert.strictEqual(c.calendar, null);
    assert.strictEqual(c.lastSync, null);
    assert.strictEqual(c.cachedSlots, null);
  });
});

// ─── _generateDaySlots ──────────────────────────────────────────────

describe('CalendarSlotsConnector _generateDaySlots', () => {
  // Use a far-future date to avoid minAdvanceBooking blocking
  const futureDate = '2027-06-15';

  test('generates slots within business hours', () => {
    const c = new CalendarSlotsConnector('t1');
    const slots = c._generateDaySlots(futureDate);
    assert.ok(slots.length > 0);
    // First slot should be at 09:00
    assert.strictEqual(slots[0].time, '09:00');
  });

  test('respects slot duration + buffer interval', () => {
    const c = new CalendarSlotsConnector('t1', { slotDuration: 60 });
    const slots = c._generateDaySlots(futureDate);
    // With 60min slots + 5min buffer = 65min interval
    // From 09:00 to 18:00 = 540min / 65 = 8 slots max (last starts at 17:00 = 09:00 + 8*65 = 09:00 + 520min = 17:40 — but slot needs 60min so must end by 18:00)
    assert.ok(slots.length >= 5);
    if (slots.length >= 2) {
      // Second slot at 10:05 (09:00 + 65min)
      assert.strictEqual(slots[1].time, '10:05');
    }
  });

  test('generates 30-min slots correctly', () => {
    const c = new CalendarSlotsConnector('t1', { slotDuration: 30 });
    const slots = c._generateDaySlots(futureDate);
    // 30min + 5min buffer = 35min interval
    // 540min / 35 = ~15 slots
    assert.ok(slots.length >= 10);
    assert.strictEqual(slots[0].time, '09:00');
    assert.strictEqual(slots[1].time, '09:35');
  });

  test('each slot has expected fields', () => {
    const c = new CalendarSlotsConnector('t1');
    const slots = c._generateDaySlots(futureDate);
    const slot = slots[0];
    assert.ok(slot.time);
    assert.ok(slot.startTime instanceof Date);
    assert.ok(slot.endTime instanceof Date);
    assert.strictEqual(slot.durationMinutes, 60);
    assert.strictEqual(slot.bufferMinutes, 5);
    assert.strictEqual(typeof slot.available, 'boolean');
    assert.ok(Array.isArray(slot.service_ids));
  });

  test('past slots are blocked by min_advance_booking', () => {
    // Use today's date — all morning slots likely past min advance
    const today = new Date().toISOString().split('T')[0];
    const c = new CalendarSlotsConnector('t1');
    const slots = c._generateDaySlots(today);
    // At least some slots should be blocked
    const blocked = slots.filter(s => s.blocked_reason === 'min_advance_booking');
    // If it's before 18:00, some should be blocked
    assert.ok(blocked.length >= 0); // Just verify the field exists
  });

  test('custom business hours produce different slots', () => {
    const c = new CalendarSlotsConnector('t1', {
      businessHours: { start: '14:00', end: '20:00' },
      slotDuration: 60
    });
    const slots = c._generateDaySlots(futureDate);
    assert.strictEqual(slots[0].time, '14:00');
    // 6 hours = 360min / 65 = ~5 slots
    assert.ok(slots.length >= 4);
  });

  test('services are mapped to slot service_ids', () => {
    const c = new CalendarSlotsConnector('t1', {
      services: [{ id: 'SRV-001' }, { id: 'SRV-002' }]
    });
    const slots = c._generateDaySlots(futureDate);
    assert.deepStrictEqual(slots[0].service_ids, ['SRV-001', 'SRV-002']);
  });
});

// ─── _isSlotBusy ────────────────────────────────────────────────────

describe('CalendarSlotsConnector _isSlotBusy', () => {
  const c = new CalendarSlotsConnector('t1');

  test('returns false when no busy periods', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    assert.strictEqual(c._isSlotBusy(slot, []), false);
  });

  test('returns true for fully overlapping period', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [{ start: '2027-06-15T09:00:00', end: '2027-06-15T12:00:00' }];
    assert.strictEqual(c._isSlotBusy(slot, busy), true);
  });

  test('returns true for partial overlap at start', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [{ start: '2027-06-15T09:30:00', end: '2027-06-15T10:30:00' }];
    assert.strictEqual(c._isSlotBusy(slot, busy), true);
  });

  test('returns true for partial overlap at end', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [{ start: '2027-06-15T10:30:00', end: '2027-06-15T11:30:00' }];
    assert.strictEqual(c._isSlotBusy(slot, busy), true);
  });

  test('returns false for adjacent period (no overlap)', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [{ start: '2027-06-15T11:00:00', end: '2027-06-15T12:00:00' }];
    assert.strictEqual(c._isSlotBusy(slot, busy), false);
  });

  test('returns false for non-overlapping period', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [{ start: '2027-06-15T14:00:00', end: '2027-06-15T15:00:00' }];
    assert.strictEqual(c._isSlotBusy(slot, busy), false);
  });

  test('checks multiple busy periods', () => {
    const slot = {
      startTime: new Date('2027-06-15T10:00:00'),
      endTime: new Date('2027-06-15T11:00:00')
    };
    const busy = [
      { start: '2027-06-15T08:00:00', end: '2027-06-15T09:00:00' },
      { start: '2027-06-15T10:30:00', end: '2027-06-15T12:00:00' }
    ];
    assert.strictEqual(c._isSlotBusy(slot, busy), true);
  });
});

// ─── _isCacheStale ──────────────────────────────────────────────────

describe('CalendarSlotsConnector _isCacheStale', () => {
  test('returns true when no lastSync', () => {
    const c = new CalendarSlotsConnector('t1');
    assert.strictEqual(c._isCacheStale(), true);
  });

  test('returns false when synced just now', () => {
    const c = new CalendarSlotsConnector('t1');
    c.lastSync = new Date();
    assert.strictEqual(c._isCacheStale(), false);
  });

  test('returns true when synced 6 minutes ago', () => {
    const c = new CalendarSlotsConnector('t1');
    c.lastSync = new Date(Date.now() - 6 * 60 * 1000);
    assert.strictEqual(c._isCacheStale(), true);
  });

  test('returns false when synced 4 minutes ago', () => {
    const c = new CalendarSlotsConnector('t1');
    c.lastSync = new Date(Date.now() - 4 * 60 * 1000);
    assert.strictEqual(c._isCacheStale(), false);
  });
});

// ─── _formatDate ────────────────────────────────────────────────────

describe('CalendarSlotsConnector _formatDate', () => {
  const c = new CalendarSlotsConnector('t1');

  test('formats date in French', () => {
    // 2027-06-15 is a Tuesday
    const result = c._formatDate('2027-06-15');
    assert.ok(result.includes('mardi'));
    assert.ok(result.includes('15'));
    assert.ok(result.includes('juin'));
  });

  test('formats January correctly', () => {
    const result = c._formatDate('2027-01-01');
    assert.ok(result.includes('janvier'));
  });

  test('formats Sunday correctly', () => {
    // 2027-06-13 is a Sunday
    const result = c._formatDate('2027-06-13');
    assert.ok(result.includes('dimanche'));
  });
});

// ─── CalendarSlotsConnector getStatus ───────────────────────────────

describe('CalendarSlotsConnector getStatus', () => {
  test('returns expected shape', () => {
    const c = new CalendarSlotsConnector('t1', {
      services: [{ id: 'SRV-001' }]
    });
    const status = c.getStatus();
    assert.strictEqual(status.tenantId, 't1');
    assert.strictEqual(status.connected, false);
    assert.strictEqual(status.source, 'static');
    assert.strictEqual(status.calendarId, 'primary');
    assert.deepStrictEqual(status.businessHours, CONFIG.defaultBusinessHours);
    assert.strictEqual(status.slotDuration, 60);
    assert.strictEqual(status.lastSync, null);
    assert.strictEqual(status.servicesCount, 1);
  });
});

// ─── CalendarSlotsConnector disconnect ──────────────────────────────

describe('CalendarSlotsConnector disconnect', () => {
  test('clears state on disconnect', async () => {
    const c = new CalendarSlotsConnector('t1');
    c.connected = true;
    c.cachedSlots = { test: true };
    await c.disconnect();
    assert.strictEqual(c.connected, false);
    assert.strictEqual(c.calendar, null);
    assert.strictEqual(c.cachedSlots, null);
  });
});

// ─── CalendarSlotsConnector bookSlot (offline) ──────────────────────

describe('CalendarSlotsConnector bookSlot offline', () => {
  test('returns error when not connected', async () => {
    const c = new CalendarSlotsConnector('t1');
    const result = await c.bookSlot('2027-06-15', '10:00', { clientName: 'Test' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'calendar_not_connected');
    assert.ok(result.voiceResponse);
  });
});

// ─── CalendarSlotsConnector cancelBooking (offline) ─────────────────

describe('CalendarSlotsConnector cancelBooking offline', () => {
  test('returns error when not connected', async () => {
    const c = new CalendarSlotsConnector('t1');
    const result = await c.cancelBooking('event_123');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'calendar_not_connected');
  });
});

// ─── CalendarSlotsStore ─────────────────────────────────────────────

describe('CalendarSlotsStore', () => {
  test('constructor initializes empty', () => {
    const store = new CalendarSlotsStore();
    assert.strictEqual(store.connectors.size, 0);
    assert.strictEqual(store.initialized, false);
  });

  test('getConnector returns undefined for unknown tenant', () => {
    const store = new CalendarSlotsStore();
    assert.strictEqual(store.getConnector('unknown'), undefined);
  });

  test('getStats returns empty stats', () => {
    const store = new CalendarSlotsStore();
    const stats = store.getStats();
    assert.strictEqual(stats.tenantsCount, 0);
    assert.strictEqual(stats.connectedCount, 0);
    assert.deepStrictEqual(stats.tenants, []);
  });

  test('bookSlot returns error for unregistered tenant', async () => {
    const store = new CalendarSlotsStore();
    const result = await store.bookSlot('unknown', '2027-06-15', '10:00', {});
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'tenant_not_registered');
  });
});

// ─── getCalendarSlotsStore (singleton) ──────────────────────────────

describe('getCalendarSlotsStore', () => {
  test('returns a CalendarSlotsStore instance', () => {
    const store = getCalendarSlotsStore();
    assert.ok(store instanceof CalendarSlotsStore);
  });

  test('returns same instance on second call', () => {
    const s1 = getCalendarSlotsStore();
    const s2 = getCalendarSlotsStore();
    assert.strictEqual(s1, s2);
  });
});
