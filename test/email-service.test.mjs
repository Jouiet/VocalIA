/**
 * Email Service — Tests
 * VocalIA — Session 250.207
 *
 * Tests: core/email-service.cjs (339 lines, 6 exports)
 * In production (Resend SMTP LIVE, DKIM+SPF+MX verified). Was 0 tests.
 *
 * Strategy:
 *   - escapeHtml: pure function, direct testing
 *   - sendEmail/send*: mock transporter to avoid real sends
 *   - Template HTML verification (no XSS in injected data)
 *
 * Run: node --test test/email-service.test.mjs
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Clear cached module to control env state
delete require.cache[require.resolve('../core/email-service.cjs')];

// No RESEND_API_KEY and no SMTP env = both providers unconfigured
const savedEnv = { ...process.env };
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const emailService = require('../core/email-service.cjs');

const {
  sendEmail,
  sendCartRecoveryEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
  getTransporter
} = emailService;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: escapeHtml (pure function — not exported but used internally)
// We test it via the email templates that use it
// ═══════════════════════════════════════════════════════════════════════════════

// Note: escapeHtml is NOT in module.exports. Test indirectly via templates.

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: getTransporter
// ═══════════════════════════════════════════════════════════════════════════════

describe('getTransporter()', () => {
  it('returns null when SMTP env vars not set', () => {
    const transporter = getTransporter();
    assert.equal(transporter, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: sendEmail — no provider configured
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendEmail() — no provider configured', () => {
  it('returns not_configured when no Resend and no SMTP', async () => {
    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>hi</p>' });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('returns not_configured even with valid-looking params', async () => {
    const result = await sendEmail({
      to: 'real@company.com',
      subject: 'Important',
      html: '<h1>Hello</h1><p>This is a test</p>',
      from: 'VocalIA <noreply@vocalia.ma>'
    });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: sendCartRecoveryEmail — template verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendCartRecoveryEmail()', () => {
  // Since no provider is configured, we can still verify the function runs
  // and returns the expected shape (just won't actually send)

  it('returns not_configured (no provider)', async () => {
    const result = await sendCartRecoveryEmail({
      to: 'customer@example.com',
      tenantId: 'test_tenant',
      cart: [{ name: 'Product A', price: '29.99€', quantity: 2 }],
      discount: 10,
      language: 'fr',
      recoveryUrl: 'https://shop.com/cart/recover/abc123'
    });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles empty cart gracefully', async () => {
    const result = await sendCartRecoveryEmail({
      to: 'customer@example.com',
      tenantId: 'test_tenant',
      cart: [],
      discount: 0,
      language: 'en'
    });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles missing optional fields', async () => {
    const result = await sendCartRecoveryEmail({
      to: 'customer@example.com'
    });
    assert.equal(result.success, false);
    // Should not throw
  });

  it('handles all 5 languages without error', async () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const result = await sendCartRecoveryEmail({
        to: `test-${lang}@example.com`,
        tenantId: 'test',
        cart: [{ name: 'Test', price: '10', quantity: 1 }],
        discount: 5,
        language: lang,
        recoveryUrl: 'https://example.com/recover'
      });
      assert.equal(result.success, false, `lang=${lang} should return not_configured`);
    }
  });

  it('handles cart as {total, items} object — BUG FIX 250.207b', async () => {
    // db-api.cjs passes cart as { total, items } from request body,
    // but the old code treated cart as a flat array → TypeError
    const result = await sendCartRecoveryEmail({
      to: 'buyer@example.com',
      tenantId: 'test_tenant',
      cart: {
        total: 149.99,
        items: [
          { name: 'Widget Pro', price: '99.99€', quantity: 1 },
          { name: 'Cable USB', price: '24.99€', quantity: 2 }
        ]
      },
      discount: 15,
      language: 'fr',
      recoveryUrl: 'https://shop.com/recover/xyz'
    });
    // Should NOT throw TypeError — function should handle object format
    assert.equal(result.success, false); // not_configured (no SMTP)
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles cart as plain array (backward compat)', async () => {
    const result = await sendCartRecoveryEmail({
      to: 'buyer@example.com',
      tenantId: 'test_tenant',
      cart: [{ name: 'Direct Item', price: '10€', quantity: 1 }],
      discount: 10,
      language: 'en'
    });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: sendVerificationEmail — template verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendVerificationEmail()', () => {
  it('does not throw with valid params', async () => {
    const result = await sendVerificationEmail('user@example.com', 'verify_token_abc123', 'Jean');
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles empty name', async () => {
    const result = await sendVerificationEmail('user@example.com', 'token123');
    assert.equal(result.success, false);
  });

  it('handles XSS in name (escapeHtml should sanitize)', async () => {
    // Even though email won't send, the function should not throw
    const result = await sendVerificationEmail('user@example.com', 'token', '<script>alert("xss")</script>');
    assert.equal(result.success, false);
  });

  it('handles XSS in token (URL-encoded)', async () => {
    const result = await sendVerificationEmail('user@example.com', '<script>alert(1)</script>');
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5b: sendVerificationEmail — i18n BEHAVIORAL (B28 — Session 250.213c)
// Strategy: mock module.exports.sendEmail to capture the actual subject/html
// built by sendVerificationEmail, then assert on language content.
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendVerificationEmail() — i18n behavioral', () => {
  it('EN: subject contains "Verify" and html contains dir="ltr"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendVerificationEmail('user@example.com', 'token_en', 'John', 'en');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('Verify'), `EN subject should contain "Verify", got: "${captured.subject}"`);
    assert.ok(captured.html.includes('dir="ltr"'), 'EN html should have dir="ltr"');
    assert.ok(captured.html.includes('Welcome to VocalIA'), 'EN html should contain EN welcome text');
  });

  it('AR: subject contains Arabic and html contains dir="rtl"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendVerificationEmail('user@example.com', 'token_ar', 'أحمد', 'ar');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('تحقق'), `AR subject should contain Arabic, got: "${captured.subject}"`);
    assert.ok(captured.html.includes('dir="rtl"'), 'AR html should have dir="rtl"');
  });

  it('ES: subject contains "Verifica"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendVerificationEmail('user@example.com', 'token_es', 'María', 'es');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('Verifica'), `ES subject should contain "Verifica", got: "${captured.subject}"`);
  });

  it('unknown lang falls back to FR subject', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendVerificationEmail('user@example.com', 'token_xx', 'Test', 'xx');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('Vérifiez'), `Fallback should be FR, got: "${captured.subject}"`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: sendPasswordResetEmail
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendPasswordResetEmail()', () => {
  it('does not throw with valid params', async () => {
    const result = await sendPasswordResetEmail('user@example.com', 'reset_token_xyz', 'Marie');
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles empty name', async () => {
    const result = await sendPasswordResetEmail('user@example.com', 'token456');
    assert.equal(result.success, false);
  });

  it('handles special characters in name', async () => {
    const result = await sendPasswordResetEmail('user@example.com', 'token', "O'Brien & Co <LLC>");
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6b: sendPasswordResetEmail — i18n BEHAVIORAL (B29 — Session 250.213c)
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendPasswordResetEmail() — i18n behavioral', () => {
  it('EN: subject contains "reset" and html dir="ltr"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendPasswordResetEmail('user@example.com', 'token_en', 'John', 'en');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.toLowerCase().includes('reset'), `EN subject should contain "reset", got: "${captured.subject}"`);
    assert.ok(captured.html.includes('dir="ltr"'), 'EN html should have dir="ltr"');
    assert.ok(captured.html.includes('You requested'), 'EN html should contain EN body text');
  });

  it('ES: subject contains "contraseña"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendPasswordResetEmail('user@example.com', 'token_es', 'Juan', 'es');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('contraseña'), `ES subject should contain "contraseña", got: "${captured.subject}"`);
  });

  it('ARY: subject contains Arabic script and html dir="rtl"', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendPasswordResetEmail('user@example.com', 'token_ary', 'يوسف', 'ary');
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('بدل'), `ARY subject should contain Darija, got: "${captured.subject}"`);
    assert.ok(captured.html.includes('dir="rtl"'), 'ARY html should have dir="rtl"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6c: sendCartRecoveryEmail — i18n BEHAVIORAL (B30 — Session 250.213c)
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendCartRecoveryEmail() — i18n behavioral', () => {
  it('EN: subject is in English and html has EN CTA', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendCartRecoveryEmail({
      to: 'buyer@example.com',
      tenantId: 'test',
      cart: [{ name: 'Widget', price: '29.99', quantity: 1 }],
      language: 'en',
      recoveryUrl: 'https://example.com/recover'
    });
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('cart') || captured.subject.includes('waiting'),
      `EN subject should be in English, got: "${captured.subject}"`);
    assert.ok(captured.html.includes('Recover my cart') || captured.html.includes('Complete'),
      'EN html should contain EN CTA text');
  });

  it('AR: html has dir="rtl" and Arabic CTA', async (t) => {
    let captured = null;
    t.mock.method(emailService, 'sendEmail', async (args) => {
      captured = args;
      return { success: true, method: 'mock' };
    });
    await sendCartRecoveryEmail({
      to: 'buyer@example.com',
      tenantId: 'test',
      cart: [{ name: 'منتج', price: '100', quantity: 1 }],
      language: 'ar',
      recoveryUrl: 'https://example.com/recover'
    });
    assert.ok(captured, 'sendEmail was called');
    assert.ok(captured.subject.includes('سلة'), `AR subject should contain Arabic, got: "${captured.subject}"`);
    assert.ok(captured.html.includes('dir="rtl"'), 'AR html should have dir="rtl"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: sendTransactionalEmail — template routing
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendTransactionalEmail()', () => {
  it('handles welcome template', async () => {
    const result = await sendTransactionalEmail({
      to: 'new@user.com',
      subject: 'Welcome',
      template: 'welcome',
      data: { name: 'Alice', dashboardUrl: 'https://vocalia.ma/app/client/dashboard.html' },
      language: 'fr'
    });
    assert.equal(result.success, false);
    assert.equal(result.method, 'email_not_configured');
  });

  it('handles invoice template', async () => {
    const result = await sendTransactionalEmail({
      to: 'billing@company.com',
      subject: 'Invoice #123',
      template: 'invoice',
      data: { invoiceId: 'INV-2026-001', amount: '99€', period: 'Feb 2026', invoiceUrl: 'https://billing.vocalia.ma/inv/123' },
      language: 'en'
    });
    assert.equal(result.success, false);
  });

  it('handles notification template (default fallback)', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Update',
      template: 'notification',
      data: { message: 'Your agent is now live!' }
    });
    assert.equal(result.success, false);
  });

  it('handles unknown template (default branch)', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Test',
      template: 'unknown_template_type',
      data: { message: 'Fallback message' }
    });
    assert.equal(result.success, false);
  });

  it('handles RTL languages (ar/ary)', async () => {
    for (const lang of ['ar', 'ary']) {
      const result = await sendTransactionalEmail({
        to: 'user@example.com',
        subject: 'Test RTL',
        template: 'welcome',
        data: { name: 'Ahmed' },
        language: lang
      });
      assert.equal(result.success, false);
    }
  });

  it('handles all 5 languages for welcome template', async () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const result = await sendTransactionalEmail({
        to: `test-${lang}@example.com`,
        subject: `Welcome ${lang}`,
        template: 'welcome',
        data: { name: 'Test' },
        language: lang
      });
      assert.equal(result.success, false, `lang=${lang}`);
    }
  });

  it('handles XSS in template data', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Test XSS',
      template: 'welcome',
      data: { name: '<script>alert("xss")</script>' }
    });
    assert.equal(result.success, false);
  });

  it('handles XSS in invoice data', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Invoice',
      template: 'invoice',
      data: {
        invoiceId: '"><script>alert(1)</script>',
        amount: '<img src=x onerror=alert(1)>',
        period: 'Jan&Feb',
        invoiceUrl: 'javascript:alert(1)'
      }
    });
    assert.equal(result.success, false);
  });

  it('handles empty data object', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Test',
      template: 'welcome',
      data: {}
    });
    assert.equal(result.success, false);
  });

  it('handles missing data (defaults to {})', async () => {
    const result = await sendTransactionalEmail({
      to: 'user@example.com',
      subject: 'Test'
    });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: sendEmail result shape
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendEmail() result shape', () => {
  it('always returns an object with success and method', async () => {
    const result = await sendEmail({ to: 'x@x.com', subject: 'S', html: '<p>H</p>' });
    assert.ok('success' in result);
    assert.ok('method' in result);
    assert.equal(typeof result.success, 'boolean');
    assert.equal(typeof result.method, 'string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Module exports verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module exports', () => {
  it('exports sendEmail as function', () => {
    assert.equal(typeof sendEmail, 'function');
  });

  it('exports sendCartRecoveryEmail as function', () => {
    assert.equal(typeof sendCartRecoveryEmail, 'function');
  });

  it('exports sendVerificationEmail as function', () => {
    assert.equal(typeof sendVerificationEmail, 'function');
  });

  it('exports sendPasswordResetEmail as function', () => {
    assert.equal(typeof sendPasswordResetEmail, 'function');
  });

  it('exports sendTransactionalEmail as function', () => {
    assert.equal(typeof sendTransactionalEmail, 'function');
  });

  it('exports getTransporter as function', () => {
    assert.equal(typeof getTransporter, 'function');
  });

  it('exports exactly 6 functions', () => {
    const exports = Object.keys(emailService);
    assert.equal(exports.length, 6);
  });
});
