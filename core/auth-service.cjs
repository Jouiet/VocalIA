/**
 * VocalIA Authentication Service
 * Session 250.55: Production-ready JWT + bcrypt authentication
 *
 * Features:
 * - bcrypt password hashing (12 rounds)
 * - JWT access tokens (24h) + refresh tokens (30d)
 * - Account lockout after 5 failed attempts
 * - Email verification tokens
 * - Password reset flow
 * - Multi-tenant support
 */

'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  jwt: {
    secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    accessExpiry: '24h',
    refreshExpiry: '30d',
    algorithm: 'HS256'
  },
  bcrypt: {
    rounds: 12
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    resetTokenExpiry: 6 * 60 * 60 * 1000, // 6 hours
    verifyTokenExpiry: 24 * 60 * 60 * 1000 // 24 hours
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true
  }
};

// Role permissions
const ROLE_PERMISSIONS = {
  admin: [
    'read:tenants', 'write:tenants', 'delete:tenants',
    'read:users', 'write:users', 'delete:users',
    'read:calls', 'write:calls',
    'read:agents', 'write:agents',
    'read:analytics', 'export:analytics',
    'read:billing', 'write:billing',
    'read:logs', 'admin:system',
    'hitl:approve', 'hitl:reject'
  ],
  user: [
    'read:calls', 'write:calls',
    'read:agents', 'write:agents',
    'read:analytics', 'export:analytics',
    'read:billing',
    'read:integrations', 'write:integrations'
  ],
  viewer: [
    'read:calls',
    'read:agents',
    'read:analytics'
  ]
};

// Database reference (will be set via init)
let db = null;

/**
 * Initialize with database instance
 */
function init(database) {
  db = database;
  console.log('[Auth] Service initialized');
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  const errors = [];

  if (password.length < CONFIG.password.minLength) {
    errors.push(`Password must be at least ${CONFIG.password.minLength} characters`);
  }
  if (password.length > CONFIG.password.maxLength) {
    errors.push(`Password must be less than ${CONFIG.password.maxLength} characters`);
  }
  if (CONFIG.password.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (CONFIG.password.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (CONFIG.password.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate secure random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, CONFIG.bcrypt.rounds);
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    permissions: ROLE_PERMISSIONS[user.role] || []
  };

  return jwt.sign(payload, CONFIG.jwt.secret, {
    expiresIn: CONFIG.jwt.accessExpiry,
    algorithm: CONFIG.jwt.algorithm
  });
}

/**
 * Generate refresh token
 */
function generateRefreshToken() {
  return generateToken(64);
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, CONFIG.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthError('Token expired', 'TOKEN_EXPIRED', 401);
    }
    throw new AuthError('Invalid token', 'INVALID_TOKEN', 401);
  }
}

/**
 * Custom Auth Error class
 */
class AuthError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Register new user
 */
async function register({ email, password, name, tenantId = null, role: _role }) {
  // Session 250.173: Force role to 'user' to prevent privilege escalation (NM5)
  const role = 'user';
  // Validate email
  if (!validateEmail(email)) {
    throw new AuthError('Invalid email format', 'INVALID_EMAIL');
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new AuthError(passwordValidation.errors.join(', '), 'WEAK_PASSWORD');
  }

  // Check if email exists
  const existingUser = await db.query('users', { email: email.toLowerCase() });
  if (existingUser.length > 0) {
    throw new AuthError('Email already registered', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate verification token
  const verifyToken = generateToken(32);
  const verifyExpires = new Date(Date.now() + CONFIG.security.verifyTokenExpiry).toISOString();

  // Create user
  const userId = `user_${generateToken(16)}`;
  const now = new Date().toISOString();

  const user = await db.create('users', {
    id: userId,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    name: name || email.split('@')[0],
    role: role,
    tenant_id: tenantId,
    email_verified: false,
    email_verify_token: crypto.createHash('sha256').update(verifyToken).digest('hex'),
    email_verify_expires: verifyExpires,
    login_count: 0,
    failed_login_count: 0,
    preferences: JSON.stringify({ theme: 'system', lang: 'fr', notifications: true }),
    created_at: now,
    updated_at: now
  });

  // Send verification email (token stays server-side)
  try {
    const emailService = require('./email-service.cjs');
    if (emailService && emailService.sendVerificationEmail) {
      await emailService.sendVerificationEmail(email, verifyToken, name);
    }
  } catch (e) {
    console.error('❌ [Auth] Failed to send verification email:', e.message);
  }

  // Return user WITHOUT sensitive tokens
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
    email_verified: false
  };
}

/**
 * Login user
 */
async function login({ email, password, rememberMe = false }) {
  // Find user
  const users = await db.query('users', { email: email.toLowerCase() });
  if (users.length === 0) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  const user = users[0];

  // Check if account is locked
  if (user.locked_until) {
    const lockExpiry = new Date(user.locked_until);
    if (lockExpiry > new Date()) {
      const minutesLeft = Math.ceil((lockExpiry - new Date()) / 60000);
      throw new AuthError(
        `Account locked. Try again in ${minutesLeft} minutes`,
        'ACCOUNT_LOCKED',
        423
      );
    }
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    // Increment failed attempts
    const failedCount = (parseInt(user.failed_login_count) || 0) + 1;
    const updates = { failed_login_count: failedCount };

    // Lock account if too many failures
    if (failedCount >= CONFIG.security.maxLoginAttempts) {
      updates.locked_until = new Date(Date.now() + CONFIG.security.lockoutDuration).toISOString();
      await db.update('users', user.id, updates);
      throw new AuthError(
        `Too many failed attempts. Account locked for 15 minutes`,
        'ACCOUNT_LOCKED',
        423
      );
    }

    await db.update('users', user.id, updates);
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  // Check email verification (C2 fix — unverified users cannot login)
  const isVerified = user.email_verified === 'true' || user.email_verified === true;
  if (!isVerified) {
    throw new AuthError(
      'Please verify your email before logging in. Check your inbox for the verification link.',
      'EMAIL_NOT_VERIFIED',
      403
    );
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Calculate refresh token expiry
  const refreshExpiry = rememberMe
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store refresh token in auth_sessions
  const sessionId = `session_${generateToken(16)}`;
  await db.create('auth_sessions', {
    id: sessionId,
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    expires_at: refreshExpiry.toISOString(),
    created_at: new Date().toISOString(),
    last_used_at: new Date().toISOString()
  });

  // Update user login stats
  await db.update('users', user.id, {
    last_login: new Date().toISOString(),
    login_count: (parseInt(user.login_count) || 0) + 1,
    failed_login_count: 0,
    locked_until: null
  });

  // Return tokens and user info
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 86400, // 24 hours in seconds
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      email_verified: user.email_verified === 'true' || user.email_verified === true,
      preferences: (() => { try { return user.preferences ? JSON.parse(user.preferences) : {}; } catch { return {}; } })()
    }
  };
}

/**
 * Login or register via OAuth SSO (Google, GitHub)
 * If user exists with this email: login. If not: create account.
 * OAuth users are auto-verified (email comes from trusted provider).
 */
async function loginWithOAuth({ email, name, provider, providerId }) {
  if (!validateEmail(email)) {
    throw new AuthError('Invalid email from OAuth provider', 'INVALID_EMAIL');
  }

  const normalizedEmail = email.toLowerCase();
  const now = new Date().toISOString();

  // Check if user exists
  let users = await db.query('users', { email: normalizedEmail });
  let user;

  if (users.length > 0) {
    // Existing user — update OAuth info and login
    user = users[0];
    await db.update('users', user.id, {
      oauth_provider: provider,
      oauth_provider_id: providerId,
      last_login: now,
      login_count: (parseInt(user.login_count) || 0) + 1,
      failed_login_count: 0,
      locked_until: null,
      email_verified: true,
      updated_at: now
    });
    // Re-read updated user
    users = await db.query('users', { email: normalizedEmail });
    user = users[0];
  } else {
    // New user — auto-register via OAuth (no password needed)
    const userId = `user_${generateToken(16)}`;
    // Random password hash (not usable for password login)
    const randomPassword = crypto.randomBytes(64).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    user = await db.create('users', {
      id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
      name: name || normalizedEmail.split('@')[0],
      role: 'user',
      tenant_id: null,
      email_verified: true,
      oauth_provider: provider,
      oauth_provider_id: providerId,
      login_count: 1,
      failed_login_count: 0,
      preferences: JSON.stringify({ theme: 'system', lang: 'fr', notifications: true }),
      created_at: now,
      updated_at: now
    });
  }

  // Generate tokens (same as standard login)
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for OAuth

  // Store session
  const sessionId = `session_${generateToken(16)}`;
  await db.create('auth_sessions', {
    id: sessionId,
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    expires_at: refreshExpiry.toISOString(),
    created_at: now,
    last_used_at: now
  });

  console.log(`✅ [Auth] OAuth login: ${normalizedEmail} via ${provider}`);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 86400,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      email_verified: true,
      preferences: (() => { try { return user.preferences ? JSON.parse(user.preferences) : {}; } catch { return {}; } })()
    }
  };
}

/**
 * Logout user (invalidate refresh token)
 */
async function logout(refreshToken) {
  if (!refreshToken) return { success: true };

  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Find and delete the session
  const sessions = await db.query('auth_sessions', { refresh_token_hash: refreshTokenHash });
  if (sessions.length > 0) {
    await db.delete('auth_sessions', sessions[0].id);
  }

  return { success: true };
}

/**
 * Refresh access token
 */
async function refreshTokens(refreshToken) {
  if (!refreshToken) {
    throw new AuthError('Refresh token required', 'MISSING_TOKEN', 401);
  }

  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Find session
  const sessions = await db.query('auth_sessions', { refresh_token_hash: refreshTokenHash });
  if (sessions.length === 0) {
    throw new AuthError('Invalid refresh token', 'INVALID_TOKEN', 401);
  }

  const session = sessions[0];

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await db.delete('auth_sessions', session.id);
    throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED', 401);
  }

  // Get user
  const user = await db.findById('users', session.user_id);
  if (!user) {
    await db.delete('auth_sessions', session.id);
    throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
  }

  // Generate new access token
  const accessToken = generateAccessToken(user);

  // Update session last used
  await db.update('auth_sessions', session.id, {
    last_used_at: new Date().toISOString()
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400
  };
}

/**
 * Verify access token and return user
 */
async function verifyAccessToken(token) {
  const decoded = verifyToken(token);

  // Optionally fetch fresh user data
  const user = await db.findById('users', decoded.sub);
  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
    permissions: ROLE_PERMISSIONS[user.role] || []
  };
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
  const users = await db.query('users', { email: email.toLowerCase() });

  // Always return success to prevent email enumeration
  if (users.length === 0) {
    return { success: true, message: 'If an account exists, a reset email will be sent' };
  }

  const user = users[0];

  // Generate reset token
  const resetToken = generateToken(32);
  const resetExpires = new Date(Date.now() + CONFIG.security.resetTokenExpiry).toISOString();

  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  await db.update('users', user.id, {
    password_reset_token: resetTokenHash,
    password_reset_expires: resetExpires
  });

  // Send reset email (token stays server-side)
  try {
    const emailService = require('./email-service.cjs');
    if (emailService && emailService.sendPasswordResetEmail) {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.name);
    }
  } catch (e) {
    console.error('❌ [Auth] Failed to send reset email:', e.message);
  }

  return {
    success: true,
    message: 'If an account exists, a reset email will be sent'
  };
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
  // Validate password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new AuthError(passwordValidation.errors.join(', '), 'WEAK_PASSWORD');
  }

  // Find user with this token (compare hashed)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const users = await db.query('users', { password_reset_token: tokenHash });
  if (users.length === 0) {
    throw new AuthError('Invalid or expired reset token', 'INVALID_TOKEN');
  }

  const user = users[0];

  // Check token expiry
  if (new Date(user.password_reset_expires) < new Date()) {
    throw new AuthError('Reset token has expired', 'TOKEN_EXPIRED');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user
  await db.update('users', user.id, {
    password_hash: passwordHash,
    password_reset_token: null,
    password_reset_expires: null,
    updated_at: new Date().toISOString()
  });

  // Invalidate all sessions (force re-login)
  const sessions = await db.query('auth_sessions', { user_id: user.id });
  for (const session of sessions) {
    await db.delete('auth_sessions', session.id);
  }

  return { success: true, message: 'Password reset successfully' };
}

/**
 * Change password (while logged in)
 */
async function changePassword(userId, oldPassword, newPassword) {
  const user = await db.findById('users', userId);
  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Verify old password
  const passwordValid = await verifyPassword(oldPassword, user.password_hash);
  if (!passwordValid) {
    throw new AuthError('Current password is incorrect', 'INVALID_PASSWORD', 401);
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new AuthError(passwordValidation.errors.join(', '), 'WEAK_PASSWORD');
  }

  // Hash and update
  const passwordHash = await hashPassword(newPassword);
  await db.update('users', user.id, {
    password_hash: passwordHash,
    updated_at: new Date().toISOString()
  });

  // D5 fix: Invalidate all existing sessions (force re-login, same as resetPassword)
  try {
    const sessions = await db.query('auth_sessions', { user_id: user.id });
    for (const session of sessions) {
      await db.delete('auth_sessions', session.id);
    }
  } catch (e) {
    console.warn('[Auth] Session invalidation after password change failed:', e.message);
  }

  return { success: true, message: 'Password changed successfully' };
}

/**
 * Verify email with token
 */
async function verifyEmail(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const users = await db.query('users', { email_verify_token: tokenHash });
  if (users.length === 0) {
    throw new AuthError('Invalid verification token', 'INVALID_TOKEN');
  }

  const user = users[0];

  // Check expiry
  if (user.email_verify_expires && new Date(user.email_verify_expires) < new Date()) {
    throw new AuthError('Verification token has expired', 'TOKEN_EXPIRED');
  }

  // Update user
  await db.update('users', user.id, {
    email_verified: true,
    email_verify_token: null,
    email_verify_expires: null,
    updated_at: new Date().toISOString()
  });

  return { success: true, message: 'Email verified successfully' };
}

/**
 * Resend verification email
 */
async function resendVerificationEmail(email) {
  const users = await db.query('users', { email: email.toLowerCase() });

  // Always return success to prevent email enumeration
  if (users.length === 0) {
    return { success: true, message: 'If an account exists, a verification email will be sent' };
  }

  const user = users[0];

  // Already verified
  if (user.email_verified === 'true' || user.email_verified === true) {
    return { success: true, message: 'Email already verified' };
  }

  // Generate new token
  const verifyToken = generateToken(32);
  const verifyExpires = new Date(Date.now() + CONFIG.security.verifyTokenExpiry).toISOString();

  const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
  await db.update('users', user.id, {
    email_verify_token: verifyTokenHash,
    email_verify_expires: verifyExpires,
    updated_at: new Date().toISOString()
  });

  // Send verification email (token stays server-side)
  try {
    const emailService = require('./email-service.cjs');
    if (emailService && emailService.sendVerificationEmail) {
      await emailService.sendVerificationEmail(user.email, verifyToken, user.name);
    }
  } catch (e) {
    console.error('❌ [Auth] Failed to resend verification email:', e.message);
  }

  return { success: true, message: 'If an account exists, a verification email will be sent' };
}

/**
 * Get current user
 */
async function getCurrentUser(userId) {
  const user = await db.findById('users', userId);
  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
    email_verified: user.email_verified === 'true' || user.email_verified === true,
    phone: user.phone,
    avatar_url: user.avatar_url,
    preferences: (() => { try { return user.preferences ? JSON.parse(user.preferences) : {}; } catch { return {}; } })(),
    created_at: user.created_at,
    last_login: user.last_login
  };
}

/**
 * Update current user profile
 */
async function updateProfile(userId, updates) {
  const allowedUpdates = ['name', 'phone', 'avatar_url', 'preferences'];
  const filteredUpdates = {};

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = key === 'preferences'
        ? JSON.stringify(updates[key])
        : updates[key];
    }
  }

  filteredUpdates.updated_at = new Date().toISOString();

  await db.update('users', userId, filteredUpdates);

  return getCurrentUser(userId);
}

/**
 * Check if user has permission
 */
function hasPermission(user, permission) {
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

/**
 * Check if user has role
 */
function hasRole(user, role) {
  return user.role === role;
}

// Export
module.exports = {
  init,
  register,
  login,
  loginWithOAuth,
  logout,
  refreshTokens,
  verifyAccessToken,
  verifyToken,
  requestPasswordReset,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
  updateProfile,
  hasPermission,
  hasRole,
  generateToken,
  AuthError,
  CONFIG,
  ROLE_PERMISSIONS
};
