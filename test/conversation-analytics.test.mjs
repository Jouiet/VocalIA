/**
 * conversation-analytics.test.mjs
 * Tests for Conversation Intelligence Engine (MOAT — Session 250.241)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, '..', 'data', 'test-analytics-' + process.pid);

// Setup test conversations
function createTestConversation(tenantId, sessionId, overrides = {}) {
  const tenantDir = path.join(TEST_DIR, tenantId);
  fs.mkdirSync(tenantDir, { recursive: true });

  const conversation = {
    session_id: sessionId,
    tenant_id: tenantId,
    messages: overrides.messages || [
      { role: 'user', content: 'Bonjour, je voudrais un rendez-vous' },
      { role: 'assistant', content: 'Bien sûr ! Quel jour vous convient ?' },
      { role: 'user', content: 'Mardi prochain' },
      { role: 'assistant', content: 'Parfait, rendez-vous mardi à 10h.' }
    ],
    message_count: overrides.message_count !== undefined ? overrides.message_count : 4,
    created_at: overrides.created_at || new Date().toISOString(),
    metadata: {
      source: overrides.source || 'widget',
      language: overrides.language || 'fr',
      persona: overrides.persona || 'DENTAL_CLINIC',
      duration_sec: overrides.duration_sec || 120,
      lead_score: overrides.lead_score !== undefined ? overrides.lead_score : 65,
      ...overrides.metadata
    }
  };

  fs.writeFileSync(
    path.join(tenantDir, `${sessionId}.json`),
    JSON.stringify(conversation, null, 2)
  );
  return conversation;
}

describe('ConversationAnalytics', () => {
  let ConversationAnalytics, analytics;

  before(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    ({ ConversationAnalytics } = require(path.join(__dirname, '..', 'core', 'conversation-analytics.cjs')));
    analytics = new ConversationAnalytics(TEST_DIR);
  });

  after(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Empty state', () => {
    it('should return zero stats for non-existent tenant', () => {
      const result = analytics.analyze('nonexistent_tenant');
      assert.equal(result.total_conversations, 0);
      assert.ok(result.message);
    });
  });

  describe('Single tenant analytics', () => {
    before(() => {
      // Create 10 test conversations with variety
      const now = new Date();

      // Hot leads (score >= 75)
      createTestConversation('test_analytics', 'session_hot1', { lead_score: 85, source: 'widget', language: 'fr', persona: 'DENTAL_CLINIC', duration_sec: 180 });
      createTestConversation('test_analytics', 'session_hot2', { lead_score: 90, source: 'telephony', language: 'en', persona: 'DENTAL_CLINIC', duration_sec: 240 });

      // Warm leads (50-74)
      createTestConversation('test_analytics', 'session_warm1', { lead_score: 55, source: 'widget', language: 'fr', persona: 'REAL_ESTATE', duration_sec: 90 });
      createTestConversation('test_analytics', 'session_warm2', { lead_score: 65, source: 'widget', language: 'es', persona: 'REAL_ESTATE', duration_sec: 150 });

      // Cool leads (25-49)
      createTestConversation('test_analytics', 'session_cool1', { lead_score: 30, source: 'telephony', language: 'ar', persona: 'TRAVEL_AGENT', duration_sec: 60 });

      // Cold leads (< 25)
      createTestConversation('test_analytics', 'session_cold1', { lead_score: 10, source: 'widget', language: 'fr', persona: 'TRAVEL_AGENT', duration_sec: 30 });

      // No score
      createTestConversation('test_analytics', 'session_noscore', { lead_score: undefined, source: 'widget', language: 'ary' });

      // Bounce (1 message)
      createTestConversation('test_analytics', 'session_bounce', {
        messages: [{ role: 'user', content: 'Hello' }],
        message_count: 1,
        lead_score: 0,
        duration_sec: 5
      });

      // Long conversation (15 messages)
      const longMessages = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1} about rendez-vous dentaire prix consultation`
      }));
      createTestConversation('test_analytics', 'session_long', {
        messages: longMessages,
        message_count: 15,
        lead_score: 80,
        duration_sec: 600,
        persona: 'DENTAL_CLINIC'
      });

      // Different day
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      createTestConversation('test_analytics', 'session_yesterday', {
        created_at: yesterday.toISOString(),
        lead_score: 70,
        duration_sec: 200,
        language: 'fr'
      });
    });

    it('should compute total conversations', () => {
      const result = analytics.analyze('test_analytics');
      assert.equal(result.total_conversations, 10);
    });

    it('should compute overview stats', () => {
      const { overview } = analytics.analyze('test_analytics');
      assert.ok(overview.total_messages > 0);
      assert.ok(overview.avg_messages_per_conversation > 0);
      assert.ok(overview.avg_duration_sec > 0);
      assert.ok(overview.median_duration_sec > 0);
    });

    it('should compute lead qualification stats', () => {
      const { lead_qualification } = analytics.analyze('test_analytics');
      assert.ok(lead_qualification.qualified_conversations > 0);
      assert.ok(lead_qualification.qualification_rate > 0);
      assert.ok(lead_qualification.avg_score > 0);
      assert.ok(lead_qualification.distribution.hot >= 2);
      assert.ok(lead_qualification.distribution.warm >= 2);
      assert.ok(lead_qualification.distribution.cool >= 1);
      assert.ok(lead_qualification.distribution.cold >= 1);
      assert.ok(lead_qualification.conversion_rate > 0);
      assert.ok(lead_qualification.distribution_pct.hot > 0);
    });

    it('should compute source breakdown', () => {
      const { by_source } = analytics.analyze('test_analytics');
      assert.ok(by_source.widget);
      assert.ok(by_source.telephony);
      assert.ok(by_source.widget.conversations > by_source.telephony.conversations);
      assert.ok(by_source.widget.pct > 0);
    });

    it('should compute language breakdown', () => {
      const { by_language } = analytics.analyze('test_analytics');
      assert.ok(by_language.fr);
      assert.ok(by_language.en);
      assert.ok(by_language.es);
      assert.ok(by_language.ar);
      assert.ok(by_language.ary);
    });

    it('should compute persona breakdown with conversion rates', () => {
      const { by_persona } = analytics.analyze('test_analytics');
      assert.ok(by_persona.DENTAL_CLINIC);
      assert.ok(by_persona.DENTAL_CLINIC.conversations >= 3);
      assert.ok(by_persona.DENTAL_CLINIC.conversion_rate > 0);
      assert.ok(by_persona.REAL_ESTATE);
      assert.ok(by_persona.TRAVEL_AGENT);
    });

    it('should sort personas by conversion rate descending', () => {
      const { by_persona } = analytics.analyze('test_analytics');
      const rates = Object.values(by_persona).map(p => p.conversion_rate);
      for (let i = 1; i < rates.length; i++) {
        assert.ok(rates[i - 1] >= rates[i], `Persona sort: ${rates[i-1]} should be >= ${rates[i]}`);
      }
    });

    it('should compute temporal distribution', () => {
      const { temporal } = analytics.analyze('test_analytics');
      assert.equal(temporal.hourly_distribution.length, 24);
      assert.ok(temporal.peak_hour >= 0 && temporal.peak_hour <= 23);
      assert.ok(temporal.peak_weekday);
      assert.ok(temporal.weekday_distribution);
      assert.ok(Object.keys(temporal.daily_trend).length >= 1);
    });

    it('should compute engagement metrics', () => {
      const { engagement } = analytics.analyze('test_analytics');
      assert.ok(typeof engagement.bounce_rate === 'number');
      assert.ok(typeof engagement.deep_conversations === 'number');
      assert.ok(engagement.counts.bounce >= 1); // We created a bounce
      assert.ok(engagement.counts.deep >= 1);  // We created a long conv
    });

    it('should extract top keywords from user messages', () => {
      const { top_keywords } = analytics.analyze('test_analytics');
      assert.ok(Array.isArray(top_keywords));
      if (top_keywords.length > 0) {
        assert.ok(top_keywords[0].word);
        assert.ok(top_keywords[0].count > 0);
        // Stop words should be filtered
        const words = top_keywords.map(k => k.word);
        assert.ok(!words.includes('je'));
        assert.ok(!words.includes('the'));
      }
    });

    it('should filter by date range', () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Only yesterday's conversations
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const filtered = analytics.analyze('test_analytics', {
        from: twoDaysAgo.toISOString(),
        to: tomorrow.toISOString()
      });
      assert.equal(filtered.total_conversations, 10); // All within range
    });
  });

  describe('Period comparison', () => {
    it('should compare two periods', () => {
      const now = new Date();
      const result = analytics.compare(
        'test_analytics',
        { from: new Date(now.getFullYear(), 0, 1).toISOString() }, // current = this year
        { from: '2025-01-01', to: '2025-12-31' } // previous = 2025
      );
      assert.ok(result.current);
      assert.ok(result.previous);
      // Previous has no data, so growth should be null
      assert.equal(result.growth, null);
    });
  });

  describe('Persona leaderboard', () => {
    it('should return persona leaderboard sorted by conversion rate', () => {
      const leaderboard = analytics.personaLeaderboard();
      assert.ok(Array.isArray(leaderboard));
      assert.ok(leaderboard.length > 0);
      assert.ok(leaderboard[0].persona);
      assert.ok(typeof leaderboard[0].total_conversations === 'number');
      assert.ok(typeof leaderboard[0].conversion_rate === 'number');
      assert.ok(typeof leaderboard[0].unique_tenants === 'number');

      // Verify sorted by conversion rate desc
      for (let i = 1; i < leaderboard.length; i++) {
        assert.ok(leaderboard[i - 1].conversion_rate >= leaderboard[i].conversion_rate);
      }
    });
  });

  describe('Multi-tenant isolation', () => {
    before(() => {
      createTestConversation('tenant_alpha', 'alpha_1', { lead_score: 90, persona: 'DENTAL_CLINIC' });
      createTestConversation('tenant_beta', 'beta_1', { lead_score: 20, persona: 'TRAVEL_AGENT' });
    });

    it('should return isolated results per tenant', () => {
      const alpha = analytics.analyze('tenant_alpha');
      const beta = analytics.analyze('tenant_beta');

      assert.equal(alpha.total_conversations, 1);
      assert.equal(beta.total_conversations, 1);
      assert.ok(alpha.lead_qualification.avg_score > beta.lead_qualification.avg_score);
    });

    it('should include all tenants in persona leaderboard', () => {
      const leaderboard = analytics.personaLeaderboard();
      const allTenants = new Set();
      for (const p of leaderboard) {
        assert.ok(p.unique_tenants > 0);
      }
      // At least 3 tenants in test data
      const dentalEntry = leaderboard.find(p => p.persona === 'DENTAL_CLINIC');
      assert.ok(dentalEntry);
      assert.ok(dentalEntry.unique_tenants >= 2); // test_analytics + tenant_alpha
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages array', () => {
      createTestConversation('edge_tenant', 'empty_msgs', {
        messages: [],
        message_count: 0,
        lead_score: undefined
      });
      const result = analytics.analyze('edge_tenant');
      assert.equal(result.total_conversations, 1);
      assert.equal(result.overview.total_messages, 0);
    });

    it('should handle corrupted JSON files', () => {
      const dir = path.join(TEST_DIR, 'corrupt_tenant');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'bad.json'), 'not json at all');
      createTestConversation('corrupt_tenant', 'good', { lead_score: 50 });

      const result = analytics.analyze('corrupt_tenant');
      assert.equal(result.total_conversations, 1); // Only the good one
    });

    it('should handle missing metadata gracefully', () => {
      const dir = path.join(TEST_DIR, 'no_meta_tenant');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'no_meta.json'),
        JSON.stringify({ session_id: 'x', messages: [{ role: 'user', content: 'test' }] })
      );

      const result = analytics.analyze('no_meta_tenant');
      assert.equal(result.total_conversations, 1);
      assert.ok(result.by_language.unknown);
    });

    it('should handle utility functions correctly', () => {
      // Test avg with empty array
      assert.equal(analytics._avg([]), 0);
      assert.equal(analytics._avg(null), 0);

      // Test median
      assert.equal(analytics._median([1, 2, 3]), 2);
      assert.equal(analytics._median([1, 2, 3, 4]), 2.5);
      assert.equal(analytics._median([]), 0);

      // Test pct
      assert.equal(analytics._pct(1, 4), 25);
      assert.equal(analytics._pct(0, 0), 0);

      // Test growth
      assert.equal(analytics._growthPct(200, 100), 100);
      assert.equal(analytics._growthPct(50, 100), -50);
      assert.equal(analytics._growthPct(100, 0), null);
    });
  });
});
