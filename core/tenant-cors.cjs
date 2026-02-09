'use strict';

/**
 * Shared Tenant CORS + Origin Validation
 * VocalIA — Session 250.174
 *
 * Single source of truth for:
 *   - Loading tenant registry from client_registry.json
 *   - Origin↔tenant validation
 *   - API key validation (timing-safe)
 *   - CORS headers generation
 *
 * Used by: voice-api-resilient.cjs, db-api.cjs
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TENANT_ORIGINS_TTL = 300000; // 5 minutes
const VOCALIA_ORIGINS = [
  'https://vocalia.ma',
  'https://www.vocalia.ma',
  'https://api.vocalia.ma',
  'https://app.vocalia.ma'
];

let _tenantRegistry = null;
let _tenantOrigins = new Set();
let _lastLoad = 0;

function loadTenantOrigins() {
  try {
    const registryPath = path.join(__dirname, '..', 'personas', 'client_registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    _tenantRegistry = registry.clients || {};
    const origins = new Set();
    for (const [, client] of Object.entries(_tenantRegistry)) {
      if (client.allowed_origins) {
        for (const o of client.allowed_origins) {
          origins.add(o.replace(/\/$/, ''));
        }
      }
    }
    _tenantOrigins = origins;
    _lastLoad = Date.now();
    if (origins.size > 0) {
      console.log(`✅ [CORS] Loaded ${origins.size} tenant origins from registry`);
    }
  } catch (err) {
    console.warn('[CORS] Could not load tenant origins:', err.message);
  }
}

// Load on startup
loadTenantOrigins();

function _ensureFresh() {
  if (Date.now() - _lastLoad > TENANT_ORIGINS_TTL) {
    loadTenantOrigins();
  }
}

/**
 * Check if an origin is allowed (internal, local dev, or tenant-registered).
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  if (VOCALIA_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vocalia.ma')) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  _ensureFresh();
  if (_tenantOrigins.has(origin)) return true;
  return false;
}

/**
 * Validate that a request origin matches the tenant_id's allowed_origins.
 * Prevents tenant A from spoofing tenant B's tenant_id.
 */
function validateOriginTenant(origin, tenantId) {
  if (!tenantId || tenantId === 'default') return { valid: true };
  if (!origin) return { valid: true }; // Server-to-server
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return { valid: true };
  if (VOCALIA_ORIGINS.includes(origin) || origin.endsWith('.vocalia.ma')) return { valid: true };

  _ensureFresh();
  if (!_tenantRegistry) {
    console.warn('⚠️ [Security] Tenant registry not loaded — origin validation skipped');
    return { valid: true };
  }
  const client = _tenantRegistry[tenantId];
  if (!client) return { valid: false, reason: 'unknown_tenant' };
  if (!client.allowed_origins || client.allowed_origins.length === 0) return { valid: true };
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (client.allowed_origins.some(o => o.replace(/\/$/, '') === normalizedOrigin)) return { valid: true };
  return { valid: false, reason: 'origin_mismatch' };
}

/**
 * Validate API key for a tenant (timing-safe comparison).
 */
function validateApiKey(apiKey, tenantId) {
  if (!apiKey) return { valid: true }; // API key optional (backward compat)
  if (!tenantId || tenantId === 'default') return { valid: true };

  _ensureFresh();
  if (!_tenantRegistry) return { valid: true };
  const client = _tenantRegistry[tenantId];
  if (!client) return { valid: false, reason: 'unknown_tenant' };
  if (!client.api_key) return { valid: true }; // No key configured
  if (client.api_key.length === apiKey.length && crypto.timingSafeEqual(Buffer.from(client.api_key), Buffer.from(apiKey))) return { valid: true };
  return { valid: false, reason: 'invalid_api_key' };
}

/**
 * Get CORS headers for a request.
 */
function getCorsHeaders(req) {
  const origin = req?.headers?.origin || '';
  const isAllowed = isOriginAllowed(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : VOCALIA_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

/**
 * Get the tenant registry (for inline API key checks).
 */
function getRegistry() {
  _ensureFresh();
  return _tenantRegistry;
}

module.exports = {
  loadTenantOrigins,
  isOriginAllowed,
  validateOriginTenant,
  validateApiKey,
  getCorsHeaders,
  getRegistry,
  VOCALIA_ORIGINS
};
