'use strict';

/**
 * conversation-analytics.cjs
 * MOAT: Conversation Intelligence Engine
 *
 * Aggregates per-tenant KPIs from conversation data:
 * - BANT conversion rates, lead scores distribution
 * - Avg duration, message count, resolution patterns
 * - By persona, language, source (widget/telephony)
 * - Temporal trends (hourly heatmap, daily, weekly)
 * - Top intents/keywords extraction
 *
 * Creates DATA MOAT: more usage → richer insights → harder to leave.
 * No competitor (Retell/Vapi/Bland) offers this natively.
 *
 * @version 1.0.0
 * @session 250.241
 */

const fs = require('fs');
const path = require('path');

const CONVERSATIONS_DIR = path.join(__dirname, '..', 'data', 'conversations');

// Lead score thresholds (mirrors voice-api-resilient.cjs)
const SCORE_THRESHOLDS = { hot: 75, warm: 50, cool: 25, cold: 0 };

class ConversationAnalytics {
  constructor(baseDir = CONVERSATIONS_DIR) {
    this.baseDir = baseDir;
  }

  /**
   * Load all conversations for a tenant within a date range
   */
  _loadConversations(tenantId, fromDate = null, toDate = null) {
    const tenantDir = path.join(this.baseDir, tenantId);
    if (!fs.existsSync(tenantDir)) return [];

    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
    const conversations = [];

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(tenantDir, file), 'utf8'));
        const created = new Date(data.created_at || data.metadata?.created_at || 0);

        if (fromDate && created < fromDate) continue;
        if (toDate && created > toDate) continue;

        conversations.push(data);
      } catch (_e) {
        // Skip corrupted files
      }
    }

    return conversations;
  }

  /**
   * Main analytics: compute all KPIs for a tenant
   */
  analyze(tenantId, options = {}) {
    const fromDate = options.from ? new Date(options.from) : null;
    const toDate = options.to ? new Date(options.to) : null;
    const conversations = this._loadConversations(tenantId, fromDate, toDate);

    if (conversations.length === 0) {
      return {
        tenant_id: tenantId,
        period: { from: options.from || null, to: options.to || null },
        total_conversations: 0,
        message: 'No conversation data available'
      };
    }

    return {
      tenant_id: tenantId,
      period: { from: options.from || null, to: options.to || null },
      total_conversations: conversations.length,
      overview: this._computeOverview(conversations),
      lead_qualification: this._computeLeadStats(conversations),
      by_source: this._computeBySource(conversations),
      by_language: this._computeByLanguage(conversations),
      by_persona: this._computeByPersona(conversations),
      temporal: this._computeTemporal(conversations),
      engagement: this._computeEngagement(conversations),
      top_keywords: this._extractTopKeywords(conversations, 20)
    };
  }

  /**
   * Overview stats
   */
  _computeOverview(conversations) {
    const durations = conversations
      .map(c => c.metadata?.duration_sec)
      .filter(d => typeof d === 'number' && d > 0);

    const messageCounts = conversations.map(c => c.message_count || (c.messages || []).length);

    return {
      total_messages: messageCounts.reduce((a, b) => a + b, 0),
      avg_messages_per_conversation: this._avg(messageCounts),
      avg_duration_sec: this._avg(durations),
      median_duration_sec: this._median(durations),
      max_duration_sec: durations.length > 0 ? Math.max(...durations) : 0,
      conversations_with_duration: durations.length
    };
  }

  /**
   * Lead qualification / BANT stats — THE MOAT
   */
  _computeLeadStats(conversations) {
    const scored = conversations.filter(c => {
      const score = c.metadata?.lead_score;
      return typeof score === 'number' && score > 0;
    });

    if (scored.length === 0) {
      return { qualified_conversations: 0, conversion_rate: 0, distribution: {} };
    }

    const scores = scored.map(c => c.metadata.lead_score);

    // Distribution by temperature
    const distribution = { hot: 0, warm: 0, cool: 0, cold: 0 };
    for (const score of scores) {
      if (score >= SCORE_THRESHOLDS.hot) distribution.hot++;
      else if (score >= SCORE_THRESHOLDS.warm) distribution.warm++;
      else if (score >= SCORE_THRESHOLDS.cool) distribution.cool++;
      else distribution.cold++;
    }

    // Conversion = hot leads / total scored
    const conversionRate = scored.length > 0
      ? Math.round((distribution.hot / scored.length) * 100) / 100
      : 0;

    return {
      qualified_conversations: scored.length,
      qualification_rate: Math.round((scored.length / conversations.length) * 100) / 100,
      avg_score: this._avg(scores),
      median_score: this._median(scores),
      conversion_rate: conversionRate,
      distribution,
      distribution_pct: {
        hot: this._pct(distribution.hot, scored.length),
        warm: this._pct(distribution.warm, scored.length),
        cool: this._pct(distribution.cool, scored.length),
        cold: this._pct(distribution.cold, scored.length)
      }
    };
  }

  /**
   * Breakdown by source (widget, telephony, etc.)
   */
  _computeBySource(conversations) {
    const groups = {};
    for (const c of conversations) {
      const source = c.metadata?.source || 'unknown';
      if (!groups[source]) groups[source] = { count: 0, total_messages: 0, scores: [] };
      groups[source].count++;
      groups[source].total_messages += c.message_count || (c.messages || []).length;
      if (typeof c.metadata?.lead_score === 'number') {
        groups[source].scores.push(c.metadata.lead_score);
      }
    }

    const result = {};
    for (const [source, data] of Object.entries(groups)) {
      result[source] = {
        conversations: data.count,
        pct: this._pct(data.count, conversations.length),
        avg_messages: Math.round(data.total_messages / data.count * 10) / 10,
        avg_lead_score: this._avg(data.scores)
      };
    }
    return result;
  }

  /**
   * Breakdown by language
   */
  _computeByLanguage(conversations) {
    const groups = {};
    for (const c of conversations) {
      const lang = c.metadata?.language || 'unknown';
      if (!groups[lang]) groups[lang] = 0;
      groups[lang]++;
    }

    const result = {};
    for (const [lang, count] of Object.entries(groups)) {
      result[lang] = { conversations: count, pct: this._pct(count, conversations.length) };
    }
    return result;
  }

  /**
   * Breakdown by persona — which industry persona converts best
   */
  _computeByPersona(conversations) {
    const groups = {};
    for (const c of conversations) {
      const persona = c.metadata?.persona || 'default';
      if (!groups[persona]) groups[persona] = { count: 0, scores: [], durations: [] };
      groups[persona].count++;
      if (typeof c.metadata?.lead_score === 'number') {
        groups[persona].scores.push(c.metadata.lead_score);
      }
      if (typeof c.metadata?.duration_sec === 'number') {
        groups[persona].durations.push(c.metadata.duration_sec);
      }
    }

    const result = {};
    for (const [persona, data] of Object.entries(groups)) {
      const hotLeads = data.scores.filter(s => s >= SCORE_THRESHOLDS.hot).length;
      result[persona] = {
        conversations: data.count,
        avg_lead_score: this._avg(data.scores),
        conversion_rate: data.scores.length > 0
          ? Math.round((hotLeads / data.scores.length) * 100) / 100
          : 0,
        avg_duration_sec: this._avg(data.durations)
      };
    }

    // Sort by conversion rate desc
    return Object.fromEntries(
      Object.entries(result).sort((a, b) => b[1].conversion_rate - a[1].conversion_rate)
    );
  }

  /**
   * Temporal patterns — hourly heatmap + daily trend
   */
  _computeTemporal(conversations) {
    const hourly = new Array(24).fill(0);
    const daily = {};
    const weekday = new Array(7).fill(0);

    for (const c of conversations) {
      const date = new Date(c.created_at || c.metadata?.created_at || 0);
      if (isNaN(date.getTime())) continue;

      hourly[date.getHours()]++;
      weekday[date.getDay()]++;

      const dayKey = date.toISOString().split('T')[0];
      daily[dayKey] = (daily[dayKey] || 0) + 1;
    }

    // Peak hour
    const peakHour = hourly.indexOf(Math.max(...hourly));

    // Peak weekday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDay = dayNames[weekday.indexOf(Math.max(...weekday))];

    return {
      hourly_distribution: hourly,
      peak_hour: peakHour,
      peak_weekday: peakDay,
      weekday_distribution: Object.fromEntries(dayNames.map((d, i) => [d, weekday[i]])),
      daily_trend: daily
    };
  }

  /**
   * Engagement metrics
   */
  _computeEngagement(conversations) {
    let singleMessage = 0;   // bounces
    let shortConv = 0;       // < 3 messages
    let mediumConv = 0;      // 3-10 messages
    let longConv = 0;        // > 10 messages

    for (const c of conversations) {
      const msgCount = c.message_count || (c.messages || []).length;
      if (msgCount <= 1) singleMessage++;
      else if (msgCount < 3) shortConv++;
      else if (msgCount <= 10) mediumConv++;
      else longConv++;
    }

    const total = conversations.length;
    return {
      bounce_rate: this._pct(singleMessage, total),
      short_conversations: this._pct(shortConv, total),
      medium_conversations: this._pct(mediumConv, total),
      deep_conversations: this._pct(longConv, total),
      counts: { bounce: singleMessage, short: shortConv, medium: mediumConv, deep: longConv }
    };
  }

  /**
   * Extract top keywords from user messages
   */
  _extractTopKeywords(conversations, limit = 20) {
    const freq = {};
    const stopWords = new Set([
      // FR
      'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'de', 'la', 'le', 'les', 'un', 'une',
      'des', 'et', 'en', 'est', 'que', 'qui', 'dans', 'pour', 'pas', 'ne', 'ce', 'se',
      'sur', 'au', 'avec', 'plus', 'tout', 'son', 'sa', 'ses', 'du', 'par', 'mais', 'ou',
      'si', 'ai', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'avoir', 'etre', 'fait', 'comme',
      'cette', 'bien', 'aussi', 'peut', 'tous', 'donc', 'quoi', 'moi', 'oui', 'non', 'merci',
      'bonjour', 'bonsoir', 'salut',
      // EN
      'i', 'you', 'he', 'she', 'we', 'they', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
      'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'can', 'may', 'might', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'it', 'this', 'that', 'not', 'but', 'or', 'and', 'if', 'my', 'your', 'what',
      'how', 'yes', 'no', 'hello', 'hi', 'thanks', 'thank',
      // ES
      'yo', 'el', 'ella', 'nosotros', 'ellos', 'es', 'ser', 'estar', 'hola', 'gracias',
      // Common
      'ok', 'ah', 'oh', 'hm', 'hmm', 'euh', 'um'
    ]);

    for (const c of conversations) {
      const messages = c.messages || [];
      for (const msg of messages) {
        if (msg.role !== 'user') continue;
        const words = (msg.content || '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));

        for (const word of words) {
          freq[word] = (freq[word] || 0) + 1;
        }
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }

  /**
   * Compare two periods — growth analysis
   */
  compare(tenantId, currentPeriod, previousPeriod) {
    const current = this.analyze(tenantId, currentPeriod);
    const previous = this.analyze(tenantId, previousPeriod);

    if (previous.total_conversations === 0) {
      return { current, previous, growth: null, message: 'No previous data for comparison' };
    }

    const growth = {
      conversations: this._growthPct(
        current.total_conversations,
        previous.total_conversations
      ),
      avg_duration: current.overview && previous.overview
        ? this._growthPct(current.overview.avg_duration_sec, previous.overview.avg_duration_sec)
        : null,
      conversion_rate: current.lead_qualification && previous.lead_qualification
        ? this._growthPct(
          current.lead_qualification.conversion_rate,
          previous.lead_qualification.conversion_rate
        )
        : null,
      avg_lead_score: current.lead_qualification && previous.lead_qualification
        ? this._growthPct(
          current.lead_qualification.avg_score,
          previous.lead_qualification.avg_score
        )
        : null
    };

    return { current, previous, growth };
  }

  /**
   * Get persona leaderboard across all tenants
   */
  personaLeaderboard() {
    if (!fs.existsSync(this.baseDir)) return [];

    const tenants = fs.readdirSync(this.baseDir).filter(f => {
      try { return fs.statSync(path.join(this.baseDir, f)).isDirectory(); } catch (_) { return false; }
    });

    const personaStats = {};

    for (const tenantId of tenants) {
      const conversations = this._loadConversations(tenantId);
      for (const c of conversations) {
        const persona = c.metadata?.persona || 'default';
        if (!personaStats[persona]) {
          personaStats[persona] = { conversations: 0, scores: [], durations: [], tenants: new Set() };
        }
        personaStats[persona].conversations++;
        personaStats[persona].tenants.add(tenantId);
        if (typeof c.metadata?.lead_score === 'number') {
          personaStats[persona].scores.push(c.metadata.lead_score);
        }
        if (typeof c.metadata?.duration_sec === 'number') {
          personaStats[persona].durations.push(c.metadata.duration_sec);
        }
      }
    }

    return Object.entries(personaStats)
      .map(([persona, data]) => ({
        persona,
        total_conversations: data.conversations,
        unique_tenants: data.tenants.size,
        avg_lead_score: this._avg(data.scores),
        conversion_rate: data.scores.length > 0
          ? Math.round((data.scores.filter(s => s >= SCORE_THRESHOLDS.hot).length / data.scores.length) * 100) / 100
          : 0,
        avg_duration_sec: this._avg(data.durations)
      }))
      .sort((a, b) => b.conversion_rate - a.conversion_rate);
  }

  // ─── Utility methods ─────────────────────────────────────────
  _avg(arr) {
    if (!arr || arr.length === 0) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
  }

  _median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }

  _pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 10000) / 100;
  }

  _growthPct(current, previous) {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }
}

// Singleton
let instance = null;
function getInstance(baseDir) {
  if (!instance) instance = new ConversationAnalytics(baseDir);
  return instance;
}

module.exports = { ConversationAnalytics, getInstance };
