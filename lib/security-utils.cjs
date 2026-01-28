#!/usr/bin/env node
/**
 * SECURITY UTILITIES MODULE
 * Centralized security functions for all automations
 *
 * Fixes: Timeouts, Rate Limiting, Input Validation, Secure Random,
 *        Path Sanitization, Exponential Backoff, Safe Polling
 *
 * Date: 2025-12-29
 * Version: 1.0.0
 */

const crypto = require('crypto');
const path = require('path');
const { URL } = require('url');

// ============================================================================
// 1. FETCH WITH TIMEOUT (Fixes HIGH: 42 files without timeout)
// ============================================================================

/**
 * Fetch with automatic timeout and abort signal
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// 2. EXPONENTIAL BACKOFF RETRY (Fixes HIGH: Linear backoff)
// ============================================================================

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {object} options - Retry options
 * @returns {Promise<any>}
 */
async function retryWithExponentialBackoff(operation, options = {}) {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    factor = 2, // Exponential factor (2^n)
    jitter = true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Calculate exponential delay: baseDelay * (factor ^ attempt)
      let delay = Math.min(baseDelayMs * Math.pow(factor, attempt), maxDelayMs);

      // Add jitter (0-25% random variance) to prevent thundering herd
      if (jitter) {
        const jitterAmount = delay * 0.25 * Math.random();
        delay = delay + jitterAmount;
      }

      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      } else {
        console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`);
      }

      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

// ============================================================================
// 3. SAFE POLLING WITH MAX_RETRIES (Fixes CRITICAL: Unbounded loops)
// ============================================================================

/**
 * Poll with bounded retries and timeout
 * @param {Function} checkFn - Function that returns { done: boolean, result: any }
 * @param {object} options - Polling options
 * @returns {Promise<any>}
 */
async function safePoll(checkFn, options = {}) {
  const {
    maxRetries = 100,           // Maximum poll iterations
    maxTimeMs = 600000,         // Maximum total time (10 min)
    intervalMs = 5000,          // Poll interval
    onProgress = null
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (attempts < maxRetries) {
    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= maxTimeMs) {
      throw new Error(`Polling timeout after ${Math.round(elapsed / 1000)}s`);
    }

    attempts++;

    try {
      const { done, result, status } = await checkFn();

      if (onProgress) {
        onProgress(attempts, status, elapsed);
      }

      if (done) {
        return result;
      }
    } catch (error) {
      console.error(`❌ Poll attempt ${attempts} failed: ${error.message}`);
      // Continue polling on error unless max retries reached
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error(`Polling failed after ${maxRetries} attempts`);
}

// ============================================================================
// 4. SECURE RANDOM (Fixes HIGH: Math.random() usage)
// ============================================================================

/**
 * Cryptographically secure random integer
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number}
 */
function secureRandomInt(min, max) {
  return crypto.randomInt(min, max);
}

/**
 * Cryptographically secure random element from array
 * @param {Array} array - Array to pick from
 * @returns {any}
 */
function secureRandomElement(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error('Array must be non-empty');
  }
  return array[crypto.randomInt(0, array.length)];
}

/**
 * Cryptographically secure shuffle (Fisher-Yates with crypto.randomInt)
 * @param {Array} array - Array to shuffle
 * @returns {Array} - New shuffled array
 */
function secureShuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Secure random string for tokens/IDs
 * @param {number} length - Length of string
 * @returns {string}
 */
function secureRandomString(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

// ============================================================================
// 5. INPUT VALIDATION (Fixes CRITICAL: Missing validation)
// ============================================================================

const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^\d{2}:\d{2}(:\d{2})?$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i
};

/**
 * Validate input against pattern
 * @param {string} value - Value to validate
 * @param {string} type - Type of validation (email, phone, date, etc.)
 * @returns {boolean}
 */
function validateInput(value, type) {
  if (value === null || value === undefined) return false;
  const pattern = VALIDATION_PATTERNS[type];
  if (!pattern) throw new Error(`Unknown validation type: ${type}`);
  return pattern.test(String(value));
}

/**
 * Sanitize string input (XSS prevention)
 * @param {string} input - Input to sanitize
 * @param {object} options - Sanitization options
 * @returns {string}
 */
function sanitizeInput(input, options = {}) {
  const {
    maxLength = 10000,
    allowHtml = false,
    trim = true
  } = options;

  if (input === null || input === undefined) return '';

  let sanitized = String(input);

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  // HTML escape if not allowed
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Validate and sanitize request body
 * @param {object} body - Request body
 * @param {object} schema - Validation schema
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
function validateRequestBody(body, schema) {
  const errors = [];
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];

    // Required check
    if (rules.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip optional empty fields
    if (!rules.required && (value === null || value === undefined || value === '')) {
      continue;
    }

    // Type validation
    if (rules.type && !validateInput(value, rules.type)) {
      errors.push(`${field} must be a valid ${rules.type}`);
      continue;
    }

    // Min/Max length
    if (rules.minLength && String(value).length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
      continue;
    }

    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors.push(`${field} must be at most ${rules.maxLength} characters`);
      continue;
    }

    // Custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push(rules.message || `${field} is invalid`);
      continue;
    }

    // Sanitize and add to result
    sanitized[field] = sanitizeInput(value, { maxLength: rules.maxLength || 10000 });
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

// ============================================================================
// 6. PATH SANITIZATION (Fixes MEDIUM: Path traversal)
// ============================================================================

/**
 * Sanitize file path to prevent path traversal
 * @param {string} inputPath - User-provided path
 * @param {string} basePath - Allowed base directory
 * @returns {string} - Safe absolute path
 * @throws {Error} - If path is outside base directory
 */
function sanitizePath(inputPath, basePath = process.cwd()) {
  // Normalize and resolve the path
  const normalizedBase = path.resolve(basePath);
  const normalizedInput = path.resolve(normalizedBase, inputPath);

  // Check if the resolved path starts with the base path
  if (!normalizedInput.startsWith(normalizedBase + path.sep) && normalizedInput !== normalizedBase) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return normalizedInput;
}

/**
 * Validate filename (no directory components)
 * @param {string} filename - Filename to validate
 * @returns {boolean}
 */
function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;

  // Check for path separators
  if (filename.includes('/') || filename.includes('\\')) return false;

  // Check for special names
  if (filename === '.' || filename === '..') return false;

  // Check for null bytes
  if (filename.includes('\0')) return false;

  return true;
}

// ============================================================================
// 7. RATE LIMITING (Fixes HIGH: No rate limiting)
// ============================================================================

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;     // 1 minute
    this.maxRequests = options.maxRequests || 100; // 100 requests per window
    this.requests = new Map();

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be allowed
   * @param {string} key - Identifier (IP, user ID, etc.)
   * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
   */
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create entry
    let entry = this.requests.get(key);
    if (!entry) {
      entry = { timestamps: [], blocked: false };
      this.requests.set(key, entry);
    }

    // Filter to only timestamps within current window
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);

    // Check if allowed
    const allowed = entry.timestamps.length < this.maxRequests;

    if (allowed) {
      entry.timestamps.push(now);
    }

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - entry.timestamps.length),
      resetTime: entry.timestamps.length > 0 ? entry.timestamps[0] + this.windowMs : now + this.windowMs
    };
  }

  /**
   * Alias for check().allowed
   * @param {string} key - Identifier
   * @returns {boolean}
   */
  isAllowed(key) {
    return this.check(key).allowed;
  }

  /**
   * Express/Node.js middleware
   */
  middleware() {
    return (req, res, next) => {
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      const result = this.check(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

      if (!result.allowed) {
        res.statusCode = 429;
        res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
      }

      next();
    };
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, entry] of this.requests.entries()) {
      entry.timestamps = entry.timestamps.filter(t => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// ============================================================================
// 8. REQUEST SIZE LIMITER (Fixes HIGH: Unbounded body size)
// ============================================================================

/**
 * Limit request body size
 * @param {number} maxBytes - Maximum body size in bytes (default: 1MB)
 * @returns {Function} - Middleware function
 */
function requestSizeLimiter(maxBytes = 1024 * 1024) {
  return (req, res, next) => {
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        res.statusCode = 413;
        res.end(JSON.stringify({ error: 'Request body too large' }));
      }
    });

    next();
  };
}

// ============================================================================
// 9. SECURITY HEADERS (Fixes LOW: Missing headers)
// ============================================================================

/**
 * Set security headers on response
 * @param {object} res - HTTP response object
 */
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * Security headers middleware
 */
function securityHeadersMiddleware() {
  return (req, res, next) => {
    setSecurityHeaders(res);
    next();
  };
}

// ============================================================================
// 10. CORS CONFIGURATION (Fixes MEDIUM: Any origin)
// ============================================================================

/**
 * Create CORS middleware with whitelist
 * @param {string[]} allowedOrigins - List of allowed origins
 * @returns {Function} - Middleware function
 */
function corsMiddleware(allowedOrigins = []) {
  return (req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

// ============================================================================
// 11. TIMING-SAFE COMPARISON (Fixes LOW: String comparison)
// ============================================================================

/**
 * Constant-time string comparison (prevents timing attacks)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths differ, compare against itself to maintain constant time
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================================
// 12. SAFE LOGGING (Fixes LOW: Information disclosure)
// ============================================================================

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization', 'auth', 'api_key', 'apikey', 'credit_card', 'ssn'];

/**
 * Redact sensitive information from object for logging
 * @param {object} obj - Object to redact
 * @returns {object} - Redacted copy
 */
function redactSensitive(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Safe console.log that redacts sensitive info
 */
function safeLog(...args) {
  const redacted = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return redactSensitive(arg);
    }
    return arg;
  });
  console.log(...redacted);
}

// ============================================================================
// 13. URL VALIDATION (Fixes potential SSRF)
// ============================================================================

/**
 * Validate URL against allowed hosts
 * @param {string} urlString - URL to validate
 * @param {string[]} allowedHosts - List of allowed hostnames
 * @returns {boolean}
 */
function validateUrl(urlString, allowedHosts = []) {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // If allowedHosts specified, check against whitelist
    if (allowedHosts.length > 0) {
      return allowedHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host));
    }

    // Block internal IPs
    const ip = url.hostname;
    if (
      ip === 'localhost' ||
      ip === '127.0.0.1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip === '0.0.0.0' ||
      ip === '::1'
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 14. CSRF PROTECTION (Session 114 Addition)
// ============================================================================

/**
 * Generate CSRF token
 * @param {number} length - Token length (default: 32)
 * @returns {string} - Secure CSRF token
 */
function generateCsrfToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate CSRF token with timing-safe comparison
 * @param {string} token - Token from request
 * @param {string} expected - Expected token from session
 * @returns {boolean}
 */
function validateCsrfToken(token, expected) {
  if (!token || !expected) return false;
  return timingSafeEqual(token, expected);
}

/**
 * CSRF middleware
 * @param {object} options - Options { cookieName, headerName, methods }
 * @returns {Function} - Express middleware
 */
function csrfMiddleware(options = {}) {
  const {
    cookieName = 'csrf_token',
    headerName = 'x-csrf-token',
    methods = ['POST', 'PUT', 'DELETE', 'PATCH']
  } = options;

  return (req, res, next) => {
    // Generate token for GET requests
    if (req.method === 'GET') {
      if (!req.cookies?.[cookieName]) {
        const token = generateCsrfToken();
        res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`);
        req.csrfToken = token;
      } else {
        req.csrfToken = req.cookies[cookieName];
      }
      return next();
    }

    // Validate token for protected methods
    if (methods.includes(req.method)) {
      const tokenFromHeader = req.headers[headerName];
      const tokenFromCookie = req.cookies?.[cookieName];

      if (!validateCsrfToken(tokenFromHeader, tokenFromCookie)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Invalid CSRF token' }));
        return;
      }
    }

    next();
  };
}

// ============================================================================
// 15. XSS UTILITIES (Session 114 Addition)
// ============================================================================

/**
 * HTML encode string (prevents XSS)
 * @param {string} str - String to encode
 * @returns {string}
 */
function encodeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Strip all HTML tags from string
 * @param {string} str - String to strip
 * @returns {string}
 */
function stripHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/<[^>]*>/g, '');
}

/**
 * Sanitize URL to prevent javascript: and data: schemes
 * @param {string} url - URL to sanitize
 * @returns {string|null} - Safe URL or null if dangerous
 */
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim().toLowerCase();

  // Block dangerous schemes
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (const scheme of dangerousSchemes) {
    if (trimmed.startsWith(scheme)) {
      return null;
    }
  }

  // Allow relative URLs, http, https, mailto, tel
  const safeSchemes = ['http://', 'https://', 'mailto:', 'tel:', '/', '#'];
  const isRelative = !url.includes(':') || safeSchemes.some(s => trimmed.startsWith(s));

  return isRelative ? url : null;
}

// ============================================================================
// 16. REQUEST DEDUPLICATION (Session 114 Addition)
// ============================================================================

/**
 * Create a deduped fetch function
 * In-flight request cache to prevent duplicate concurrent requests
 */
function createDedupedFetch() {
  const inFlight = new Map();

  return async function dedupedFetch(url, options = {}) {
    // Create cache key from URL + method
    const method = options.method || 'GET';
    const cacheKey = `${method}:${url}`;

    // Only dedupe GET requests by default
    if (method !== 'GET') {
      return fetchWithTimeout(url, options);
    }

    // Check if request is already in flight
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }

    // Make request and cache the promise
    const promise = fetchWithTimeout(url, options)
      .finally(() => {
        inFlight.delete(cacheKey);
      });

    inFlight.set(cacheKey, promise);
    return promise;
  };
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
function debounce(fn, wait = 300) {
  let timeout;
  return function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function}
 */
function throttle(fn, limit = 300) {
  let inThrottle;
  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Fetch & Retry
  fetchWithTimeout,
  retryWithExponentialBackoff,
  safePoll,
  createDedupedFetch,
  debounce,
  throttle,

  // Random
  secureRandomInt,
  secureRandomElement,
  secureShuffleArray,
  secureRandomString,

  // Validation
  validateInput,
  sanitizeInput,
  validateRequestBody,
  VALIDATION_PATTERNS,

  // Path
  sanitizePath,
  isValidFilename,

  // Rate Limiting
  RateLimiter,
  requestSizeLimiter,

  // Headers & CORS
  setSecurityHeaders,
  securityHeadersMiddleware,
  corsMiddleware,

  // Security Utils
  timingSafeEqual,
  redactSensitive,
  safeLog,
  validateUrl,

  // CSRF Protection
  generateCsrfToken,
  validateCsrfToken,
  csrfMiddleware,

  // XSS Utilities
  encodeHTML,
  stripHTML,
  sanitizeURL
};
