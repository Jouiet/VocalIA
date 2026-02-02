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
const { getDB } = require('./GoogleSheetsDB.cjs');
const authService = require('./auth-service.cjs');
const { requireAuth, requireAdmin, rateLimit, extractToken } = require('./auth-middleware.cjs');

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

      const result = await authService.login({ email, password, rememberMe: remember_me });
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const { refresh_token } = body;
      await authService.logout(refresh_token);
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

  // HITL Endpoints
  if (path.startsWith('/api/hitl/')) {
    const handled = await handleHITLRequest(req, res, path, method);
    if (handled) return;
  }

  // Logs Endpoint with real-time support
  if (path === '/api/logs' && method === 'GET') {
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

  // Health check
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

  const db = getDB();

  try {
    switch (method) {
      // GET /api/db/:sheet - List all or query
      case 'GET':
        if (id) {
          // GET /api/db/:sheet/:id - Get by ID
          const record = await db.findById(sheet, id);
          if (!record) {
            sendError(res, 404, 'Record not found');
            return;
          }
          sendJson(res, 200, record);
        } else if (Object.keys(query).length > 0) {
          // GET /api/db/:sheet?field=value - Query
          const records = await db.find(sheet, query);
          sendJson(res, 200, { count: records.length, data: records });
        } else {
          // GET /api/db/:sheet - List all
          const records = await db.findAll(sheet);
          sendJson(res, 200, { count: records.length, data: records });
        }
        break;

      // POST /api/db/:sheet - Create
      case 'POST':
        const createData = await parseBody(req);
        const created = await db.create(sheet, createData);
        sendJson(res, 201, created);
        break;

      // PUT /api/db/:sheet/:id - Update
      case 'PUT':
        if (!id) {
          sendError(res, 400, 'ID required for update');
          return;
        }
        const updateData = await parseBody(req);
        const updated = await db.update(sheet, id, updateData);
        sendJson(res, 200, updated);
        break;

      // DELETE /api/db/:sheet/:id - Delete
      case 'DELETE':
        if (!id) {
          sendError(res, 400, 'ID required for delete');
          return;
        }
        await db.delete(sheet, id);
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
 * Start server
 */
async function startServer() {
  // Initialize auth service with database
  const db = getDB();
  authService.init(db);

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║       VocalIA Database + Auth API                 ║
╠═══════════════════════════════════════════════════╣
║  Port: ${PORT}                                       ║
║  URL:  http://localhost:${PORT}                     ║
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
║  Sheets: tenants, sessions, logs, users           ║
╚═══════════════════════════════════════════════════╝
`);
  });

  return server;
}

// CLI
if (require.main === module) {
  startServer();
}

module.exports = { startServer, handleRequest };
