/**
 * TaskRouter — Dynamic Model Routing by Competence
 * VocalIA — Session 250.245 (Inspired by Perplexity Computer orchestration)
 *
 * Instead of a blind linear fallback (Grok → Gemini → Claude),
 * routes each request to the optimal provider based on task type.
 *
 * Pattern: Perplexity Computer selects among 19 models per sub-task.
 * VocalIA adaptation: classify the user intent → reorder the 4 providers.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TASK TYPES
// ─────────────────────────────────────────────────────────────────────────────

const TASK_TYPES = {
  CONVERSATION: 'conversation',
  QUALIFICATION: 'qualification',
  RECOMMENDATION: 'recommendation',
  SUPPORT: 'support',
  DARIJA: 'darija',
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING TABLE — optimal provider order per task type
// ─────────────────────────────────────────────────────────────────────────────
// Rationale:
//   - CONVERSATION: Grok first (lowest latency for fluid chat)
//   - QUALIFICATION: Anthropic first (best structured reasoning for BANT extraction)
//   - RECOMMENDATION: Gemini first (best at data analysis, product matching)
//   - SUPPORT: Gemini first (best at KB search, long context for troubleshooting)
//   - DARIJA: Grok first (fast), then atlasChat (specialized Darija), then gemini

const ROUTING_TABLE = {
  [TASK_TYPES.CONVERSATION]:    ['grok', 'gemini', 'anthropic'],
  [TASK_TYPES.QUALIFICATION]:   ['anthropic', 'gemini', 'grok'],
  [TASK_TYPES.RECOMMENDATION]:  ['gemini', 'grok', 'anthropic'],
  [TASK_TYPES.SUPPORT]:         ['gemini', 'anthropic', 'grok'],
  [TASK_TYPES.DARIJA]:          ['grok', 'atlasChat', 'gemini', 'anthropic'],
};

// ─────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

// Precompiled patterns for performance (called on every request)
const QUAL_PATTERN = /budget|prix|tarif|co[uû]t|combien|d[eé]lai|timeline|urgence|urgent|d[eé]cid|responsable|qui d[eé]cide|price|cost|how much|deadline|decision|when.*start|quand.*commencer|precio|cu[aá]nto|plazo|presupuesto|ميزاني|سعر|ثمن/i;
const REC_PATTERN = /recommand|suggest|propos|conseill|quoi (acheter|choisir)|quel.*(produit|service|plan|offre|formule)|meilleur.*(option|choix)|recommend|which.*plan|best.*option|قترح|شنو نشري|واش عندكم/i;
const SUPPORT_PATTERN = /probl[eè]m|bug|erreur|marche pas|fonctionne pas|ne.*pas|aide|comment faire|help|issue|error|broken|not working|how to|can't|doesn't work|مشكل|ما خدامش/i;

/**
 * Classify the user message into a task type
 * @param {string} userMessage - The user's message
 * @param {string} language - ISO language code (fr, en, es, ar, ary)
 * @param {object} session - Session context (for future use)
 * @returns {string} One of TASK_TYPES values
 */
function classifyTask(userMessage, language, session) {
  // Darija = absolute priority (specialized Atlas-Chat)
  if (language === 'ary') return TASK_TYPES.DARIJA;

  // Qualification: budget/timeline/decision intent
  if (QUAL_PATTERN.test(userMessage)) return TASK_TYPES.QUALIFICATION;

  // Recommendation: suggestion/product selection intent
  if (REC_PATTERN.test(userMessage)) return TASK_TYPES.RECOMMENDATION;

  // Support: problem/help intent
  if (SUPPORT_PATTERN.test(userMessage)) return TASK_TYPES.SUPPORT;

  // Default: fluid conversation (Grok = fastest)
  return TASK_TYPES.CONVERSATION;
}

/**
 * Get the optimal provider order for a given task type
 * Filters out providers that are not enabled in the current config
 * @param {string} taskType - One of TASK_TYPES values
 * @param {object} currentProviders - Provider config from getProviderConfig()
 * @returns {string[]} Ordered array of provider keys
 */
function getOptimalProviderOrder(taskType, currentProviders) {
  const order = ROUTING_TABLE[taskType] || ROUTING_TABLE[TASK_TYPES.CONVERSATION];
  return order.filter(p => currentProviders[p]?.enabled);
}

module.exports = {
  classifyTask,
  getOptimalProviderOrder,
  TASK_TYPES,
  ROUTING_TABLE,
  // Exposed for testing
  QUAL_PATTERN,
  REC_PATTERN,
  SUPPORT_PATTERN,
};
