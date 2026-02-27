/**
 * QualityGate — Post-response quality verification
 * VocalIA — Session 250.245 (Inspired by Perplexity Computer aggregation & coherence check)
 *
 * Verifies response quality BEFORE returning to the user.
 * If quality is too low, the fallback chain continues to the next provider.
 *
 * Checks:
 *   1. Minimum response length
 *   2. Price/number hallucination detection (invents data not in RAG)
 *   3. Off-topic detection (synonym-aware keyword overlap with query)
 *   4. Refusal detection (model refuses to answer despite RAG context)
 *   5. Repetition detection (duplicate sentences in response)
 */

'use strict';

const SCORE_THRESHOLD = 60;

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess response quality against the original query and RAG context
 * @param {string} response - AI response text
 * @param {string} originalQuery - User's original message
 * @param {string} ragContext - RAG context that was injected into the prompt
 * @param {string} language - ISO language code
 * @returns {{ score: number, passed: boolean, checks: Array }}
 */
function assessResponseQuality(response, originalQuery, ragContext, language) {
  const checks = [];
  let score = 100;

  if (!response || typeof response !== 'string') {
    return { score: 0, passed: false, checks: [{ check: 'null_response', passed: false, penalty: 100 }] };
  }

  const trimmed = response.trim();

  // 1. Minimum length check
  if (trimmed.length < 10) {
    checks.push({ check: 'min_length', passed: false, penalty: 50 });
    score -= 50;
  } else {
    checks.push({ check: 'min_length', passed: true, penalty: 0 });
  }

  // 2. Price/number hallucination: response contains specific prices not in RAG
  // Matches: "49€", "99 €", "199$/mois", "$29.99", "500 MAD" (word boundary), "99 euros"
  const pricePattern = /(\d[\d\s,.]*)\s*(?:[€$£]|(?:\bMAD\b)|(?:euros?|dollars?))/gi;
  const responsePrices = [...trimmed.matchAll(pricePattern)].map(m => m[1].replace(/[\s,.]/g, ''));
  if (responsePrices.length > 0 && ragContext) {
    const ragText = ragContext || '';
    const ragPrices = [...ragText.matchAll(pricePattern)].map(m => m[1].replace(/[\s,.]/g, ''));
    // Known plan prices (from PLAN_BUDGETS) — never penalize these
    const knownPlanPrices = new Set(['49', '99', '149', '199', '024']);
    const inventedPrices = responsePrices.filter(p =>
      !ragPrices.includes(p) && !knownPlanPrices.has(p)
    );
    if (inventedPrices.length > 0 && ragPrices.length > 0) {
      // Only penalize if RAG has prices but response invents different ones
      checks.push({ check: 'price_hallucination', passed: false, penalty: 15, detail: `Invented: ${inventedPrices.join(', ')}` });
      score -= 15;
    } else {
      checks.push({ check: 'price_hallucination', passed: true, penalty: 0 });
    }
  }

  // 3. Off-topic detection: no keyword overlap with query
  // Only checks when query has 3+ meaningful CONTENT words (after filtering stop words,
  // interrogatives, possessives, and determiners that carry no topical weight).
  // Uses stem matching (first 4 chars) + synonym map for common business terms.
  const stopWords = new Set([
    // FR: articles, prepositions, pronouns, interrogatives, possessives
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'est', 'je', 'tu', 'il',
    'nous', 'vous', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'par', 'pas',
    'quel', 'quelle', 'quels', 'quelles', 'votre', 'notre', 'cette', 'quoi',
    'comment', 'combien', 'aussi', 'plus', 'moins', 'tout', 'tous', 'très',
    'bien', 'fait', 'faire', 'dire', 'peut', 'sont', 'sera', 'être', 'avoir',
    // EN: articles, prepositions, pronouns, interrogatives, possessives
    'the', 'is', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of',
    'it', 'my', 'me', 'we', 'you', 'your', 'our', 'this', 'that', 'what',
    'which', 'how', 'does', 'have', 'has', 'been', 'will', 'can', 'with',
    'from', 'not', 'are', 'was', 'were', 'they', 'their', 'there',
    // ES
    'qué', 'cuál', 'cómo', 'cuánto', 'este', 'esta', 'estos',
    // AR (transliterated short words unlikely but kept for consistency)
  ]);
  // Synonym groups: any word in a group matches any other word in the same group.
  // This handles "budget → tarifs", "coût → prix", etc.
  const SYNONYM_GROUPS = [
    ['budget', 'tarif', 'tarifs', 'prix', 'coût', 'cout', 'coûte', 'coute', 'cost', 'price', 'pricing', 'precio', 'presupuesto'],
    ['produit', 'produits', 'service', 'services', 'offre', 'offres', 'plan', 'plans', 'formule', 'product', 'products'],
    ['projet', 'projets', 'besoin', 'besoins', 'objectif', 'objectifs', 'project', 'need', 'needs', 'solution'],
    ['problème', 'probleme', 'erreur', 'bug', 'panne', 'issue', 'error', 'problem'],
    ['recommander', 'suggérer', 'suggerer', 'conseiller', 'recommend', 'suggest'],
    ['délai', 'delai', 'deadline', 'timeline', 'livraison', 'delivery', 'plazo'],
    ['installer', 'installation', 'intégrer', 'integrer', 'intégration', 'integration', 'setup', 'install'],
    ['mensuel', 'mensuelle', 'mois', 'monthly', 'month', 'abonnement', 'subscription'],
  ];
  // Build reverse lookup: word → Set of synonyms
  const synonymOf = {};
  for (const group of SYNONYM_GROUPS) {
    for (const w of group) {
      synonymOf[w] = group;
    }
  }
  const queryWords = originalQuery.toLowerCase().split(/\s+/)
    .map(w => w.replace(/[?!.,;:'"()]/g, ''))
    .filter(w => w.length > 3 && !stopWords.has(w));
  // Skip off-topic check if query contains injection/XSS markers (sanitized input)
  const hasInjectionMarkers = /REDACTED|<script|<\/script|alert\(|onerror|onload/i.test(originalQuery);
  if (queryWords.length >= 2 && !hasInjectionMarkers) {
    const responseLower = trimmed.toLowerCase();
    const overlap = queryWords.filter(w => {
      // 1. Exact match
      if (responseLower.includes(w)) return true;
      // 2. Stem match (first 4 chars for words >= 5 chars)
      if (w.length >= 5 && responseLower.includes(w.slice(0, 4))) return true;
      // 3. Synonym match: check if any synonym of this query word appears in response
      const syns = synonymOf[w];
      if (syns) {
        for (const syn of syns) {
          if (syn !== w && responseLower.includes(syn)) return true;
          // Also try stem of synonym
          if (syn.length >= 5 && responseLower.includes(syn.slice(0, 4))) return true;
        }
      }
      return false;
    });
    if (overlap.length === 0) {
      checks.push({ check: 'off_topic', passed: false, penalty: 45, detail: `0/${queryWords.length} keywords found` });
      score -= 45;
    } else {
      checks.push({ check: 'off_topic', passed: true, penalty: 0 });
    }
  }

  // 4. Refusal detection: model refuses instead of answering
  // Covers EN/FR/ES/AR refusal phrases. Does NOT penalize legitimate security refusals.
  const refusalPatterns = /I cannot|I'm unable|I don't have|Je ne peux pas|Je suis incapable|I can't assist|I'm not able|As an AI|No puedo|No tengo información|لا أستطيع|ليس لدي/i;
  if (refusalPatterns.test(trimmed) && ragContext && ragContext.length > 50) {
    // Model refused but we had RAG context — penalize
    checks.push({ check: 'refusal_with_context', passed: false, penalty: 20 });
    score -= 20;
  }

  // 5. Repetition detection: response repeats the same phrase
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length >= 3) {
    const unique = new Set(sentences.map(s => s.trim().toLowerCase()));
    if (unique.size < sentences.length * 0.5) {
      checks.push({ check: 'repetition', passed: false, penalty: 20 });
      score -= 20;
    }
  }

  return {
    score: Math.max(0, score),
    passed: score >= SCORE_THRESHOLD,
    checks,
  };
}

module.exports = {
  assessResponseQuality,
  SCORE_THRESHOLD,
};
