/**
 * RateLimiter & Security Utils Tests
 *
 * Tests rate limiting, input validation, and security utilities.
 * Run: node --test test/rate-limiter.test.mjs
 *
 * @session 250.6
 */


import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { RateLimiter, validateInput, sanitizeInput, validateRequestBody, sanitizePath, isValidFilename, secureRandomInt, secureRandomString, timingSafeEqual, redactSensitive, validateUrl, generateCsrfToken, validateCsrfToken, encodeHTML, stripHTML, sanitizeURL } from '../lib/security-utils.cjs';


describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 1000,  // 1 second window for fast tests
      maxRequests: 3   // 3 requests per window
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  test('allows requests under the limit', () => {
    const result1 = limiter.check('test-user');
    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result1.remaining, 2);

    const result2 = limiter.check('test-user');
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result2.remaining, 1);

    const result3 = limiter.check('test-user');
    assert.strictEqual(result3.allowed, true);
    assert.strictEqual(result3.remaining, 0);
  });

  test('blocks requests over the limit', () => {
    // Use up all requests
    limiter.check('test-user');
    limiter.check('test-user');
    limiter.check('test-user');

    // 4th request should be blocked
    const result = limiter.check('test-user');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.remaining, 0);
  });

  test('tracks different users separately', () => {
    // User A uses 3 requests
    limiter.check('user-a');
    limiter.check('user-a');
    limiter.check('user-a');

    // User A blocked
    assert.strictEqual(limiter.isAllowed('user-a'), false);

    // User B still allowed
    assert.strictEqual(limiter.isAllowed('user-b'), true);
  });

  test('isAllowed returns boolean', () => {
    assert.strictEqual(limiter.isAllowed('test'), true);
    assert.strictEqual(typeof limiter.isAllowed('test'), 'boolean');
  });

  test('resets after window expires', async () => {
    // Use all requests
    limiter.check('test-user');
    limiter.check('test-user');
    limiter.check('test-user');
    assert.strictEqual(limiter.isAllowed('test-user'), false);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 1100));

    // Should be allowed again
    assert.strictEqual(limiter.isAllowed('test-user'), true);
  });

  test('cleanup removes old entries', () => {
    limiter.check('old-user');
    assert.ok(limiter.requests.has('old-user'));

    // Manually trigger cleanup
    limiter.cleanup();

    // Entry should still exist (within window)
    assert.ok(limiter.requests.has('old-user'));
  });

  test('returns resetTime in result', () => {
    const result = limiter.check('test-user');
    assert.ok(result.resetTime > Date.now());
    assert.ok(result.resetTime <= Date.now() + 1000);
  });
});

describe('Input Validation', () => {
  describe('validateInput', () => {
    test('validates email addresses', () => {
      assert.strictEqual(validateInput('test@example.com', 'email'), true);
      assert.strictEqual(validateInput('user.name+tag@domain.co.uk', 'email'), true);
      assert.strictEqual(validateInput('invalid-email', 'email'), false);
      assert.strictEqual(validateInput('@missing.local', 'email'), false);
    });

    test('validates phone numbers', () => {
      assert.strictEqual(validateInput('+33612345678', 'phone'), true);
      assert.strictEqual(validateInput('0612345678', 'phone'), true);
      assert.strictEqual(validateInput('+212-5-20-00-00-00', 'phone'), true);
      assert.strictEqual(validateInput('abc', 'phone'), false);
    });

    test('validates dates', () => {
      assert.strictEqual(validateInput('2026-01-31', 'date'), true);
      assert.strictEqual(validateInput('31-01-2026', 'date'), false);
      assert.strictEqual(validateInput('2026/01/31', 'date'), false);
    });

    test('validates UUIDs', () => {
      assert.strictEqual(validateInput('123e4567-e89b-12d3-a456-426614174000', 'uuid'), true);
      assert.strictEqual(validateInput('not-a-uuid', 'uuid'), false);
    });

    test('validates URLs', () => {
      assert.strictEqual(validateInput('https://example.com', 'url'), true);
      assert.strictEqual(validateInput('http://localhost:3000', 'url'), true);
      assert.strictEqual(validateInput('ftp://server.com', 'url'), false);
    });

    test('returns false for null/undefined', () => {
      assert.strictEqual(validateInput(null, 'email'), false);
      assert.strictEqual(validateInput(undefined, 'email'), false);
    });

    test('throws for unknown type', () => {
      assert.throws(() => validateInput('test', 'unknown-type'), /Unknown validation type/);
    });
  });

  describe('sanitizeInput', () => {
    test('trims whitespace', () => {
      assert.strictEqual(sanitizeInput('  hello  '), 'hello');
    });

    test('limits length', () => {
      const result = sanitizeInput('abcdefghij', { maxLength: 5 });
      assert.strictEqual(result, 'abcde');
    });

    test('escapes HTML entities', () => {
      assert.strictEqual(sanitizeInput('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('allows HTML when specified', () => {
      assert.strictEqual(sanitizeInput('<b>bold</b>', { allowHtml: true }), '<b>bold</b>');
    });

    test('removes null bytes', () => {
      assert.strictEqual(sanitizeInput('hello\0world'), 'helloworld');
    });

    test('handles null/undefined', () => {
      assert.strictEqual(sanitizeInput(null), '');
      assert.strictEqual(sanitizeInput(undefined), '');
    });
  });

  describe('validateRequestBody', () => {
    test('validates required fields', () => {
      const body = { name: 'John' };
      const schema = {
        name: { required: true },
        email: { required: true }
      };

      const result = validateRequestBody(body, schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('email is required'));
    });

    test('validates types', () => {
      const body = { email: 'invalid' };
      const schema = {
        email: { required: true, type: 'email' }
      };

      const result = validateRequestBody(body, schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('valid email')));
    });

    test('validates min/max length', () => {
      const body = { name: 'ab' };
      const schema = {
        name: { required: true, minLength: 3 }
      };

      const result = validateRequestBody(body, schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('at least 3')));
    });

    test('sanitizes valid fields', () => {
      const body = { name: '  <b>John</b>  ' };
      const schema = {
        name: { required: true }
      };

      const result = validateRequestBody(body, schema);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.sanitized.name, '&lt;b&gt;John&lt;/b&gt;');
    });
  });
});

describe('Path Sanitization', () => {
  describe('sanitizePath', () => {
    test('allows valid paths within base', () => {
      const base = '/tmp/uploads';
      const result = sanitizePath('file.txt', base);
      assert.ok(result.startsWith(base));
    });

    test('rejects path traversal', () => {
      const base = '/tmp/uploads';
      assert.throws(() => sanitizePath('../etc/passwd', base), /Path traversal detected/);
      assert.throws(() => sanitizePath('/etc/passwd', base), /Path traversal detected/);
    });
  });

  describe('isValidFilename', () => {
    test('accepts valid filenames', () => {
      assert.strictEqual(isValidFilename('file.txt'), true);
      assert.strictEqual(isValidFilename('my-file_123.json'), true);
    });

    test('rejects paths', () => {
      assert.strictEqual(isValidFilename('../file.txt'), false);
      assert.strictEqual(isValidFilename('path/to/file.txt'), false);
      assert.strictEqual(isValidFilename('path\\to\\file.txt'), false);
    });

    test('rejects special names', () => {
      assert.strictEqual(isValidFilename('.'), false);
      assert.strictEqual(isValidFilename('..'), false);
    });

    test('rejects null bytes', () => {
      assert.strictEqual(isValidFilename('file\0.txt'), false);
    });

    test('rejects invalid types', () => {
      assert.strictEqual(isValidFilename(null), false);
      assert.strictEqual(isValidFilename(undefined), false);
      assert.strictEqual(isValidFilename(''), false);
    });
  });
});

describe('Secure Random', () => {
  test('secureRandomInt returns integer in range', () => {
    for (let i = 0; i < 100; i++) {
      const result = secureRandomInt(0, 10);
      assert.ok(result >= 0 && result < 10);
      assert.strictEqual(result, Math.floor(result));
    }
  });

  test('secureRandomString returns hex string of correct length', () => {
    const result = secureRandomString(32);
    assert.strictEqual(result.length, 32);
    assert.ok(/^[a-f0-9]+$/.test(result));
  });

  test('secureRandomString generates unique values', () => {
    const values = new Set();
    for (let i = 0; i < 100; i++) {
      values.add(secureRandomString(32));
    }
    assert.strictEqual(values.size, 100);
  });
});

describe('Timing Safe Comparison', () => {
  test('returns true for equal strings', () => {
    assert.strictEqual(timingSafeEqual('secret', 'secret'), true);
    assert.strictEqual(timingSafeEqual('abc123', 'abc123'), true);
  });

  test('returns false for different strings', () => {
    assert.strictEqual(timingSafeEqual('secret', 'Secret'), false);
    assert.strictEqual(timingSafeEqual('abc', 'abcd'), false);
  });

  test('returns false for non-strings', () => {
    assert.strictEqual(timingSafeEqual(123, 123), false);
    assert.strictEqual(timingSafeEqual(null, null), false);
  });
});

describe('Sensitive Data Redaction', () => {
  test('redacts password fields', () => {
    const obj = { username: 'john', password: 'secret123' };
    const result = redactSensitive(obj);
    assert.strictEqual(result.username, 'john');
    assert.strictEqual(result.password, '[REDACTED]');
  });

  test('redacts nested sensitive fields', () => {
    const obj = { user: { email: 'test@test.com', api_key: 'key123' } };
    const result = redactSensitive(obj);
    assert.strictEqual(result.user.email, 'test@test.com');
    assert.strictEqual(result.user.api_key, '[REDACTED]');
  });

  test('handles arrays at root level', () => {
    const arr = [{ name: 'test' }, { api_key: 'secret' }];
    const result = redactSensitive(arr);
    assert.strictEqual(result[0].name, 'test');
    assert.strictEqual(result[1].api_key, '[REDACTED]');
  });

  test('handles non-objects', () => {
    assert.strictEqual(redactSensitive('string'), 'string');
    assert.strictEqual(redactSensitive(null), null);
    assert.strictEqual(redactSensitive(123), 123);
  });
});

describe('URL Validation', () => {
  test('allows valid URLs', () => {
    assert.strictEqual(validateUrl('https://example.com'), true);
    assert.strictEqual(validateUrl('http://api.vocalia.ma/v1'), true);
  });

  test('blocks internal IPs', () => {
    assert.strictEqual(validateUrl('http://localhost/admin'), false);
    assert.strictEqual(validateUrl('http://127.0.0.1/'), false);
    assert.strictEqual(validateUrl('http://192.168.1.1/'), false);
    assert.strictEqual(validateUrl('http://10.0.0.1/'), false);
  });

  test('blocks non-http protocols', () => {
    assert.strictEqual(validateUrl('ftp://server.com'), false);
    assert.strictEqual(validateUrl('file:///etc/passwd'), false);
  });

  test('validates against allowed hosts', () => {
    assert.strictEqual(validateUrl('https://api.vocalia.ma', ['vocalia.ma']), true);
    assert.strictEqual(validateUrl('https://evil.com', ['vocalia.ma']), false);
  });
});

describe('CSRF Protection', () => {
  test('generateCsrfToken returns hex string', () => {
    const token = generateCsrfToken();
    assert.strictEqual(token.length, 64); // 32 bytes = 64 hex chars
    assert.ok(/^[a-f0-9]+$/.test(token));
  });

  test('generateCsrfToken generates unique tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    assert.notStrictEqual(t1, t2);
  });

  test('validateCsrfToken validates correctly', () => {
    const token = generateCsrfToken();
    assert.strictEqual(validateCsrfToken(token, token), true);
    assert.strictEqual(validateCsrfToken(token, 'wrong'), false);
    assert.strictEqual(validateCsrfToken(null, token), false);
    assert.strictEqual(validateCsrfToken(token, null), false);
  });
});

describe('XSS Utilities', () => {
  describe('encodeHTML', () => {
    test('encodes HTML entities', () => {
      assert.strictEqual(encodeHTML('<script>'), '&lt;script&gt;');
      assert.strictEqual(encodeHTML('"test"'), '&quot;test&quot;');
      assert.strictEqual(encodeHTML("it's"), "it&#x27;s");
      assert.strictEqual(encodeHTML('a & b'), 'a &amp; b');
    });

    test('handles null/undefined', () => {
      assert.strictEqual(encodeHTML(null), '');
      assert.strictEqual(encodeHTML(undefined), '');
    });
  });

  describe('stripHTML', () => {
    test('removes all HTML tags', () => {
      assert.strictEqual(stripHTML('<p>Hello</p>'), 'Hello');
      assert.strictEqual(stripHTML('<script>alert("xss")</script>'), 'alert("xss")');
      assert.strictEqual(stripHTML('<a href="url">Link</a>'), 'Link');
    });

    test('handles null/undefined', () => {
      assert.strictEqual(stripHTML(null), '');
      assert.strictEqual(stripHTML(undefined), '');
    });
  });

  describe('sanitizeURL', () => {
    test('allows safe URLs', () => {
      assert.strictEqual(sanitizeURL('https://example.com'), 'https://example.com');
      assert.strictEqual(sanitizeURL('/relative/path'), '/relative/path');
      assert.strictEqual(sanitizeURL('#anchor'), '#anchor');
      assert.strictEqual(sanitizeURL('mailto:test@test.com'), 'mailto:test@test.com');
    });

    test('blocks dangerous schemes', () => {
      assert.strictEqual(sanitizeURL('javascript:alert("xss")'), null);
      assert.strictEqual(sanitizeURL('data:text/html,<script>'), null);
      assert.strictEqual(sanitizeURL('vbscript:msgbox("xss")'), null);
    });

    test('handles invalid input', () => {
      assert.strictEqual(sanitizeURL(null), null);
      assert.strictEqual(sanitizeURL(''), null);
    });
  });
});

console.log('\n🔒 Security Utils Tests Complete\n');
