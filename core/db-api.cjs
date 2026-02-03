'use strict';

/**
 * VocalIA Database API
 * REST API for Google Sheets Database + Authentication
 *
 * Auth Endpoints:
 * - POST   /api/auth/register       - Register new user
 * - POST   /api/auth/login          - Login and get tokens
 * - POST   /api/auth/logout         - Logout (invalidate refresh token)
 * - POST   /api/auth/refresh        - Refresh access token
 * - POST   /api/auth/forgot         - Request password reset
 * - POST   /api/auth/reset          - Reset password with token
 * - POST   /api/auth/verify-email   - Verify email with token
 * - GET    /api/auth/me             - Get current user
 * - PUT    /api/auth/me             - Update profile
 * - PUT    /api/auth/password       - Change password
 *
 * DB Endpoints:
 * - GET    /api/db/:sheet           - List all records
 * - GET    /api/db/:sheet/:id       - Get single record
 * - POST   /api/db/:sheet           - Create record
 * - PUT    /api/db/:sheet/:id       - Update record
 * - DELETE /api/db/:sheet/:id       - Delete record
 * - GET    /api/db/:sheet/query     - Query with filters
 * - GET    /api/db/health           - Health check
 *
 * @port 3013
 * Session 250.55: Added authentication endpoints
 */

const http = require('http');
const url = require('url');
const { WebSocketServer } = require('ws');
const { getDB } = require('./GoogleSheetsDB.cjs');
const authService = require('./auth-service.cjs');
const { requireAuth, requireAdmin, rateLimit, extractToken } = require('./auth-middleware.cjs');

// Session 250.57: Audit trail for compliance
const { getInstance: getAuditStore, ACTION_CATEGORIES } = require('./audit-store.cjs');
const auditStore = getAuditStore();

// Session 250.57: Conversation store for export/history
const { getInstance: getConversationStore, TELEPHONY_RETENTION_DAYS } = require('./conversation-store.cjs');
const conversationStore = getConversationStore();

// WebSocket clients store
const wsClients = new Map(); // Map<WebSocket, { user, channels: Set<string> }>

/**
 * Broadcast message to all clients subscribed to a channel
 * @param {string} channel - Channel name (hitl, logs, stats, etc.)
 * @param {string} event - Event type (created, updated, deleted, etc.)
 * @param {Object} data - Event data
 */
function broadcast(channel, event, data) {
  const message = JSON.stringify({
    channel,
    event,
    data,
    timestamp: new Date().toISOString()
  });

  wsClients.forEach((clientData, ws) => {
    if (ws.readyState === 1 && clientData.channels.has(channel)) {
      try {
        ws.send(message);
      } catch (e) {
        console.error('❌ [WS] Broadcast error:', e.message);
      }
    }
  });
}

/**
 * Broadcast to specific tenant only
 */
function broadcastToTenant(tenantId, channel, event, data) {
  const message = JSON.stringify({
    channel,
    event,
    data,
    timestamp: new Date().toISOString()
  });

  wsClients.forEach((clientData, ws) => {
    if (ws.readyState === 1 &&
        clientData.channels.has(channel) &&
        (clientData.user?.role === 'admin' || clientData.user?.tenant_id === tenantId)) {
      try {
        ws.send(message);
      } catch (e) {
        console.error('❌ [WS] Broadcast error:', e.message);
      }
    }
  });
}

const PORT = process.env.DB_API_PORT || 3013;
const ALLOWED_SHEETS = ['tenants', 'sessions', 'logs', 'users', 'auth_sessions', 'hitl_pending', 'hitl_history'];

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }); // 5 per 15min
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 }); // 3 per hour
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 per minute

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Rate limiter for DB endpoints
const dbLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 per minute

/**
 * Check authentication (returns user or null)
 * @returns {Object|null} User object or null if not authenticated
 */
async function checkAuth(req, res) {
  const token = extractToken(req);
  if (!token) {
    sendError(res, 401, 'Authorization required');
    return null;
  }
  try {
    const decoded = authService.verifyToken(token);
    return decoded;
  } catch (e) {
    sendError(res, 401, 'Invalid or expired token');
    return null;
  }
}

/**
 * Check admin role (returns user or null)
 * @returns {Object|null} User object or null if not admin
 */
async function checkAdmin(req, res) {
  const user = await checkAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendError(res, 403, 'Admin access required');
    return null;
  }
  return user;
}

/**
 * Filter sensitive fields from user records
 */
function filterUserRecord(record) {
  if (!record) return record;
  const { password_hash, password_reset_token, password_reset_expires, email_verify_token, email_verify_expires, ...safe } = record;
  return safe;
}

/**
 * Filter sensitive fields from array of user records
 */
function filterUserRecords(records) {
  return records.map(filterUserRecord);
}

/**
 * Parse JSON body
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

/**
 * Handle Auth Endpoints
 */
async function handleAuthRequest(req, res, path, method) {
  try {
    const body = method !== 'GET' ? await parseBody(req) : {};

    // POST /api/auth/register
    if (path === '/api/auth/register' && method === 'POST') {
      // Apply rate limiting
      const rateLimited = await applyRateLimit(req, res, registerLimiter);
      if (rateLimited) return true;

      const { email, password, name, tenant_id } = body;
      if (!email || !password) {
        sendError(res, 400, 'Email and password required');
        return true;
      }

      const result = await authService.register({ email, password, name, tenantId: tenant_id });
      sendJson(res, 201, {
        success: true,
        message: 'Registration successful. Please verify your email.',
        user: result
      });
      return true;
    }

    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;

      const { email, password, remember_me } = body;
      if (!email || !password) {
        sendError(res, 400, 'Email and password required');
        return true;
      }

      try {
        const result = await authService.login({ email, password, rememberMe: remember_me });

        // Session 250.57: Audit log successful login
        const tenantId = result.user?.tenant_id || 'default';
        auditStore.log(tenantId, {
          action: ACTION_CATEGORIES.AUTH_LOGIN,
          actor: result.user?.id || email,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          outcome: 'success',
          details: { email }
        });

        sendJson(res, 200, result);
      } catch (err) {
        // Audit log failed login
        auditStore.log('default', {
          action: ACTION_CATEGORIES.AUTH_FAILED,
          actor: email,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          outcome: 'failure',
          details: { email, reason: err.message }
        });
        throw err;
      }
      return true;
    }

    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const { refresh_token } = body;
      await authService.logout(refresh_token);

      // Session 250.57: Audit log logout
      const user = req.user; // May be set by auth middleware
      if (user) {
        auditStore.log(user.tenant_id || 'default', {
          action: ACTION_CATEGORIES.AUTH_LOGOUT,
          actor: user.id,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          outcome: 'success'
        });
      }

      sendJson(res, 200, { success: true, message: 'Logged out successfully' });
      return true;
    }

    // POST /api/auth/refresh
    if (path === '/api/auth/refresh' && method === 'POST') {
      const { refresh_token } = body;
      if (!refresh_token) {
        sendError(res, 400, 'Refresh token required');
        return true;
      }

      const result = await authService.refreshTokens(refresh_token);
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/forgot
    if (path === '/api/auth/forgot' && method === 'POST') {
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;

      const { email } = body;
      if (!email) {
        sendError(res, 400, 'Email required');
        return true;
      }

      const result = await authService.requestPasswordReset(email);
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/reset
    if (path === '/api/auth/reset' && method === 'POST') {
      const { token, password } = body;
      if (!token || !password) {
        sendError(res, 400, 'Token and new password required');
        return true;
      }

      const result = await authService.resetPassword(token, password);
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/verify-email
    if (path === '/api/auth/verify-email' && method === 'POST') {
      const { token } = body;
      if (!token) {
        sendError(res, 400, 'Verification token required');
        return true;
      }

      const result = await authService.verifyEmail(token);
      sendJson(res, 200, result);
      return true;
    }

    // GET /api/auth/me - Get current user (requires auth)
    if (path === '/api/auth/me' && method === 'GET') {
      const token = extractToken(req);
      if (!token) {
        sendError(res, 401, 'Authorization required');
        return true;
      }

      try {
        const decoded = authService.verifyToken(token);
        const user = await authService.getCurrentUser(decoded.sub);
        sendJson(res, 200, user);
      } catch (e) {
        sendError(res, 401, e.message);
      }
      return true;
    }

    // PUT /api/auth/me - Update profile (requires auth)
    if (path === '/api/auth/me' && method === 'PUT') {
      const token = extractToken(req);
      if (!token) {
        sendError(res, 401, 'Authorization required');
        return true;
      }

      try {
        const decoded = authService.verifyToken(token);
        const user = await authService.updateProfile(decoded.sub, body);
        sendJson(res, 200, user);
      } catch (e) {
        sendError(res, e.status || 400, e.message);
      }
      return true;
    }

    // PUT /api/auth/password - Change password (requires auth)
    if (path === '/api/auth/password' && method === 'PUT') {
      const token = extractToken(req);
      if (!token) {
        sendError(res, 401, 'Authorization required');
        return true;
      }

      const { old_password, new_password } = body;
      if (!old_password || !new_password) {
        sendError(res, 400, 'Old and new password required');
        return true;
      }

      try {
        const decoded = authService.verifyToken(token);
        const result = await authService.changePassword(decoded.sub, old_password, new_password);
        sendJson(res, 200, result);
      } catch (e) {
        sendError(res, e.status || 400, e.message);
      }
      return true;
    }

    return false; // Not an auth route
  } catch (error) {
    console.error(`❌ [Auth] ${method} ${path}:`, error.message);
    if (error instanceof authService.AuthError) {
      sendError(res, error.status, error.message);
    } else {
      sendError(res, 500, error.message);
    }
    return true;
  }
}

/**
 * Apply rate limiting
 */
async function applyRateLimit(req, res, limiter) {
  return new Promise(resolve => {
    limiter(req, res, () => resolve(false));
    // If rate limited, resolve will happen after sendError
    setTimeout(() => resolve(res.writableEnded), 100);
  });
}

/**
 * Handle HITL (Human-in-the-Loop) Endpoints
 * - GET  /api/hitl/pending  - List pending approvals
 * - GET  /api/hitl/history  - List approval history
 * - POST /api/hitl/approve/:id - Approve an item
 * - POST /api/hitl/reject/:id  - Reject an item
 * - GET  /api/hitl/stats    - Get HITL statistics
 */
async function handleHITLRequest(req, res, path, method) {
  try {
    const db = getDB();

    // GET /api/hitl/pending
    if (path === '/api/hitl/pending' && method === 'GET') {
      let pending = [];
      try {
        pending = await db.findAll('hitl_pending');
        // Sort by created_at descending (newest first)
        pending.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } catch (e) {
        // Table might not exist yet
        pending = [];
      }
      sendJson(res, 200, { count: pending.length, data: pending });
      return true;
    }

    // GET /api/hitl/history
    if (path === '/api/hitl/history' && method === 'GET') {
      let history = [];
      try {
        history = await db.findAll('hitl_history');
        history.sort((a, b) => new Date(b.decided_at) - new Date(a.decided_at));
      } catch (e) {
        history = [];
      }
      sendJson(res, 200, { count: history.length, data: history.slice(0, 50) });
      return true;
    }

    // GET /api/hitl/stats
    if (path === '/api/hitl/stats' && method === 'GET') {
      let pending = [], history = [];
      try {
        pending = await db.findAll('hitl_pending');
        history = await db.findAll('hitl_history');
      } catch (e) {
        // Tables might not exist
      }
      const approved = history.filter(h => h.decision === 'approved').length;
      const rejected = history.filter(h => h.decision === 'rejected').length;
      sendJson(res, 200, {
        pending_count: pending.length,
        approved_count: approved,
        rejected_count: rejected,
        total_decided: history.length
      });
      return true;
    }

    // POST /api/hitl/approve/:id
    const approveMatch = path.match(/^\/api\/hitl\/approve\/(\w+)$/);
    if (approveMatch && method === 'POST') {
      const id = approveMatch[1];
      const body = await parseBody(req);
      const admin = body.admin || 'Admin';

      // Find pending item
      let pending;
      try {
        pending = await db.findById('hitl_pending', id);
      } catch (e) {
        sendError(res, 404, 'Pending item not found');
        return true;
      }

      if (!pending) {
        sendError(res, 404, 'Pending item not found');
        return true;
      }

      // Move to history with approved decision
      await db.create('hitl_history', {
        ...pending,
        decision: 'approved',
        decided_by: admin,
        decided_at: new Date().toISOString()
      });

      // Remove from pending
      await db.delete('hitl_pending', id);

      // Broadcast HITL approval
      broadcast('hitl', 'approved', { id, admin, item: pending });

      // Session 250.57: Audit trail for HITL approval
      auditStore.log(pending.tenant_id || 'default', {
        action: ACTION_CATEGORIES.HITL_APPROVE,
        actor: admin,
        actor_type: 'admin',
        resource: `hitl:${id}`,
        details: { type: pending.type, data: pending.data }
      });

      sendJson(res, 200, { success: true, decision: 'approved', id });
      return true;
    }

    // POST /api/hitl/reject/:id
    const rejectMatch = path.match(/^\/api\/hitl\/reject\/(\w+)$/);
    if (rejectMatch && method === 'POST') {
      const id = rejectMatch[1];
      const body = await parseBody(req);
      const admin = body.admin || 'Admin';
      const reason = body.reason || '';

      // Find pending item
      let pending;
      try {
        pending = await db.findById('hitl_pending', id);
      } catch (e) {
        sendError(res, 404, 'Pending item not found');
        return true;
      }

      if (!pending) {
        sendError(res, 404, 'Pending item not found');
        return true;
      }

      // Move to history with rejected decision
      await db.create('hitl_history', {
        ...pending,
        decision: 'rejected',
        decided_by: admin,
        decided_at: new Date().toISOString(),
        rejection_reason: reason
      });

      // Remove from pending
      await db.delete('hitl_pending', id);

      // Broadcast HITL rejection
      broadcast('hitl', 'rejected', { id, admin, reason, item: pending });

      // Session 250.57: Audit trail for HITL rejection
      auditStore.log(pending.tenant_id || 'default', {
        action: ACTION_CATEGORIES.HITL_REJECT,
        actor: admin,
        actor_type: 'admin',
        resource: `hitl:${id}`,
        details: { type: pending.type, reason }
      });

      sendJson(res, 200, { success: true, decision: 'rejected', id });
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ [HITL] ${method} ${path}:`, error.message);
    sendError(res, 500, error.message);
    return true;
  }
}

/**
 * API Router
 */
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Auth endpoints
  if (path.startsWith('/api/auth/')) {
    const handled = await handleAuthRequest(req, res, path, method);
    if (handled) return;
  }

  // HITL Endpoints (ADMIN ONLY)
  if (path.startsWith('/api/hitl/')) {
    const admin = await checkAdmin(req, res);
    if (!admin) return; // Auth error already sent
    const handled = await handleHITLRequest(req, res, path, method);
    if (handled) return;
  }

  // ═══════════════════════════════════════════════════════════════
  // Session 250.45: KB API ENDPOINTS (Per-Tenant Knowledge Base)
  // ═══════════════════════════════════════════════════════════════

  // KB List - GET /api/tenants/:id/kb
  const kbListMatch = path.match(/^\/api\/tenants\/(\w+)\/kb$/);
  if (kbListMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbListMatch[1];

    try {
      const { getInstance } = require('./tenant-kb-loader.cjs');
      const loader = getInstance();
      const lang = query.lang || 'fr';
      const kb = await loader.getKB(tenantId, lang);

      // Remove internal metadata for response
      const entries = Object.entries(kb)
        .filter(([key]) => key !== '__meta')
        .map(([key, value]) => ({ key, ...value }));

      sendJson(res, 200, {
        tenant_id: tenantId,
        language: lang,
        count: entries.length,
        meta: kb.__meta || {},
        entries: entries.slice(0, parseInt(query.limit) || 100)
      });
    } catch (e) {
      sendError(res, 500, `KB error: ${e.message}`);
    }
    return;
  }

  // KB Create/Update - POST /api/tenants/:id/kb
  if (kbListMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbListMatch[1];

    try {
      const body = await parseBody(req);
      const { key, value, language = 'fr' } = body;

      if (!key || !value) {
        sendError(res, 400, 'key and value are required');
        return;
      }

      // Load current KB, add entry, save
      const fs = require('fs');
      const path = require('path');
      const kbDir = path.join(__dirname, '../clients', tenantId, 'knowledge_base');
      const kbFile = path.join(kbDir, `kb_${language}.json`);

      // Ensure directory exists
      if (!fs.existsSync(kbDir)) {
        fs.mkdirSync(kbDir, { recursive: true });
      }

      // Load or create KB
      let kb = {};
      if (fs.existsSync(kbFile)) {
        kb = JSON.parse(fs.readFileSync(kbFile, 'utf8'));
      }

      // Add/update entry
      kb[key] = typeof value === 'object' ? value : { response: value };
      kb.__meta = {
        ...kb.__meta,
        tenant_id: tenantId,
        last_updated: new Date().toISOString()
      };

      // Save
      fs.writeFileSync(kbFile, JSON.stringify(kb, null, 2));

      // Invalidate cache
      const { getInstance } = require('./tenant-kb-loader.cjs');
      getInstance().invalidateCache(tenantId);

      sendJson(res, 201, { success: true, key, language, message: 'KB entry created/updated' });
    } catch (e) {
      sendError(res, 500, `KB write error: ${e.message}`);
    }
    return;
  }

  // KB Delete Entry - DELETE /api/tenants/:id/kb/:key
  const kbDeleteMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/(\w+)$/);
  if (kbDeleteMatch && method === 'DELETE') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbDeleteMatch[1];
    const key = kbDeleteMatch[2];

    try {
      const fs = require('fs');
      const pathModule = require('path');
      const language = query.lang || 'fr';
      const kbFile = pathModule.join(__dirname, '../clients', tenantId, 'knowledge_base', `kb_${language}.json`);

      if (!fs.existsSync(kbFile)) {
        sendError(res, 404, 'KB file not found');
        return;
      }

      const kb = JSON.parse(fs.readFileSync(kbFile, 'utf8'));
      if (!kb[key]) {
        sendError(res, 404, 'KB entry not found');
        return;
      }

      delete kb[key];
      kb.__meta = { ...kb.__meta, last_updated: new Date().toISOString() };
      fs.writeFileSync(kbFile, JSON.stringify(kb, null, 2));

      // Invalidate cache
      const { getInstance } = require('./tenant-kb-loader.cjs');
      getInstance().invalidateCache(tenantId);

      sendJson(res, 200, { success: true, key, message: 'KB entry deleted' });
    } catch (e) {
      sendError(res, 500, `KB delete error: ${e.message}`);
    }
    return;
  }

  // KB Search - GET /api/tenants/:id/kb/search
  const kbSearchMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/search$/);
  if (kbSearchMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbSearchMatch[1];

    try {
      const q = query.q || query.query;
      if (!q) {
        sendError(res, 400, 'query parameter (q) is required');
        return;
      }

      const { getInstance } = require('./tenant-kb-loader.cjs');
      const loader = getInstance();
      const language = query.lang || 'fr';
      const results = await loader.searchKB(tenantId, language, q, { maxResults: 10 });

      sendJson(res, 200, {
        tenant_id: tenantId,
        query: q,
        language,
        count: results.length,
        results
      });
    } catch (e) {
      sendError(res, 500, `KB search error: ${e.message}`);
    }
    return;
  }

  // KB Stats - GET /api/kb/stats
  if (path === '/api/kb/stats' && method === 'GET') {
    try {
      const { getInstance } = require('./tenant-kb-loader.cjs');
      const loader = getInstance();
      sendJson(res, 200, loader.getStats());
    } catch (e) {
      sendError(res, 500, `KB stats error: ${e.message}`);
    }
    return;
  }

  // KB Quota Status - GET /api/tenants/:id/kb/quota
  const kbQuotaMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/quota$/);
  if (kbQuotaMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbQuotaMatch[1];

    try {
      const { getInstance } = require('./kb-quotas.cjs');
      const status = getInstance().getQuotaStatus(tenantId);
      sendJson(res, 200, status);
    } catch (e) {
      sendError(res, 500, `KB quota error: ${e.message}`);
    }
    return;
  }

  // KB Import Bulk - POST /api/tenants/:id/kb/import
  const kbImportMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/import$/);
  if (kbImportMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbImportMatch[1];

    try {
      const body = await parseBody(req);
      if (!body.data) {
        sendError(res, 400, 'data field is required (JSON object or array)');
        return;
      }

      // Check quota before import
      const quotaManager = require('./kb-quotas.cjs').getInstance();
      const entryCount = Array.isArray(body.data) ? body.data.length : Object.keys(body.data).filter(k => k !== '__meta').length;
      const quotaCheck = quotaManager.checkQuota(tenantId, 'add_entries', { count: entryCount });

      if (!quotaCheck.allowed) {
        sendError(res, 403, quotaCheck.reason);
        return;
      }

      // Check import monthly limit
      const importCheck = quotaManager.checkQuota(tenantId, 'import');
      if (!importCheck.allowed) {
        sendError(res, 403, importCheck.reason);
        return;
      }

      const language = body.language || 'fr';
      const options = {
        overwrite: body.overwrite !== false
      };

      const { getInstance } = require('./tenant-kb-loader.cjs');
      const result = await getInstance().importBulk(tenantId, language, body.data, options);

      // Increment import counter
      quotaManager.incrementUsage(tenantId, 'import');

      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 500, `KB import error: ${e.message}`);
    }
    return;
  }

  // KB Rebuild Index - POST /api/tenants/:id/kb/rebuild-index
  const kbRebuildMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/rebuild-index$/);
  if (kbRebuildMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbRebuildMatch[1];

    try {
      const body = await parseBody(req);
      const language = body.language || null; // null = rebuild all languages

      const { getInstance } = require('./tenant-kb-loader.cjs');
      const result = await getInstance().rebuildIndex(tenantId, language);

      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 500, `KB rebuild index error: ${e.message}`);
    }
    return;
  }

  // KB Crawl Website - POST /api/tenants/:id/kb/crawl
  const kbCrawlMatch = path.match(/^\/api\/tenants\/(\w+)\/kb\/crawl$/);
  if (kbCrawlMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = kbCrawlMatch[1];

    try {
      const body = await parseBody(req);
      if (!body.url) {
        sendError(res, 400, 'url field is required');
        return;
      }

      // Check crawl quota
      const quotaManager = require('./kb-quotas.cjs').getInstance();
      const crawlCheck = quotaManager.checkQuota(tenantId, 'crawl');
      if (!crawlCheck.allowed) {
        sendError(res, 403, crawlCheck.reason);
        return;
      }

      const { KBCrawler } = require('./kb-crawler.cjs');
      const crawler = new KBCrawler({
        maxPages: body.maxPages || 10
      });

      const language = body.language || 'fr';
      const kbData = body.singlePage
        ? await crawler.crawlURL(body.url)
        : await crawler.crawlSite(body.url);

      // Import crawled data to KB
      if (kbData && Object.keys(kbData).filter(k => k !== '__meta').length > 0) {
        const { getInstance } = require('./tenant-kb-loader.cjs');
        const importResult = await getInstance().importBulk(tenantId, language, kbData, { overwrite: true });

        // Increment crawl counter
        quotaManager.incrementUsage(tenantId, 'crawl');

        sendJson(res, 200, {
          success: true,
          crawled: kbData,
          imported: importResult
        });
      } else {
        sendJson(res, 200, {
          success: false,
          message: 'No KB data extracted from URL',
          crawled: kbData
        });
      }
    } catch (e) {
      sendError(res, 500, `KB crawl error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // END KB ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // Session 250.68: CATALOG ENDPOINTS (Dynamic Product Catalog)
  // Endpoints:
  // - GET  /api/tenants/:id/catalog           - List catalog items
  // - GET  /api/tenants/:id/catalog/:itemId   - Get single item
  // - POST /api/tenants/:id/catalog           - Create item
  // - PUT  /api/tenants/:id/catalog/:itemId   - Update item
  // - DELETE /api/tenants/:id/catalog/:itemId - Delete item
  // - POST /api/tenants/:id/catalog/import    - Import catalog from file
  // - POST /api/tenants/:id/catalog/sync      - Sync with external source
  // ═══════════════════════════════════════════════════════════════

  // Lazy load catalog store to avoid circular dependencies
  let _catalogStore = null;
  function getCatalogStore() {
    if (!_catalogStore) {
      const { TenantCatalogStore } = require('./tenant-catalog-store.cjs');
      _catalogStore = new TenantCatalogStore();
    }
    return _catalogStore;
  }

  // Catalog List - GET /api/tenants/:id/catalog
  const catalogListMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog$/);
  if (catalogListMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = catalogListMatch[1];

    try {
      const catalogStore = getCatalogStore();
      const catalogType = query.type || 'PRODUCTS';
      const search = query.search || null;
      const category = query.category || null;
      const limit = query.limit ? parseInt(query.limit) : 100;
      const offset = query.offset ? parseInt(query.offset) : 0;

      let items = catalogStore.getItems(tenantId, catalogType);

      // Apply filters
      if (search) {
        const searchLower = search.toLowerCase();
        items = items.filter(item =>
          (item.name && item.name.toLowerCase().includes(searchLower)) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
      }
      if (category) {
        items = items.filter(item => item.category === category);
      }

      // Get unique categories
      const allItems = catalogStore.getItems(tenantId, catalogType);
      const categories = [...new Set(allItems.map(i => i.category).filter(Boolean))];

      // Pagination
      const total = items.length;
      items = items.slice(offset, offset + limit);

      sendJson(res, 200, {
        success: true,
        tenant_id: tenantId,
        catalog_type: catalogType,
        items,
        total,
        limit,
        offset,
        categories
      });
    } catch (e) {
      sendError(res, 500, `Catalog error: ${e.message}`);
    }
    return;
  }

  // Catalog Import - POST /api/tenants/:id/catalog/import
  const catalogImportMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/import$/);
  if (catalogImportMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = catalogImportMatch[1];

    try {
      const body = await readBody(req);
      if (!body.data || !Array.isArray(body.data)) {
        sendError(res, 400, 'data array required');
        return;
      }

      const catalogStore = getCatalogStore();
      const catalogType = body.type || 'PRODUCTS';

      // Register tenant if not exists
      catalogStore.registerTenant(tenantId, {
        name: tenantId,
        connector: {
          type: 'custom',
          catalogType: catalogType,
          dataPath: `data/catalogs/tenants/${tenantId}`
        }
      });

      // Import items
      let imported = 0;
      for (const item of body.data) {
        if (item.id && item.name) {
          catalogStore.addItem(tenantId, catalogType, item);
          imported++;
        }
      }

      sendJson(res, 200, {
        success: true,
        imported,
        total: body.data.length,
        catalog_type: catalogType
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'imported', { imported, catalog_type: catalogType });
    } catch (e) {
      sendError(res, 500, `Catalog import error: ${e.message}`);
    }
    return;
  }

  // Catalog Sync - POST /api/tenants/:id/catalog/sync
  const catalogSyncMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/sync$/);
  if (catalogSyncMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = catalogSyncMatch[1];

    try {
      const body = await readBody(req);
      const catalogStore = getCatalogStore();
      const catalogType = body.type || 'PRODUCTS';

      const result = await catalogStore.syncCatalog(tenantId, catalogType, { force: body.force || false });

      sendJson(res, 200, {
        success: true,
        synced: result,
        catalog_type: catalogType
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'synced', { catalog_type: catalogType });
    } catch (e) {
      sendError(res, 500, `Catalog sync error: ${e.message}`);
    }
    return;
  }

  // Catalog Item Detail - GET /api/tenants/:id/catalog/:itemId
  const catalogItemMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/([^/]+)$/);
  if (catalogItemMatch && method === 'GET' && !path.includes('/import') && !path.includes('/sync')) {
    const user = await checkAuth(req, res);
    if (!user) return;
    const [, tenantId, itemId] = catalogItemMatch;

    try {
      const catalogStore = getCatalogStore();
      const catalogType = query.type || 'PRODUCTS';
      const item = catalogStore.getItem(tenantId, catalogType, itemId);

      if (!item) {
        sendError(res, 404, 'Item not found');
        return;
      }

      sendJson(res, 200, {
        success: true,
        item
      });
    } catch (e) {
      sendError(res, 500, `Catalog error: ${e.message}`);
    }
    return;
  }

  // Catalog Create Item - POST /api/tenants/:id/catalog
  if (catalogListMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = catalogListMatch[1];

    try {
      const body = await readBody(req);
      if (!body.name) {
        sendError(res, 400, 'name required');
        return;
      }

      const catalogStore = getCatalogStore();
      const catalogType = body.catalog_type || 'PRODUCTS';

      // Register tenant if not exists
      catalogStore.registerTenant(tenantId, {
        name: tenantId,
        connector: {
          type: 'custom',
          catalogType: catalogType,
          dataPath: `data/catalogs/tenants/${tenantId}`
        }
      });

      // Generate ID if not provided
      const item = {
        id: body.id || `item_${Date.now()}`,
        name: body.name,
        category: body.category || 'default',
        price: body.price || 0,
        currency: body.currency || 'MAD',
        stock: body.stock ?? null,
        available: body.available !== false,
        description: body.description || '',
        voiceDescription: body.voiceDescription || body.voice_description || '',
        createdAt: new Date().toISOString()
      };

      catalogStore.addItem(tenantId, catalogType, item);

      sendJson(res, 201, {
        success: true,
        item
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'created', { item, catalog_type: catalogType });
    } catch (e) {
      sendError(res, 500, `Catalog create error: ${e.message}`);
    }
    return;
  }

  // Catalog Update Item - PUT /api/tenants/:id/catalog/:itemId
  if (catalogItemMatch && method === 'PUT') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const [, tenantId, itemId] = catalogItemMatch;

    try {
      const body = await readBody(req);
      const catalogStore = getCatalogStore();
      const catalogType = body.catalog_type || query.type || 'PRODUCTS';

      const existing = catalogStore.getItem(tenantId, catalogType, itemId);
      if (!existing) {
        sendError(res, 404, 'Item not found');
        return;
      }

      // Merge updates
      const updatedItem = {
        ...existing,
        ...body,
        id: itemId, // Preserve original ID
        updatedAt: new Date().toISOString()
      };

      catalogStore.updateItem(tenantId, catalogType, itemId, updatedItem);

      sendJson(res, 200, {
        success: true,
        item: updatedItem
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'updated', { item: updatedItem, catalog_type: catalogType });
    } catch (e) {
      sendError(res, 500, `Catalog update error: ${e.message}`);
    }
    return;
  }

  // Catalog Delete Item - DELETE /api/tenants/:id/catalog/:itemId
  if (catalogItemMatch && method === 'DELETE') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const [, tenantId, itemId] = catalogItemMatch;

    try {
      const catalogStore = getCatalogStore();
      const catalogType = query.type || 'PRODUCTS';

      const existing = catalogStore.getItem(tenantId, catalogType, itemId);
      if (!existing) {
        sendError(res, 404, 'Item not found');
        return;
      }

      catalogStore.removeItem(tenantId, catalogType, itemId);

      sendJson(res, 200, {
        success: true,
        deleted: itemId
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'deleted', { itemId, catalog_type: catalogType });
    } catch (e) {
      sendError(res, 500, `Catalog delete error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // END CATALOG ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // Session 250.57: CONVERSATION HISTORY & EXPORT ENDPOINTS
  // ⚠️ TELEPHONY RETENTION: 60 days maximum (auto-purge 1st of month)
  // ═══════════════════════════════════════════════════════════════

  // Conversation List - GET /api/tenants/:id/conversations
  const convListMatch = path.match(/^\/api\/tenants\/(\w+)\/conversations$/);
  if (convListMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = convListMatch[1];

    try {
      const options = {};
      if (query.source) options.source = query.source;
      if (query.limit) options.limit = parseInt(query.limit);

      const conversations = conversationStore.listByTenant(tenantId, options);
      const stats = conversationStore.getStats(tenantId);

      sendJson(res, 200, {
        tenant_id: tenantId,
        retention_policy: {
          telephony_days: TELEPHONY_RETENTION_DAYS,
          notice: 'Telephony history is automatically purged after 60 days on the 1st of each month'
        },
        stats,
        count: conversations.length,
        conversations
      });
    } catch (e) {
      sendError(res, 500, `Conversation error: ${e.message}`);
    }
    return;
  }

  // Conversation Detail - GET /api/tenants/:id/conversations/:sessionId
  const convDetailMatch = path.match(/^\/api\/tenants\/(\w+)\/conversations\/([^/]+)$/);
  if (convDetailMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const [, tenantId, sessionId] = convDetailMatch;

    try {
      const conversation = conversationStore.load(tenantId, sessionId);
      if (!conversation) {
        sendError(res, 404, 'Conversation not found');
        return;
      }
      sendJson(res, 200, conversation);
    } catch (e) {
      sendError(res, 500, `Conversation error: ${e.message}`);
    }
    return;
  }

  // Export Conversations - GET /api/tenants/:id/conversations/export
  const convExportMatch = path.match(/^\/api\/tenants\/(\w+)\/conversations\/export$/);
  if (convExportMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = convExportMatch[1];

    try {
      const format = (query.format || 'csv').toLowerCase();
      const options = {};
      if (query.source) options.source = query.source;
      if (query.limit) options.limit = parseInt(query.limit);

      let result;
      switch (format) {
        case 'xlsx':
          result = await conversationStore.exportToXLSX(tenantId, options);
          break;
        case 'pdf':
          result = await conversationStore.exportToPDF(tenantId, options);
          break;
        default:
          result = conversationStore.exportToCSV(tenantId, options);
      }

      if (result.error) {
        sendError(res, 400, result.error);
        return;
      }

      // Audit trail
      auditStore.log(tenantId, {
        action: ACTION_CATEGORIES.DATA_EXPORT,
        actor: user.id || user.email,
        actor_type: 'user',
        resource: `conversations:${format}`,
        details: { format, conversations: result.file?.conversations }
      });

      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 500, `Export error: ${e.message}`);
    }
    return;
  }

  // Download Exported File - GET /api/exports/:filename
  const exportDownloadMatch = path.match(/^\/api\/exports\/([^/]+\.(csv|xlsx|pdf))$/);
  if (exportDownloadMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const filename = exportDownloadMatch[1];
    const filePath = require('path').join(__dirname, '../data/exports', filename);

    try {
      if (!require('fs').existsSync(filePath)) {
        sendError(res, 404, 'Export file not found');
        return;
      }

      const fileStream = require('fs').createReadStream(filePath);
      const ext = filename.split('.').pop().toLowerCase();
      const contentTypes = {
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf'
      };

      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      fileStream.pipe(res);
    } catch (e) {
      sendError(res, 500, `Download error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // END CONVERSATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // Logs Endpoint (ADMIN ONLY)
  if (path === '/api/logs' && method === 'GET') {
    const admin = await checkAdmin(req, res);
    if (!admin) return; // Auth error already sent
    try {
      const db = getDB();
      const logs = await db.findAll('logs');
      // Sort by timestamp descending
      logs.sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
      sendJson(res, 200, { count: logs.length, data: logs.slice(0, 100) });
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // Health check (basic DB)
  if (path === '/api/db/health' && method === 'GET') {
    try {
      const db = getDB();
      const health = await db.health();
      sendJson(res, 200, health);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // Comprehensive health check (all stores) - Session 250.57bis
  if (path === '/api/health' && method === 'GET') {
    try {
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');

      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '6.61.0',
        stores: {
          database: await getDB().health(),
          conversations: conversationStore.health(),
          audit: auditStore.health(),
          ucp: getUCPStore().health()
        },
        retention_policy: {
          telephony_days: TELEPHONY_RETENTION_DAYS,
          purge_schedule: '1st of each month'
        }
      };

      // Check overall status
      const storeStatuses = Object.values(health.stores).map(s => s.status);
      if (storeStatuses.some(s => s === 'error')) {
        health.status = 'degraded';
      }

      sendJson(res, 200, health);
    } catch (e) {
      sendJson(res, 500, {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: e.message
      });
    }
    return;
  }

  // Parse path: /api/db/:sheet/:id?
  const match = path.match(/^\/api\/db\/(\w+)(?:\/(\w+))?$/);
  if (!match) {
    sendError(res, 404, 'Not found');
    return;
  }

  const sheet = match[1];
  const id = match[2];

  // Validate sheet
  if (!ALLOWED_SHEETS.includes(sheet)) {
    sendError(res, 400, `Invalid sheet: ${sheet}`);
    return;
  }

  // SECURITY: Require authentication for all DB operations (except health)
  const user = await checkAuth(req, res);
  if (!user) return; // Auth error already sent

  // Apply rate limiting
  const rateLimited = await applyRateLimit(req, res, dbLimiter);
  if (rateLimited) return;

  // SECURITY: Admin-only sheets
  const adminOnlySheets = ['users', 'auth_sessions', 'hitl_pending', 'hitl_history'];
  if (adminOnlySheets.includes(sheet) && user.role !== 'admin') {
    sendError(res, 403, `Admin access required for ${sheet}`);
    return;
  }

  // SECURITY: Tenant isolation for non-admin users
  const tenantId = user.tenant_id;

  const db = getDB();

  try {
    switch (method) {
      // GET /api/db/:sheet - List all or query
      case 'GET':
        if (id) {
          // GET /api/db/:sheet/:id - Get by ID
          let record = await db.findById(sheet, id);
          if (!record) {
            sendError(res, 404, 'Record not found');
            return;
          }
          // Tenant isolation check
          if (tenantId && record.tenant_id && record.tenant_id !== tenantId && user.role !== 'admin') {
            sendError(res, 403, 'Access denied');
            return;
          }
          // Filter sensitive fields from users
          if (sheet === 'users') {
            record = filterUserRecord(record);
          }
          sendJson(res, 200, record);
        } else if (Object.keys(query).length > 0) {
          // GET /api/db/:sheet?field=value - Query
          let records = await db.find(sheet, query);
          // Tenant isolation for non-admin
          if (tenantId && user.role !== 'admin') {
            records = records.filter(r => !r.tenant_id || r.tenant_id === tenantId);
          }
          // Filter sensitive fields from users
          if (sheet === 'users') {
            records = filterUserRecords(records);
          }
          sendJson(res, 200, { count: records.length, data: records });
        } else {
          // GET /api/db/:sheet - List all
          let records = await db.findAll(sheet);
          // Tenant isolation for non-admin
          if (tenantId && user.role !== 'admin') {
            records = records.filter(r => !r.tenant_id || r.tenant_id === tenantId);
          }
          // Filter sensitive fields from users
          if (sheet === 'users') {
            records = filterUserRecords(records);
          }
          sendJson(res, 200, { count: records.length, data: records });
        }
        break;

      // POST /api/db/:sheet - Create
      case 'POST':
        const createData = await parseBody(req);
        // Auto-set tenant_id for non-admin
        if (tenantId && user.role !== 'admin' && !createData.tenant_id) {
          createData.tenant_id = tenantId;
        }
        const created = await db.create(sheet, createData);
        // Broadcast creation to appropriate channel
        if (created.tenant_id) {
          broadcastToTenant(created.tenant_id, sheet, 'created', sheet === 'users' ? filterUserRecord(created) : created);
        } else {
          broadcast(sheet, 'created', sheet === 'users' ? filterUserRecord(created) : created);
        }
        sendJson(res, 201, sheet === 'users' ? filterUserRecord(created) : created);
        break;

      // PUT /api/db/:sheet/:id - Update
      case 'PUT':
        if (!id) {
          sendError(res, 400, 'ID required for update');
          return;
        }
        // Check tenant access before update
        const existingRecord = await db.findById(sheet, id);
        if (existingRecord && tenantId && existingRecord.tenant_id !== tenantId && user.role !== 'admin') {
          sendError(res, 403, 'Access denied');
          return;
        }
        const updateData = await parseBody(req);
        const updated = await db.update(sheet, id, updateData);
        // Broadcast update to appropriate channel
        if (updated.tenant_id) {
          broadcastToTenant(updated.tenant_id, sheet, 'updated', sheet === 'users' ? filterUserRecord(updated) : updated);
        } else {
          broadcast(sheet, 'updated', sheet === 'users' ? filterUserRecord(updated) : updated);
        }
        sendJson(res, 200, sheet === 'users' ? filterUserRecord(updated) : updated);
        break;

      // DELETE /api/db/:sheet/:id - Delete
      case 'DELETE':
        if (!id) {
          sendError(res, 400, 'ID required for delete');
          return;
        }
        // Check tenant access before delete
        const recordToDelete = await db.findById(sheet, id);
        if (recordToDelete && tenantId && recordToDelete.tenant_id !== tenantId && user.role !== 'admin') {
          sendError(res, 403, 'Access denied');
          return;
        }
        await db.delete(sheet, id);
        // Broadcast deletion to appropriate channel
        if (recordToDelete?.tenant_id) {
          broadcastToTenant(recordToDelete.tenant_id, sheet, 'deleted', { id });
        } else {
          broadcast(sheet, 'deleted', { id });
        }
        sendJson(res, 200, { deleted: true, id });
        break;

      default:
        sendError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    console.error(`❌ [DB-API] ${method} ${path}:`, error.message);
    sendError(res, 500, error.message);
  }
}

/**
 * Handle WebSocket connection
 */
function handleWebSocketConnection(ws, req) {
  // Extract token from query string
  const parsedUrl = url.parse(req.url, true);
  const token = parsedUrl.query.token;

  if (!token) {
    ws.close(4001, 'Authorization required');
    return;
  }

  let user;
  try {
    user = authService.verifyToken(token);
  } catch (e) {
    ws.close(4002, 'Invalid or expired token');
    return;
  }

  // Initialize client data
  ws.isAlive = true;
  wsClients.set(ws, { user, channels: new Set() });
  console.log(`✅ [WS] Client connected: ${user.email} (${user.role})`);

  // Handle pong for heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    user: { id: user.sub, email: user.email, role: user.role },
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const clientData = wsClients.get(ws);

      switch (msg.type) {
        case 'subscribe':
          // Subscribe to channel(s)
          const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          channels.forEach(ch => {
            // Admin-only channels
            if (['hitl', 'users', 'auth_sessions'].includes(ch) && user.role !== 'admin') {
              ws.send(JSON.stringify({ type: 'error', message: `Channel ${ch} requires admin role` }));
              return;
            }
            clientData.channels.add(ch);
          });
          ws.send(JSON.stringify({
            type: 'subscribed',
            channels: Array.from(clientData.channels)
          }));
          break;

        case 'unsubscribe':
          // Unsubscribe from channel(s)
          const unsubChannels = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          unsubChannels.forEach(ch => clientData.channels.delete(ch));
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            channels: Array.from(clientData.channels)
          }));
          break;

        case 'ping':
          // Heartbeat response
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  // Handle close
  ws.on('close', () => {
    console.log(`🔌 [WS] Client disconnected: ${user.email}`);
    wsClients.delete(ws);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error(`❌ [WS] Error for ${user.email}:`, err.message);
    wsClients.delete(ws);
  });
}

/**
 * Start server
 */
async function startServer() {
  // Initialize auth service with database
  const db = getDB();
  authService.init(db);

  const server = http.createServer(handleRequest);

  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', handleWebSocketConnection);

  // Heartbeat interval to detect stale connections
  // unref() allows Node.js to exit even if interval is active (for tests)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        wsClients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  heartbeatInterval.unref();

  wss.on('close', () => clearInterval(heartbeatInterval));

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║       VocalIA Database + Auth API                 ║
╠═══════════════════════════════════════════════════╣
║  Port: ${PORT}                                       ║
║  HTTP: http://localhost:${PORT}                     ║
║  WS:   ws://localhost:${PORT}/ws                    ║
╠═══════════════════════════════════════════════════╣
║  Auth Endpoints:                                  ║
║  POST   /api/auth/register    - Register          ║
║  POST   /api/auth/login       - Login             ║
║  POST   /api/auth/logout      - Logout            ║
║  POST   /api/auth/refresh     - Refresh token     ║
║  POST   /api/auth/forgot      - Forgot password   ║
║  POST   /api/auth/reset       - Reset password    ║
║  GET    /api/auth/me          - Current user      ║
║  PUT    /api/auth/me          - Update profile    ║
║  PUT    /api/auth/password    - Change password   ║
╠═══════════════════════════════════════════════════╣
║  DB Endpoints:                                    ║
║  GET    /api/db/health        - Health check      ║
║  GET    /api/db/:sheet        - List all          ║
║  GET    /api/db/:sheet/:id    - Get by ID         ║
║  POST   /api/db/:sheet        - Create            ║
║  PUT    /api/db/:sheet/:id    - Update            ║
║  DELETE /api/db/:sheet/:id    - Delete            ║
╠═══════════════════════════════════════════════════╣
║  WebSocket Channels:                              ║
║  hitl, logs, tenants, sessions, stats (admin)     ║
╠═══════════════════════════════════════════════════╣
║  Sheets: tenants, sessions, logs, users           ║
╚═══════════════════════════════════════════════════╝
`);
  });

  return { server, wss };
}

// CLI
if (require.main === module) {
  startServer();
}

module.exports = { startServer, handleRequest, broadcast, broadcastToTenant, wsClients };
