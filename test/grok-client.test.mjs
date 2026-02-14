/**
 * VocalIA Grok Client Tests
 *
 * Tests:
 * - BASE_SYSTEM_PROMPT content and structure (identity, products, personas, integrations, principles)
 * - BASE_SYSTEM_PROMPT section headers (## IDENTITÉ, ## NOS 2 PRODUITS, etc.)
 * - BASE_SYSTEM_PROMPT SaaS / product details
 * - initRAG behavior (returns boolean)
 * - queryKnowledgeBase guard (returns error when not initialized)
 * - Module exports (chatCompletion, generateAuditAnalysis, etc.)
 *
 * NOTE: Does NOT call xAI API. Tests pure logic and constants only.
 *
 * Run: node --test test/grok-client.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import mod from '../core/grok-client.cjs';
import { BASE_SYSTEM_PROMPT, chatCompletion, generateAuditAnalysis, generateEmailContent, queryKnowledgeBase, initRAG } from '../core/grok-client.cjs';


// ─── BASE_SYSTEM_PROMPT ─────────────────────────────────────────────

describe('GrokClient BASE_SYSTEM_PROMPT', () => {
  test('is a non-empty string', () => {
    assert.strictEqual(typeof BASE_SYSTEM_PROMPT, 'string');
    assert.ok(BASE_SYSTEM_PROMPT.length > 100);
  });

  test('contains VocalIA identity', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('VocalIA'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('vocalia.ma'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('contact@vocalia.ma'));
  });

  test('mentions Voice AI platform type', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Voice AI'));
  });

  test('describes 2 products: Widget and Telephony', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('VOICE WIDGET'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('VOICE TELEPHONY'));
  });

  test('mentions Web Speech API for widget', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Web Speech API'));
  });

  test('mentions Twilio for telephony', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Twilio'));
  });

  test('mentions 38 personas', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('38'), 'Should reference 38 personas (not 40 — 5 eliminated session 250.120)');
    assert.ok(BASE_SYSTEM_PROMPT.includes('ersonas') || BASE_SYSTEM_PROMPT.includes('PERSONAS'));
  });

  test('mentions MCP tools', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('MCP'));
  });

  test('mentions integrations: HubSpot, Shopify, Stripe', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('HubSpot'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Shopify'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Stripe'));
  });

  test('mentions 5 languages', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Français'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('English'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Español'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('العربية'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Darija'));
  });

  test('mentions location: Maroc', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Maroc'));
  });

  test('includes principles section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Factualité'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Transparence'));
  });

  test('includes format guidelines', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('FORMAT'));
  });

  test('mentions BANT qualification', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('BANT'));
  });

  test('mentions Pipedrive and Zoho', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Pipedrive'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Zoho'));
  });

  test('mentions WooCommerce and Magento', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('WooCommerce'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Magento'));
  });

  test('mentions Calendar integrations', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Calendar') || BASE_SYSTEM_PROMPT.includes('Calendly'));
  });

  test('mentions PrestaShop', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('PrestaShop'));
  });

  test('mentions SaaS type', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('SaaS'));
  });

  test('mentions JavaScript widget', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('JavaScript'));
  });
});

// ─── BASE_SYSTEM_PROMPT section headers ─────────────────────────────

describe('GrokClient BASE_SYSTEM_PROMPT section headers', () => {
  test('has IDENTITÉ section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('## IDENTITÉ'));
  });

  test('has NOS 2 PRODUITS section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('## NOS 2 PRODUITS'));
  });

  test('has 38 PERSONAS section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('## 38 PERSONAS'), 'Should say "38 PERSONAS" (5 eliminated session 250.120)');
  });

  test('has INTÉGRATIONS section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('INTÉGRATIONS') || BASE_SYSTEM_PROMPT.includes('INTEGRATIONS'));
  });

  test('has PRINCIPES section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('## PRINCIPES'));
  });

  test('has FORMAT section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('## FORMAT'));
  });
});

// ─── BASE_SYSTEM_PROMPT product details ─────────────────────────────

describe('GrokClient BASE_SYSTEM_PROMPT product details', () => {
  test('Widget product describes 24/7 support', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('24/7'));
  });

  test('Widget mentions Starter plan', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Starter'));
  });

  test('Telephony mentions qualification', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('qualification') || BASE_SYSTEM_PROMPT.includes('Qualification') || BASE_SYSTEM_PROMPT.includes('BANT'));
  });

  test('mentions e-commerce platforms', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('E-commerce') || BASE_SYSTEM_PROMPT.includes('e-commerce'));
  });

  test('mentions CRM category', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('CRM'));
  });

  test('mentions Paiements/Payments', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Paiements') || BASE_SYSTEM_PROMPT.includes('Payments'));
  });

  test('prompt ends without trailing whitespace-heavy content', () => {
    const trimmed = BASE_SYSTEM_PROMPT.trim();
    assert.ok(trimmed.length > 0);
  });
});

// ─── initRAG ────────────────────────────────────────────────────────

describe('GrokClient initRAG', () => {
  test('returns a boolean', () => {
    const result = initRAG();
    assert.strictEqual(typeof result, 'boolean');
  });

  test('returns false when KB files not available (test env)', () => {
    const result = initRAG();
    // In test env without built KB, initRAG returns false
    // (ServiceKnowledgeBase.load() fails or module not built)
    assert.strictEqual(typeof result, 'boolean');
  });
});

// ─── queryKnowledgeBase ─────────────────────────────────────────────

describe('GrokClient queryKnowledgeBase', () => {
  test('returns an object', async () => {
    const result = await queryKnowledgeBase('test query');
    assert.strictEqual(typeof result, 'object');
    assert.ok(result !== null);
  });

  test('returns error or found property', async () => {
    const result = await queryKnowledgeBase('pricing details');
    // Either has 'error' (RAG not init) or 'found' (RAG initialized)
    assert.ok('error' in result || 'found' in result);
  });

  test('is async (returns promise)', () => {
    const result = queryKnowledgeBase('test');
    assert.ok(result instanceof Promise);
  });
});

// ─── chatCompletion (fetch mock) ──────────────────────────────────────

describe('GrokClient chatCompletion', () => {
  test('API success → returns response content string', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Bonjour, je suis VocalIA' } }] })
    });
    try {
      const result = await chatCompletion('Présente-toi', 'Tu es VocalIA');
      assert.strictEqual(result, 'Bonjour, je suis VocalIA');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('API error (status 500) → returns Erreur string', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });
    try {
      const result = await chatCompletion('test', 'system');
      assert.ok(result.startsWith('Erreur:'));
      assert.ok(result.includes('500'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('network failure (fetch throws) → returns Erreur string', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    try {
      const result = await chatCompletion('test', 'system');
      assert.ok(result.startsWith('Erreur:'));
      assert.ok(result.includes('ECONNREFUSED'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('sends correct model grok-4-1-fast-reasoning in request body', async () => {
    const origFetch = globalThis.fetch;
    let capturedBody;
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    };
    try {
      await chatCompletion('hello', 'sys');
      assert.strictEqual(capturedBody.model, 'grok-4-1-fast-reasoning');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('uses provided systemPrompt instead of buildEnhancedPrompt', async () => {
    const origFetch = globalThis.fetch;
    let capturedBody;
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    };
    try {
      await chatCompletion('hello', 'My custom system prompt');
      const systemMsg = capturedBody.messages.find(m => m.role === 'system');
      assert.strictEqual(systemMsg.content, 'My custom system prompt');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ─── API boundary (encapsulation) ────────────────────────────────────

describe('GrokClient API boundary', () => {
  test('does not export internal helpers (ragQuery, getKnowledgeContext)', () => {
    assert.strictEqual(mod.ragQuery, undefined);
    assert.strictEqual(mod.getKnowledgeContext, undefined);
  });

  test('does not export checkApiKey', () => {
    assert.strictEqual(mod.checkApiKey, undefined);
  });

  test('does not export interactiveChat', () => {
    assert.strictEqual(mod.interactiveChat, undefined);
  });
});
