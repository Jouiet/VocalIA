/**
 * Slack Notifier — Behavioral Tests
 *
 * Tests REAL function calls with mocked fetch to verify:
 * 1. sendMessage — correct API call, auth header, body, fire-and-forget on error
 * 2. sendToTenant — per-tenant bot token, correct API call
 * 3. notifySignup — formatted message, skips if no channel
 * 4. notifyError — critical vs high emoji, formatted message
 * 5. notifyPayment — formatted message with/without amount
 * 6. Guard clauses — no token/channel = no fetch call
 *
 * Run: node --test test/slack-notifier.test.mjs
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Track fetch calls
let fetchCalls = [];
let originalFetch;

function mockFetch(handler) {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    if (handler) return handler(...args);
    return { ok: true, json: async () => ({ ok: true }) };
  };
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  fetchCalls = [];
}

// Fresh import each time to avoid module cache issues with env
let slackNotifier;
async function loadModule() {
  // Bust cache
  const cacheBuster = Date.now() + Math.random();
  slackNotifier = (await import(`file://${import.meta.dirname}/../core/slack-notifier.cjs?t=${cacheBuster}`)).default || await import(`file://${import.meta.dirname}/../core/slack-notifier.cjs?t=${cacheBuster}`);
  // Fallback: require
  if (!slackNotifier || !slackNotifier.sendMessage) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve('../core/slack-notifier.cjs')];
    slackNotifier = require('../core/slack-notifier.cjs');
  }
}

// ─── sendMessage ───────────────────────────────────────────────────

describe('sendMessage', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('calls Slack API with correct params when token and channel set', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

    mockFetch();

    try {
      await slackNotifier.sendMessage('Hello Slack', 'C12345');

      assert.strictEqual(fetchCalls.length, 1);
      const [url, opts] = fetchCalls[0];
      assert.strictEqual(url, 'https://slack.com/api/chat.postMessage');
      assert.strictEqual(opts.method, 'POST');
      assert.strictEqual(opts.headers['Authorization'], 'Bearer xoxb-test-token');
      assert.strictEqual(opts.headers['Content-Type'], 'application/json');

      const body = JSON.parse(opts.body);
      assert.strictEqual(body.channel, 'C12345');
      assert.strictEqual(body.text, 'Hello Slack');
      assert.strictEqual(body.blocks, undefined);
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
    }
  });

  test('includes blocks when provided', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = 'xoxb-blocks-test';

    mockFetch();

    const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*Bold*' } }];

    try {
      await slackNotifier.sendMessage('fallback', 'C99', blocks);

      assert.strictEqual(fetchCalls.length, 1);
      const body = JSON.parse(fetchCalls[0][1].body);
      assert.deepStrictEqual(body.blocks, blocks);
      assert.strictEqual(body.text, 'fallback');
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
    }
  });

  test('does NOT call fetch when SLACK_BOT_TOKEN is missing', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;

    mockFetch();

    try {
      await slackNotifier.sendMessage('test', 'C12345');
      assert.strictEqual(fetchCalls.length, 0);
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
    }
  });

  test('does NOT call fetch when channel is empty', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';

    mockFetch();

    try {
      await slackNotifier.sendMessage('test', '');
      assert.strictEqual(fetchCalls.length, 0);

      await slackNotifier.sendMessage('test', null);
      assert.strictEqual(fetchCalls.length, 0);

      await slackNotifier.sendMessage('test', undefined);
      assert.strictEqual(fetchCalls.length, 0);
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
    }
  });

  test('swallows fetch errors (fire-and-forget)', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = 'xoxb-error-test';

    mockFetch(() => { throw new Error('Network failure'); });

    try {
      // Should NOT throw
      await slackNotifier.sendMessage('test', 'C12345');
      assert.ok(true, 'No error thrown');
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
    }
  });
});

// ─── sendToTenant ──────────────────────────────────────────────────

describe('sendToTenant', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('calls Slack API with tenant bot token', async () => {
    mockFetch();

    await slackNotifier.sendToTenant('xoxb-tenant-abc', 'C_TENANT', 'Bonjour');

    assert.strictEqual(fetchCalls.length, 1);
    const [url, opts] = fetchCalls[0];
    assert.strictEqual(url, 'https://slack.com/api/chat.postMessage');
    assert.strictEqual(opts.headers['Authorization'], 'Bearer xoxb-tenant-abc');

    const body = JSON.parse(opts.body);
    assert.strictEqual(body.channel, 'C_TENANT');
    assert.strictEqual(body.text, 'Bonjour');
  });

  test('includes blocks when provided', async () => {
    mockFetch();

    const blocks = [{ type: 'divider' }];
    await slackNotifier.sendToTenant('xoxb-t', 'C1', 'text', blocks);

    const body = JSON.parse(fetchCalls[0][1].body);
    assert.deepStrictEqual(body.blocks, blocks);
  });

  test('skips when botToken is falsy', async () => {
    mockFetch();

    await slackNotifier.sendToTenant(null, 'C1', 'text');
    await slackNotifier.sendToTenant('', 'C1', 'text');
    await slackNotifier.sendToTenant(undefined, 'C1', 'text');

    assert.strictEqual(fetchCalls.length, 0);
  });

  test('skips when channel is falsy', async () => {
    mockFetch();

    await slackNotifier.sendToTenant('xoxb-token', null, 'text');
    await slackNotifier.sendToTenant('xoxb-token', '', 'text');

    assert.strictEqual(fetchCalls.length, 0);
  });

  test('swallows fetch errors', async () => {
    mockFetch(() => { throw new Error('Timeout'); });

    await slackNotifier.sendToTenant('xoxb-t', 'C1', 'text');
    assert.ok(true, 'No error thrown');
  });
});

// ─── notifySignup ──────────────────────────────────────────────────

describe('notifySignup', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('sends formatted signup message to notification channel', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-signup-test';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ALERTS';

    mockFetch();

    try {
      slackNotifier.notifySignup({ email: 'user@test.com', name: 'Test User', plan: 'pro', tenantId: 'tenant_abc' });
      // notifySignup calls sendMessage which is async — wait a tick
      await new Promise(r => setTimeout(r, 50));

      assert.strictEqual(fetchCalls.length, 1);
      const body = JSON.parse(fetchCalls[0][1].body);
      assert.strictEqual(body.channel, 'C_ALERTS');
      assert.ok(body.text.includes('Nouveau signup'));
      assert.ok(body.text.includes('Test User'));
      assert.ok(body.text.includes('user@test.com'));
      assert.ok(body.text.includes('pro'));
      assert.ok(body.text.includes('tenant_abc'));
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('uses email as fallback when name is missing', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ALERTS';

    mockFetch();

    try {
      slackNotifier.notifySignup({ email: 'noname@test.com', tenantId: 't1' });
      await new Promise(r => setTimeout(r, 50));

      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(body.text.includes('noname@test.com'));
      assert.ok(body.text.includes('starter')); // default plan
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('skips when SLACK_NOTIFICATION_CHANNEL is not set', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    delete process.env.SLACK_NOTIFICATION_CHANNEL;

    mockFetch();

    try {
      slackNotifier.notifySignup({ email: 'a@b.com', tenantId: 't' });
      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(fetchCalls.length, 0);
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
    }
  });
});

// ─── notifyError ───────────────────────────────────────────────────

describe('notifyError', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('sends critical error with rotating_light emoji', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-err';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ERR';

    mockFetch();

    try {
      slackNotifier.notifyError({ component: 'VoiceAPI', error: 'OOM', severity: 'critical', tenantId: 't1' });
      await new Promise(r => setTimeout(r, 50));

      assert.strictEqual(fetchCalls.length, 1);
      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(body.text.includes(':rotating_light:'));
      assert.ok(body.text.includes('CRITICAL'));
      assert.ok(body.text.includes('VoiceAPI'));
      assert.ok(body.text.includes('OOM'));
      assert.ok(body.text.includes('t1'));
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('sends high error with warning emoji', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-err';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ERR';

    mockFetch();

    try {
      slackNotifier.notifyError({ component: 'DB', error: 'timeout', severity: 'high' });
      await new Promise(r => setTimeout(r, 50));

      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(body.text.includes(':warning:'));
      assert.ok(body.text.includes('HIGH'));
      assert.ok(body.text.includes('unknown')); // tenantId fallback
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('skips when no channel', async () => {
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    delete process.env.SLACK_NOTIFICATION_CHANNEL;

    mockFetch();

    try {
      slackNotifier.notifyError({ component: 'X', error: 'Y', severity: 'critical' });
      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(fetchCalls.length, 0);
    } finally {
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
    }
  });
});

// ─── notifyPayment ─────────────────────────────────────────────────

describe('notifyPayment', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('sends payment message with amount', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-pay';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_PAY';

    mockFetch();

    try {
      slackNotifier.notifyPayment({ tenantId: 't_pay', amount: '99EUR', plan: 'pro', action: 'checkout_created' });
      await new Promise(r => setTimeout(r, 50));

      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(body.text.includes('Paiement'));
      assert.ok(body.text.includes('t_pay'));
      assert.ok(body.text.includes('99EUR'));
      assert.ok(body.text.includes('pro'));
      assert.ok(body.text.includes('checkout_created'));
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('sends payment message without amount', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-pay';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_PAY';

    mockFetch();

    try {
      slackNotifier.notifyPayment({ tenantId: 't2' });
      await new Promise(r => setTimeout(r, 50));

      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(body.text.includes('payment')); // default action
      assert.ok(body.text.includes('?')); // default plan
      assert.ok(!body.text.includes('undefined'));
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('skips when no channel', async () => {
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    delete process.env.SLACK_NOTIFICATION_CHANNEL;

    mockFetch();

    try {
      slackNotifier.notifyPayment({ tenantId: 't' });
      await new Promise(r => setTimeout(r, 50));
      assert.strictEqual(fetchCalls.length, 0);
    } finally {
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
    }
  });
});

// ─── B18 regression: escapeSlack prevents mrkdwn injection ─────────────

describe('escapeSlack — B18 mrkdwn injection prevention', () => {
  beforeEach(async () => {
    await loadModule();
    fetchCalls = [];
  });
  afterEach(() => restoreFetch());

  test('escapeSlack escapes <, >, & characters', () => {
    const { escapeSlack } = slackNotifier;
    assert.strictEqual(escapeSlack('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.strictEqual(escapeSlack('<@U123> mention'), '&lt;@U123&gt; mention');
    assert.strictEqual(escapeSlack('AT&T'), 'AT&amp;T');
    assert.strictEqual(escapeSlack('<https://evil.com|Click>'), '&lt;https://evil.com|Click&gt;');
  });

  test('escapeSlack handles null/undefined', () => {
    const { escapeSlack } = slackNotifier;
    assert.strictEqual(escapeSlack(null), '');
    assert.strictEqual(escapeSlack(undefined), '');
    assert.strictEqual(escapeSlack(''), '');
  });

  test('notifySignup escapes malicious name to prevent Slack injection', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ALERTS';

    mockFetch();

    try {
      slackNotifier.notifySignup({
        email: 'test@example.com',
        name: '<@U999> <https://evil.com|PHISH>',
        plan: 'starter',
        tenantId: 't1'
      });
      await new Promise(r => setTimeout(r, 50));

      assert.strictEqual(fetchCalls.length, 1);
      const body = JSON.parse(fetchCalls[0][1].body);
      // The < and > should be escaped — no raw Slack mrkdwn links/mentions
      assert.ok(!body.text.includes('<@U999>'), 'Should not contain raw user mention');
      assert.ok(!body.text.includes('<https://'), 'Should not contain raw link injection');
      assert.ok(body.text.includes('&lt;@U999&gt;'), 'Should contain escaped mention');
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });

  test('notifyError escapes malicious component/error strings', async () => {
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_NOTIFICATION_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_NOTIFICATION_CHANNEL = 'C_ALERTS';

    mockFetch();

    try {
      slackNotifier.notifyError({
        component: '<script>XSS</script>',
        error: 'Error <@U123>',
        severity: 'critical',
        tenantId: 't1'
      });
      await new Promise(r => setTimeout(r, 50));

      assert.strictEqual(fetchCalls.length, 1);
      const body = JSON.parse(fetchCalls[0][1].body);
      assert.ok(!body.text.includes('<script>'), 'Should not contain raw HTML');
      assert.ok(!body.text.includes('<@U123>'), 'Should not contain raw mention');
      assert.ok(body.text.includes('&lt;script&gt;'), 'Should contain escaped HTML');
    } finally {
      if (origToken !== undefined) process.env.SLACK_BOT_TOKEN = origToken;
      else delete process.env.SLACK_BOT_TOKEN;
      if (origChannel !== undefined) process.env.SLACK_NOTIFICATION_CHANNEL = origChannel;
      else delete process.env.SLACK_NOTIFICATION_CHANNEL;
    }
  });
});
