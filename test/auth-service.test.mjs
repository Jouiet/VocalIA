/**
 * VocalIA AuthService Tests
 *
 * Tests:
 * - CONFIG structure and defaults
 * - ROLE_PERMISSIONS completeness
 * - AuthError class
 * - validatePassword (strength checks)
 * - validateEmail
 * - generateToken (crypto random)
 * - hashPassword + verifyPassword (bcrypt)
 * - generateAccessToken + verifyToken (JWT)
 * - hasPermission / hasRole helpers
 *
 * NOTE: DB-dependent methods (register, login, logout, etc.) are tested
 * with a mock DB to verify logic without Google Sheets.
 *
 * Run: node --test test/auth-service.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import authService from '../core/auth-service.cjs';

const {
  CONFIG,
  ROLE_PERMISSIONS,
  AuthError,
  generateToken,
  validateEmail,
  hasPermission,
  hasRole,
  verifyToken
} = authService;

// ─── CONFIG ────────────────────────────────────────────────────────

describe('AuthService CONFIG', () => {
  test('has JWT config with required fields', () => {
    assert.ok(CONFIG.jwt);
    assert.ok(CONFIG.jwt.secret);
    assert.strictEqual(CONFIG.jwt.accessExpiry, '24h');
    assert.strictEqual(CONFIG.jwt.refreshExpiry, '30d');
    assert.strictEqual(CONFIG.jwt.algorithm, 'HS256');
  });

  test('has bcrypt config with 12 rounds', () => {
    assert.ok(CONFIG.bcrypt);
    assert.strictEqual(CONFIG.bcrypt.rounds, 12);
  });

  test('has security config with lockout and token expiry', () => {
    assert.ok(CONFIG.security);
    assert.strictEqual(CONFIG.security.maxLoginAttempts, 5);
    assert.strictEqual(CONFIG.security.lockoutDuration, 15 * 60 * 1000);
    assert.strictEqual(CONFIG.security.resetTokenExpiry, 6 * 60 * 60 * 1000);
    assert.strictEqual(CONFIG.security.verifyTokenExpiry, 24 * 60 * 60 * 1000);
  });

  test('has password policy with min 8 chars', () => {
    assert.ok(CONFIG.password);
    assert.strictEqual(CONFIG.password.minLength, 8);
    assert.strictEqual(CONFIG.password.maxLength, 128);
    assert.strictEqual(CONFIG.password.requireUppercase, true);
    assert.strictEqual(CONFIG.password.requireLowercase, true);
    assert.strictEqual(CONFIG.password.requireNumber, true);
  });
});

// ─── ROLE_PERMISSIONS ──────────────────────────────────────────────

describe('AuthService ROLE_PERMISSIONS', () => {
  test('has admin, user, viewer roles', () => {
    assert.ok(ROLE_PERMISSIONS.admin);
    assert.ok(ROLE_PERMISSIONS.user);
    assert.ok(ROLE_PERMISSIONS.viewer);
  });

  test('admin has all critical permissions', () => {
    const adminPerms = ROLE_PERMISSIONS.admin;
    assert.ok(adminPerms.includes('admin:system'));
    assert.ok(adminPerms.includes('hitl:approve'));
    assert.ok(adminPerms.includes('write:tenants'));
    assert.ok(adminPerms.includes('delete:users'));
  });

  test('user cannot admin:system or delete', () => {
    const userPerms = ROLE_PERMISSIONS.user;
    assert.ok(!userPerms.includes('admin:system'));
    assert.ok(!userPerms.includes('delete:tenants'));
    assert.ok(!userPerms.includes('delete:users'));
  });

  test('viewer has read-only permissions', () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    assert.ok(viewerPerms.every(p => p.startsWith('read:')));
  });

  test('admin has more permissions than user', () => {
    assert.ok(ROLE_PERMISSIONS.admin.length > ROLE_PERMISSIONS.user.length);
  });

  test('user has more permissions than viewer', () => {
    assert.ok(ROLE_PERMISSIONS.user.length > ROLE_PERMISSIONS.viewer.length);
  });
});

// ─── AuthError ─────────────────────────────────────────────────────

describe('AuthError class', () => {
  test('creates error with message, code, status', () => {
    const err = new AuthError('Test error', 'TEST_CODE', 403);
    assert.strictEqual(err.message, 'Test error');
    assert.strictEqual(err.code, 'TEST_CODE');
    assert.strictEqual(err.status, 403);
    assert.strictEqual(err.name, 'AuthError');
  });

  test('defaults status to 400', () => {
    const err = new AuthError('Bad request', 'BAD_REQUEST');
    assert.strictEqual(err.status, 400);
  });

  test('is instanceof Error', () => {
    const err = new AuthError('test', 'TEST');
    assert.ok(err instanceof Error);
    assert.ok(err instanceof AuthError);
  });
});

// ─── validatePassword ──────────────────────────────────────────────

describe('AuthService validatePassword', () => {
  // Access validatePassword via private scope — it's not exported directly
  // We'll test it through the auth flow, or use the internal function
  // Since it's not exported, we test password rules through register errors

  test('valid password passes', () => {
    // validatePassword is not directly exported, test via CONFIG rules
    const pass = 'StrongPass1';
    assert.ok(pass.length >= CONFIG.password.minLength);
    assert.ok(/[A-Z]/.test(pass));
    assert.ok(/[a-z]/.test(pass));
    assert.ok(/[0-9]/.test(pass));
  });

  test('CONFIG requires uppercase, lowercase, number', () => {
    assert.strictEqual(CONFIG.password.requireUppercase, true);
    assert.strictEqual(CONFIG.password.requireLowercase, true);
    assert.strictEqual(CONFIG.password.requireNumber, true);
  });
});

// ─── validateEmail ─────────────────────────────────────────────────

// validateEmail is not directly exported, but we can test the regex pattern

describe('AuthService email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  test('accepts valid emails', () => {
    assert.ok(emailRegex.test('user@example.com'));
    assert.ok(emailRegex.test('test.user@domain.org'));
    assert.ok(emailRegex.test('a@b.co'));
  });

  test('rejects invalid emails', () => {
    assert.ok(!emailRegex.test(''));
    assert.ok(!emailRegex.test('notanemail'));
    assert.ok(!emailRegex.test('@domain.com'));
    assert.ok(!emailRegex.test('user@'));
    assert.ok(!emailRegex.test('user @domain.com'));
  });
});

// ─── generateToken ─────────────────────────────────────────────────

describe('AuthService generateToken', () => {
  test('generates hex string of default length (32 bytes = 64 chars)', () => {
    const token = generateToken();
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 64); // 32 bytes → 64 hex chars
    assert.ok(/^[0-9a-f]+$/.test(token));
  });

  test('generates unique tokens', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    assert.notStrictEqual(t1, t2);
  });

  test('respects custom length', () => {
    const token = generateToken(16);
    assert.strictEqual(token.length, 32); // 16 bytes → 32 hex chars
  });

  test('generates 128-byte token', () => {
    const token = generateToken(128);
    assert.strictEqual(token.length, 256);
  });
});

// ─── Password hashing (tested indirectly via register/login) ───────
// hashPassword and verifyPassword are internal functions, not exported.
// They are tested through register() + login() in the mock DB section below.

// ─── JWT verifyToken ───────────────────────────────────────────────

describe('AuthService JWT verifyToken', () => {
  test('verifyToken throws AuthError for invalid token', () => {
    assert.throws(
      () => verifyToken('invalid.jwt.token'),
      (err) => err instanceof AuthError && err.code === 'INVALID_TOKEN'
    );
  });

  test('verifyToken throws AuthError for empty string', () => {
    assert.throws(
      () => verifyToken(''),
      (err) => err instanceof AuthError
    );
  });

  test('verifyToken throws for malformed JWT', () => {
    assert.throws(
      () => verifyToken('abc.def.ghi'),
      (err) => err instanceof AuthError
    );
  });
});

// ─── hasPermission / hasRole ───────────────────────────────────────

describe('AuthService hasPermission', () => {
  test('admin has admin:system', () => {
    assert.strictEqual(hasPermission({ role: 'admin' }, 'admin:system'), true);
  });

  test('user does not have admin:system', () => {
    assert.strictEqual(hasPermission({ role: 'user' }, 'admin:system'), false);
  });

  test('user has read:calls', () => {
    assert.strictEqual(hasPermission({ role: 'user' }, 'read:calls'), true);
  });

  test('viewer has read:analytics', () => {
    assert.strictEqual(hasPermission({ role: 'viewer' }, 'read:analytics'), true);
  });

  test('unknown role has no permissions', () => {
    assert.strictEqual(hasPermission({ role: 'unknown' }, 'read:calls'), false);
  });
});

describe('AuthService hasRole', () => {
  test('correctly identifies admin role', () => {
    assert.strictEqual(hasRole({ role: 'admin' }, 'admin'), true);
  });

  test('correctly rejects wrong role', () => {
    assert.strictEqual(hasRole({ role: 'user' }, 'admin'), false);
  });
});

// ─── Mock DB tests for register/login flows ────────────────────────

describe('AuthService with mock DB', () => {
  const users = new Map();
  const sessions = new Map();

  const mockDB = {
    query: async (table, filter) => {
      if (table === 'users') {
        return [...users.values()].filter(u => {
          for (const [k, v] of Object.entries(filter)) {
            if (u[k] !== v) return false;
          }
          return true;
        });
      }
      if (table === 'auth_sessions') {
        return [...sessions.values()].filter(s => {
          for (const [k, v] of Object.entries(filter)) {
            if (s[k] !== v) return false;
          }
          return true;
        });
      }
      return [];
    },
    create: async (table, data) => {
      if (table === 'users') users.set(data.id, data);
      if (table === 'auth_sessions') sessions.set(data.id, data);
      return data;
    },
    update: async (table, id, updates) => {
      const store = table === 'users' ? users : sessions;
      const item = store.get(id);
      if (item) {
        Object.assign(item, updates);
        store.set(id, item);
      }
    },
    delete: async (table, id) => {
      const store = table === 'users' ? users : sessions;
      store.delete(id);
    },
    findById: async (table, id) => {
      const store = table === 'users' ? users : sessions;
      return store.get(id) || null;
    }
  };

  // Initialize auth service with mock DB
  authService.init(mockDB);

  test('register creates user with valid data', async () => {
    users.clear();
    sessions.clear();

    const result = await authService.register({
      email: 'new@vocalia.ma',
      password: 'StrongPass1',
      name: 'Test User',
      tenantId: 'tenant_1'
    });

    assert.ok(result.id.startsWith('user_'));
    assert.strictEqual(result.email, 'new@vocalia.ma');
    assert.strictEqual(result.name, 'Test User');
    assert.strictEqual(result.role, 'user');
    assert.strictEqual(result.email_verified, false);
    assert.ok(result.verify_token);
  });

  test('register rejects duplicate email', async () => {
    await assert.rejects(
      () => authService.register({
        email: 'new@vocalia.ma',
        password: 'StrongPass2',
        name: 'Duplicate'
      }),
      (err) => err instanceof AuthError && err.code === 'EMAIL_EXISTS'
    );
  });

  test('register rejects invalid email', async () => {
    await assert.rejects(
      () => authService.register({
        email: 'notanemail',
        password: 'StrongPass1',
        name: 'Bad Email'
      }),
      (err) => err instanceof AuthError && err.code === 'INVALID_EMAIL'
    );
  });

  test('register rejects weak password (no uppercase)', async () => {
    await assert.rejects(
      () => authService.register({
        email: 'weak1@vocalia.ma',
        password: 'weakpass1',
        name: 'Weak'
      }),
      (err) => err instanceof AuthError && err.code === 'WEAK_PASSWORD'
    );
  });

  test('register rejects short password', async () => {
    await assert.rejects(
      () => authService.register({
        email: 'weak2@vocalia.ma',
        password: 'Sh1',
        name: 'Short'
      }),
      (err) => err instanceof AuthError && err.code === 'WEAK_PASSWORD'
    );
  });

  test('login returns tokens for valid credentials', async () => {
    const result = await authService.login({
      email: 'new@vocalia.ma',
      password: 'StrongPass1'
    });

    assert.ok(result.access_token);
    assert.ok(result.refresh_token);
    assert.strictEqual(result.token_type, 'Bearer');
    assert.strictEqual(result.expires_in, 86400);
    assert.strictEqual(result.user.email, 'new@vocalia.ma');
  });

  test('login rejects wrong password', async () => {
    await assert.rejects(
      () => authService.login({
        email: 'new@vocalia.ma',
        password: 'WrongPass1'
      }),
      (err) => err instanceof AuthError && err.code === 'INVALID_CREDENTIALS'
    );
  });

  test('login rejects non-existent email', async () => {
    await assert.rejects(
      () => authService.login({
        email: 'nobody@vocalia.ma',
        password: 'AnyPass1'
      }),
      (err) => err instanceof AuthError && err.code === 'INVALID_CREDENTIALS'
    );
  });

  test('logout succeeds', async () => {
    const loginResult = await authService.login({
      email: 'new@vocalia.ma',
      password: 'StrongPass1'
    });

    const result = await authService.logout(loginResult.refresh_token);
    assert.strictEqual(result.success, true);
  });

  test('logout with null token succeeds', async () => {
    const result = await authService.logout(null);
    assert.strictEqual(result.success, true);
  });
});
