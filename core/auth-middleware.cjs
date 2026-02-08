/**
 * VocalIA Authentication Middleware
 * Session 250.55: Express-compatible auth middleware
 *
 * Usage:
 *   const { requireAuth, requireRole, requireTenant } = require('./auth-middleware.cjs');
 *
 *   // Protect any route
 *   app.get('/api/protected', requireAuth, (req, res) => { ... });
 *
 *   // Require specific role
 *   app.get('/api/admin', requireAuth, requireRole(['admin']), (req, res) => { ... });
 *
 *   // Require tenant access
 *   app.get('/api/tenant/:tenantId', requireAuth, requireTenant, (req, res) => { ... });
 */

'use strict';

const authService = require('./auth-service.cjs');

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Main authentication middleware
 * Verifies JWT token and attaches user to request
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return sendError(res, 401, 'Authorization required', 'MISSING_TOKEN');
    }

    // Verify token and get user
    const user = await authService.verifyAccessToken(token);

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof authService.AuthError) {
      return sendError(res, error.status, error.message, error.code);
    }
    console.error('[Auth Middleware] Error:', error.message);
    return sendError(res, 401, 'Invalid token', 'INVALID_TOKEN');
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const user = await authService.verifyAccessToken(token);
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Token invalid but optional, continue without user
    next();
  }
}

/**
 * Role-based authorization middleware
 * Must be used after requireAuth
 *
 * @param {string[]} allowedRoles - Array of allowed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', 'NOT_AUTHENTICATED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Insufficient permissions', 'FORBIDDEN');
    }

    next();
  };
}

/**
 * Permission-based authorization middleware
 * Must be used after requireAuth
 *
 * @param {string[]} requiredPermissions - Array of required permissions
 */
function requirePermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', 'NOT_AUTHENTICATED');
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasAll) {
      return sendError(res, 403, 'Insufficient permissions', 'FORBIDDEN');
    }

    next();
  };
}

/**
 * Tenant isolation middleware
 * Ensures user can only access their own tenant's data
 * Must be used after requireAuth
 */
function requireTenant(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', 'NOT_AUTHENTICATED');
  }

  // Admins can access any tenant
  if (req.user.role === 'admin') {
    return next();
  }

  // Get requested tenant from params, query, or body
  const requestedTenant =
    req.params?.tenantId ||
    req.params?.tenant_id ||
    req.query?.tenant_id ||
    req.body?.tenant_id;

  // If no tenant specified, filter to user's tenant
  if (!requestedTenant) {
    req.tenantFilter = req.user.tenant_id;
    return next();
  }

  // Verify user belongs to requested tenant
  if (requestedTenant !== req.user.tenant_id) {
    return sendError(res, 403, 'Access denied to this tenant', 'TENANT_FORBIDDEN');
  }

  req.tenantFilter = requestedTenant;
  next();
}

/**
 * Admin only middleware
 * Shortcut for requireRole(['admin'])
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', 'NOT_AUTHENTICATED');
  }

  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required', 'ADMIN_REQUIRED');
  }

  next();
}

/**
 * Email verified middleware
 * Requires the user's email to be verified
 */
function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', 'NOT_AUTHENTICATED');
  }

  if (!req.user.email_verified) {
    return sendError(res, 403, 'Email verification required', 'EMAIL_NOT_VERIFIED');
  }

  next();
}

/**
 * Rate limit state (in-memory, use Redis for production scale)
 */
const rateLimitState = new Map();
const RATE_LIMIT_MAX_ENTRIES = 10000; // Session 250.167: Cap to prevent memory DoS

/**
 * Rate limiting middleware
 *
 * @param {object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} [options.keyGenerator] - Function to generate rate limit key
 */
function rateLimit({ windowMs = 60000, max = 100, keyGenerator = null } = {}) {
  return (req, res, next) => {
    // Generate key based on IP + optional user ID
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const userId = req.user?.id || '';
    const key = keyGenerator ? keyGenerator(req) : `${ip}:${userId}`;

    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit entry
    let entry = rateLimitState.get(key);
    if (!entry || entry.windowStart < windowStart) {
      entry = { windowStart: now, count: 0 };
    }

    entry.count++;
    // Session 250.167: Enforce maxSize to prevent memory DoS from distributed IPs
    if (rateLimitState.size >= RATE_LIMIT_MAX_ENTRIES && !rateLimitState.has(key)) {
      return sendError(res, 429, 'Too many requests', 'RATE_LIMITED');
    }
    rateLimitState.set(key, entry);

    // Check limit
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return sendError(res, 429, 'Too many requests', 'RATE_LIMITED');
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + windowMs) / 1000));

    next();
  };
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
function cleanupRateLimits() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [key, entry] of rateLimitState.entries()) {
    if (now - entry.windowStart > maxAge) {
      rateLimitState.delete(key);
    }
  }
}

// Cleanup every 5 minutes
// unref() allows Node.js to exit even if interval is active (for tests)
const rateLimitCleanup = setInterval(cleanupRateLimits, 5 * 60 * 1000);
rateLimitCleanup.unref();

/**
 * Send error response
 */
function sendError(res, status, message, code = 'ERROR') {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: message,
    code: code,
    status: status,
    timestamp: new Date().toISOString()
  }));
}

/**
 * CORS middleware for protected routes
 */
function corsMiddleware(allowedOrigins = ['*']) {
  return (req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    next();
  };
}

// Export middleware functions
module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireTenant,
  requireAdmin,
  requireVerifiedEmail,
  rateLimit,
  corsMiddleware,
  extractToken,
  sendError,
  cleanupRateLimits
};
