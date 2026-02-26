'use strict';

/**
 * Outbound Webhook Dispatcher — Multi-Tenant
 * VocalIA — Session 250.239
 *
 * Fires events to client-configured webhook endpoints.
 * Events: lead.qualified, call.completed, call.started, conversation.ended,
 *         cart.abandoned, appointment.booked, quota.warning
 *
 * Security: HMAC-SHA256 signature (X-VocalIA-Signature), idempotency keys,
 *           retry with exponential backoff (3 attempts).
 *
 * Used by: voice-api-resilient.cjs, voice-telephony-bridge.cjs, db-api.cjs
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VALID_EVENTS = [
  'lead.qualified',
  'call.started',
  'call.completed',
  'conversation.ended',
  'cart.abandoned',
  'appointment.booked',
  'quota.warning',
  'tenant.provisioned'
];

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // 1s, 2s, 4s exponential backoff
const TIMEOUT_MS = 10000;   // 10s per attempt

/**
 * Load webhook config for a tenant.
 * Checks clients/{tenantId}/config.json for webhook_url, webhook_secret, webhook_events.
 * Falls back to GoogleSheetsDB tenant record.
 */
function getWebhookConfig(tenantId) {
  if (!tenantId || tenantId === 'default') return null;

  try {
    // Sanitize tenantId to prevent path traversal (e.g., '../../../etc/passwd')
    const safeTenantId = (tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    const configPath = path.join(__dirname, '..', 'clients', safeTenantId, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.webhook_url) {
        return {
          url: config.webhook_url,
          secret: config.webhook_secret || null,
          events: config.webhook_events || VALID_EVENTS
        };
      }
    }
  } catch (_e) {
    // Fall through to return null
  }

  return null;
}

/**
 * Sign payload with HMAC-SHA256 using tenant's webhook secret.
 */
function signPayload(payload, secret) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Dispatch a webhook event to a tenant's configured endpoint.
 * Non-blocking (fire-and-forget with retries).
 *
 * @param {string} tenantId - Tenant identifier
 * @param {string} event - Event type (e.g. 'lead.qualified')
 * @param {object} data - Event payload
 */
async function dispatch(tenantId, event, data = {}) {
  if (!VALID_EVENTS.includes(event)) {
    console.warn(`⚠️ [Webhook] Invalid event type: ${event}`);
    return;
  }

  const webhookConfig = getWebhookConfig(tenantId);
  if (!webhookConfig) return; // No webhook configured — silent no-op

  // Check if tenant subscribed to this event type
  if (webhookConfig.events && !webhookConfig.events.includes(event)) return;

  const idempotencyKey = `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const timestamp = new Date().toISOString();

  const payload = JSON.stringify({
    id: idempotencyKey,
    event,
    tenant_id: tenantId,
    timestamp,
    data
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-VocalIA-Event': event,
    'X-VocalIA-Timestamp': timestamp,
    'X-VocalIA-Idempotency-Key': idempotencyKey,
    'User-Agent': 'VocalIA-Webhook/1.0'
  };

  if (webhookConfig.secret) {
    headers['X-VocalIA-Signature'] = signPayload(payload, webhookConfig.secret);
  }

  // Fire with retries (non-blocking)
  _sendWithRetry(webhookConfig.url, payload, headers, tenantId, event, 0);
}

/**
 * Send webhook with exponential backoff retries.
 */
async function _sendWithRetry(url, payload, headers, tenantId, event, attempt) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log(`✅ [Webhook] ${event} → ${tenantId} (${response.status})`);
    } else if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
      // Retry on 5xx errors
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(`⚠️ [Webhook] ${event} → ${tenantId}: ${response.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      setTimeout(() => _sendWithRetry(url, payload, headers, tenantId, event, attempt + 1), delay);
    } else {
      console.error(`❌ [Webhook] ${event} → ${tenantId}: ${response.status} (final)`);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(`⚠️ [Webhook] ${event} → ${tenantId}: ${err.message}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      setTimeout(() => _sendWithRetry(url, payload, headers, tenantId, event, attempt + 1), delay);
    } else {
      console.error(`❌ [Webhook] ${event} → ${tenantId}: ${err.message} (final after ${MAX_RETRIES} attempts)`);
    }
  }
}

module.exports = {
  dispatch,
  getWebhookConfig,
  signPayload,
  VALID_EVENTS
};
