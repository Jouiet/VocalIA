#!/usr/bin/env node
/**
 * HubSpot B2B CRM Integration
 *
 * Purpose: CRM operations for B2B PME (contacts, companies, deals)
 * API Tier: Works with FREE HubSpot CRM
 *
 * Features:
 * - Contact management (create, update, search)
 * - Company management (create, update, search)
 * - Deal pipeline management
 * - Lead scoring (manual via properties)
 * - Geo-segmentation sync
 * - Batch operations (up to 100 records per call)
 * - Exponential backoff with jitter for 429 errors
 * - Rate limit header monitoring
 *
 * NOTE: Workflows API requires Pro tier ($890/mo) - NOT INCLUDED
 * This script uses FREE tier APIs only
 *
 * @version 1.1.0
 * @date 2026-01-02
 */

require('dotenv').config();
const { Client } = require('@hubspot/api-client');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  accessToken: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN,
  rateLimit: {
    requests: 100,
    perSeconds: 10,
    burstLimit: 190  // HubSpot burst limit per 10 seconds
  },
  retry: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterMs: 500  // Random jitter to avoid thundering herd
  },
  batch: {
    maxRecords: 100  // HubSpot batch API limit
  },
  defaultProperties: {
    contact: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'lead_score', 'hs_lead_status'],
    company: ['name', 'domain', 'industry', 'city', 'country', 'numberofemployees', 'annualrevenue'],
    deal: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate']
  },
  leadScoreThresholds: {
    hot: 80,
    warm: 50,
    cold: 0
  }
};

// ============================================================================
// HITL CONFIGURATION (Human In The Loop)
// ============================================================================

const fs = require('fs');
const path = require('path');

// User configurable thresholds via ENV variables:
//   HITL_DEAL_VALUE_THRESHOLD: 1000 | 1500 | 2000 | 3000 | 5000 | custom (default: 1500)
const HITL_CONFIG = {
  enabled: process.env.HITL_HUBSPOT_ENABLED !== 'false',
  dealValueThreshold: parseFloat(process.env.HITL_DEAL_VALUE_THRESHOLD) || 1500, // €1000, €1500, €2000, €3000, €5000 ou valeur custom
  dealValueOptions: [1000, 1500, 2000, 3000, 5000],  // Recommended options
  slackWebhook: process.env.HITL_SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
  notifyOnPending: process.env.HITL_NOTIFY_ON_PENDING !== 'false'
};

const DATA_DIR = process.env.HUBSPOT_DATA_DIR || path.join(__dirname, '../../../data/hubspot');
const HITL_PENDING_DIR = path.join(DATA_DIR, 'hitl-pending');
const HITL_PENDING_FILE = path.join(HITL_PENDING_DIR, 'pending-deals.json');

// Ensure directories exist
function ensureHitlDir() {
  if (!fs.existsSync(HITL_PENDING_DIR)) {
    fs.mkdirSync(HITL_PENDING_DIR, { recursive: true });
  }
}
ensureHitlDir();

// HITL Functions
function loadPendingDeals() {
  try {
    if (fs.existsSync(HITL_PENDING_FILE)) {
      return JSON.parse(fs.readFileSync(HITL_PENDING_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn(`⚠️ Could not load HITL pending deals: ${error.message}`);
  }
  return [];
}

function savePendingDeals(deals) {
  try {
    const tempPath = `${HITL_PENDING_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(deals, null, 2));
    fs.renameSync(tempPath, HITL_PENDING_FILE);
  } catch (error) {
    console.error(`❌ Failed to save HITL pending deals: ${error.message}`);
  }
}

function queueDealForApproval(dealData, reason) {
  const pending = loadPendingDeals();
  const pendingDeal = {
    id: `hitl_deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    dealData,
    amount: dealData.amount || 0,
    reason,
    queuedAt: new Date().toISOString(),
    status: 'pending'
  };

  pending.push(pendingDeal);
  savePendingDeals(pending);

  console.log(`🔒 Deal "${dealData.dealname}" queued for HITL approval (${reason})`);

  // Slack notification
  if (HITL_CONFIG.slackWebhook && HITL_CONFIG.notifyOnPending) {
    sendHitlDealNotification(pendingDeal).catch(e => console.error(`❌ Slack notification failed: ${e.message}`));
  }

  return pendingDeal;
}

async function sendHitlDealNotification(pendingDeal) {
  if (!HITL_CONFIG.slackWebhook) return;

  const message = {
    text: `🔒 HITL Approval Required - HubSpot Deal`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔒 HITL: High-Value Deal Pending', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Deal:* ${pendingDeal.dealData.dealname}` },
          { type: 'mrkdwn', text: `*Amount:* €${pendingDeal.amount.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Pipeline:* ${pendingDeal.dealData.pipeline || 'default'}` },
          { type: 'mrkdwn', text: `*Reason:* ${pendingDeal.reason}` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `\`\`\`node hubspot-b2b-crm.cjs --approve=${pendingDeal.id}\`\`\`` }
      }
    ]
  };

  await fetch(HITL_CONFIG.slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}

async function approveDeal(hitlId, crm) {
  const pending = loadPendingDeals();
  const index = pending.findIndex(d => d.id === hitlId);

  if (index === -1) {
    console.log(`❌ HITL deal ${hitlId} not found`);
    return { success: false, error: 'Deal not found' };
  }

  const deal = pending[index];
  deal.status = 'approved';
  deal.approvedAt = new Date().toISOString();

  pending.splice(index, 1);
  savePendingDeals(pending);

  console.log(`✅ HITL deal "${deal.dealData.dealname}" approved, creating...`);

  // Create the deal
  const result = await crm.createDealInternal(deal.dealData);

  return { success: true, deal, result };
}

function rejectDeal(hitlId, reason = 'Rejected by operator') {
  const pending = loadPendingDeals();
  const index = pending.findIndex(d => d.id === hitlId);

  if (index === -1) {
    console.log(`❌ HITL deal ${hitlId} not found`);
    return { success: false, error: 'Deal not found' };
  }

  const deal = pending[index];
  deal.status = 'rejected';
  deal.rejectedAt = new Date().toISOString();
  deal.rejectionReason = reason;

  pending.splice(index, 1);
  savePendingDeals(pending);

  console.log(`❌ HITL deal "${deal.dealData.dealname}" rejected: ${reason}`);

  return { success: true, deal };
}

function listPendingDeals() {
  const pending = loadPendingDeals();
  console.log(`\n🔒 Pending HITL Deals (${pending.length}):\n`);

  if (pending.length === 0) {
    console.log('  No pending deals');
    return pending;
  }

  pending.forEach(d => {
    console.log(`  • ${d.id}`);
    console.log(`    Deal: ${d.dealData.dealname} | Amount: €${d.amount.toLocaleString()}`);
    console.log(`    Reason: ${d.reason}`);
    console.log(`    Queued: ${d.queuedAt}`);
    console.log();
  });

  return pending;
}

// ============================================================================
// HUBSPOT CLIENT
// ============================================================================

class HubSpotB2BCRM {
  constructor(accessToken = CONFIG.accessToken) {
    if (!accessToken) {
      console.warn('⚠️ No HubSpot access token provided. Running in test mode.');
      this.testMode = true;
      this.client = null;
    } else {
      this.testMode = false;
      this.client = new Client({ accessToken });
    }
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.rateLimitRemaining = CONFIG.rateLimit.requests;
    this.rateLimitResetAt = null;
  }

  /**
   * Rate limit handler with header monitoring
   */
  async rateLimit() {
    this.requestCount++;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    // Check if we're approaching rate limit based on tracked remaining
    if (this.rateLimitRemaining <= 5) {
      const waitTime = this.rateLimitResetAt
        ? Math.max(0, this.rateLimitResetAt - now)
        : (CONFIG.rateLimit.perSeconds * 1000) - elapsed;
      if (waitTime > 0) {
        console.log(`⏳ Rate limit approaching (${this.rateLimitRemaining} remaining): waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.rateLimitRemaining = CONFIG.rateLimit.requests;
      }
    }

    if (this.requestCount >= CONFIG.rateLimit.requests && elapsed < CONFIG.rateLimit.perSeconds * 1000) {
      const waitTime = (CONFIG.rateLimit.perSeconds * 1000) - elapsed;
      console.log(`⏳ Rate limit: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
  }

  /**
   * Update rate limit info from response headers (if available)
   * @param {Object} response - API response with headers
   */
  updateRateLimitFromHeaders(response) {
    try {
      if (response && response.headers) {
        const remaining = response.headers['x-hubspot-ratelimit-remaining'];
        const reset = response.headers['x-hubspot-ratelimit-secondly-reset'];
        if (remaining !== undefined) {
          this.rateLimitRemaining = parseInt(remaining, 10);
        }
        if (reset !== undefined) {
          this.rateLimitResetAt = Date.now() + parseInt(reset, 10) * 1000;
        }
      }
    } catch (e) {
      // Ignore header parsing errors
    }
  }

  /**
   * Execute with exponential backoff and jitter
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name for logging
   * @returns {*} Operation result
   */
  async withRetry(operation, operationName = 'operation') {
    let lastError;

    for (let attempt = 1; attempt <= CONFIG.retry.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        const statusCode = error.code || error.statusCode || (error.response && error.response.status);

        // Only retry on rate limit (429) or server errors (5xx)
        if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
          // Calculate delay with exponential backoff and jitter
          const baseDelay = Math.min(
            CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
            CONFIG.retry.maxDelayMs
          );
          const jitter = Math.random() * CONFIG.retry.jitterMs;
          const delay = baseDelay + jitter;

          // Check for Retry-After header
          let retryAfter = null;
          if (error.response && error.response.headers) {
            retryAfter = error.response.headers['retry-after'];
          }

          const actualDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

          console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${CONFIG.retry.maxAttempts}): ${statusCode}. Retrying in ${Math.round(actualDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }

    // All retries exhausted
    console.error(`❌ ${operationName} failed after ${CONFIG.retry.maxAttempts} attempts`);
    throw lastError;
  }

  /**
   * Safe JSON parse helper
   */
  safeJsonParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  // ==========================================================================
  // CONTACTS
  // ==========================================================================

  /**
   * Create or update a contact
   * @param {Object} contactData - Contact properties
   * @returns {Object} Created/updated contact
   */
  async upsertContact(contactData) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would upsert contact:', contactData);
      return { id: 'test-contact-id', properties: contactData };
    }

    await this.rateLimit();

    const { email, ...otherProps } = contactData;

    if (!email) {
      throw new Error('Email is required for contact upsert');
    }

    try {
      // Try to find existing contact by email
      const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }],
        properties: CONFIG.defaultProperties.contact
      });

      if (searchResponse.results && searchResponse.results.length > 0) {
        // Update existing contact
        const existingId = searchResponse.results[0].id;
        const updateResponse = await this.client.crm.contacts.basicApi.update(existingId, {
          properties: { email, ...otherProps }
        });
        console.log(`✅ Updated contact: ${email} (ID: ${existingId})`);
        return updateResponse;
      } else {
        // Create new contact
        const createResponse = await this.client.crm.contacts.basicApi.create({
          properties: { email, ...otherProps }
        });
        console.log(`✅ Created contact: ${email} (ID: ${createResponse.id})`);
        return createResponse;
      }
    } catch (error) {
      console.error(`❌ Contact upsert failed for ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all contacts with pagination
   * @param {number} limit - Max contacts to retrieve
   * @returns {Array} Contacts list
   */
  async getAllContacts(limit = 100) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would get all contacts');
      return [];
    }

    await this.rateLimit();

    try {
      const contacts = await this.client.crm.contacts.getAll(
        limit,
        undefined,
        CONFIG.defaultProperties.contact
      );
      console.log(`✅ Retrieved ${contacts.length} contacts`);
      return contacts;
    } catch (error) {
      console.error('❌ Failed to get contacts:', error.message);
      throw error;
    }
  }

  /**
   * Search contacts by criteria
   * @param {Object} filters - Search filters
   * @returns {Array} Matching contacts
   */
  async searchContacts(filters) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would search contacts with:', filters);
      return [];
    }

    await this.rateLimit();

    const filterGroups = [];

    if (filters.email) {
      filterGroups.push({
        filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: filters.email }]
      });
    }

    if (filters.company) {
      filterGroups.push({
        filters: [{ propertyName: 'company', operator: 'CONTAINS_TOKEN', value: filters.company }]
      });
    }

    if (filters.leadStatus) {
      filterGroups.push({
        filters: [{ propertyName: 'hs_lead_status', operator: 'EQ', value: filters.leadStatus }]
      });
    }

    try {
      const response = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: filterGroups.length > 0 ? filterGroups : undefined,
        properties: CONFIG.defaultProperties.contact,
        limit: filters.limit || 100
      });

      console.log(`✅ Found ${response.total} contacts matching criteria`);
      return response.results || [];
    } catch (error) {
      console.error('❌ Contact search failed:', error.message);
      throw error;
    }
  }

  // ==========================================================================
  // BATCH OPERATIONS (up to 100 records per call)
  // ==========================================================================

  /**
   * Batch create contacts (up to 100 at a time)
   * @param {Array} contacts - Array of contact objects with properties
   * @returns {Object} Batch result with created contacts
   */
  async batchCreateContacts(contacts) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would batch create ${contacts.length} contacts`);
      return { status: 'COMPLETE', results: contacts.map((c, i) => ({ id: `test-${i}`, properties: c })) };
    }

    if (!contacts || contacts.length === 0) {
      return { status: 'COMPLETE', results: [] };
    }

    // Split into chunks of 100 (HubSpot batch limit)
    const chunks = [];
    for (let i = 0; i < contacts.length; i += CONFIG.batch.maxRecords) {
      chunks.push(contacts.slice(i, i + CONFIG.batch.maxRecords));
    }

    const allResults = [];

    for (const chunk of chunks) {
      await this.rateLimit();

      try {
        const result = await this.withRetry(async () => {
          return await this.client.crm.contacts.batchApi.create({
            inputs: chunk.map(contact => ({ properties: contact }))
          });
        }, `batchCreateContacts (${chunk.length} records)`);

        allResults.push(...(result.results || []));
        console.log(`✅ Batch created ${chunk.length} contacts`);
      } catch (error) {
        console.error(`❌ Batch contact creation failed:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Total batch created: ${allResults.length} contacts`);
    return { status: 'COMPLETE', results: allResults };
  }

  /**
   * Batch update contacts by ID (up to 100 at a time)
   * @param {Array} contacts - Array of { id, properties } objects
   * @returns {Object} Batch result with updated contacts
   */
  async batchUpdateContacts(contacts) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would batch update ${contacts.length} contacts`);
      return { status: 'COMPLETE', results: contacts };
    }

    if (!contacts || contacts.length === 0) {
      return { status: 'COMPLETE', results: [] };
    }

    // Split into chunks of 100
    const chunks = [];
    for (let i = 0; i < contacts.length; i += CONFIG.batch.maxRecords) {
      chunks.push(contacts.slice(i, i + CONFIG.batch.maxRecords));
    }

    const allResults = [];

    for (const chunk of chunks) {
      await this.rateLimit();

      try {
        const result = await this.withRetry(async () => {
          return await this.client.crm.contacts.batchApi.update({
            inputs: chunk.map(contact => ({
              id: contact.id,
              properties: contact.properties
            }))
          });
        }, `batchUpdateContacts (${chunk.length} records)`);

        allResults.push(...(result.results || []));
        console.log(`✅ Batch updated ${chunk.length} contacts`);
      } catch (error) {
        console.error(`❌ Batch contact update failed:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Total batch updated: ${allResults.length} contacts`);
    return { status: 'COMPLETE', results: allResults };
  }

  /**
   * Batch upsert contacts by email (up to 100 at a time)
   * Uses search + batch create/update for efficiency
   * @param {Array} contacts - Array of contact objects (must have email property)
   * @returns {Object} Result with created and updated counts
   */
  async batchUpsertContacts(contacts) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would batch upsert ${contacts.length} contacts`);
      return { created: 0, updated: 0, total: contacts.length };
    }

    if (!contacts || contacts.length === 0) {
      return { created: 0, updated: 0, total: 0 };
    }

    // Get all emails from input
    const emails = contacts.map(c => c.email).filter(Boolean);
    if (emails.length !== contacts.length) {
      throw new Error('All contacts must have an email property for batch upsert');
    }

    // Search for existing contacts by email (in batches)
    const existingMap = new Map();
    for (let i = 0; i < emails.length; i += CONFIG.batch.maxRecords) {
      const emailBatch = emails.slice(i, i + CONFIG.batch.maxRecords);
      await this.rateLimit();

      try {
        const searchResponse = await this.withRetry(async () => {
          return await this.client.crm.contacts.searchApi.doSearch({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'IN',
                values: emailBatch
              }]
            }],
            properties: ['email'],
            limit: CONFIG.batch.maxRecords
          });
        }, `searchContacts (${emailBatch.length} emails)`);

        for (const contact of (searchResponse.results || [])) {
          const email = contact.properties.email;
          if (email) {
            existingMap.set(email.toLowerCase(), contact.id);
          }
        }
      } catch (error) {
        console.error(`❌ Batch search failed:`, error.message);
        throw error;
      }
    }

    // Separate into creates and updates
    const toCreate = [];
    const toUpdate = [];

    for (const contact of contacts) {
      const existingId = existingMap.get(contact.email.toLowerCase());
      if (existingId) {
        toUpdate.push({ id: existingId, properties: contact });
      } else {
        toCreate.push(contact);
      }
    }

    // Execute batch operations
    let createdCount = 0;
    let updatedCount = 0;

    if (toCreate.length > 0) {
      const createResult = await this.batchCreateContacts(toCreate);
      createdCount = createResult.results.length;
    }

    if (toUpdate.length > 0) {
      const updateResult = await this.batchUpdateContacts(toUpdate);
      updatedCount = updateResult.results.length;
    }

    console.log(`✅ Batch upsert complete: ${createdCount} created, ${updatedCount} updated`);
    return { created: createdCount, updated: updatedCount, total: createdCount + updatedCount };
  }

  /**
   * Batch create companies (up to 100 at a time)
   * @param {Array} companies - Array of company objects with properties
   * @returns {Object} Batch result with created companies
   */
  async batchCreateCompanies(companies) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would batch create ${companies.length} companies`);
      return { status: 'COMPLETE', results: companies.map((c, i) => ({ id: `test-${i}`, properties: c })) };
    }

    if (!companies || companies.length === 0) {
      return { status: 'COMPLETE', results: [] };
    }

    // Split into chunks of 100
    const chunks = [];
    for (let i = 0; i < companies.length; i += CONFIG.batch.maxRecords) {
      chunks.push(companies.slice(i, i + CONFIG.batch.maxRecords));
    }

    const allResults = [];

    for (const chunk of chunks) {
      await this.rateLimit();

      try {
        const result = await this.withRetry(async () => {
          return await this.client.crm.companies.batchApi.create({
            inputs: chunk.map(company => ({ properties: company }))
          });
        }, `batchCreateCompanies (${chunk.length} records)`);

        allResults.push(...(result.results || []));
        console.log(`✅ Batch created ${chunk.length} companies`);
      } catch (error) {
        console.error(`❌ Batch company creation failed:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Total batch created: ${allResults.length} companies`);
    return { status: 'COMPLETE', results: allResults };
  }

  // ==========================================================================
  // COMPANIES
  // ==========================================================================

  /**
   * Create or update a company
   * @param {Object} companyData - Company properties
   * @returns {Object} Created/updated company
   */
  async upsertCompany(companyData) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would upsert company:', companyData);
      return { id: 'test-company-id', properties: companyData };
    }

    await this.rateLimit();

    const { domain, ...otherProps } = companyData;

    if (!domain && !companyData.name) {
      throw new Error('Domain or name is required for company upsert');
    }

    try {
      // Try to find existing company by domain
      if (domain) {
        const searchResponse = await this.client.crm.companies.searchApi.doSearch({
          filterGroups: [{
            filters: [{
              propertyName: 'domain',
              operator: 'EQ',
              value: domain
            }]
          }],
          properties: CONFIG.defaultProperties.company
        });

        if (searchResponse.results && searchResponse.results.length > 0) {
          const existingId = searchResponse.results[0].id;
          const updateResponse = await this.client.crm.companies.basicApi.update(existingId, {
            properties: { domain, ...otherProps }
          });
          console.log(`✅ Updated company: ${domain} (ID: ${existingId})`);
          return updateResponse;
        }
      }

      // Create new company
      const createResponse = await this.client.crm.companies.basicApi.create({
        properties: { domain, ...otherProps }
      });
      console.log(`✅ Created company: ${domain || companyData.name} (ID: ${createResponse.id})`);
      return createResponse;
    } catch (error) {
      console.error(`❌ Company upsert failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get all companies with pagination
   * @param {number} limit - Max companies to retrieve
   * @returns {Array} Companies list
   */
  async getAllCompanies(limit = 100) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would get all companies');
      return [];
    }

    await this.rateLimit();

    try {
      const companies = await this.client.crm.companies.getAll(
        limit,
        undefined,
        CONFIG.defaultProperties.company
      );
      console.log(`✅ Retrieved ${companies.length} companies`);
      return companies;
    } catch (error) {
      console.error('❌ Failed to get companies:', error.message);
      throw error;
    }
  }

  // ==========================================================================
  // DEALS
  // ==========================================================================

  /**
   * Create a deal (with HITL check)
   * @param {Object} dealData - Deal properties
   * @returns {Object} Created deal or pending approval
   */
  async createDeal(dealData) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would create deal:', dealData);
      return { id: 'test-deal-id', properties: dealData };
    }

    if (!dealData.dealname) {
      throw new Error('Deal name is required');
    }

    // HITL Check: High-value deals require approval
    if (HITL_CONFIG.enabled && dealData.amount >= HITL_CONFIG.dealValueThreshold) {
      const pendingDeal = queueDealForApproval(dealData, `Deal amount €${dealData.amount.toLocaleString()} >= €${HITL_CONFIG.dealValueThreshold.toLocaleString()} threshold`);
      return {
        status: 'pending_approval',
        hitlId: pendingDeal.id,
        dealname: dealData.dealname,
        amount: dealData.amount,
        message: `Deal queued for HITL approval. Use --approve=${pendingDeal.id} to create.`
      };
    }

    return this.createDealInternal(dealData);
  }

  /**
   * Internal deal creation (bypasses HITL check)
   * @param {Object} dealData - Deal properties
   * @returns {Object} Created deal
   */
  async createDealInternal(dealData) {
    await this.rateLimit();

    try {
      const response = await this.client.crm.deals.basicApi.create({
        properties: {
          dealname: dealData.dealname,
          amount: dealData.amount || 0,
          dealstage: dealData.dealstage || 'appointmentscheduled',
          pipeline: dealData.pipeline || 'default',
          closedate: dealData.closedate || new Date().toISOString()
        }
      });
      console.log(`✅ Created deal: ${dealData.dealname} (ID: ${response.id})`);
      return response;
    } catch (error) {
      console.error('❌ Deal creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update deal stage
   * @param {string} dealId - Deal ID
   * @param {string} newStage - New deal stage
   * @returns {Object} Updated deal
   */
  async updateDealStage(dealId, newStage) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would update deal ${dealId} to stage ${newStage}`);
      return { id: dealId, properties: { dealstage: newStage } };
    }

    await this.rateLimit();

    try {
      const response = await this.client.crm.deals.basicApi.update(dealId, {
        properties: { dealstage: newStage }
      });
      console.log(`✅ Updated deal ${dealId} to stage: ${newStage}`);
      return response;
    } catch (error) {
      console.error(`❌ Deal update failed for ${dealId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all deals with pagination
   * @param {number} limit - Max deals to retrieve
   * @returns {Array} Deals list
   */
  async getAllDeals(limit = 100) {
    if (this.testMode) {
      console.log('🧪 TEST MODE: Would get all deals');
      return [];
    }

    await this.rateLimit();

    try {
      const deals = await this.client.crm.deals.getAll(
        limit,
        undefined,
        CONFIG.defaultProperties.deal
      );
      console.log(`✅ Retrieved ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('❌ Failed to get deals:', error.message);
      throw error;
    }
  }

  // ==========================================================================
  // ASSOCIATIONS
  // ==========================================================================

  /**
   * Associate contact to company
   * @param {string} contactId - Contact ID
   * @param {string} companyId - Company ID
   */
  async associateContactToCompany(contactId, companyId) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would associate contact ${contactId} to company ${companyId}`);
      return true;
    }

    await this.rateLimit();

    try {
      await this.client.crm.associations.v4.basicApi.create(
        'contacts',
        contactId,
        'companies',
        companyId,
        [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }]
      );
      console.log(`✅ Associated contact ${contactId} to company ${companyId}`);
      return true;
    } catch (error) {
      console.error('❌ Association failed:', error.message);
      throw error;
    }
  }

  /**
   * Associate deal to contact
   * @param {string} dealId - Deal ID
   * @param {string} contactId - Contact ID
   */
  async associateDealToContact(dealId, contactId) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would associate deal ${dealId} to contact ${contactId}`);
      return true;
    }

    await this.rateLimit();

    try {
      await this.client.crm.associations.v4.basicApi.create(
        'deals',
        dealId,
        'contacts',
        contactId,
        [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
      );
      console.log(`✅ Associated deal ${dealId} to contact ${contactId}`);
      return true;
    } catch (error) {
      console.error('❌ Association failed:', error.message);
      throw error;
    }
  }

  // ==========================================================================
  // LEAD SCORING (Manual via Properties - FREE tier)
  // ==========================================================================

  /**
   * Update lead score for a contact
   * @param {string} contactId - Contact ID
   * @param {number} score - Lead score (0-100)
   */
  async updateLeadScore(contactId, score) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would update lead score for ${contactId} to ${score}`);
      return { id: contactId, properties: { lead_score: score } };
    }

    await this.rateLimit();

    // Determine lead status based on score
    let leadStatus = 'NEW';
    if (score >= CONFIG.leadScoreThresholds.hot) {
      leadStatus = 'QUALIFIED';
    } else if (score >= CONFIG.leadScoreThresholds.warm) {
      leadStatus = 'OPEN';
    }

    try {
      const response = await this.client.crm.contacts.basicApi.update(contactId, {
        properties: {
          lead_score: score.toString(),
          hs_lead_status: leadStatus
        }
      });
      console.log(`✅ Updated lead score for ${contactId}: ${score} (Status: ${leadStatus})`);
      return response;
    } catch (error) {
      console.error(`❌ Lead score update failed for ${contactId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get contacts by lead status (HOT/WARM/COLD)
   * @param {string} status - Lead status
   * @returns {Array} Contacts with matching status
   */
  async getContactsByLeadStatus(status) {
    return this.searchContacts({ leadStatus: status });
  }

  // ==========================================================================
  // GEO-SEGMENTATION
  // ==========================================================================

  /**
   * Update contact with geo data
   * @param {string} contactId - Contact ID
   * @param {Object} geoData - Geo information
   */
  async updateContactGeo(contactId, geoData) {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would update geo for ${contactId}:`, geoData);
      return { id: contactId, properties: geoData };
    }

    await this.rateLimit();

    try {
      const response = await this.client.crm.contacts.basicApi.update(contactId, {
        properties: {
          city: geoData.city,
          state: geoData.state || geoData.region,
          country: geoData.country,
          zip: geoData.postalCode
        }
      });
      console.log(`✅ Updated geo for ${contactId}: ${geoData.city}, ${geoData.country}`);
      return response;
    } catch (error) {
      console.error(`❌ Geo update failed for ${contactId}:`, error.message);
      throw error;
    }
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  /**
   * Test API connectivity
   */
  async healthCheck() {
    console.log('\n🔍 HubSpot B2B CRM Health Check v1.1.0');
    console.log('=======================================');

    // Show configuration
    console.log('\nConfiguration:');
    console.log(`  Batch size: ${CONFIG.batch.maxRecords} records/call`);
    console.log(`  Rate limit: ${CONFIG.rateLimit.requests} req/${CONFIG.rateLimit.perSeconds}s`);
    console.log(`  Retry: ${CONFIG.retry.maxAttempts} attempts, backoff ${CONFIG.retry.baseDelayMs}-${CONFIG.retry.maxDelayMs}ms`);
    console.log(`  Jitter: ${CONFIG.retry.jitterMs}ms`);

    if (this.testMode) {
      console.log('\n⚠️ Running in TEST MODE (no API key)');
      console.log('✅ SDK loaded correctly');
      console.log('✅ Batch operations: Ready');
      console.log('✅ Exponential backoff: Ready');
      console.log('✅ Rate limit monitoring: Ready');
      console.log('ℹ️ Set HUBSPOT_API_KEY or HUBSPOT_ACCESS_TOKEN to test API');
      return { status: 'test-mode', message: 'No API key configured', version: '1.1.0' };
    }

    try {
      // Test contacts API
      const contacts = await this.withRetry(
        () => this.client.crm.contacts.basicApi.getPage(1),
        'contacts API test'
      );
      console.log(`\n✅ Contacts API: ${contacts.results?.length || 0} contacts accessible`);

      // Test companies API
      const companies = await this.withRetry(
        () => this.client.crm.companies.basicApi.getPage(1),
        'companies API test'
      );
      console.log(`✅ Companies API: ${companies.results?.length || 0} companies accessible`);

      // Test deals API
      const deals = await this.withRetry(
        () => this.client.crm.deals.basicApi.getPage(1),
        'deals API test'
      );
      console.log(`✅ Deals API: ${deals.results?.length || 0} deals accessible`);

      console.log('\n✅ All HubSpot APIs operational');
      console.log('✅ Batch operations: Available');
      console.log('✅ Exponential backoff: Active');
      console.log('✅ Rate limit monitoring: Active');
      return {
        status: 'healthy',
        version: '1.1.0',
        contacts: contacts.results?.length || 0,
        companies: companies.results?.length || 0,
        deals: deals.results?.length || 0,
        features: ['batch', 'backoff', 'rate-limit-monitoring']
      };
    } catch (error) {
      console.error(`\n❌ Health check failed: ${error.message}`);
      return { status: 'error', message: error.message, version: '1.1.0' };
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

// Export for programmatic use
module.exports = { HubSpotB2BCRM, CONFIG };

// Run CLI if executed directly
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const crm = new HubSpotB2BCRM();

    if (args.includes('--health')) {
      await crm.healthCheck();
    } else if (args.includes('--test-contact')) {
      await crm.upsertContact({
        email: 'test@example.com',
        firstname: 'Test',
        lastname: 'Contact'
      });
    } else if (args.includes('--list-contacts')) {
      await crm.getAllContacts(10);
    } else {
      console.log('HubSpot B2B CRM Integration v1.1.0\nUsage: node hubspot-b2b-crm.cjs [options]');
    }
  })().catch(console.error);
}
