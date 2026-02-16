/**
 * VocalIA Security Utils Tests
 *
 * Tests:
 * - secureRandomInt, secureRandomElement, secureShuffleArray, secureRandomString
 * - validateInput (9 patterns: email, phone, date, time, datetime, uuid, alphanumeric, slug, url)
 * - sanitizeInput (XSS prevention, length limit, trim, null bytes)
 * - validateRequestBody (schema-based validation)
 * - sanitizePath (path traversal prevention)
 * - isValidFilename
 * - RateLimiter (check, isAllowed, cleanup, destroy)
 * - timingSafeEqual (constant-time comparison)
 * - redactSensitive (sensitive key redaction)
 * - validateUrl (SSRF prevention)
 * - generateCsrfToken, validateCsrfToken
 * - encodeHTML, stripHTML, sanitizeURL
 * - setSecurityHeaders
 * - debounce, throttle
 * - VALIDATION_PATTERNS
 *
 * NOTE: Does NOT test async network functions (fetchWithTimeout, retryWithExponentialBackoff, safePoll).
 *
 * Run: node --test test/security-utils.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import sec from '../lib/security-utils.cjs';

// ─── Module Exports ──────────────────────────────────────────────────────────

describe('Security Utils exports', () => {
  test('exports at least 25 items', () => {
    assert.ok(Object.keys(sec).length >= 25);
  });

  test('exports all documented functions', () => {
    const expected = [
      'fetchWithTimeout', 'retryWithExponentialBackoff', 'safePoll', 'createDedupedFetch',
      'debounce', 'throttle', 'secureRandomInt', 'secureRandomElement',
      'secureShuffleArray', 'secureRandomString', 'validateInput', 'sanitizeInput',
      'validateRequestBody', 'VALIDATION_PATTERNS', 'sanitizePath', 'isValidFilename',
      'RateLimiter', 'requestSizeLimiter', 'setSecurityHeaders', 'securityHeadersMiddleware',
      'corsMiddleware', 'timingSafeEqual', 'redactSensitive', 'safeLog', 'validateUrl',
      'generateCsrfToken', 'validateCsrfToken', 'csrfMiddleware',
      'encodeHTML', 'stripHTML', 'sanitizeURL'
    ];
    for (const name of expected) {
      assert.ok(name in sec, `Missing export: ${name}`);
    }
  });
});

// ─── Secure Random ───────────────────────────────────────────────────────────

describe('secureRandomInt', () => {
  test('returns integer in range', () => {
    for (let i = 0; i < 50; i++) {
      const val = sec.secureRandomInt(0, 10);
      assert.ok(val >= 0 && val < 10, `${val} not in [0,10)`);
    }
  });

  test('returns min when range is 1', () => {
    assert.strictEqual(sec.secureRandomInt(5, 6), 5);
  });
});

describe('secureRandomElement', () => {
  test('returns element from array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      assert.ok(arr.includes(sec.secureRandomElement(arr)));
    }
  });

  test('returns sole element from single-item array', () => {
    assert.strictEqual(sec.secureRandomElement(['only']), 'only');
  });

  test('throws on empty array', () => {
    assert.throws(() => sec.secureRandomElement([]), /non-empty/);
  });

  test('throws on non-array', () => {
    assert.throws(() => sec.secureRandomElement('string'), /non-empty/);
  });

  test('throws on null', () => {
    assert.throws(() => sec.secureRandomElement(null), /non-empty/);
  });
});

describe('secureShuffleArray', () => {
  test('returns new array (not same reference)', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = sec.secureShuffleArray(arr);
    assert.notStrictEqual(arr, shuffled);
  });

  test('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = sec.secureShuffleArray(arr);
    assert.strictEqual(shuffled.length, arr.length);
    for (const item of arr) {
      assert.ok(shuffled.includes(item));
    }
  });

  test('does not modify original array', () => {
    const arr = [1, 2, 3];
    sec.secureShuffleArray(arr);
    assert.deepStrictEqual(arr, [1, 2, 3]);
  });

  test('returns empty array for empty input', () => {
    assert.deepStrictEqual(sec.secureShuffleArray([]), []);
  });
});

describe('secureRandomString', () => {
  test('returns hex string of specified length', () => {
    const str = sec.secureRandomString(16);
    assert.strictEqual(str.length, 16);
    assert.match(str, /^[0-9a-f]+$/);
  });

  test('defaults to 32 characters', () => {
    const str = sec.secureRandomString();
    assert.strictEqual(str.length, 32);
  });

  test('generates unique strings', () => {
    const a = sec.secureRandomString(32);
    const b = sec.secureRandomString(32);
    assert.notStrictEqual(a, b);
  });
});

// ─── VALIDATION_PATTERNS ─────────────────────────────────────────────────────

describe('VALIDATION_PATTERNS', () => {
  test('has 9 patterns', () => {
    assert.strictEqual(Object.keys(sec.VALIDATION_PATTERNS).length, 9);
  });

  test('all patterns are RegExp', () => {
    for (const [, pattern] of Object.entries(sec.VALIDATION_PATTERNS)) {
      assert.ok(pattern instanceof RegExp);
    }
  });

  test('has email, phone, date, time, datetime, uuid, alphanumeric, slug, url', () => {
    for (const key of ['email', 'phone', 'date', 'time', 'datetime', 'uuid', 'alphanumeric', 'slug', 'url']) {
      assert.ok(key in sec.VALIDATION_PATTERNS, `Missing: ${key}`);
    }
  });
});

// ─── validateInput ───────────────────────────────────────────────────────────

describe('validateInput', () => {
  test('email: valid', () => {
    assert.ok(sec.validateInput('test@example.com', 'email'));
    assert.ok(sec.validateInput('user.name+tag@domain.co.uk', 'email'));
  });

  test('email: invalid', () => {
    assert.ok(!sec.validateInput('not-an-email', 'email'));
    assert.ok(!sec.validateInput('@missing.com', 'email'));
  });

  test('phone: valid', () => {
    assert.ok(sec.validateInput('+212 6 12 34 56 78', 'phone'));
    assert.ok(sec.validateInput('+33612345678', 'phone'));
    assert.ok(sec.validateInput('(555) 123-4567', 'phone'));
  });

  test('phone: invalid', () => {
    assert.ok(!sec.validateInput('not-a-phone', 'phone'));
    assert.ok(!sec.validateInput('', 'phone'));
  });

  test('date: valid YYYY-MM-DD', () => {
    assert.ok(sec.validateInput('2026-02-06', 'date'));
  });

  test('date: invalid', () => {
    assert.ok(!sec.validateInput('06/02/2026', 'date'));
    assert.ok(!sec.validateInput('2026-2-6', 'date'));
  });

  test('time: valid', () => {
    assert.ok(sec.validateInput('14:30', 'time'));
    assert.ok(sec.validateInput('14:30:59', 'time'));
  });

  test('time: invalid', () => {
    assert.ok(!sec.validateInput('2pm', 'time'));
  });

  test('uuid: valid', () => {
    assert.ok(sec.validateInput('550e8400-e29b-41d4-a716-446655440000', 'uuid'));
  });

  test('uuid: invalid', () => {
    assert.ok(!sec.validateInput('not-a-uuid', 'uuid'));
  });

  test('alphanumeric: valid', () => {
    assert.ok(sec.validateInput('abc123', 'alphanumeric'));
  });

  test('alphanumeric: rejects special chars', () => {
    assert.ok(!sec.validateInput('abc-123', 'alphanumeric'));
    assert.ok(!sec.validateInput('abc 123', 'alphanumeric'));
  });

  test('slug: valid', () => {
    assert.ok(sec.validateInput('my-page-slug', 'slug'));
    assert.ok(sec.validateInput('abc', 'slug'));
  });

  test('slug: rejects uppercase', () => {
    assert.ok(!sec.validateInput('My-Page', 'slug'));
  });

  test('url: valid', () => {
    assert.ok(sec.validateInput('https://vocalia.ma', 'url'));
    assert.ok(sec.validateInput('http://localhost:3004/health', 'url'));
  });

  test('url: rejects ftp', () => {
    assert.ok(!sec.validateInput('ftp://files.example.com', 'url'));
  });

  test('returns false for null', () => {
    assert.ok(!sec.validateInput(null, 'email'));
  });

  test('returns false for undefined', () => {
    assert.ok(!sec.validateInput(undefined, 'email'));
  });

  test('throws for unknown type', () => {
    assert.throws(() => sec.validateInput('test', 'unknown_type'), /Unknown validation type/);
  });
});

// ─── sanitizeInput ───────────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  test('escapes HTML by default', () => {
    const result = sec.sanitizeInput('<script>alert("xss")</script>');
    assert.ok(!result.includes('<script>'));
    assert.ok(result.includes('&lt;script&gt;'));
  });

  test('escapes all 5 HTML entities', () => {
    const result = sec.sanitizeInput('<>"\'&');
    assert.ok(result.includes('&lt;'));
    assert.ok(result.includes('&gt;'));
    assert.ok(result.includes('&quot;'));
    assert.ok(result.includes('&#x27;'));
    assert.ok(result.includes('&amp;'));
  });

  test('preserves HTML when allowHtml=true', () => {
    const result = sec.sanitizeInput('<b>bold</b>', { allowHtml: true });
    assert.ok(result.includes('<b>'));
  });

  test('trims whitespace by default', () => {
    assert.strictEqual(sec.sanitizeInput('  hello  '), 'hello');
  });

  test('preserves whitespace when trim=false', () => {
    const result = sec.sanitizeInput('  hello  ', { trim: false });
    assert.ok(result.startsWith('  '));
  });

  test('truncates to maxLength', () => {
    const result = sec.sanitizeInput('a'.repeat(200), { maxLength: 50 });
    assert.strictEqual(result.length, 50);
  });

  test('removes null bytes', () => {
    const result = sec.sanitizeInput('hello\0world');
    assert.ok(!result.includes('\0'));
    assert.ok(result.includes('helloworld'));
  });

  test('returns empty string for null', () => {
    assert.strictEqual(sec.sanitizeInput(null), '');
  });

  test('returns empty string for undefined', () => {
    assert.strictEqual(sec.sanitizeInput(undefined), '');
  });

  test('converts numbers to string', () => {
    assert.strictEqual(sec.sanitizeInput(42), '42');
  });
});

// ─── validateRequestBody ─────────────────────────────────────────────────────

describe('validateRequestBody', () => {
  const schema = {
    email: { required: true, type: 'email' },
    name: { required: true, minLength: 2, maxLength: 50 },
    phone: { required: false, type: 'phone' }
  };

  test('valid body returns valid=true', () => {
    const result = sec.validateRequestBody({ email: 'a@b.com', name: 'Jean' }, schema);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('missing required field returns error', () => {
    const result = sec.validateRequestBody({ name: 'Jean' }, schema);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('email')));
  });

  test('invalid type returns error', () => {
    const result = sec.validateRequestBody({ email: 'not-email', name: 'Jean' }, schema);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('email')));
  });

  test('too short name returns error', () => {
    const result = sec.validateRequestBody({ email: 'a@b.com', name: 'X' }, schema);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')));
  });

  test('too long name returns error', () => {
    const result = sec.validateRequestBody({ email: 'a@b.com', name: 'X'.repeat(51) }, schema);
    assert.strictEqual(result.valid, false);
  });

  test('optional field skipped when empty', () => {
    const result = sec.validateRequestBody({ email: 'a@b.com', name: 'Jean' }, schema);
    assert.ok(!('phone' in result.sanitized));
  });

  test('sanitizes output fields', () => {
    const result = sec.validateRequestBody({ email: 'a@b.com', name: '<b>Jean</b>' }, schema);
    assert.ok(!result.sanitized.name.includes('<b>'));
  });

  test('custom validator works', () => {
    const customSchema = {
      age: { required: true, validator: v => Number(v) >= 18, message: 'Must be 18+' }
    };
    const result = sec.validateRequestBody({ age: '16' }, customSchema);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('18+')));
  });
});

// ─── sanitizePath ────────────────────────────────────────────────────────────

describe('sanitizePath', () => {
  test('allows normal subdirectory path', () => {
    const result = sec.sanitizePath('sub/file.txt', '/base');
    assert.strictEqual(result, path.resolve('/base', 'sub/file.txt'));
  });

  test('blocks path traversal with ../', () => {
    assert.throws(() => sec.sanitizePath('../../etc/passwd', '/base'), /Path traversal/);
  });

  test('blocks absolute path outside base', () => {
    assert.throws(() => sec.sanitizePath('/etc/passwd', '/base'), /Path traversal/);
  });

  test('allows base path itself', () => {
    const result = sec.sanitizePath('.', '/base');
    assert.strictEqual(result, path.resolve('/base'));
  });
});

// ─── isValidFilename ─────────────────────────────────────────────────────────

describe('isValidFilename', () => {
  test('valid simple filename', () => {
    assert.ok(sec.isValidFilename('report.pdf'));
  });

  test('valid filename with dots', () => {
    assert.ok(sec.isValidFilename('archive.tar.gz'));
  });

  test('rejects path separator /', () => {
    assert.ok(!sec.isValidFilename('path/file.txt'));
  });

  test('rejects path separator \\', () => {
    assert.ok(!sec.isValidFilename('path\\file.txt'));
  });

  test('rejects .', () => {
    assert.ok(!sec.isValidFilename('.'));
  });

  test('rejects ..', () => {
    assert.ok(!sec.isValidFilename('..'));
  });

  test('rejects null bytes', () => {
    assert.ok(!sec.isValidFilename('file\0.txt'));
  });

  test('rejects empty string', () => {
    assert.ok(!sec.isValidFilename(''));
  });

  test('rejects null', () => {
    assert.ok(!sec.isValidFilename(null));
  });

  test('rejects non-string', () => {
    assert.ok(!sec.isValidFilename(123));
  });
});

// ─── RateLimiter ─────────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  test('allows requests within limit', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 5, windowMs: 10000 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('test-ip');
      assert.ok(result.allowed, `Request ${i + 1} should be allowed`);
    }
    limiter.destroy();
  });

  test('blocks requests exceeding limit', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 3, windowMs: 10000 });
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');
    const result = limiter.check('ip1');
    assert.ok(!result.allowed);
    limiter.destroy();
  });

  test('tracks remaining count', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 5, windowMs: 10000 });
    const r1 = limiter.check('ip2');
    assert.strictEqual(r1.remaining, 4);
    const r2 = limiter.check('ip2');
    assert.strictEqual(r2.remaining, 3);
    limiter.destroy();
  });

  test('isAllowed returns boolean', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 2, windowMs: 10000 });
    assert.strictEqual(limiter.isAllowed('ip3'), true);
    assert.strictEqual(limiter.isAllowed('ip3'), true);
    assert.strictEqual(limiter.isAllowed('ip3'), false);
    limiter.destroy();
  });

  test('tracks different keys independently', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 1, windowMs: 10000 });
    assert.ok(limiter.isAllowed('ip-a'));
    assert.ok(!limiter.isAllowed('ip-a')); // blocked
    assert.ok(limiter.isAllowed('ip-b'));  // different key, allowed
    limiter.destroy();
  });

  test('cleanup removes expired entries', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 10, windowMs: 1 });
    limiter.check('cleanup-test');
    // After 1ms window, cleanup should clear
    setTimeout(() => {
      limiter.cleanup();
      // Fresh entry should be allowed
      assert.ok(limiter.isAllowed('cleanup-test'));
      limiter.destroy();
    }, 5);
  });

  test('destroy clears state', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 10, windowMs: 60000 });
    limiter.check('destroy-test');
    limiter.destroy();
    // After destroy, internal map is cleared
    assert.strictEqual(limiter.requests.size, 0);
  });

  test('returns resetTime', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 5, windowMs: 60000 });
    const result = limiter.check('reset-test');
    assert.ok(typeof result.resetTime === 'number');
    assert.ok(result.resetTime > Date.now());
    limiter.destroy();
  });
});

// ─── timingSafeEqual ─────────────────────────────────────────────────────────

describe('timingSafeEqual', () => {
  test('returns true for equal strings', () => {
    assert.ok(sec.timingSafeEqual('secret123', 'secret123'));
  });

  test('returns false for different strings', () => {
    assert.ok(!sec.timingSafeEqual('secret123', 'secret456'));
  });

  test('returns false for different lengths', () => {
    assert.ok(!sec.timingSafeEqual('short', 'longer-string'));
  });

  test('returns false for non-string first arg', () => {
    assert.ok(!sec.timingSafeEqual(123, 'string'));
  });

  test('returns false for non-string second arg', () => {
    assert.ok(!sec.timingSafeEqual('string', null));
  });

  test('returns false for both non-strings', () => {
    assert.ok(!sec.timingSafeEqual(null, undefined));
  });
});

// ─── redactSensitive ─────────────────────────────────────────────────────────

describe('redactSensitive', () => {
  test('redacts password field', () => {
    const result = sec.redactSensitive({ password: 'secret123' });
    assert.strictEqual(result.password, '[REDACTED]');
  });

  test('redacts token field', () => {
    const result = sec.redactSensitive({ auth_token: 'tok123' });
    assert.strictEqual(result.auth_token, '[REDACTED]');
  });

  test('redacts api_key field', () => {
    const result = sec.redactSensitive({ api_key: 'key123' });
    assert.strictEqual(result.api_key, '[REDACTED]');
  });

  test('redacts apikey field (case insensitive)', () => {
    const result = sec.redactSensitive({ ApiKey: 'key123' });
    assert.strictEqual(result.ApiKey, '[REDACTED]');
  });

  test('preserves non-sensitive fields', () => {
    const result = sec.redactSensitive({ name: 'Jean', email: 'j@b.com' });
    assert.strictEqual(result.name, 'Jean');
    assert.strictEqual(result.email, 'j@b.com');
  });

  test('redacts nested objects', () => {
    const result = sec.redactSensitive({ user: { password: 'secret' } });
    assert.strictEqual(result.user.password, '[REDACTED]');
  });

  test('returns primitive as-is', () => {
    assert.strictEqual(sec.redactSensitive('string'), 'string');
    assert.strictEqual(sec.redactSensitive(42), 42);
  });

  test('returns null as-is', () => {
    assert.strictEqual(sec.redactSensitive(null), null);
  });

  test('handles arrays', () => {
    const result = sec.redactSensitive([{ password: 'x' }]);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].password, '[REDACTED]');
  });
});

// ─── validateUrl ─────────────────────────────────────────────────────────────

describe('validateUrl', () => {
  test('allows https URL', () => {
    assert.ok(sec.validateUrl('https://vocalia.ma'));
  });

  test('allows http URL', () => {
    assert.ok(sec.validateUrl('http://example.com'));
  });

  test('rejects ftp protocol', () => {
    assert.ok(!sec.validateUrl('ftp://files.example.com'));
  });

  test('rejects file protocol', () => {
    assert.ok(!sec.validateUrl('file:///etc/passwd'));
  });

  test('blocks localhost', () => {
    assert.ok(!sec.validateUrl('http://localhost:3000'));
  });

  test('blocks 127.0.0.1', () => {
    assert.ok(!sec.validateUrl('http://127.0.0.1:8080'));
  });

  test('blocks 192.168.x.x', () => {
    assert.ok(!sec.validateUrl('http://192.168.1.1'));
  });

  test('blocks 10.x.x.x', () => {
    assert.ok(!sec.validateUrl('http://10.0.0.1'));
  });

  test('blocks 0.0.0.0', () => {
    assert.ok(!sec.validateUrl('http://0.0.0.0'));
  });

  test('blocks ::1 IPv6 loopback', () => {
    // WHATWG URL spec: hostname includes brackets for IPv6
    // new URL('http://[::1]').hostname === '[::1]'
    assert.ok(!sec.validateUrl('http://[::1]'));
  });

  test('returns false for invalid URL', () => {
    assert.ok(!sec.validateUrl('not-a-url'));
  });

  test('validates against allowedHosts whitelist', () => {
    assert.ok(sec.validateUrl('https://api.vocalia.ma/health', ['vocalia.ma']));
    assert.ok(!sec.validateUrl('https://evil.com', ['vocalia.ma']));
  });

  test('allowedHosts supports subdomain matching', () => {
    assert.ok(sec.validateUrl('https://sub.example.com', ['example.com']));
  });
});

// ─── CSRF ────────────────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  test('generates hex string', () => {
    const token = sec.generateCsrfToken();
    assert.match(token, /^[0-9a-f]+$/);
  });

  test('default length is 64 hex chars (32 bytes)', () => {
    const token = sec.generateCsrfToken();
    assert.strictEqual(token.length, 64);
  });

  test('custom length', () => {
    const token = sec.generateCsrfToken(16);
    assert.strictEqual(token.length, 32); // 16 bytes = 32 hex chars
  });

  test('generates unique tokens', () => {
    const a = sec.generateCsrfToken();
    const b = sec.generateCsrfToken();
    assert.notStrictEqual(a, b);
  });
});

describe('validateCsrfToken', () => {
  test('returns true for matching tokens', () => {
    const token = sec.generateCsrfToken();
    assert.ok(sec.validateCsrfToken(token, token));
  });

  test('returns false for different tokens', () => {
    assert.ok(!sec.validateCsrfToken('abc', 'def'));
  });

  test('returns false for null token', () => {
    assert.ok(!sec.validateCsrfToken(null, 'expected'));
  });

  test('returns false for null expected', () => {
    assert.ok(!sec.validateCsrfToken('token', null));
  });

  test('returns false for both null', () => {
    assert.ok(!sec.validateCsrfToken(null, null));
  });
});

// ─── XSS Utilities ───────────────────────────────────────────────────────────

describe('encodeHTML', () => {
  test('encodes < and >', () => {
    assert.strictEqual(sec.encodeHTML('<script>'), '&lt;script&gt;');
  });

  test('encodes quotes', () => {
    const result = sec.encodeHTML('"hello"');
    assert.ok(result.includes('&quot;'));
  });

  test('encodes single quotes', () => {
    const result = sec.encodeHTML("it's");
    assert.ok(result.includes('&#x27;'));
  });

  test('encodes ampersand', () => {
    assert.ok(sec.encodeHTML('a&b').includes('&amp;'));
  });

  test('encodes forward slash', () => {
    assert.ok(sec.encodeHTML('/path').includes('&#x2F;'));
  });

  test('returns empty string for null', () => {
    assert.strictEqual(sec.encodeHTML(null), '');
  });

  test('returns empty string for undefined', () => {
    assert.strictEqual(sec.encodeHTML(undefined), '');
  });
});

describe('stripHTML', () => {
  test('removes HTML tags', () => {
    assert.strictEqual(sec.stripHTML('<b>bold</b>'), 'bold');
  });

  test('removes nested tags', () => {
    assert.strictEqual(sec.stripHTML('<div><p>text</p></div>'), 'text');
  });

  test('removes self-closing tags', () => {
    const result = sec.stripHTML('hello<br/>world');
    assert.strictEqual(result, 'helloworld');
  });

  test('returns empty string for null', () => {
    assert.strictEqual(sec.stripHTML(null), '');
  });

  test('returns plain text unchanged', () => {
    assert.strictEqual(sec.stripHTML('no tags here'), 'no tags here');
  });
});

describe('sanitizeURL', () => {
  test('allows https URLs', () => {
    assert.strictEqual(sec.sanitizeURL('https://vocalia.ma'), 'https://vocalia.ma');
  });

  test('allows http URLs', () => {
    assert.strictEqual(sec.sanitizeURL('http://example.com'), 'http://example.com');
  });

  test('allows relative URLs', () => {
    assert.strictEqual(sec.sanitizeURL('/path/to/page'), '/path/to/page');
  });

  test('allows hash links', () => {
    assert.strictEqual(sec.sanitizeURL('#section'), '#section');
  });

  test('allows mailto links', () => {
    assert.strictEqual(sec.sanitizeURL('mailto:test@example.com'), 'mailto:test@example.com');
  });

  test('allows tel links', () => {
    assert.strictEqual(sec.sanitizeURL('tel:+212612345678'), 'tel:+212612345678');
  });

  test('blocks javascript: scheme', () => {
    assert.strictEqual(sec.sanitizeURL('javascript:alert(1)'), null);
  });

  test('blocks data: scheme', () => {
    assert.strictEqual(sec.sanitizeURL('data:text/html,<script>'), null);
  });

  test('blocks vbscript: scheme', () => {
    assert.strictEqual(sec.sanitizeURL('vbscript:msgbox'), null);
  });

  test('blocks file: scheme', () => {
    assert.strictEqual(sec.sanitizeURL('file:///etc/passwd'), null);
  });

  test('returns null for null input', () => {
    assert.strictEqual(sec.sanitizeURL(null), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(sec.sanitizeURL(''), null);
  });
});

// ─── setSecurityHeaders ──────────────────────────────────────────────────────

describe('setSecurityHeaders', () => {
  test('sets all 7 security headers', () => {
    const headers = {};
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    sec.setSecurityHeaders(mockRes);

    assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
    assert.strictEqual(headers['X-Frame-Options'], 'DENY');
    assert.strictEqual(headers['X-XSS-Protection'], '0');
    assert.ok(headers['Referrer-Policy']);
    assert.ok(headers['Strict-Transport-Security'].includes('max-age='));
    assert.ok(headers['Content-Security-Policy'].includes("default-src"));
    assert.ok(headers['Permissions-Policy']);
  });

  test('HSTS max-age is at least 1 year', () => {
    const headers = {};
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    sec.setSecurityHeaders(mockRes);
    assert.ok(headers['Strict-Transport-Security'].includes('31536000'));
  });

  test('HSTS includes includeSubDomains', () => {
    const headers = {};
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    sec.setSecurityHeaders(mockRes);
    assert.ok(headers['Strict-Transport-Security'].includes('includeSubDomains'));
  });
});

// ─── debounce ────────────────────────────────────────────────────────────────

describe('debounce', () => {
  test('returns a function', () => {
    const debounced = sec.debounce(() => {}, 100);
    assert.strictEqual(typeof debounced, 'function');
  });

  test('delays execution', (t, done) => {
    let called = false;
    const debounced = sec.debounce(() => { called = true; }, 50);
    debounced();
    assert.ok(!called, 'Should not be called immediately');
    setTimeout(() => {
      assert.ok(called, 'Should be called after delay');
      done();
    }, 100);
  });

  test('resets timer on rapid calls', (t, done) => {
    let count = 0;
    const debounced = sec.debounce(() => { count++; }, 50);
    debounced();
    debounced();
    debounced();
    setTimeout(() => {
      assert.strictEqual(count, 1, 'Should only fire once');
      done();
    }, 150);
  });
});

// ─── throttle ────────────────────────────────────────────────────────────────

describe('throttle', () => {
  test('returns a function', () => {
    const throttled = sec.throttle(() => {}, 100);
    assert.strictEqual(typeof throttled, 'function');
  });

  test('executes immediately on first call', () => {
    let called = false;
    const throttled = sec.throttle(() => { called = true; }, 100);
    throttled();
    assert.ok(called);
  });

  test('blocks subsequent calls within limit', () => {
    let count = 0;
    const throttled = sec.throttle(() => { count++; }, 100);
    throttled();
    throttled();
    throttled();
    assert.strictEqual(count, 1);
  });
});

// ─── retryWithExponentialBackoff ─────────────────────────────────────────────

describe('retryWithExponentialBackoff', () => {
  test('returns result on first success', async () => {
    const result = await sec.retryWithExponentialBackoff(() => 'ok', {
      maxRetries: 3, baseDelayMs: 1
    });
    assert.strictEqual(result, 'ok');
  });

  test('retries on failure then succeeds', async () => {
    let attempt = 0;
    const result = await sec.retryWithExponentialBackoff(() => {
      attempt++;
      if (attempt < 3) throw new Error('fail');
      return 'recovered';
    }, { maxRetries: 5, baseDelayMs: 1, jitter: false });
    assert.strictEqual(result, 'recovered');
    assert.strictEqual(attempt, 3);
  });

  test('throws after maxRetries exhausted', async () => {
    await assert.rejects(
      () => sec.retryWithExponentialBackoff(() => { throw new Error('always fail'); }, {
        maxRetries: 2, baseDelayMs: 1, jitter: false
      }),
      /failed after 3 attempts/
    );
  });

  test('calls onRetry callback with correct args', async () => {
    const retries = [];
    try {
      await sec.retryWithExponentialBackoff(() => { throw new Error('fail'); }, {
        maxRetries: 2, baseDelayMs: 1, jitter: false,
        onRetry: (attempt, delay, error) => retries.push({ attempt, delay, msg: error.message })
      });
    } catch { /* expected */ }
    assert.strictEqual(retries.length, 2);
    assert.strictEqual(retries[0].attempt, 1);
    assert.strictEqual(retries[0].msg, 'fail');
    // Second retry delay should be baseDelayMs * factor^1 = 2
    assert.strictEqual(retries[1].delay, 2);
  });

  test('respects maxDelayMs cap', async () => {
    const retries = [];
    try {
      await sec.retryWithExponentialBackoff(() => { throw new Error('fail'); }, {
        maxRetries: 5, baseDelayMs: 100, maxDelayMs: 150, jitter: false,
        onRetry: (attempt, delay) => retries.push(delay)
      });
    } catch { /* expected */ }
    // All delays should be <= maxDelayMs
    for (const d of retries) {
      assert.ok(d <= 150, `Delay ${d} exceeds maxDelayMs 150`);
    }
  });
});

// ─── safePoll ────────────────────────────────────────────────────────────────

describe('safePoll', () => {
  test('returns result when done=true', async () => {
    let call = 0;
    const result = await sec.safePoll(() => {
      call++;
      return { done: call >= 2, result: 'complete', status: 'checking' };
    }, { maxRetries: 10, intervalMs: 1, maxTimeMs: 5000 });
    assert.strictEqual(result, 'complete');
    assert.strictEqual(call, 2);
  });

  test('throws after maxRetries', async () => {
    await assert.rejects(
      () => sec.safePoll(() => ({ done: false, status: 'waiting' }), {
        maxRetries: 3, intervalMs: 1, maxTimeMs: 60000
      }),
      /failed after 3 attempts/
    );
  });

  test('calls onProgress callback', async () => {
    const progress = [];
    await sec.safePoll(() => {
      return { done: progress.length >= 1, result: 'ok', status: 'step' };
    }, {
      maxRetries: 5, intervalMs: 1, maxTimeMs: 5000,
      onProgress: (attempts, status, elapsed) => progress.push({ attempts, status })
    });
    assert.ok(progress.length >= 1);
    assert.strictEqual(progress[0].status, 'step');
  });

  test('continues polling on checkFn error', async () => {
    let call = 0;
    const result = await sec.safePoll(() => {
      call++;
      if (call === 1) throw new Error('transient');
      return { done: true, result: 'recovered' };
    }, { maxRetries: 5, intervalMs: 1, maxTimeMs: 5000 });
    assert.strictEqual(result, 'recovered');
    assert.strictEqual(call, 2);
  });
});

// ─── corsMiddleware ──────────────────────────────────────────────────────────

describe('corsMiddleware', () => {
  test('sets CORS headers for allowed origin', () => {
    const mw = sec.corsMiddleware(['https://vocalia.ma']);
    const headers = {};
    const mockReq = { method: 'GET', headers: { origin: 'https://vocalia.ma' } };
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    let called = false;
    mw(mockReq, mockRes, () => { called = true; });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://vocalia.ma');
    assert.ok(called);
  });

  test('does NOT set CORS for disallowed origin', () => {
    const mw = sec.corsMiddleware(['https://vocalia.ma']);
    const headers = {};
    const mockReq = { method: 'GET', headers: { origin: 'https://evil.com' } };
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    mw(mockReq, mockRes, () => {});
    assert.strictEqual(headers['Access-Control-Allow-Origin'], undefined);
  });

  test('handles OPTIONS preflight with 204', () => {
    const mw = sec.corsMiddleware(['https://vocalia.ma']);
    const mockReq = { method: 'OPTIONS', headers: { origin: 'https://vocalia.ma' } };
    let status;
    let ended = false;
    const mockRes = {
      setHeader: () => {},
      set statusCode(s) { status = s; },
      get statusCode() { return status; },
      end: () => { ended = true; }
    };
    let nextCalled = false;
    mw(mockReq, mockRes, () => { nextCalled = true; });
    assert.strictEqual(status, 204);
    assert.ok(ended);
    assert.ok(!nextCalled, 'next() should NOT be called for OPTIONS');
  });

  test('allows all origins when allowedOrigins is empty', () => {
    const mw = sec.corsMiddleware([]);
    const headers = {};
    const mockReq = { method: 'GET', headers: { origin: 'https://anything.com' } };
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    mw(mockReq, mockRes, () => {});
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://anything.com');
  });

  test('sets Max-Age header', () => {
    const mw = sec.corsMiddleware(['https://vocalia.ma']);
    const headers = {};
    const mockReq = { method: 'GET', headers: { origin: 'https://vocalia.ma' } };
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    mw(mockReq, mockRes, () => {});
    assert.strictEqual(headers['Access-Control-Max-Age'], '86400');
  });
});

// ─── requestSizeLimiter ──────────────────────────────────────────────────────

describe('requestSizeLimiter', () => {
  test('returns a middleware function', () => {
    const mw = sec.requestSizeLimiter(1024);
    assert.strictEqual(typeof mw, 'function');
  });

  test('rejects oversized Content-Length with 413', () => {
    const mw = sec.requestSizeLimiter(100);
    let status;
    let body;
    const mockReq = { headers: { 'content-length': '200' }, on: () => {} };
    const mockRes = {
      set statusCode(s) { status = s; },
      end: (b) => { body = b; }
    };
    mw(mockReq, mockRes, () => {});
    assert.strictEqual(status, 413);
    assert.ok(body.includes('too large'));
  });

  test('calls next() for acceptable Content-Length', () => {
    const mw = sec.requestSizeLimiter(1000);
    const mockReq = { headers: { 'content-length': '500' }, on: () => {} };
    const mockRes = {};
    let called = false;
    mw(mockReq, mockRes, () => { called = true; });
    assert.ok(called);
  });
});

// ─── RateLimiter maxEntries (memory DoS prevention) ──────────────────────────

describe('RateLimiter maxEntries', () => {
  test('prevents memory DoS via maxEntries limit', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 100, maxEntries: 3, windowMs: 60000 });
    limiter.check('a');
    limiter.check('b');
    limiter.check('c');
    const result = limiter.check('d'); // 4th unique key exceeds maxEntries
    assert.ok(!result.allowed, 'Should block new keys beyond maxEntries');
    assert.strictEqual(result.remaining, 0);
    limiter.destroy();
  });
});

// ─── securityHeadersMiddleware ───────────────────────────────────────────────

describe('securityHeadersMiddleware', () => {
  test('returns a middleware function', () => {
    const mw = sec.securityHeadersMiddleware();
    assert.strictEqual(typeof mw, 'function');
  });

  test('sets headers and calls next()', () => {
    const mw = sec.securityHeadersMiddleware();
    const headers = {};
    const mockReq = {};
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    let called = false;
    mw(mockReq, mockRes, () => { called = true; });
    assert.ok(called);
    assert.strictEqual(headers['X-Frame-Options'], 'DENY');
  });
});

// ─── Integration chains ──────────────────────────────────────────────────────

describe('Integration chains', () => {
  test('sanitizeInput → encodeHTML double-encoding is safe', () => {
    const input = '<script>alert("xss")</script>';
    const sanitized = sec.sanitizeInput(input);
    const encoded = sec.encodeHTML(sanitized);
    assert.ok(!encoded.includes('<script>'));
  });

  test('validateRequestBody + sanitizeInput chain prevents XSS', () => {
    const schema = { comment: { required: true, maxLength: 500 } };
    const body = { comment: '<img onerror="alert(document.cookie)">' };
    const result = sec.validateRequestBody(body, schema);
    assert.ok(result.valid);
    assert.ok(!result.sanitized.comment.includes('<img'), 'XSS should be escaped');
  });

  test('CSRF token generation → validation round-trip', () => {
    const token = sec.generateCsrfToken();
    assert.ok(sec.validateCsrfToken(token, token));
    assert.ok(!sec.validateCsrfToken(token, token + 'x'));
  });

  test('sanitizePath + isValidFilename combined security', () => {
    const filename = 'report.pdf';
    assert.ok(sec.isValidFilename(filename));
    const fullPath = sec.sanitizePath(filename, '/uploads');
    assert.strictEqual(fullPath, path.resolve('/uploads', filename));
  });

  test('sanitizePath + isValidFilename rejects traversal', () => {
    const malicious = '../../../etc/passwd';
    assert.ok(!sec.isValidFilename(malicious));
    assert.throws(() => sec.sanitizePath(malicious, '/uploads'), /Path traversal/);
  });

  test('validateUrl + sanitizeURL combined check', () => {
    assert.strictEqual(sec.sanitizeURL('javascript:alert(1)'), null);
    assert.ok(!sec.validateUrl('http://192.168.1.1/admin'));
    const good = 'https://api.vocalia.ma/health';
    assert.strictEqual(sec.sanitizeURL(good), good);
    assert.ok(sec.validateUrl(good));
  });

  test('redactSensitive preserves structure for safe logging', () => {
    const data = {
      user: 'admin',
      password: 'secret',
      nested: { api_key: 'sk_live_xxx', value: 42 }
    };
    const redacted = sec.redactSensitive(data);
    assert.strictEqual(redacted.user, 'admin');
    assert.strictEqual(redacted.password, '[REDACTED]');
    assert.strictEqual(redacted.nested.api_key, '[REDACTED]');
    assert.strictEqual(redacted.nested.value, 42);
  });

  test('RateLimiter + timingSafeEqual for auth flow', () => {
    const limiter = new sec.RateLimiter({ maxRequests: 3, windowMs: 60000 });
    const apiKey = sec.secureRandomString(32);

    // Simulate 3 auth attempts
    for (let i = 0; i < 3; i++) {
      const allowed = limiter.isAllowed('auth-ip');
      assert.ok(allowed);
      sec.timingSafeEqual(apiKey, apiKey); // constant-time compare
    }
    // 4th attempt blocked
    assert.ok(!limiter.isAllowed('auth-ip'));
    limiter.destroy();
  });
});
