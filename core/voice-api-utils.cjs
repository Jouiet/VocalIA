'use strict';

/**
 * VocalIA Voice API Pure Utilities
 *
 * Extracted from voice-api-resilient.cjs for testability.
 * Pure functions with ZERO side effects (no HTTP, no file I/O, no server).
 *
 * Used by: voice-api-resilient.cjs (main server)
 * Tested by: test/voice-api-utils.test.cjs
 */

// ─────────────────────────────────────────────────────────────────────────────
// ORIGIN VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (origin.endsWith('.vocalia.ma') || origin === 'https://vocalia.ma') return true;
  if (origin.startsWith('http://localhost:')) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD QUALIFICATION CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const QUALIFICATION = {
  weights: {
    budget: 30,
    timeline: 25,
    decisionMaker: 20,
    fit: 15,
    engagement: 10
  },
  budgetTiers: {
    high: { min: 1000, score: 30, label: 'Growth+' },
    medium: { min: 500, score: 20, label: 'Essentials' },
    low: { min: 300, score: 10, label: 'Quick Win' },
    minimal: { min: 0, score: 5, label: 'Nurture' }
  },
  timelineTiers: {
    immediate: { keywords: ['urgent', 'asap', 'maintenant', 'cette semaine', 'immédiat'], score: 25 },
    short: { keywords: ['ce mois', 'bientôt', 'rapidement', '2 semaines', 'prochainement'], score: 20 },
    medium: { keywords: ['prochain mois', 'trimestre', '1-3 mois', 'q1', 'q2'], score: 12 },
    long: { keywords: ['plus tard', 'explorer', 'pas pressé', 'futur'], score: 5 }
  },
  decisionMakerPatterns: {
    yes: ['je décide', 'c\'est moi', 'mon entreprise', 'je suis le', 'fondateur', 'ceo', 'directeur', 'owner', 'gérant', 'patron'],
    partial: ['avec mon', 'équipe', 'nous décidons', 'je propose', 'valider avec'],
    no: ['mon chef', 'supérieur', 'je transmets', 'je demande']
  },
  industryFit: {
    perfect: { keywords: ['e-commerce', 'boutique en ligne', 'shopify', 'woocommerce', 'klaviyo', 'email marketing'], score: 15 },
    good: { keywords: ['pme', 'b2b', 'saas', 'startup', 'agence', 'services'], score: 12 },
    moderate: { keywords: ['entreprise', 'société', 'business', 'commerce'], score: 8 },
    low: { keywords: ['particulier', 'personnel', 'hobby'], score: 3 }
  },
  thresholds: {
    hot: 75,
    warm: 50,
    cool: 25,
    cold: 0
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NPS CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────

function calculateNPS(responses) {
  if (!responses.length) return 0;
  const promoters = responses.filter(r => r >= 9).length;
  const detractors = responses.filter(r => r <= 6).length;
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

function estimateNPS(hotLeads, warmLeads, totalLeads) {
  if (totalLeads === 0) return 0;
  const promoterRatio = hotLeads / totalLeads;
  const passiveRatio = warmLeads / totalLeads;
  const detractorRatio = 1 - promoterRatio - passiveRatio;
  return Math.round((promoterRatio - Math.max(0, detractorRatio)) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE JSON PARSING
// ─────────────────────────────────────────────────────────────────────────────

function safeJsonParse(str, context = 'unknown') {
  try {
    return { success: true, data: JSON.parse(str) };
  } catch (err) {
    return { success: false, error: err.message, raw: str?.substring(0, 200) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text.substring(0, 1000);

  const injectionPatterns = [
    /ignore previous instructions/gi,
    /ignore all previous/gi,
    /system prompt/gi,
    /forget everything/gi,
    /new instructions/gi,
    /tu es maintenant/gi,
    /votre nouveau rôle/gi,
    /act as/gi,
    /speak as/gi
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECURITY_POLICY]');
    }
  }

  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD EXTRACTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function extractBudget(text) {
  const lower = text.toLowerCase();

  const amountMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)/i);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(',', '.'));
    for (const [tier, config] of Object.entries(QUALIFICATION.budgetTiers)) {
      if (amount >= config.min) {
        return { amount, tier, score: config.score, label: config.label };
      }
    }
  }

  if (lower.includes('growth') || lower.includes('1399') || lower.includes('1400')) {
    return { tier: 'high', score: 30, label: 'Growth+' };
  }
  if (lower.includes('essentials') || lower.includes('790') || lower.includes('800')) {
    return { tier: 'medium', score: 20, label: 'Essentials' };
  }
  if (lower.includes('quick win') || lower.includes('390') || lower.includes('400')) {
    return { tier: 'low', score: 10, label: 'Quick Win' };
  }

  return null;
}

function extractTimeline(text) {
  const lower = text.toLowerCase();

  for (const [tier, config] of Object.entries(QUALIFICATION.timelineTiers)) {
    if (config.keywords.some(kw => lower.includes(kw))) {
      return { tier, score: config.score };
    }
  }

  return null;
}

function extractDecisionMaker(text) {
  const lower = text.toLowerCase();

  for (const pattern of QUALIFICATION.decisionMakerPatterns.yes) {
    if (lower.includes(pattern)) {
      return { isDecisionMaker: true, score: 20 };
    }
  }

  for (const pattern of QUALIFICATION.decisionMakerPatterns.partial) {
    if (lower.includes(pattern)) {
      return { isDecisionMaker: 'partial', score: 12 };
    }
  }

  for (const pattern of QUALIFICATION.decisionMakerPatterns.no) {
    if (lower.includes(pattern)) {
      return { isDecisionMaker: false, score: 5 };
    }
  }

  return null;
}

function extractIndustryFit(text) {
  const lower = text.toLowerCase();

  for (const [tier, config] of Object.entries(QUALIFICATION.industryFit)) {
    if (config.keywords.some(kw => lower.includes(kw))) {
      return { tier, score: config.score };
    }
  }

  return null;
}

function extractEmail(text) {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/i);
  return emailMatch ? emailMatch[0].toLowerCase() : null;
}

function extractPhone(text) {
  const phoneMatch = text.match(/(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/);
  return phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, '') : null;
}

function extractName(text) {
  const nameMatch = text.match(/(?:je suis|je m'appelle|my name is|i'm|i am)\s+([A-Z][a-zéèêëàâäùûü]+(?:\s+[A-Z][a-zéèêëàâäùûü]+)?)/i);
  return nameMatch ? nameMatch[1].trim() : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD SCORING
// ─────────────────────────────────────────────────────────────────────────────

function calculateLeadScore(session) {
  let score = 0;
  const breakdown = {};

  if (session.extractedData.budget) {
    score += session.extractedData.budget.score;
    breakdown.budget = session.extractedData.budget.score;
  }

  if (session.extractedData.timeline) {
    score += session.extractedData.timeline.score;
    breakdown.timeline = session.extractedData.timeline.score;
  }

  if (session.extractedData.decisionMaker) {
    score += session.extractedData.decisionMaker.score;
    breakdown.decisionMaker = session.extractedData.decisionMaker.score;
  }

  if (session.extractedData.industry) {
    score += session.extractedData.industry.score;
    breakdown.industry = session.extractedData.industry.score;
  }

  const messageCount = session.messages.length;
  const engagementScore = Math.min(10, messageCount * 2);
  score += engagementScore;
  breakdown.engagement = engagementScore;

  return { score, breakdown };
}

function getLeadStatus(score) {
  if (score >= QUALIFICATION.thresholds.hot) return 'hot';
  if (score >= QUALIFICATION.thresholds.warm) return 'warm';
  if (score >= QUALIFICATION.thresholds.cool) return 'cool';
  return 'cold';
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the VocalIA Voice AI Assistant.
- Markets: Morocco (MAD), Europe (EUR), International (USD)

WHAT VOCALIA OFFERS:
1. Voice Widget: JavaScript embed for 24/7 website voice assistant
2. Voice Telephony: PSTN AI Bridge via Twilio for real phone calls
3. 38 Industry Personas: Pre-configured for dental, property, contractors, restaurants, etc.
4. MCP Server: 203 integration tools (CRM, e-commerce, payments, calendar)

RESPONSE PROTOCOL:
- VOICE OPTIMIZED: Max 2-3 sentences. Speak naturally.
- HONEST: Only claim features VocalIA actually has.
- CONVERSION FOCUS: Guide towards demo or vocalia.ma/booking.

GUIDELINES:
- Language: Follow the user's language (FR/EN/ES/AR/Darija).
- Qualify leads with BANT methodology.
- For integration questions, reference MCP Server capabilities.`;

function getSystemPromptForLanguage(language = 'fr') {
  if (language !== 'ary') {
    return SYSTEM_PROMPT;
  }

  return `أنت المساعد الصوتي ديال VocalIA.

شكون حنا (الحقيقة):
VocalIA هي منصة Voice AI. عندنا 2 منتوجات:
1. Voice Widget: تحطو فالموقع ديالك وكيجاوب على العملاء 24/7
2. Voice Telephony: رقم تيليفون ذكي كيجاوب على المكالمات

شنو كنقدمو:
- 38 persona حسب الصناعة: طبيب، عقار، مطعم، متجر...
- 5 لغات: فرنسية، إنجليزية، إسبانية، عربية، دارجة
- تكامل مع: CRM، Shopify، Stripe، Calendar

الأسعار:
- Starter: 499 درهم/شهر
- Pro: 999 درهم/شهر
- Enterprise: على المقاس

قواعد الجواب:
1. جاوب بالدارجة المغربية الأصيلة
2. جملتين-3 جمل فقط
3. كون صريح - VocalIA = Voice AI فقط
4. وجه نحو vocalia.ma/booking للديمو`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PROOF MESSAGES (from real metrics)
// ─────────────────────────────────────────────────────────────────────────────

function generateSocialProofMessages(lang, metrics = {}) {
  const messages = [];
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const callsToday = metrics.dailyCalls?.[todayKey] || 0;
  const totalCalls = metrics.totalCalls || 0;
  const leadsQualified = metrics.totalLeadsQualified || 0;
  const hotLeads = metrics.hotLeads || 0;
  const timeStr = now.toLocaleTimeString(lang === 'ar' || lang === 'ary' ? 'ar-MA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });

  const templates = {
    fr: {
      callsToday: (n) => `${n} consultation${n > 1 ? 's' : ''} aujourd'hui`,
      leadsQualified: (n) => `${n} prospect${n > 1 ? 's' : ''} qualifié${n > 1 ? 's' : ''} ce mois`,
      totalCalls: (n) => `Plus de ${n} entreprises nous font confiance`,
      hotLeads: (n) => `${n} rendez-vous confirmé${n > 1 ? 's' : ''} ce mois`
    },
    en: {
      callsToday: (n) => `${n} consultation${n > 1 ? 's' : ''} today`,
      leadsQualified: (n) => `${n} qualified prospect${n > 1 ? 's' : ''} this month`,
      totalCalls: (n) => `More than ${n} businesses trust us`,
      hotLeads: (n) => `${n} confirmed appointment${n > 1 ? 's' : ''} this month`
    },
    es: {
      callsToday: (n) => `${n} consulta${n > 1 ? 's' : ''} hoy`,
      leadsQualified: (n) => `${n} prospecto${n > 1 ? 's' : ''} calificado${n > 1 ? 's' : ''} este mes`,
      totalCalls: (n) => `Más de ${n} empresas confían en nosotros`,
      hotLeads: (n) => `${n} cita${n > 1 ? 's' : ''} confirmada${n > 1 ? 's' : ''} este mes`
    },
    ar: {
      callsToday: (n) => `${n} استشارة اليوم`,
      leadsQualified: (n) => `${n} عميل محتمل مؤهل هذا الشهر`,
      totalCalls: (n) => `أكثر من ${n} شركة تثق بنا`,
      hotLeads: (n) => `${n} موعد مؤكد هذا الشهر`
    },
    ary: {
      callsToday: (n) => `${n} استشارة اليوم`,
      leadsQualified: (n) => `${n} كليان مؤهل هاد الشهر`,
      totalCalls: (n) => `كثر من ${n} شركة كيتيقو فينا`,
      hotLeads: (n) => `${n} موعد مأكد هاد الشهر`
    }
  };

  const t = templates[lang] || templates.fr;

  if (callsToday > 0) {
    messages.push({ text: t.callsToday(callsToday), time: timeStr });
  }
  if (leadsQualified > 0) {
    messages.push({ text: t.leadsQualified(leadsQualified), time: timeStr });
  }
  if (totalCalls > 10) {
    messages.push({ text: t.totalCalls(totalCalls), time: timeStr });
  }
  if (hotLeads > 0) {
    messages.push({ text: t.hotLeads(hotLeads), time: timeStr });
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  isOriginAllowed,
  QUALIFICATION,
  calculateNPS,
  estimateNPS,
  safeJsonParse,
  sanitizeInput,
  extractBudget,
  extractTimeline,
  extractDecisionMaker,
  extractIndustryFit,
  extractEmail,
  extractPhone,
  extractName,
  calculateLeadScore,
  getLeadStatus,
  SYSTEM_PROMPT,
  getSystemPromptForLanguage,
  generateSocialProofMessages
};
