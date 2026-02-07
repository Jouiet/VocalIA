/**
 * VocalIA RevenueScience Tests
 *
 * Tests:
 * - baseCosts structure
 * - models (VOICE_AI, SEO_AUTOMATION, CONTENT_FACTORY)
 * - demandConfig (thresholds, elasticity, urgency)
 * - calculateOptimalPrice (BANT scoring, entity type, bounds)
 * - calculateSectorROI (roi, cac, healthy flag)
 * - isMarginSafe (margin check, cost breakdown)
 * - updateCapacity (clamp 0-1)
 * - getPricingAnalytics (empty + populated)
 * - health (structure)
 *
 * NOTE: Tests pure pricing logic. Does NOT call Stripe or EventBus.
 *
 * Run: node --test test/revenue-science.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import revenueScience from '../core/RevenueScience.cjs';

const { RevenueScience } = revenueScience;

// ─── baseCosts ──────────────────────────────────────────────────────

describe('RevenueScience baseCosts', () => {
  test('has voice_ai_minute cost', () => {
    assert.strictEqual(typeof revenueScience.baseCosts.voice_ai_minute, 'number');
    assert.ok(revenueScience.baseCosts.voice_ai_minute > 0);
  });

  test('has compute_server cost', () => {
    assert.strictEqual(typeof revenueScience.baseCosts.compute_server, 'number');
    assert.ok(revenueScience.baseCosts.compute_server > 0);
  });

  test('has seo_tooling cost', () => {
    assert.strictEqual(typeof revenueScience.baseCosts.seo_tooling, 'number');
  });

  test('has api_overhead cost', () => {
    assert.strictEqual(typeof revenueScience.baseCosts.api_overhead, 'number');
  });

  test('has management_overhead cost', () => {
    assert.strictEqual(typeof revenueScience.baseCosts.management_overhead, 'number');
    assert.ok(revenueScience.baseCosts.management_overhead > 0);
    assert.ok(revenueScience.baseCosts.management_overhead < 1); // percentage
  });
});

// ─── models ─────────────────────────────────────────────────────────

describe('RevenueScience models', () => {
  test('has 3 sector models', () => {
    assert.strictEqual(Object.keys(revenueScience.models).length, 3);
  });

  test('VOICE_AI model has floor < target < max', () => {
    const m = revenueScience.models.VOICE_AI;
    assert.ok(m.floor < m.target);
    assert.ok(m.target < m.max);
  });

  test('SEO_AUTOMATION model has floor < target < max', () => {
    const m = revenueScience.models.SEO_AUTOMATION;
    assert.ok(m.floor < m.target);
    assert.ok(m.target < m.max);
  });

  test('CONTENT_FACTORY model has floor < target < max', () => {
    const m = revenueScience.models.CONTENT_FACTORY;
    assert.ok(m.floor < m.target);
    assert.ok(m.target < m.max);
  });
});

// ─── demandConfig ───────────────────────────────────────────────────

describe('RevenueScience demandConfig', () => {
  test('has 3 capacity thresholds', () => {
    assert.strictEqual(revenueScience.demandConfig.capacityThresholds.length, 3);
  });

  test('thresholds are in ascending order', () => {
    const t = revenueScience.demandConfig.capacityThresholds;
    assert.ok(t[0] < t[1]);
    assert.ok(t[1] < t[2]);
  });

  test('has 4 elasticity factors', () => {
    assert.strictEqual(revenueScience.demandConfig.elasticityFactors.length, 4);
  });

  test('has 7 urgency days', () => {
    assert.strictEqual(Object.keys(revenueScience.demandConfig.urgencyDays).length, 7);
  });
});

// ─── calculateOptimalPrice ──────────────────────────────────────────

describe('RevenueScience calculateOptimalPrice', () => {
  test('returns a number (cents)', () => {
    const result = revenueScience.calculateOptimalPrice({ score: 70 }, 'VOICE_AI', { applyUrgency: false });
    assert.strictEqual(typeof result, 'number');
    assert.ok(result > 0);
  });

  test('higher BANT score = higher price', () => {
    const lowScore = revenueScience.calculateOptimalPrice({ score: 55 }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    const highScore = revenueScience.calculateOptimalPrice({ score: 95 }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    assert.ok(highScore >= lowScore, `highScore ${highScore} should >= lowScore ${lowScore}`);
  });

  test('B2B entity type increases price', () => {
    const neutral = revenueScience.calculateOptimalPrice({ score: 70 }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    const b2b = revenueScience.calculateOptimalPrice({ score: 70, entity_type: 'B2B' }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    assert.ok(b2b >= neutral, `B2B price ${b2b} should >= neutral ${neutral}`);
  });

  test('B2C entity type decreases price', () => {
    const neutral = revenueScience.calculateOptimalPrice({ score: 70 }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    const b2c = revenueScience.calculateOptimalPrice({ score: 70, entity_type: 'B2C' }, 'VOICE_AI', { applyDemandCurve: false, applyUrgency: false });
    assert.ok(b2c <= neutral, `B2C price ${b2c} should <= neutral ${neutral}`);
  });

  test('price never exceeds model max', () => {
    const model = revenueScience.models.VOICE_AI;
    const result = revenueScience.calculateOptimalPrice({ score: 100, entity_type: 'B2B' }, 'VOICE_AI');
    assert.ok(result <= model.max * 100, `price ${result} should <= max ${model.max * 100}`);
  });

  test('price never goes below model floor', () => {
    const model = revenueScience.models.VOICE_AI;
    const result = revenueScience.calculateOptimalPrice({ score: 0, entity_type: 'B2C' }, 'VOICE_AI');
    assert.ok(result >= model.floor * 100, `price ${result} should >= floor ${model.floor * 100}`);
  });

  test('works with unknown sector (falls back to VOICE_AI)', () => {
    const result = revenueScience.calculateOptimalPrice({ score: 70 }, 'UNKNOWN_SECTOR', { applyUrgency: false });
    assert.strictEqual(typeof result, 'number');
    assert.ok(result > 0);
  });

  test('works with no arguments', () => {
    const result = revenueScience.calculateOptimalPrice();
    assert.strictEqual(typeof result, 'number');
    assert.ok(result > 0);
  });
});

// ─── calculateSectorROI ─────────────────────────────────────────────

describe('RevenueScience calculateSectorROI', () => {
  test('returns healthy when ROI > 200%', () => {
    const result = revenueScience.calculateSectorROI({
      spend: 1000, revenue: 5000, customerCount: 10
    });
    assert.ok(result.roi > 2);
    assert.strictEqual(result.healthy, true);
  });

  test('returns unhealthy when ROI <= 200%', () => {
    const result = revenueScience.calculateSectorROI({
      spend: 1000, revenue: 1500, customerCount: 10
    });
    assert.ok(result.roi <= 2);
    assert.strictEqual(result.healthy, false);
  });

  test('calculates CAC correctly', () => {
    const result = revenueScience.calculateSectorROI({
      spend: 1000, revenue: 5000, customerCount: 10
    });
    assert.strictEqual(result.cac, 100); // 1000 / 10
  });

  test('handles zero spend', () => {
    const result = revenueScience.calculateSectorROI({
      spend: 0, revenue: 1000, customerCount: 5
    });
    assert.strictEqual(result.roi, 100);
    assert.strictEqual(result.cac, 0);
    assert.strictEqual(result.healthy, true);
  });

  test('handles zero customers', () => {
    const result = revenueScience.calculateSectorROI({
      spend: 500, revenue: 2000, customerCount: 0
    });
    assert.strictEqual(result.cac, 500); // 500 / 1 (fallback)
  });
});

// ─── isMarginSafe ───────────────────────────────────────────────────

describe('RevenueScience isMarginSafe', () => {
  test('returns object with safe, margin, costBreakdown', () => {
    const result = revenueScience.isMarginSafe(100000, 'VOICE_AI', { voice_minutes: 60 });
    assert.strictEqual(typeof result.safe, 'boolean');
    assert.strictEqual(typeof result.margin, 'number');
    assert.ok(result.costBreakdown);
  });

  test('high price is margin safe', () => {
    const result = revenueScience.isMarginSafe(500000, 'VOICE_AI', { voice_minutes: 10 });
    assert.strictEqual(result.safe, true);
    assert.ok(result.margin > 0.35);
  });

  test('very low price is not margin safe', () => {
    const result = revenueScience.isMarginSafe(100, 'VOICE_AI', { voice_minutes: 1000 });
    assert.strictEqual(result.safe, false);
  });

  test('SEO sector has higher min margin', () => {
    const voiceResult = revenueScience.isMarginSafe(50000, 'VOICE_AI');
    const seoResult = revenueScience.isMarginSafe(50000, 'SEO_AUTOMATION');
    assert.ok(seoResult.minRequired >= voiceResult.minRequired);
  });

  test('includes priceEur in result', () => {
    const result = revenueScience.isMarginSafe(100000, 'VOICE_AI');
    assert.strictEqual(result.priceEur, 1000); // 100000 cents = 1000 EUR
  });
});

// ─── updateCapacity ─────────────────────────────────────────────────

describe('RevenueScience updateCapacity', () => {
  test('updates VOICE_AI capacity', () => {
    const original = revenueScience.currentCapacity.VOICE_AI;
    revenueScience.updateCapacity('VOICE_AI', 0.75);
    assert.strictEqual(revenueScience.currentCapacity.VOICE_AI, 0.75);
    // Restore
    revenueScience.updateCapacity('VOICE_AI', original);
  });

  test('clamps capacity at 0', () => {
    revenueScience.updateCapacity('VOICE_AI', -0.5);
    assert.strictEqual(revenueScience.currentCapacity.VOICE_AI, 0);
    // Restore
    revenueScience.updateCapacity('VOICE_AI', 0.45);
  });

  test('clamps capacity at 1', () => {
    revenueScience.updateCapacity('VOICE_AI', 1.5);
    assert.strictEqual(revenueScience.currentCapacity.VOICE_AI, 1);
    // Restore
    revenueScience.updateCapacity('VOICE_AI', 0.45);
  });

  test('ignores unknown sector', () => {
    const before = { ...revenueScience.currentCapacity };
    revenueScience.updateCapacity('UNKNOWN', 0.9);
    assert.deepStrictEqual(revenueScience.currentCapacity, before);
  });
});

// ─── getPricingAnalytics ────────────────────────────────────────────

describe('RevenueScience getPricingAnalytics', () => {
  test('returns decisions count', () => {
    const analytics = revenueScience.getPricingAnalytics();
    assert.strictEqual(typeof analytics.decisions, 'number');
  });

  test('returns null analytics when no history', () => {
    // Save and clear
    const saved = revenueScience.pricingHistory;
    revenueScience.pricingHistory = [];

    const analytics = revenueScience.getPricingAnalytics();
    assert.strictEqual(analytics.decisions, 0);
    assert.strictEqual(analytics.analytics, null);

    // Restore
    revenueScience.pricingHistory = saved;
  });
});

// ─── getPricingRecommendation ───────────────────────────────────────

describe('RevenueScience getPricingRecommendation', () => {
  test('returns full recommendation object', () => {
    const rec = revenueScience.getPricingRecommendation({ score: 75, entity_type: 'B2B' }, 'VOICE_AI');
    assert.ok(rec.recommendedPrice);
    assert.ok(rec.priceInCents);
    assert.strictEqual(typeof rec.marginSafe, 'boolean');
    assert.ok(rec.sector);
    assert.ok(rec.timestamp);
  });

  test('tracks pricing in history', () => {
    const beforeCount = revenueScience.pricingHistory.length;
    revenueScience.getPricingRecommendation({ score: 60 }, 'SEO_AUTOMATION');
    assert.ok(revenueScience.pricingHistory.length > beforeCount);
  });
});

// ─── handleCapacityEvent ────────────────────────────────────────────

describe('RevenueScience handleCapacityEvent', () => {
  test('handles event with payload', () => {
    revenueScience.handleCapacityEvent({
      payload: { sector: 'SEO_AUTOMATION', utilization: 0.8 }
    });
    assert.strictEqual(revenueScience.currentCapacity.SEO_AUTOMATION, 0.8);
    // Restore
    revenueScience.updateCapacity('SEO_AUTOMATION', 0.30);
  });

  test('handles flat event (no payload wrapper)', () => {
    revenueScience.handleCapacityEvent({
      sector: 'CONTENT_FACTORY', utilization: 0.6
    });
    assert.strictEqual(revenueScience.currentCapacity.CONTENT_FACTORY, 0.6);
    // Restore
    revenueScience.updateCapacity('CONTENT_FACTORY', 0.25);
  });
});

// ─── health ─────────────────────────────────────────────────────────

describe('RevenueScience health', () => {
  test('returns health object with service name', () => {
    const h = revenueScience.health();
    assert.strictEqual(h.service, 'RevenueScience');
    assert.strictEqual(h.status, 'ok');
  });

  test('returns version 3.0.0', () => {
    const h = revenueScience.health();
    assert.strictEqual(h.version, '3.0.0');
  });

  test('returns capacity utilization', () => {
    const h = revenueScience.health();
    assert.ok(h.capacity);
    assert.strictEqual(typeof h.capacity.VOICE_AI, 'number');
  });

  test('returns models list', () => {
    const h = revenueScience.health();
    assert.ok(Array.isArray(h.models));
    assert.strictEqual(h.models.length, 3);
    assert.ok(h.models.includes('VOICE_AI'));
  });

  test('returns analytics', () => {
    const h = revenueScience.health();
    assert.ok(h.analytics);
    assert.strictEqual(typeof h.analytics.totalDecisions, 'number');
  });

  test('returns timestamp', () => {
    const h = revenueScience.health();
    assert.ok(h.timestamp);
  });
});
