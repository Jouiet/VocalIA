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
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { getDB } = require('./GoogleSheetsDB.cjs');
const authService = require('./auth-service.cjs');
const { requireAuth, requireAdmin, rateLimit, extractToken } = require('./auth-middleware.cjs');

const { sanitizeTenantId } = require('./voice-api-utils.cjs');

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

// Session 250.174: Shared tenant CORS module (was ~80 lines duplicated with voice-api — NM7 fix)
const tenantCors = require('./tenant-cors.cjs');
const { validateOriginTenant, validateApiKey, getCorsHeaders, VOCALIA_ORIGINS: CORS_ALLOWED_ORIGINS } = tenantCors;

// validateOriginTenant, validateApiKey, getCorsHeaders → imported from tenant-cors.cjs (250.174)

// Rate limiter for DB endpoints
const dbLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 per minute
// D8 fix: Rate limiter for public catalog/widget endpoints
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 per minute per IP
// P1 fix: Strict rate limiter for endpoints that trigger external actions (calls/SMS/email)
const actionLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 }); // 5 per minute per IP

const stripeService = require('./StripeService.cjs');

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
 * Parse JSON body (with 1MB size limit to prevent DoS)
 */
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large (max 1MB)'));
        return;
      }
      body += chunk;
    });
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
  res.writeHead(statusCode, getCorsHeaders(res._corsReq));
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res, statusCode, message) {
  // P4 fix: Never expose internal error details in 500 responses
  // Client-facing errors (4xx) are intentional and safe to return as-is
  if (statusCode >= 500) {
    console.error(`[DB-API] Internal error: ${message}`);
    sendJson(res, statusCode, { error: 'Internal server error' });
  } else {
    sendJson(res, statusCode, { error: message });
  }
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
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;
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
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;
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
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;
      const { token } = body;
      if (!token) {
        sendError(res, 400, 'Verification token required');
        return true;
      }

      const result = await authService.verifyEmail(token);
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/resend-verification (F4 fix)
    if (path === '/api/auth/resend-verification' && method === 'POST') {
      const rateLimited = await applyRateLimit(req, res, loginLimiter);
      if (rateLimited) return true;

      const { email } = body;
      if (!email) {
        sendError(res, 400, 'Email required');
        return true;
      }

      const result = await authService.resendVerificationEmail(email);
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
    // Intercept writeHead to detect rate-limit response reliably (no setTimeout race)
    const origWriteHead = res.writeHead;
    res.writeHead = function(statusCode, ...args) {
      origWriteHead.call(this, statusCode, ...args);
      if (statusCode === 429) resolve(true);
    };
    limiter(req, res, () => {
      res.writeHead = origWriteHead; // Restore
      resolve(false);
    });
  });
}

/**
 * Handle HITL (Human-in-the-Loop) Endpoints
 * - GET  /api/hitl/pending  - List pending approvals (aggregated from all domains)
 * - GET  /api/hitl/history  - List approval history
 * - POST /api/hitl/approve/:id - Approve an item (dispatched to domain by ID prefix)
 * - POST /api/hitl/reject/:id  - Reject an item (dispatched to domain by ID prefix)
 * - GET  /api/hitl/stats    - Get HITL statistics
 *
 * Session 250.190: F14 fix — aggregate from 3 domain-specific stores + GoogleSheetsDB.
 * Before this fix, hitl_pending (GoogleSheetsDB) had ZERO writers → dashboard always empty.
 */

// HITL file store paths (domain-specific)
const HITL_VOICE_FILE = path.join(__dirname, '..', 'data', 'voice', 'hitl-pending', 'pending-actions.json');
const HITL_HUBSPOT_FILE = path.join(__dirname, '..', 'data', 'hubspot', 'hitl-pending', 'pending-deals.json');
const HITL_REMOTION_FILE = path.join(__dirname, '..', 'data', 'remotion-hitl', 'pending-queue.json');

function loadFileHITL(filePath, source) {
  try {
    if (fs.existsSync(filePath)) {
      const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return (Array.isArray(items) ? items : []).map(item => ({
        ...item,
        _source: source,
        _filePath: filePath
      }));
    }
  } catch (e) { /* file not ready */ }
  return [];
}

function saveFileHITL(filePath, items) {
  const clean = items.map(({ _source, _filePath, ...rest }) => rest);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(clean, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function loadAllPendingHITL(db) {
  const voice = loadFileHITL(HITL_VOICE_FILE, 'voice');
  const hubspot = loadFileHITL(HITL_HUBSPOT_FILE, 'hubspot');
  const remotion = loadFileHITL(HITL_REMOTION_FILE, 'remotion');

  // Normalize to common shape
  const normalize = (item, source) => ({
    id: item.id,
    type: item.actionType || item.type || source,
    source,
    tenant: item.tenantId || item.tenant_id || item.tenant || 'default',
    summary: item.reason || item.dealData?.dealname || item.videoId || item.summary || '',
    created_at: item.created_at || item.queuedAt || item.createdAt || new Date().toISOString(),
    raw: item
  });

  return [
    ...voice.map(i => normalize(i, 'voice')),
    ...hubspot.map(i => normalize(i, 'hubspot')),
    ...remotion.map(i => normalize(i, 'remotion'))
  ];
}

function findAndRemoveFromFileStore(id) {
  const stores = [
    { path: HITL_VOICE_FILE, source: 'voice' },
    { path: HITL_HUBSPOT_FILE, source: 'hubspot' },
    { path: HITL_REMOTION_FILE, source: 'remotion' }
  ];
  for (const store of stores) {
    const items = loadFileHITL(store.path, store.source);
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      const [found] = items.splice(index, 1);
      saveFileHITL(store.path, items);
      return { item: found, source: store.source };
    }
  }
  return null;
}

async function handleHITLRequest(req, res, path, method, authUser = null) {
  try {
    const db = getDB();

    // GET /api/hitl/pending — aggregated from all domain stores
    if (path === '/api/hitl/pending' && method === 'GET') {
      let dbPending = [];
      try {
        dbPending = await db.findAll('hitl_pending');
      } catch (e) { /* sheet may not exist */ }

      const filePending = loadAllPendingHITL(db);
      const all = [...dbPending, ...filePending];
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      sendJson(res, 200, { count: all.length, data: all });
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

    // GET /api/hitl/stats — aggregated
    if (path === '/api/hitl/stats' && method === 'GET') {
      let dbPending = [], history = [];
      try {
        dbPending = await db.findAll('hitl_pending');
        history = await db.findAll('hitl_history');
      } catch (e) { /* tables might not exist */ }

      const filePending = loadAllPendingHITL(db);
      const totalPending = dbPending.length + filePending.length;
      const approved = history.filter(h => h.decision === 'approved').length;
      const rejected = history.filter(h => h.decision === 'rejected').length;

      sendJson(res, 200, {
        pending_count: totalPending,
        pending_by_source: {
          db: dbPending.length,
          voice: filePending.filter(i => i.source === 'voice').length,
          hubspot: filePending.filter(i => i.source === 'hubspot').length,
          remotion: filePending.filter(i => i.source === 'remotion').length
        },
        approved_count: approved,
        rejected_count: rejected,
        total_decided: history.length
      });
      return true;
    }

    // POST /api/hitl/approve/:id — dispatched to domain by ID
    const approveMatch = path.match(/^\/api\/hitl\/approve\/(\w+)$/);
    if (approveMatch && method === 'POST') {
      const id = approveMatch[1];
      const body = await parseBody(req);
      const admin = authUser?.email || authUser?.sub || 'Admin';

      // Try GoogleSheetsDB first
      let pending;
      try {
        pending = await db.findById('hitl_pending', id);
      } catch (e) { /* not in DB */ }

      if (pending) {
        // Legacy DB path
        await db.create('hitl_history', {
          ...pending,
          decision: 'approved',
          decided_by: admin,
          decided_at: new Date().toISOString()
        });
        await db.delete('hitl_pending', id);
      } else {
        // Search file-based stores
        const result = findAndRemoveFromFileStore(id);
        if (!result) {
          sendError(res, 404, 'Pending item not found');
          return true;
        }
        pending = result.item;
        // Record in history
        await db.create('hitl_history', {
          id,
          type: pending.actionType || pending.type || result.source,
          source: result.source,
          tenant_id: pending.tenantId || pending.tenant_id || 'default',
          decision: 'approved',
          decided_by: admin,
          decided_at: new Date().toISOString(),
          data: pending
        });
      }

      broadcast('hitl', 'approved', { id, admin, item: pending });

      auditStore.log(pending.tenant_id || pending.tenantId || 'default', {
        action: ACTION_CATEGORIES.HITL_APPROVE,
        actor: admin,
        actor_type: 'admin',
        resource: `hitl:${id}`,
        details: { type: pending.type || pending.actionType, data: pending }
      });

      sendJson(res, 200, { success: true, decision: 'approved', id });
      return true;
    }

    // POST /api/hitl/reject/:id — dispatched to domain by ID
    const rejectMatch = path.match(/^\/api\/hitl\/reject\/(\w+)$/);
    if (rejectMatch && method === 'POST') {
      const id = rejectMatch[1];
      const body = await parseBody(req);
      const admin = authUser?.email || authUser?.sub || 'Admin';
      const reason = body.reason || '';

      // Try GoogleSheetsDB first
      let pending;
      try {
        pending = await db.findById('hitl_pending', id);
      } catch (e) { /* not in DB */ }

      if (pending) {
        await db.create('hitl_history', {
          ...pending,
          decision: 'rejected',
          decided_by: admin,
          decided_at: new Date().toISOString(),
          rejection_reason: reason
        });
        await db.delete('hitl_pending', id);
      } else {
        const result = findAndRemoveFromFileStore(id);
        if (!result) {
          sendError(res, 404, 'Pending item not found');
          return true;
        }
        pending = result.item;
        await db.create('hitl_history', {
          id,
          type: pending.actionType || pending.type || result.source,
          source: result.source,
          tenant_id: pending.tenantId || pending.tenant_id || 'default',
          decision: 'rejected',
          decided_by: admin,
          decided_at: new Date().toISOString(),
          rejection_reason: reason,
          data: pending
        });
      }

      broadcast('hitl', 'rejected', { id, admin, reason, item: pending });

      auditStore.log(pending.tenant_id || pending.tenantId || 'default', {
        action: ACTION_CATEGORIES.HITL_REJECT,
        actor: admin,
        actor_type: 'admin',
        resource: `hitl:${id}`,
        details: { type: pending.type || pending.actionType, reason }
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
 * Handle Telephony Analytics Endpoints
 * - GET /api/telephony/stats  - Get call statistics
 * - GET /api/telephony/cdrs   - List recent calls
 */
async function handleTelephonyRequest(req, res, path, method, query) {
  try {
    const user = await checkAuth(req, res);
    if (!user) return true;

    // Admin can view all or specific tenant, others only their own
    const tenantId = user.role === 'admin' ? (query.tenantId || 'all') : user.tenant_id;

    // GET /api/telephony/stats
    if (path === '/api/telephony/stats' && method === 'GET') {
      const conversations = conversationStore.listByTenant(tenantId, { source: 'telephony' });

      const totalCalls = conversations.length;
      const totalDuration = conversations.reduce((sum, c) => sum + (c.duration_sec || 0), 0);
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

      // Metrics calculation
      const langs = {};
      const statusCounts = { completed: 0, busy: 0, failed: 0, total: 0 };

      conversations.forEach(c => {
        // Languages
        const l = c.language || 'fr';
        langs[l] = (langs[l] || 0) + 1;

        // Status
        statusCounts.total++;
        const status = (c.status || 'completed').toLowerCase();
        if (status === 'completed' || status === 'success' || status === 'answered') statusCounts.completed++;
        else if (status === 'busy' || status === 'no-answer') statusCounts.busy++;
        else statusCounts.failed++;
      });

      const statusBreakdown = {
        completed: Math.round((statusCounts.completed / (statusCounts.total || 1)) * 100),
        busy: Math.round((statusCounts.busy / (statusCounts.total || 1)) * 100),
        failed: Math.round((statusCounts.failed / (statusCounts.total || 1)) * 100)
      };

      // ROI Calculation (multi-market: EU baseline)
      // Human cost: ~0.50€/min. AI cost: ~0.10€/min. Savings: 0.40€/min.
      const savings = Math.round(totalDuration * (0.40 / 60));

      sendJson(res, 200, {
        success: true,
        tenantId,
        stats: {
          totalCalls,
          totalDuration,
          avgDuration,
          languages: langs,
          statusBreakdown,
          savings,
          uptime: Math.floor(process.uptime())
        }
      });
      return true;
    }

    // GET /api/telephony/cdrs
    if (path === '/api/telephony/cdrs' && method === 'GET') {
      const limit = parseInt(query.limit) || 20;
      const conversations = conversationStore.listByTenant(tenantId, {
        source: 'telephony',
        limit: limit
      });

      const cdrs = conversations.map(c => ({
        id: c.session_id,
        number: c.call_sid ? `+*** ${c.call_sid.substring(c.call_sid.length - 4)}` : 'Anonymous',
        persona: c.persona || 'AGENCY',
        language: c.language || 'fr',
        duration_sec: c.duration_sec || 0,
        status: c.status || 'Completed',
        timestamp: c.created_at
      }));

      sendJson(res, 200, {
        success: true,
        tenantId,
        count: cdrs.length,
        data: cdrs
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ [Telephony API] Error:`, error.message);
    sendError(res, 500, error.message);
    return true;
  }
}

/**
 * API Router
 */
async function handleRequest(req, res) {
  res._corsReq = req; // Attach req for CORS origin check
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(req));
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
    // D9 fix: pass authenticated admin to prevent spoofing
    const handled = await handleHITLRequest(req, res, path, method, admin);
    if (handled) return;
  }

  // Telephony Endpoints
  if (path.startsWith('/api/telephony/')) {
    const handled = await handleTelephonyRequest(req, res, path, method, query);
    if (handled) return;
  }

  // ═══════════════════════════════════════════════════════════════
  // Session 250.78: BILLING API ENDPOINTS (Real Stripe Integration)
  // ═══════════════════════════════════════════════════════════════

  // GET /api/tenants/:id/billing - Get invoices & status
  const billingMatch = path.match(/^\/api\/tenants\/(\w+)\/billing$/);
  if (billingMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = billingMatch[1];

    // Security check: User must belong to tenant or be admin
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const invoices = await stripeService.listInvoices(tenantId);
      // Transform for frontend
      const invoicesMapped = invoices.map(inv => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: (inv.total / 100).toFixed(2),
        currency: inv.currency.toUpperCase(),
        status: inv.status,
        pdf_url: inv.invoice_pdf,
        hosted_url: inv.hosted_invoice_url
      }));

      sendJson(res, 200, {
        success: true,
        invoices: invoicesMapped
      });
    } catch (e) {
      console.error('[Billing API] Error:', e);
      sendError(res, 500, 'Billing service unavailable');
    }
    return;
  }

  // POST /api/tenants/:id/billing/portal - Get Stripe Portal Link
  const portalMatch = path.match(/^\/api\/tenants\/(\w+)\/billing\/portal$/);
  if (portalMatch && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = portalMatch[1];

    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const body = await parseBody(req);
      const returnUrl = body.returnUrl || req.headers.referer || 'https://vocalia.ma/app/client/billing.html';
      const url = await stripeService.getPortalLink(tenantId, returnUrl);

      sendJson(res, 200, { success: true, url });
    } catch (e) {
      console.error('[Billing API] Portal Error:', e);
      sendError(res, 500, 'Could not create portal session');
    }
    return;
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

    // Session 250.167: Tenant isolation — user must belong to tenant or be admin
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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
    const kbTenantId = kbListMatch[1];

    // Session 250.167: Tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== kbTenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }
    const tenantId = kbListMatch[1];

    try {
      const body = await parseBody(req);
      const { key, value, language = 'fr' } = body;

      if (!key || !value) {
        sendError(res, 400, 'key and value are required');
        return;
      }

      // D4 fix: validate language
      const ALLOWED_KB_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];
      if (!ALLOWED_KB_LANGS.includes(language)) {
        sendError(res, 400, `Invalid language: ${language}`);
        return;
      }

      // Load current KB, add entry, save
      const fs = require('fs');
      const path = require('path');
      const kbDir = path.join(__dirname, '../clients', sanitizeTenantId(tenantId), 'knowledge_base');
      const kbFile = path.join(kbDir, `kb_${language}.json`);

      // Ensure directory exists
      if (!fs.existsSync(kbDir)) {
        fs.mkdirSync(kbDir, { recursive: true });
      }

      // Load or create KB
      let kb = {};
      if (fs.existsSync(kbFile)) {
        try {
          kb = JSON.parse(fs.readFileSync(kbFile, 'utf8'));
        } catch (e) {
          console.error(`❌ [KB] Corrupted KB file: ${kbFile}`, e.message);
          sendError(res, 500, 'Knowledge base file is corrupted');
          return;
        }
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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }
    const key = kbDeleteMatch[2];

    try {
      const fs = require('fs');
      const pathModule = require('path');
      const language = query.lang || 'fr';
      // D3+D4 fix: sanitize tenantId + validate language
      const ALLOWED_KB_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];
      if (!ALLOWED_KB_LANGS.includes(language)) {
        sendError(res, 400, `Invalid language: ${language}`);
        return;
      }
      const kbFile = pathModule.join(__dirname, '../clients', sanitizeTenantId(tenantId), 'knowledge_base', `kb_${language}.json`);

      if (!fs.existsSync(kbFile)) {
        sendError(res, 404, 'KB file not found');
        return;
      }

      let kb;
      try {
        kb = JSON.parse(fs.readFileSync(kbFile, 'utf8'));
      } catch (e) {
        console.error(`❌ [KB] Corrupted KB file: ${kbFile}`, e.message);
        sendError(res, 500, 'Knowledge base file is corrupted');
        return;
      }
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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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

  // KB Stats - GET /api/kb/stats (admin-only: exposes cross-tenant data)
  if (path === '/api/kb/stats' && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      sendError(res, 403, 'Admin access required');
      return;
    }
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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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

    // Session 250.167: Tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const body = await parseBody(req);
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
          catalogType: catalogType
          // Session 250.190 Fix F9: Removed explicit dataPath — let connector use its own
          // absolute default (data/catalogs/{tenantId}), consistent with voice-ecommerce-tools
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
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const body = await parseBody(req);
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

  // ═══════════════════════════════════════════════════════════════
  // Session 250.71: CATALOG CONNECTOR ENDPOINTS (E-commerce Integration)
  // Endpoints:
  // - GET  /api/catalog/connectors               - List available connector types
  // - GET  /api/tenants/:id/catalog/connector    - Get tenant's connector config
  // - PUT  /api/tenants/:id/catalog/connector    - Configure tenant's connector
  // ═══════════════════════════════════════════════════════════════

  // List Available Connectors - GET /api/catalog/connectors
  if (path === '/api/catalog/connectors' && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;

    try {
      const { CatalogConnectorFactory } = require('./catalog-connector.cjs');
      const connectors = CatalogConnectorFactory.getAllConnectorsInfo();

      sendJson(res, 200, {
        success: true,
        connectors,
        total: connectors.length,
        market_coverage: '~64%+ (WooCommerce+Shopify+Magento+Square+Lightspeed)'
      });
    } catch (e) {
      sendError(res, 500, `Error loading connectors: ${e.message}`);
    }
    return;
  }

  // Get Tenant Connector Config - GET /api/tenants/:id/catalog/connector
  const connectorGetMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/connector$/);
  if (connectorGetMatch && method === 'GET') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = connectorGetMatch[1];
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const catalogStore = getCatalogStore();
      const connector = catalogStore.getConnector(tenantId);

      if (!connector) {
        sendJson(res, 200, {
          success: true,
          configured: false,
          connector: null,
          message: 'No connector configured for this tenant'
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        configured: true,
        connector: {
          type: connector.config?.source || 'custom',
          catalogType: connector.catalogType,
          status: connector.status,
          lastSync: connector.lastSync,
          lastError: connector.lastError
        }
      });
    } catch (e) {
      sendError(res, 500, `Error getting connector: ${e.message}`);
    }
    return;
  }

  // Configure Tenant Connector - PUT /api/tenants/:id/catalog/connector
  if (connectorGetMatch && method === 'PUT') {
    const user = await checkAuth(req, res);
    if (!user) return;
    const tenantId = connectorGetMatch[1];
    // Session 250.171: C3-AUDIT — tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    try {
      const body = await parseBody(req);
      const { CatalogConnectorFactory } = require('./catalog-connector.cjs');

      // Validate connector type
      if (!body.source) {
        sendError(res, 400, 'source required (shopify, woocommerce, square, lightspeed, magento, custom)');
        return;
      }

      // Validate config
      const validation = CatalogConnectorFactory.validateConfig(body.source, body);
      if (!validation.valid) {
        sendError(res, 400, `Invalid config: missing ${validation.missing.join(', ')}`);
        return;
      }

      // Register connector
      const catalogStore = getCatalogStore();
      await catalogStore.registerTenant(tenantId, {
        type: body.source,
        catalogType: body.catalogType || 'PRODUCTS',
        ...body
      });

      // Test connection
      const connector = catalogStore.getConnector(tenantId);
      const connected = await connector.connect();

      sendJson(res, 200, {
        success: true,
        configured: true,
        connected,
        connector: {
          type: body.source,
          catalogType: body.catalogType || 'PRODUCTS',
          status: connector.status
        },
        warnings: validation.warnings
      });

      // Broadcast update
      broadcastToTenant(tenantId, 'catalog', 'connector_configured', { type: body.source });
    } catch (e) {
      sendError(res, 500, `Error configuring connector: ${e.message}`);
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
      const body = await parseBody(req);
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
          catalogType: catalogType
          // Session 250.190 Fix F9: Removed explicit dataPath — use connector default
        }
      });

      // Generate ID if not provided
      const item = {
        id: body.id || `item_${Date.now()}`,
        name: body.name,
        category: body.category || 'default',
        price: body.price || 0,
        currency: body.currency || 'EUR',
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
      const body = await parseBody(req);
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
  // Session 250.74: CATALOG BROWSE/SEARCH/RECOMMENDATIONS (Widget Integration)
  // ═══════════════════════════════════════════════════════════════

  // Catalog Item Detail (Public) - GET /api/tenants/:id/catalog/detail/:itemId
  const catalogDetailMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/detail\/([^/]+)$/);
  if (catalogDetailMatch && method === 'GET') {
    // D8 fix: rate limit public endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    const [, tenantId, itemId] = catalogDetailMatch;
    // No auth required for public widget access

    try {
      const catalogStore = getCatalogStore();
      const catalogType = query.type || 'PRODUCTS';
      const item = catalogStore.getItem(tenantId, catalogType, itemId);

      if (!item) {
        sendError(res, 404, 'Item not found');
        return;
      }

      sendJson(res, 200, { success: true, item });
    } catch (e) {
      sendError(res, 500, `Catalog detail error: ${e.message}`);
    }
    return;
  }

  // Catalog Browse - POST /api/tenants/:id/catalog/browse
  const catalogBrowseMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/browse$/);
  if (catalogBrowseMatch && method === 'POST') {
    // D8 fix: rate limit public endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    const tenantId = catalogBrowseMatch[1];
    // No auth required for public widget access

    try {
      const body = await parseBody(req);
      const catalogStore = getCatalogStore();
      const catalogType = body.catalog_type || 'PRODUCTS';

      let items = catalogStore.getItems(tenantId, catalogType) || [];

      // Filter by category
      if (body.category) {
        const cat = body.category.toLowerCase();
        items = items.filter(i => i.category?.toLowerCase().includes(cat));
      }

      // Filter in stock only
      if (body.inStock !== false) {
        items = items.filter(i => i.in_stock !== false && i.available !== false);
      }

      // Sort by relevance (featured first, then by created date)
      items.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      // Apply limit
      const limit = Math.min(body.limit || 5, 20);
      items = items.slice(0, limit);

      sendJson(res, 200, {
        success: true,
        count: items.length,
        items,
        voiceSummary: items.length > 0
          ? `J'ai trouvé ${items.length} produits${body.category ? ` dans ${body.category}` : ''}.`
          : 'Aucun produit trouvé.'
      });
    } catch (e) {
      sendError(res, 500, `Catalog browse error: ${e.message}`);
    }
    return;
  }

  // Catalog Search - POST /api/tenants/:id/catalog/search
  const catalogSearchMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/search$/);
  if (catalogSearchMatch && method === 'POST') {
    // D8 fix: rate limit public endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    const tenantId = catalogSearchMatch[1];
    // No auth required for public widget access

    try {
      const body = await parseBody(req);
      const query = (body.q || body.query || '').toLowerCase().trim();

      if (!query) {
        sendJson(res, 200, { success: true, results: [], count: 0 });
        return;
      }

      const catalogStore = getCatalogStore();
      const catalogType = body.catalog_type || 'PRODUCTS';
      let items = catalogStore.getItems(tenantId, catalogType) || [];

      // Simple text search across name, description, category
      const queryTerms = query.split(/\s+/);
      items = items.filter(item => {
        const searchText = [
          item.name || '',
          item.description || '',
          item.category || '',
          item.tags?.join(' ') || ''
        ].join(' ').toLowerCase();

        return queryTerms.every(term => searchText.includes(term));
      });

      // Score and sort by relevance
      items = items.map(item => {
        let score = 0;
        const name = (item.name || '').toLowerCase();
        queryTerms.forEach(term => {
          if (name.includes(term)) score += 10;
          if (name.startsWith(term)) score += 5;
        });
        return { ...item, _score: score };
      }).sort((a, b) => b._score - a._score);

      // Remove score and limit results
      const limit = Math.min(body.limit || 5, 20);
      const results = items.slice(0, limit).map(({ _score, ...item }) => item);

      sendJson(res, 200, {
        success: true,
        query,
        count: results.length,
        results,
        voiceSummary: results.length > 0
          ? `J'ai trouvé ${results.length} résultat${results.length > 1 ? 's' : ''} pour "${query}".`
          : `Aucun résultat pour "${query}".`
      });
    } catch (e) {
      sendError(res, 500, `Catalog search error: ${e.message}`);
    }
    return;
  }

  // AI Recommendations - POST /api/recommendations (Session 250.79)
  // Uses AI-powered recommendation service: similar, bought_together, personalized
  if (path === '/api/recommendations' && method === 'POST') {
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const body = await parseBody(req);
      const tenantId = body.tenant_id;
      const type = body.recommendation_type || 'similar';

      if (!tenantId) {
        return sendError(res, 400, 'tenant_id is required');
      }

      // Session 250.155: Origin↔tenant cross-validation
      const originCheck = validateOriginTenant(req.headers.origin, tenantId);
      if (!originCheck.valid) {
        return sendError(res, 403, `Tenant validation failed: ${originCheck.reason}`);
      }

      const recommendationService = require('./recommendation-service.cjs');
      let result;

      switch (type) {
        case 'similar':
          if (!body.product_id) {
            return sendError(res, 400, 'product_id is required for similar recommendations');
          }
          result = await recommendationService.getSimilarProducts(
            tenantId,
            body.product_id,
            { topK: body.limit || 6 }
          );
          break;

        case 'bought_together':
          if (body.product_ids?.length > 0) {
            result = recommendationService.associationEngine.getCartRecommendations(
              tenantId,
              body.product_ids,
              body.limit || 5
            );
          } else if (body.product_id) {
            result = await recommendationService.getFrequentlyBoughtTogether(
              tenantId,
              body.product_id,
              body.limit || 4
            );
          } else {
            return sendError(res, 400, 'product_id or product_ids required for bought_together');
          }
          break;

        case 'personalized': {
          // Session 250.188: Auto-fetch UCP profile from shared store if not provided
          // Session 250.190: Fix F6 — lazy require in correct scope (was ReferenceError)
          const userId = body.user_id || 'anonymous';
          let ucpProfile = body.ucp_profile || null;
          if (!ucpProfile) {
            try {
              const { getInstance: getUCPStore } = require('./ucp-store.cjs');
              const ucpStore = getUCPStore();
              ucpProfile = ucpStore.getProfile(tenantId, userId) || {};
            } catch { ucpProfile = {}; }
          }
          result = await recommendationService.getPersonalizedRecommendations(
            tenantId,
            userId,
            ucpProfile,
            {
              topK: body.limit || 10,
              recentlyViewed: body.recently_viewed || [],
              recentlyPurchased: body.recently_purchased || []
            }
          );
          break;
        }

        default:
          return sendError(res, 400, `Unknown recommendation_type: ${type}`);
      }

      // Enrich with product details from catalog
      const catalogStore = getCatalogStore();
      const enrichedResults = await Promise.all(
        (result || []).map(async (rec) => {
          const productId = rec.productId || rec.id;
          const item = catalogStore.getItem(tenantId, 'PRODUCTS', productId);
          if (item) {
            return { ...rec, ...item };
          }
          return rec;
        })
      );

      sendJson(res, 200, {
        success: true,
        recommendation_type: type,
        count: enrichedResults.length,
        recommendations: enrichedResults
      });
    } catch (e) {
      console.error('[AI Recommendations] Error:', e.message);
      sendError(res, 500, `Recommendations error: ${e.message}`);
    }
    return;
  }

  // Catalog Recommendations - POST /api/tenants/:id/catalog/recommendations
  // (Simple rule-based fallback for basic recommendations)
  const catalogRecoMatch = path.match(/^\/api\/tenants\/(\w+)\/catalog\/recommendations$/);
  if (catalogRecoMatch && method === 'POST') {
    // D8 fix: rate limit public endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    const tenantId = catalogRecoMatch[1];
    // No auth required for public widget access

    try {
      const body = await parseBody(req);
      const catalogStore = getCatalogStore();
      const catalogType = body.catalog_type || 'PRODUCTS';
      let items = catalogStore.getItems(tenantId, catalogType) || [];

      // Filter in stock
      items = items.filter(i => i.in_stock !== false && i.available !== false);

      // Exclude already viewed products
      const viewed = body.productsViewed || [];
      if (viewed.length > 0) {
        items = items.filter(i => !viewed.includes(i.id));
      }

      // Score items for recommendations
      items = items.map(item => {
        let score = 0;

        // Boost featured items
        if (item.featured) score += 20;

        // Boost items on sale
        if (item.compare_at_price && item.compare_at_price > item.price) score += 15;

        // Boost new items (last 7 days)
        const createdAt = new Date(item.createdAt || 0);
        const ageMs = Date.now() - createdAt.getTime();
        if (ageMs < 7 * 24 * 60 * 60 * 1000) score += 10;

        // Boost highly rated items
        if (item.rating >= 4.5) score += 10;
        else if (item.rating >= 4.0) score += 5;

        // Add some randomness for variety
        score += Math.random() * 5;

        return { ...item, _score: score };
      });

      // Sort by score
      items.sort((a, b) => b._score - a._score);

      // Apply LTV-based limit
      const ltvLimits = { bronze: 3, silver: 4, gold: 5, platinum: 6, diamond: 8 };
      const limit = ltvLimits[body.ltvTier] || body.limit || 5;

      const recommendations = items.slice(0, limit).map(({ _score, ...item }) => item);

      sendJson(res, 200, {
        success: true,
        count: recommendations.length,
        recommendations,
        ltvTier: body.ltvTier || 'bronze',
        voiceSummary: recommendations.length > 0
          ? `Voici ${recommendations.length} produits recommandés pour vous.`
          : 'Je n\'ai pas de recommandations pour le moment.'
      });
    } catch (e) {
      sendError(res, 500, `Recommendations error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // END CATALOG ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // Session 250.113: LEADS ENDPOINT (Voice Quiz + Widget Lead Capture)
  // ═══════════════════════════════════════════════════════════════

  // Create Lead - POST /api/leads
  if (path === '/api/leads' && method === 'POST') {
    // P2 fix: rate limit public lead capture endpoint
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const body = await parseBody(req);
      const { tenant_id, source, name, email, phone, quiz_answers } = body;

      if (!tenant_id) {
        return sendError(res, 400, 'tenant_id is required');
      }

      // Session 250.155: Origin↔tenant cross-validation
      const originCheck = validateOriginTenant(req.headers.origin, tenant_id);
      if (!originCheck.valid) {
        return sendError(res, 403, `Tenant validation failed: ${originCheck.reason}`);
      }

      const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const lead = {
        id: leadId,
        tenant_id,
        source: source || 'widget',
        name: name || null,
        email: email || null,
        phone: phone || null,
        quiz_answers: quiz_answers || null,
        created_at: new Date().toISOString(),
        status: 'new'
      };

      // Store in memory (D10 fix: cap at 1000 entries)
      if (!global.leadsQueue) {
        global.leadsQueue = [];
      }
      global.leadsQueue.push(lead);
      if (global.leadsQueue.length > 1000) {
        global.leadsQueue = global.leadsQueue.slice(-1000);
      }

      // D7 fix: sheetsDB was never defined — use getDB()
      try {
        const db = getDB();
        if (db) {
          await db.create('leads', lead);
        }
      } catch (e) {
        console.warn('[Leads] Google Sheets persist failed:', e.message);
      }

      sendJson(res, 201, {
        success: true,
        lead_id: leadId,
        message: 'Lead captured successfully'
      });
    } catch (e) {
      sendError(res, 500, `Lead capture error: ${e.message}`);
    }
    return;
  }

  // Session 250.82: CART RECOVERY ENDPOINTS (Voice + SMS + Email)
  // Multi-channel abandoned cart recovery with voice callbacks
  // ═══════════════════════════════════════════════════════════════

  // Cart Recovery - POST /api/cart-recovery
  // Triggers voice callback, SMS, or email reminder for abandoned carts
  if (path === '/api/cart-recovery' && method === 'POST') {
    // P1 fix: STRICT rate limit — triggers external actions (calls/SMS/email)
    const rateLimited = await applyRateLimit(req, res, actionLimiter);
    if (rateLimited) return;
    try {
      const body = await parseBody(req);
      const { tenant_id, channel, contact, cart, discount_percent, language, checkout_url } = body;

      if (!tenant_id || !channel || !contact) {
        return sendError(res, 400, 'tenant_id, channel, and contact are required');
      }

      // Session 250.155: Origin↔tenant cross-validation
      const originCheck = validateOriginTenant(req.headers.origin, tenant_id);
      if (!originCheck.valid) {
        return sendError(res, 403, `Tenant validation failed: ${originCheck.reason}`);
      }

      if (!['voice', 'sms', 'email'].includes(channel)) {
        return sendError(res, 400, 'channel must be voice, sms, or email');
      }

      // Generate recovery link with discount code
      const discountCode = `COMEBACK${discount_percent || 10}`;
      const recoveryUrl = checkout_url
        ? `${checkout_url}?discount=${discountCode}&recovery=1`
        : null;

      // Store recovery request
      const recoveryId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const recoveryRequest = {
        id: recoveryId,
        tenant_id,
        channel,
        contact,
        cart_total: cart?.total || 0,
        cart_items: cart?.items?.length || 0,
        discount_percent: discount_percent || 10,
        language: language || 'fr',
        checkout_url: recoveryUrl,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // Store in memory + persist to file
      if (!global.cartRecoveryQueue) {
        global.cartRecoveryQueue = [];
        // Load existing from disk
        try {
          const recoveryPath = path.join(__dirname, '..', 'data', 'cart-recovery.json');
          if (fs.existsSync(recoveryPath)) {
            global.cartRecoveryQueue = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
          }
        } catch {}
      }
      global.cartRecoveryQueue.push(recoveryRequest);
      // D11 fix: trim in-memory queue (not just on disk)
      if (global.cartRecoveryQueue.length > 500) {
        global.cartRecoveryQueue = global.cartRecoveryQueue.slice(-500);
      }
      // Persist to disk
      try {
        const recoveryPath = path.join(__dirname, '..', 'data', 'cart-recovery.json');
        fs.writeFileSync(recoveryPath, JSON.stringify(global.cartRecoveryQueue, null, 2));
      } catch (e) {
        console.warn('[Cart Recovery] File persist failed:', e.message);
      }

      // Process based on channel
      let result = { success: false };

      switch (channel) {
        case 'voice':
          // Queue voice callback via telephony bridge
          try {
            const telephony = require('../telephony/voice-telephony-bridge.cjs');
            if (telephony.queueCartRecoveryCallback) {
              result = await telephony.queueCartRecoveryCallback({
                phone: contact,
                tenantId: tenant_id,
                cart,
                discount: discount_percent,
                language,
                recoveryUrl
              });
            } else {
              // Fallback: store for manual processing
              result = { success: true, queued: true, method: 'manual_callback_queue' };
            }
          } catch (e) {
            console.error('[Cart Recovery] Voice callback error:', e.message);
            result = { success: true, queued: true, method: 'fallback_queue' };
          }
          break;

        case 'sms':
          // Send SMS via Twilio
          try {
            const telephony = require('../telephony/voice-telephony-bridge.cjs');
            if (telephony.sendMessage) {
              const messages = {
                fr: `VocalIA: Votre panier vous attend! ${discount_percent}% de reduction: ${recoveryUrl}`,
                en: `VocalIA: Your cart is waiting! ${discount_percent}% off: ${recoveryUrl}`,
                es: `VocalIA: Tu carrito te espera! ${discount_percent}% descuento: ${recoveryUrl}`,
                ar: `VocalIA: سلتك بانتظارك! خصم ${discount_percent}%: ${recoveryUrl}`,
                ary: `VocalIA: الباني ديالك كيتسناك! ${discount_percent}% تخفيض: ${recoveryUrl}`
              };
              result = await telephony.sendMessage({
                to: contact,
                message: messages[language] || messages.fr,
                channel: 'sms'
              });
            } else {
              result = { success: true, queued: true, method: 'sms_fallback' };
            }
          } catch (e) {
            console.error('[Cart Recovery] SMS error:', e.message);
            result = { success: true, queued: true, method: 'sms_fallback' };
          }
          break;

        case 'email':
          // Send email via configured SMTP
          try {
            const emailService = require('./email-service.cjs');
            if (emailService.sendCartRecoveryEmail) {
              result = await emailService.sendCartRecoveryEmail({
                to: contact,
                tenantId: tenant_id,
                cart,
                discount: discount_percent,
                language,
                recoveryUrl
              });
            } else {
              result = { success: true, queued: true, method: 'email_fallback' };
            }
          } catch (e) {
            console.error('[Cart Recovery] Email error:', e.message);
            result = { success: true, queued: true, method: 'email_fallback' };
          }
          break;
      }

      // Update status
      recoveryRequest.status = result.success ? 'sent' : 'queued';
      recoveryRequest.result = result;

      // Broadcast via WebSocket
      if (global.wss) {
        const wsMessage = JSON.stringify({
          type: 'cart_recovery',
          data: recoveryRequest
        });
        global.wss.clients.forEach(client => {
          if (client.readyState === 1 && client.channel === 'catalog') {
            client.send(wsMessage);
          }
        });
      }

      sendJson(res, 200, {
        success: true,
        recovery_id: recoveryId,
        channel,
        status: recoveryRequest.status,
        message: result.message || `Recovery ${channel} ${recoveryRequest.status}`
      });
    } catch (e) {
      console.error('[Cart Recovery] Error:', e.message);
      sendError(res, 500, `Cart recovery error: ${e.message}`);
    }
    return;
  }

  // Cart Recovery Queue - GET /api/cart-recovery (Admin only)
  if (path === '/api/cart-recovery' && method === 'GET') {
    const user = await checkAdmin(req, res);
    if (!user) return;

    // Load from disk if not in memory
    if (!global.cartRecoveryQueue) {
      global.cartRecoveryQueue = [];
      try {
        const recoveryPath = path.join(__dirname, '..', 'data', 'cart-recovery.json');
        if (fs.existsSync(recoveryPath)) {
          global.cartRecoveryQueue = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
        }
      } catch {}
    }
    const queue = global.cartRecoveryQueue;
    const tenantFilter = query.tenant_id;

    const filtered = tenantFilter
      ? queue.filter(r => r.tenant_id === tenantFilter)
      : queue;

    sendJson(res, 200, {
      success: true,
      count: filtered.length,
      recoveries: filtered.slice(-100) // Last 100
    });
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // Session 250.154: PROMO CODE SERVER-SIDE VALIDATION
  // ═══════════════════════════════════════════════════════════════

  // Promo code store (persisted to file)
  if (!global.promoCodes) {
    global.promoCodes = new Map();
    try {
      const promoPath = path.join(__dirname, '..', 'data', 'promo-codes.json');
      if (fs.existsSync(promoPath)) {
        const entries = JSON.parse(fs.readFileSync(promoPath, 'utf8'));
        for (const [k, v] of entries) { global.promoCodes.set(k, v); }
      }
    } catch {}
  }

  function _persistPromoCodes() {
    try {
      const promoPath = path.join(__dirname, '..', 'data', 'promo-codes.json');
      const entries = [...global.promoCodes.entries()].slice(-1000);
      fs.writeFileSync(promoPath, JSON.stringify(entries, null, 2));
    } catch (e) {
      console.warn('[Promo] File persist failed:', e.message);
    }
  }

  // POST /api/promo/generate — Generate a unique, time-limited promo code
  if (path === '/api/promo/generate' && method === 'POST') {
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const body = await parseBody(req);
      const { tenant_id, prize_id, discount_percent, email } = body;

      if (!tenant_id || !prize_id) {
        return sendError(res, 400, 'tenant_id and prize_id are required');
      }

      // Session 250.155: Origin↔tenant cross-validation
      const originCheck = validateOriginTenant(req.headers.origin, tenant_id);
      if (!originCheck.valid) {
        return sendError(res, 403, `Tenant validation failed: ${originCheck.reason}`);
      }

      const discount = parseInt(discount_percent, 10) || 10;
      if (discount < 1 || discount > 50) {
        return sendError(res, 400, 'discount_percent must be between 1 and 50');
      }

      // Generate unique code: PREFIX + random + timestamp suffix
      const prefix = prize_id === 'freeShipping' ? 'SHIP' : `SAVE${discount}`;
      const unique = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${unique}`;

      const promoEntry = {
        code,
        tenant_id,
        prize_id,
        discount_percent: discount,
        email: email || null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 3600000).toISOString(), // 72h expiry
        used: false,
        used_at: null
      };

      global.promoCodes.set(code, promoEntry);
      _persistPromoCodes();
      console.log(`✅ [Promo] Generated ${code} for tenant ${tenant_id} (${discount}% off)`);

      sendJson(res, 200, {
        success: true,
        code,
        discount_percent: discount,
        expires_at: promoEntry.expires_at
      });
    } catch (e) {
      console.error('❌ [Promo] Generate error:', e.message);
      sendError(res, 500, `Promo generation error: ${e.message}`);
    }
    return;
  }

  // POST /api/promo/validate — Validate and optionally redeem a promo code
  if (path === '/api/promo/validate' && method === 'POST') {
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const body = await parseBody(req);
      const { code, tenant_id, redeem } = body;

      if (!code || !tenant_id) {
        return sendError(res, 400, 'code and tenant_id are required');
      }

      // Session 250.155: Origin↔tenant cross-validation
      const originCheck = validateOriginTenant(req.headers.origin, tenant_id);
      if (!originCheck.valid) {
        return sendError(res, 403, `Tenant validation failed: ${originCheck.reason}`);
      }

      const entry = global.promoCodes.get(code);

      if (!entry) {
        return sendJson(res, 200, { valid: false, reason: 'invalid_code' });
      }

      if (entry.tenant_id !== tenant_id) {
        return sendJson(res, 200, { valid: false, reason: 'wrong_tenant' });
      }

      if (entry.used) {
        return sendJson(res, 200, { valid: false, reason: 'already_used', used_at: entry.used_at });
      }

      if (new Date(entry.expires_at) < new Date()) {
        return sendJson(res, 200, { valid: false, reason: 'expired', expires_at: entry.expires_at });
      }

      // Valid code
      if (redeem) {
        entry.used = true;
        entry.used_at = new Date().toISOString();
        _persistPromoCodes();
        console.log(`✅ [Promo] Redeemed ${code} for tenant ${tenant_id}`);
      }

      sendJson(res, 200, {
        valid: true,
        discount_percent: entry.discount_percent,
        prize_id: entry.prize_id,
        expires_at: entry.expires_at,
        redeemed: !!redeem
      });
    } catch (e) {
      console.error('❌ [Promo] Validate error:', e.message);
      sendError(res, 500, `Promo validation error: ${e.message}`);
    }
    return;
  }

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

    // Session 250.167: Tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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

    // Session 250.167: Tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

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

    // Session 250.167: Tenant isolation
    if (user.role !== 'admin' && user.tenant_id !== tenantId) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    // Session 250.143: Feature gating — export restricted to Pro/ECOM/Telephony plans
    try {
      const tenantConfig = getDB().getTenantConfig(tenantId);
      const plan = tenantConfig?.plan || 'starter';
      const exportAllowed = tenantConfig?.features?.export !== undefined
        ? !!tenantConfig.features.export
        : ['pro', 'ecommerce', 'telephony'].includes(plan);
      if (!exportAllowed) {
        sendError(res, 403, 'Export not available on Starter plan. Upgrade to Pro or higher.');
        return;
      }
    } catch (planErr) {
      // D13 fix: fail closed — deny export if plan check fails
      console.error('[DB-API] Plan check error:', planErr.message);
      sendError(res, 503, 'Unable to verify plan — export temporarily unavailable');
      return;
    }

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
        ...getCorsHeaders(req),
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

  // Session 250.170 (M9 fix): Force quota sync — admin only
  if (path === '/api/quota/sync' && method === 'POST') {
    const user = await checkAuth(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      sendError(res, 403, 'Admin access required');
      return;
    }
    try {
      const db = getDB();
      const result = await db.syncAllTenantPlans();
      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 500, `Quota sync error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // Session 250.74: UCP ENDPOINTS FOR WIDGET INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  // UCP Sync - POST /api/ucp/sync
  if (path === '/api/ucp/sync' && method === 'POST') {
    // No auth required for widget access
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');
      const body = await parseBody(req);

      if (!body.tenantId) {
        sendError(res, 400, 'tenantId required');
        return;
      }

      const ucpStore = getUCPStore();
      const userId = body.userId || `anon_${Date.now()}`;
      const countryCode = body.countryCode || 'MA';

      // Session 250.190 Fix F10: Market rules aligned with business strategy (MENA→AR+USD)
      // and consistent with geo-detect.js + client-registry.cjs
      const marketRules = {
        MA: { locale: 'fr-MA', currency: 'MAD', market: 'morocco' },
        FR: { locale: 'fr-FR', currency: 'EUR', market: 'europe' },
        BE: { locale: 'fr-BE', currency: 'EUR', market: 'europe' },
        ES: { locale: 'es-ES', currency: 'EUR', market: 'europe' },
        US: { locale: 'en-US', currency: 'USD', market: 'international' },
        GB: { locale: 'en-GB', currency: 'USD', market: 'international' },
        SA: { locale: 'ar-SA', currency: 'USD', market: 'mena' },
        AE: { locale: 'ar-AE', currency: 'USD', market: 'mena' }
      };

      const rules = marketRules[countryCode] || marketRules.MA;

      // Get or create profile
      let profile = ucpStore.getProfile(body.tenantId, userId);

      if (!profile) {
        profile = ucpStore.upsertProfile(body.tenantId, userId, {
          country: countryCode,
          ...rules,
          totalInteractions: 0,
          lifetimeValue: 0
        });
      }

      // Get LTV tier
      const ltvData = ucpStore.getLTV(body.tenantId, userId);
      const ltvTier = ltvData?.tier || 'bronze';

      sendJson(res, 200, {
        success: true,
        profile,
        ltvTier,
        rules
      });
    } catch (e) {
      sendError(res, 500, `UCP sync error: ${e.message}`);
    }
    return;
  }

  // UCP Record Interaction - POST /api/ucp/interaction
  if (path === '/api/ucp/interaction' && method === 'POST') {
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');
      const body = await parseBody(req);

      if (!body.tenantId || !body.userId) {
        sendError(res, 400, 'tenantId and userId required');
        return;
      }

      const ucpStore = getUCPStore();

      const interaction = {
        type: body.type || 'widget_chat',
        timestamp: new Date().toISOString(),
        channel: body.channel || 'web_widget',
        metadata: body.metadata || {}
      };

      ucpStore.recordInteraction(body.tenantId, body.userId, interaction);

      sendJson(res, 200, { success: true, interaction });
    } catch (e) {
      sendError(res, 500, `UCP interaction error: ${e.message}`);
    }
    return;
  }

  // UCP Track Event - POST /api/ucp/event
  // Uses recordInteraction with type='behavioral_event'
  if (path === '/api/ucp/event' && method === 'POST') {
    // P3 fix: rate limit public widget endpoints
    const rateLimited = await applyRateLimit(req, res, publicLimiter);
    if (rateLimited) return;
    try {
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');
      const body = await parseBody(req);

      if (!body.tenantId || !body.userId || !body.event) {
        sendError(res, 400, 'tenantId, userId, and event required');
        return;
      }

      const ucpStore = getUCPStore();

      // Use recordInteraction with event metadata
      const interaction = {
        type: 'behavioral_event',
        channel: body.source || 'widget',
        event_name: body.event,
        event_value: body.value,
        timestamp: new Date().toISOString()
      };

      ucpStore.recordInteraction(body.tenantId, body.userId, interaction);

      sendJson(res, 200, { success: true, event: interaction });
    } catch (e) {
      sendError(res, 500, `UCP event error: ${e.message}`);
    }
    return;
  }

  // Widget Interactions - GET /api/tenants/:id/widget/interactions
  // Returns all widget interactions for analytics dashboard (Session 250.74)
  const widgetInteractionsMatch = path.match(/^\/api\/tenants\/([^\/]+)\/widget\/interactions$/);
  if (widgetInteractionsMatch && method === 'GET') {
    // D2 fix: require auth + tenant isolation
    const user = await checkAuth(req, res);
    if (!user) return;
    try {
      const tenantId = widgetInteractionsMatch[1];
      if (user.role !== 'admin' && user.tenant_id !== tenantId) {
        sendError(res, 403, 'Forbidden');
        return;
      }
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');
      const ucpStore = getUCPStore();

      // Get all interactions from UCP store
      const interactions = [];
      const profiles = ucpStore.getAllProfiles(tenantId) || [];

      profiles.forEach(profile => {
        if (profile.interactions && Array.isArray(profile.interactions)) {
          profile.interactions.forEach(interaction => {
            interactions.push({
              ...interaction,
              user_id: profile.userId,
              tenant_id: tenantId
            });
          });
        }
      });

      // Sort by timestamp descending
      interactions.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

      sendJson(res, 200, { data: interactions, count: interactions.length });
    } catch (e) {
      sendError(res, 500, `Widget interactions error: ${e.message}`);
    }
    return;
  }

  // UCP Profiles - GET /api/tenants/:id/ucp/profiles
  // Returns all UCP profiles for LTV distribution analytics (Session 250.74)
  const ucpProfilesMatch = path.match(/^\/api\/tenants\/([^\/]+)\/ucp\/profiles$/);
  if (ucpProfilesMatch && method === 'GET') {
    // D2 fix: require auth + tenant isolation
    const user = await checkAuth(req, res);
    if (!user) return;
    try {
      const tenantId = ucpProfilesMatch[1];
      if (user.role !== 'admin' && user.tenant_id !== tenantId) {
        sendError(res, 403, 'Forbidden');
        return;
      }
      const { getInstance: getUCPStore } = require('./ucp-store.cjs');
      const ucpStore = getUCPStore();

      const profiles = ucpStore.getAllProfiles(tenantId) || [];

      // Map to analytics-friendly format
      const analyticsProfiles = profiles.map(p => ({
        user_id: p.userId,
        ltv_tier: p.ltv?.tier || 'bronze',
        ltv_value: p.ltv?.value || 0,
        total_interactions: (p.interactions || []).length,
        last_active: p.lastUpdated
      }));

      sendJson(res, 200, { data: analyticsProfiles, count: analyticsProfiles.length });
    } catch (e) {
      sendError(res, 500, `UCP profiles error: ${e.message}`);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // END UCP ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

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

        // Session 250.97quinquies: Auto-provision KB on tenant creation
        if (sheet === 'tenants' && created.id) {
          try {
            const { onTenantCreated } = require('./kb-provisioner.cjs');
            await onTenantCreated(created);
          } catch (kbErr) {
            console.error(`[DB-API] KB provisioning failed for ${created.id}:`, kbErr.message);
            // Don't fail tenant creation if KB provisioning fails
          }
        }

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
  // H5 fix: Accept token from Sec-WebSocket-Protocol header OR first message (not query string)
  // Browser WebSocket API can't set custom headers, so we use subprotocol for token transport
  const parsedUrl = url.parse(req.url, true);
  const headerToken = req.headers['sec-websocket-protocol'];
  const queryToken = parsedUrl.query.token; // Backward compat (deprecated)
  const token = headerToken || queryToken;

  if (queryToken && !headerToken) {
    console.warn('⚠️ [WS] Token in query string is deprecated — use Sec-WebSocket-Protocol header');
  }

  if (!token) {
    // Allow unauthenticated connection — must send auth message within 5s
    ws.isAlive = true;
    ws.authenticated = false;
    wsClients.set(ws, { user: null, channels: new Set() });

    const authTimeout = setTimeout(() => {
      if (!ws.authenticated) {
        ws.close(4001, 'Authentication timeout — send auth message within 5 seconds');
      }
    }, 5000);
    ws._authTimeout = authTimeout;
  } else {
    let user;
    try {
      user = authService.verifyToken(token);
    } catch (e) {
      ws.close(4002, 'Invalid or expired token');
      return;
    }

    ws.isAlive = true;
    ws.authenticated = true;
    wsClients.set(ws, { user, channels: new Set() });
    console.log(`✅ [WS] Client authenticated via ${headerToken ? 'header' : 'query'}: ${user.role}`);

    ws.send(JSON.stringify({
      type: 'connected',
      user: { id: user.sub, role: user.role },
      timestamp: new Date().toISOString()
    }));
  }

  // Handle pong for heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle incoming messages
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const clientData = wsClients.get(ws);

      // H5: Handle auth message for token-less connections
      if (msg.type === 'auth') {
        if (ws.authenticated) return; // Already authenticated
        try {
          const user = authService.verifyToken(msg.token);
          ws.authenticated = true;
          if (ws._authTimeout) clearTimeout(ws._authTimeout);
          clientData.user = user;
          wsClients.set(ws, clientData);
          console.log(`✅ [WS] Client authenticated via message: ${user.role}`);
          ws.send(JSON.stringify({
            type: 'connected',
            user: { id: user.sub, role: user.role },
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          ws.close(4002, 'Invalid or expired token');
        }
        return;
      }

      // Reject unauthenticated messages (except auth)
      if (!ws.authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }

      switch (msg.type) {
        case 'subscribe':
          // Subscribe to channel(s)
          const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          channels.forEach(ch => {
            // Admin-only channels
            if (['hitl', 'users', 'auth_sessions'].includes(ch) && clientData.user?.role !== 'admin') {
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

  // Handle close (D1 fix: use wsClients instead of block-scoped user)
  ws.on('close', () => {
    const clientEmail = wsClients.get(ws)?.user?.email || 'anonymous';
    console.log(`🔌 [WS] Client disconnected: ${clientEmail}`);
    wsClients.delete(ws);
  });

  // Handle errors
  ws.on('error', (err) => {
    const clientEmail = wsClients.get(ws)?.user?.email || 'anonymous';
    console.error(`❌ [WS] Error for ${clientEmail}:`, err.message);
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
    // Session 250.170 (M9 fix): Start periodic quota sync
    try {
      const db = getDB();
      db.startQuotaSync();
    } catch (e) {
      console.warn('[QuotaSync] Failed to start periodic sync:', e.message);
    }
  });

  const gracefulShutdown = (signal) => {
    console.log(`\n[DB-API] ${signal} received. Shutting down...`);
    server.close(() => {
      wss.close();
      console.log('[DB-API] Graceful shutdown complete.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[DB-API] Forcing shutdown after 10s.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('❌ [DB-API] Uncaught exception:', err.message);
    console.error(err.stack);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ [DB-API] Unhandled rejection:', reason);
  });

  return { server, wss };
}

// CLI
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer, handleRequest, broadcast, broadcastToTenant, wsClients,
  // Pure utilities (exported for testing)
  filterUserRecord, filterUserRecords, getCorsHeaders, parseBody, sendJson, sendError,
  ALLOWED_SHEETS, CORS_ALLOWED_ORIGINS
};
