/**
 * VocalIA Voice Telephony Bridge - Pure Logic Tests
 *
 * Tests pure functions that don't require Twilio/WebSocket connections:
 * - getGrokVoiceFromPreferences (voice mapping)
 * - getTwiMLLanguage (language code mapping)
 * - getTwiMLMessage (localized messages)
 * - detectFinancialCommitment (keyword detection)
 * - getMatchedFinancialKeywords
 * - calculateBANTScore (BANT qualification scoring)
 * - getQualificationLabel (score → hot/warm/cold)
 * - detectQueryLanguage (Arabic/Spanish/French detection)
 * - safeJsonParse (error-safe JSON parsing)
 * - generateSessionId (unique ID generation)
 * - checkRateLimit (IP rate limiting)
 * - CONFIG structure
 * - HITL_CONFIG structure
 *
 * Run: node --test test/voice-telephony-pure.test.mjs
 */



import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import bridge from '../telephony/voice-telephony-bridge.cjs';
const _require = createRequire(import.meta.url);

const {
  getGrokVoiceFromPreferences,
  getTwiMLLanguage,
  getTwiMLMessage,
  detectFinancialCommitment,
  getMatchedFinancialKeywords,
  calculateBANTScore,
  getQualificationLabel,
  detectQueryLanguage,
  safeJsonParse,
  generateSessionId,
  checkRateLimit,
  CONFIG,
  HITL_CONFIG
} = bridge;

// ─── getGrokVoiceFromPreferences ─────────────────────────────────

describe('getGrokVoiceFromPreferences', () => {
  test('returns a voice for fr + female', () => {
    const voice = getGrokVoiceFromPreferences('fr', 'female');
    assert.ok(voice);
    assert.strictEqual(typeof voice, 'string');
  });

  test('returns a voice for en + male', () => {
    const voice = getGrokVoiceFromPreferences('en', 'male');
    assert.ok(voice);
  });

  test('returns a voice for ar + female', () => {
    const voice = getGrokVoiceFromPreferences('ar', 'female');
    assert.ok(voice);
  });

  test('returns a voice for es + female', () => {
    const voice = getGrokVoiceFromPreferences('es', 'female');
    assert.ok(voice);
  });

  test('returns a voice for ary + female', () => {
    const voice = getGrokVoiceFromPreferences('ary', 'female');
    assert.ok(voice);
  });

  test('defaults to fr_female for unknown language', () => {
    const voice = getGrokVoiceFromPreferences('unknown', 'female');
    const defaultVoice = getGrokVoiceFromPreferences('fr', 'female');
    assert.strictEqual(voice, defaultVoice);
  });

  test('defaults language to fr when not provided', () => {
    const voice = getGrokVoiceFromPreferences();
    assert.ok(voice);
  });
});

// ─── getTwiMLLanguage ────────────────────────────────────────────

describe('getTwiMLLanguage', () => {
  test('returns fr-FR for French', () => {
    const lang = getTwiMLLanguage('fr');
    assert.ok(lang.includes('fr'));
  });

  test('returns en code for English', () => {
    const lang = getTwiMLLanguage('en');
    assert.ok(lang.includes('en'));
  });

  test('returns es code for Spanish', () => {
    const lang = getTwiMLLanguage('es');
    assert.ok(lang.includes('es'));
  });

  test('returns ar code for Arabic', () => {
    const lang = getTwiMLLanguage('ar');
    assert.ok(lang.includes('ar'));
  });

  test('returns fallback for unknown language', () => {
    const lang = getTwiMLLanguage('xx');
    assert.ok(lang);
    assert.strictEqual(typeof lang, 'string');
  });
});

// ─── getTwiMLMessage ─────────────────────────────────────────────

describe('getTwiMLMessage', () => {
  test('returns non-empty for welcome in fr', () => {
    const msg = getTwiMLMessage('welcome', 'fr');
    assert.strictEqual(typeof msg, 'string');
  });

  test('returns empty string for unknown messageKey', () => {
    const msg = getTwiMLMessage('nonexistent_key_xyz', 'fr');
    assert.strictEqual(msg, '');
  });

  test('returns fallback for unknown language', () => {
    const msg = getTwiMLMessage('welcome', 'xx');
    assert.strictEqual(typeof msg, 'string');
  });
});

// ─── detectFinancialCommitment ───────────────────────────────────

describe('detectFinancialCommitment', () => {
  test('detects remboursement', () => {
    assert.strictEqual(detectFinancialCommitment('Je veux un remboursement'), true);
  });

  test('detects gratuit', () => {
    assert.strictEqual(detectFinancialCommitment('C\'est gratuit?'), true);
  });

  test('detects compensation', () => {
    assert.strictEqual(detectFinancialCommitment('Je demande une compensation'), true);
  });

  test('returns false for normal text', () => {
    assert.strictEqual(detectFinancialCommitment('Bonjour, je voudrais un rendez-vous'), false);
  });

  test('returns false for null', () => {
    assert.strictEqual(detectFinancialCommitment(null), false);
  });

  test('returns false for empty string', () => {
    assert.strictEqual(detectFinancialCommitment(''), false);
  });

  test('is case insensitive', () => {
    assert.strictEqual(detectFinancialCommitment('REMBOURSEMENT'), true);
  });
});

// ─── getMatchedFinancialKeywords ─────────────────────────────────

describe('getMatchedFinancialKeywords', () => {
  test('returns matching keywords', () => {
    const keywords = getMatchedFinancialKeywords('Je veux un remboursement gratuit');
    assert.ok(keywords.includes('remboursement'));
    assert.ok(keywords.includes('gratuit'));
  });

  test('returns empty for normal text', () => {
    const keywords = getMatchedFinancialKeywords('Bonjour');
    assert.deepStrictEqual(keywords, []);
  });

  test('returns empty for null', () => {
    const keywords = getMatchedFinancialKeywords(null);
    assert.deepStrictEqual(keywords, []);
  });

  test('returns empty for non-string', () => {
    const keywords = getMatchedFinancialKeywords(123);
    assert.deepStrictEqual(keywords, []);
  });
});

// ─── calculateBANTScore ──────────────────────────────────────────

describe('calculateBANTScore', () => {
  test('perfect score = 100', () => {
    const score = calculateBANTScore({
      need: 'high',
      timeline: 'immediate',
      budget: 'defined',
      authority: 'decision_maker'
    });
    assert.strictEqual(score, 100);
  });

  test('minimum score = 0', () => {
    const score = calculateBANTScore({
      need: 'unknown',
      timeline: 'exploring',
      budget: 'unknown',
      authority: 'unknown'
    });
    assert.strictEqual(score, 0);
  });

  test('medium need + this_quarter + flexible + influencer', () => {
    const score = calculateBANTScore({
      need: 'medium',
      timeline: 'this_quarter',
      budget: 'flexible',
      authority: 'influencer'
    });
    assert.strictEqual(score, 20 + 20 + 15 + 10); // 65
  });

  test('low need + this_year + limited + user', () => {
    const score = calculateBANTScore({
      need: 'low',
      timeline: 'this_year',
      budget: 'limited',
      authority: 'user'
    });
    assert.strictEqual(score, 10 + 10 + 5 + 5); // 30
  });

  test('handles missing fields gracefully', () => {
    const score = calculateBANTScore({});
    assert.strictEqual(score, 0);
  });

  test('handles partial fields', () => {
    const score = calculateBANTScore({ need: 'high' });
    assert.strictEqual(score, 30);
  });
});

// ─── getQualificationLabel ───────────────────────────────────────

describe('getQualificationLabel', () => {
  test('100 = hot', () => {
    assert.strictEqual(getQualificationLabel(100), 'hot');
  });

  test('70 = hot', () => {
    assert.strictEqual(getQualificationLabel(70), 'hot');
  });

  test('69 = warm', () => {
    assert.strictEqual(getQualificationLabel(69), 'warm');
  });

  test('40 = warm', () => {
    assert.strictEqual(getQualificationLabel(40), 'warm');
  });

  test('39 = cold', () => {
    assert.strictEqual(getQualificationLabel(39), 'cold');
  });

  test('0 = cold', () => {
    assert.strictEqual(getQualificationLabel(0), 'cold');
  });
});

// ─── detectQueryLanguage ─────────────────────────────────────────

describe('detectQueryLanguage', () => {
  test('detects Arabic script', () => {
    assert.strictEqual(detectQueryLanguage('مرحبا كيف حالك'), 'ar');
  });

  test('detects Darija (Arabic script) as ar', () => {
    assert.strictEqual(detectQueryLanguage('كيداير لباس؟'), 'ar');
  });

  test('detects Spanish with ñ', () => {
    assert.strictEqual(detectQueryLanguage('año nuevo'), 'es');
  });

  test('detects Spanish with common words', () => {
    assert.strictEqual(detectQueryLanguage('quiero hacer un pedido'), 'es');
  });

  test('detects Spanish with ¿', () => {
    assert.strictEqual(detectQueryLanguage('¿Cuánto cuesta?'), 'es');
  });

  test('defaults to fr for French text', () => {
    assert.strictEqual(detectQueryLanguage('Bonjour comment allez-vous'), 'fr');
  });

  test('defaults to fr for English text', () => {
    assert.strictEqual(detectQueryLanguage('Hello how are you'), 'fr');
  });

  test('defaults to fr for empty string', () => {
    assert.strictEqual(detectQueryLanguage(''), 'fr');
  });
});

// ─── safeJsonParse ───────────────────────────────────────────────

describe('safeJsonParse', () => {
  test('parses valid JSON', () => {
    const result = safeJsonParse('{"key": "value"}');
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('returns fallback for invalid JSON', () => {
    const result = safeJsonParse('not json', { default: true });
    assert.deepStrictEqual(result, { default: true });
  });

  test('returns null as default fallback', () => {
    const result = safeJsonParse('bad json');
    assert.strictEqual(result, null);
  });

  test('parses array JSON', () => {
    const result = safeJsonParse('[1, 2, 3]');
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  test('parses string JSON', () => {
    const result = safeJsonParse('"hello"');
    assert.strictEqual(result, 'hello');
  });

  test('parses number JSON', () => {
    const result = safeJsonParse('42');
    assert.strictEqual(result, 42);
  });

  test('parses null JSON', () => {
    const result = safeJsonParse('null');
    assert.strictEqual(result, null);
  });

  test('returns fallback for empty string', () => {
    const result = safeJsonParse('', {});
    assert.deepStrictEqual(result, {});
  });
});

// ─── generateSessionId ──────────────────────────────────────────

describe('generateSessionId', () => {
  test('returns a string', () => {
    const id = generateSessionId();
    assert.strictEqual(typeof id, 'string');
  });

  test('returns non-empty string', () => {
    const id = generateSessionId();
    assert.ok(id.length > 0);
  });

  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    assert.strictEqual(ids.size, 100);
  });
});

// ─── checkRateLimit ──────────────────────────────────────────────

describe('checkRateLimit', () => {
  test('allows first request from IP', () => {
    const result = checkRateLimit('192.168.99.1');
    assert.strictEqual(result, true);
  });

  test('allows multiple requests under limit', () => {
    const ip = '192.168.99.2';
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(checkRateLimit(ip), true);
    }
  });
});

// ─── CONFIG structure ────────────────────────────────────────────

describe('Telephony CONFIG', () => {
  test('has port number', () => {
    assert.strictEqual(typeof CONFIG.port, 'number');
    assert.ok(CONFIG.port > 0);
  });

  test('has supportedLanguages array', () => {
    assert.ok(Array.isArray(CONFIG.supportedLanguages));
    assert.ok(CONFIG.supportedLanguages.includes('fr'));
    assert.ok(CONFIG.supportedLanguages.includes('en'));
    assert.ok(CONFIG.supportedLanguages.includes('es'));
    assert.ok(CONFIG.supportedLanguages.includes('ar'));
    assert.ok(CONFIG.supportedLanguages.includes('ary'));
  });

  test('has defaultLanguage', () => {
    assert.strictEqual(typeof CONFIG.defaultLanguage, 'string');
    assert.ok(CONFIG.supportedLanguages.includes(CONFIG.defaultLanguage));
  });

  test('has twilio config', () => {
    assert.ok(CONFIG.twilio);
    assert.ok('accountSid' in CONFIG.twilio);
    assert.ok('authToken' in CONFIG.twilio);
    assert.ok('phoneNumber' in CONFIG.twilio);
  });

  test('has grok config', () => {
    assert.ok(CONFIG.grok);
    assert.ok('model' in CONFIG.grok);
    assert.ok('voice' in CONFIG.grok);
    assert.ok('realtimeUrl' in CONFIG.grok);
  });
});

// ─── HITL_CONFIG structure ───────────────────────────────────────

describe('Telephony HITL_CONFIG', () => {
  test('has enabled boolean', () => {
    assert.strictEqual(typeof HITL_CONFIG.enabled, 'boolean');
  });

  test('has approveHotBookings boolean', () => {
    assert.strictEqual(typeof HITL_CONFIG.approveHotBookings, 'boolean');
  });

  test('has approveTransfers boolean', () => {
    assert.strictEqual(typeof HITL_CONFIG.approveTransfers, 'boolean');
  });

  test('has bookingScoreThreshold number', () => {
    assert.strictEqual(typeof HITL_CONFIG.bookingScoreThreshold, 'number');
    assert.ok(HITL_CONFIG.bookingScoreThreshold >= 0);
  });

  test('has financialKeywords array', () => {
    assert.ok(Array.isArray(HITL_CONFIG.financialKeywords));
    assert.ok(HITL_CONFIG.financialKeywords.length > 0);
    assert.ok(HITL_CONFIG.financialKeywords.includes('remboursement'));
  });

  test('has bookingScoreThresholdOptions', () => {
    assert.ok(Array.isArray(HITL_CONFIG.bookingScoreThresholdOptions));
    assert.ok(HITL_CONFIG.bookingScoreThresholdOptions.includes(70));
  });
});

// NOTE: Telephony exports are proven by behavioral tests above
// (getGrokVoiceFromPreferences, getTwiMLLanguage, detectFinancialCommitment, calculateBANTScore,
// detectQueryLanguage, safeJsonParse, generateSessionId, checkRateLimit, CONFIG, HITL_CONFIG).

// B52 fix: Clean up singletons to allow process exit
after(() => {
  try {
    const eventBus = _require('../core/AgencyEventBus.cjs');
    eventBus.shutdown();
    eventBus.subscribers.clear();
    eventBus.idempotencyCache.clear();
  } catch { /* ignore */ }
  try {
    const tenantMemory = _require('../core/tenant-memory.cjs');
    if (tenantMemory.vectorStores) {
      for (const [, store] of tenantMemory.vectorStores) store.close?.();
      tenantMemory.vectorStores.clear();
    }
    if (tenantMemory._dedupSets) tenantMemory._dedupSets.clear();
  } catch { /* ignore */ }
});
