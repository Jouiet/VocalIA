'use strict';

/**
 * VocalIA ErrorScience Tests
 *
 * Tests:
 * - CONFIDENCE_CONFIG defaults
 * - Constructor with custom logDir
 * - _mapComponentToSector mapping
 * - _calculateTrends (STABLE, EMERGING, INCREASING, DECREASING)
 * - analyzeFailures with synthetic JSONL data
 * - getLearnedInstructions (sector/confidence filtering)
 * - getRulesStatus
 * - recordError
 * - health check
 *
 * NOTE: Uses /tmp temp directories for all file I/O. No production data touched.
 *
 * Run: node --test test/error-science.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create isolated instances with temp dirs
const { ErrorScience } = require('../core/ErrorScience.cjs');

let testDir;
let es;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-error-science-'));
  es = new ErrorScience({ logDir: testDir });
  es.errorBuffer = [];
});

afterEach(() => {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// ─── Constructor ───────────────────────────────────────────────────

describe('ErrorScience constructor', () => {
  test('uses custom logDir', () => {
    assert.ok(es.logFile.startsWith(testDir));
    assert.ok(es.learnedRulesFile.startsWith(testDir));
    assert.ok(es.metricsFile.startsWith(testDir));
  });

  test('logFile is marketing_events.jsonl', () => {
    assert.ok(es.logFile.endsWith('marketing_events.jsonl'));
  });

  test('learnedRulesFile is learned_rules.json', () => {
    assert.ok(es.learnedRulesFile.endsWith('learned_rules.json'));
  });
});

// ─── _mapComponentToSector ─────────────────────────────────────────

describe('ErrorScience _mapComponentToSector', () => {
  test('maps VoiceAPI to voice', () => {
    assert.strictEqual(es._mapComponentToSector('VoiceAPI'), 'voice');
  });

  test('maps GrokRealtime to voice', () => {
    assert.strictEqual(es._mapComponentToSector('GrokRealtime'), 'voice');
  });

  test('maps SEOSensor to seo', () => {
    assert.strictEqual(es._mapComponentToSector('SEOSensor'), 'seo');
  });

  test('maps ShopifySensor to operations', () => {
    assert.strictEqual(es._mapComponentToSector('ShopifySensor'), 'operations');
  });

  test('maps MetaAds to ads', () => {
    assert.strictEqual(es._mapComponentToSector('MetaAds'), 'ads');
  });

  test('maps unknown component to operations', () => {
    assert.strictEqual(es._mapComponentToSector('UnknownThing'), 'operations');
  });
});

// ─── _calculateTrends ──────────────────────────────────────────────

describe('ErrorScience _calculateTrends', () => {
  test('STABLE when both empty', () => {
    const recent = { voice: [], seo: [], ops: [], ads: [] };
    const baseline = { voice: [], seo: [], ops: [], ads: [] };
    const trends = es._calculateTrends(recent, baseline);
    assert.strictEqual(trends.voice, 'STABLE');
    assert.strictEqual(trends.seo, 'STABLE');
  });

  test('EMERGING when baseline empty but recent has data', () => {
    const recent = { voice: [{ event: 'test' }], seo: [], ops: [], ads: [] };
    const baseline = { voice: [], seo: [], ops: [], ads: [] };
    const trends = es._calculateTrends(recent, baseline);
    assert.strictEqual(trends.voice, 'EMERGING');
  });

  test('INCREASING when recent rate much higher than baseline', () => {
    const recent = { voice: Array(50).fill({}), seo: [], ops: [], ads: [] };
    const baseline = { voice: Array(5).fill({}), seo: [], ops: [], ads: [] };
    const trends = es._calculateTrends(recent, baseline);
    assert.strictEqual(trends.voice, 'INCREASING');
  });

  test('DECREASING when recent rate much lower than baseline', () => {
    const recent = { voice: Array(1).fill({}), seo: [], ops: [], ads: [] };
    const baseline = { voice: Array(500).fill({}), seo: [], ops: [], ads: [] };
    const trends = es._calculateTrends(recent, baseline);
    assert.strictEqual(trends.voice, 'DECREASING');
  });
});

// ─── analyzeFailures ───────────────────────────────────────────────

describe('ErrorScience analyzeFailures', () => {
  test('returns error when no logs exist', async () => {
    const result = await es.analyzeFailures();
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('No logs'));
  });

  test('parses JSONL and categorizes failures', async () => {
    // Write synthetic events
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push(JSON.stringify({
        timestamp: new Date().toISOString(),
        sector: 'voice',
        event: 'call_abandoned',
        language: 'fr'
      }));
    }
    fs.writeFileSync(es.logFile, events.join('\n') + '\n');

    const result = await es.analyzeFailures();
    assert.ok(result.failures);
    assert.ok(result.failures.voice.length >= 10);
    assert.ok(result.trends);
    assert.ok(result.timestamp);
  });

  test('creates metrics file after analysis', async () => {
    const events = [];
    for (let i = 0; i < 6; i++) {
      events.push(JSON.stringify({
        timestamp: new Date().toISOString(),
        sector: 'seo',
        pressure: 85
      }));
    }
    fs.writeFileSync(es.logFile, events.join('\n') + '\n');

    await es.analyzeFailures();
    assert.ok(fs.existsSync(es.metricsFile));

    const metrics = JSON.parse(fs.readFileSync(es.metricsFile, 'utf8'));
    assert.ok(metrics.timestamp);
    assert.ok(metrics.failure_counts);
  });
});

// ─── getLearnedInstructions ────────────────────────────────────────

describe('ErrorScience getLearnedInstructions', () => {
  test('returns empty string when no rules file', () => {
    assert.strictEqual(es.getLearnedInstructions('voice'), '');
  });

  test('returns filtered instructions by sector', () => {
    const rules = [
      {
        id: 'rule_voice_1',
        instruction: 'Fix voice issues',
        confidence: 0.8,
        sector: 'voice',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: 'rule_seo_1',
        instruction: 'Fix SEO issues',
        confidence: 0.9,
        sector: 'seo',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }
    ];
    fs.writeFileSync(es.learnedRulesFile, JSON.stringify(rules));

    const voiceInstructions = es.getLearnedInstructions('voice');
    assert.ok(voiceInstructions.includes('Fix voice issues'));
    assert.ok(!voiceInstructions.includes('Fix SEO issues'));
  });

  test('filters by minimum confidence', () => {
    const rules = [
      {
        id: 'rule_low',
        instruction: 'Low confidence rule',
        confidence: 0.3,
        sector: 'voice',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: 'rule_high',
        instruction: 'High confidence rule',
        confidence: 0.9,
        sector: 'voice',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }
    ];
    fs.writeFileSync(es.learnedRulesFile, JSON.stringify(rules));

    const instructions = es.getLearnedInstructions('voice', 0.5);
    assert.ok(!instructions.includes('Low confidence'));
    assert.ok(instructions.includes('High confidence'));
  });

  test('filters expired rules', () => {
    const rules = [
      {
        id: 'rule_expired',
        instruction: 'Old expired rule',
        confidence: 0.9,
        sector: 'voice',
        expires_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
      }
    ];
    fs.writeFileSync(es.learnedRulesFile, JSON.stringify(rules));

    assert.strictEqual(es.getLearnedInstructions('voice'), '');
  });
});

// ─── getRulesStatus ────────────────────────────────────────────────

describe('ErrorScience getRulesStatus', () => {
  test('returns empty when no rules file', () => {
    const status = es.getRulesStatus();
    assert.strictEqual(status.count, 0);
    assert.deepStrictEqual(status.rules, []);
  });

  test('returns status with active rules', () => {
    const rules = [
      {
        id: 'rule_1',
        sector: 'voice',
        confidence: 0.8,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: 'rule_2',
        sector: 'seo',
        confidence: 0.6,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }
    ];
    fs.writeFileSync(es.learnedRulesFile, JSON.stringify(rules));

    const status = es.getRulesStatus();
    assert.strictEqual(status.count, 2);
    assert.strictEqual(status.by_sector.voice, 1);
    assert.strictEqual(status.by_sector.seo, 1);
    assert.ok(status.avg_confidence > 0);
  });

  test('excludes expired rules from count', () => {
    const rules = [
      {
        id: 'active',
        sector: 'voice',
        confidence: 0.9,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: 'expired',
        sector: 'voice',
        confidence: 0.9,
        expires_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    fs.writeFileSync(es.learnedRulesFile, JSON.stringify(rules));

    const status = es.getRulesStatus();
    assert.strictEqual(status.count, 1);
  });
});

// ─── recordError ───────────────────────────────────────────────────

describe('ErrorScience recordError', () => {
  test('records error to JSONL file', () => {
    const result = es.recordError({
      component: 'VoiceAPI',
      error: 'Connection timeout',
      severity: 'high',
      tenantId: 'test_tenant'
    });

    assert.strictEqual(result.recorded, true);
    assert.ok(result.eventId);

    const content = fs.readFileSync(es.logFile, 'utf8').trim();
    const event = JSON.parse(content);
    assert.strictEqual(event.event, 'system_error');
    assert.strictEqual(event.sector, 'voice');
    assert.strictEqual(event.component, 'VoiceAPI');
    assert.strictEqual(event.severity, 'high');
    assert.strictEqual(event.pressure, 85);
  });

  test('maps critical severity to pressure 100', () => {
    es.recordError({
      component: 'MetaAds',
      error: 'API down',
      severity: 'critical'
    });

    const content = fs.readFileSync(es.logFile, 'utf8').trim();
    const event = JSON.parse(content);
    assert.strictEqual(event.pressure, 100);
    assert.strictEqual(event.sector, 'ads');
  });

  test('adds to errorBuffer', () => {
    assert.strictEqual(es.errorBuffer.length, 0);
    es.recordError({ component: 'Test', error: 'err1', severity: 'low' });
    assert.strictEqual(es.errorBuffer.length, 1);
  });

  test('handles Error objects', () => {
    es.recordError({
      component: 'Test',
      error: new Error('real error'),
      severity: 'medium'
    });

    const content = fs.readFileSync(es.logFile, 'utf8').trim();
    const event = JSON.parse(content);
    assert.strictEqual(event.error, 'real error');
  });
});

// ─── health ────────────────────────────────────────────────────────

describe('ErrorScience health', () => {
  test('returns health status', () => {
    const h = es.health();
    assert.strictEqual(h.status, 'ok');
    assert.strictEqual(h.service, 'ErrorScience');
    assert.strictEqual(h.version, '3.0.0');
    assert.ok(h.rules);
    assert.ok(h.buffer !== undefined);
    assert.ok(h.timestamp);
  });

  test('reflects errorBuffer size', () => {
    es.errorBuffer = [1, 2, 3];
    const h = es.health();
    assert.strictEqual(h.buffer.size, 3);
  });
});
