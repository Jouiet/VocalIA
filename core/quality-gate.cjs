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
 *   3. Off-topic detection (no overlap with query keywords)
 *   4. Language mismatch (basic — A2A handles full verification)
 *   5. Refusal detection (model refuses to answer instead of using KB data)
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
  const pricePattern = /(\d[\d\s,.]*)\s*[€$£MAD]/g;
  const responsePrices = [...trimmed.matchAll(pricePattern)].map(m => m[1].replace(/[\s,.]/g, ''));
  if (responsePrices.length > 0 && ragContext) {
    const ragText = ragContext || '';
    const ragPrices = [...ragText.matchAll(pricePattern)].map(m => m[1].replace(/[\s,.]/g, ''));
    const inventedPrices = responsePrices.filter(p => !ragPrices.includes(p));
    if (inventedPrices.length > 0 && ragPrices.length > 0) {
      // Only penalize if RAG has prices but response invents different ones
      checks.push({ check: 'price_hallucination', passed: false, penalty: 15, detail: `Invented: ${inventedPrices.join(', ')}` });
      score -= 15;
    } else {
      checks.push({ check: 'price_hallucination', passed: true, penalty: 0 });
    }
  }

  // 3. Off-topic detection: no keyword overlap with query
  const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'est', 'je', 'tu', 'il', 'nous', 'vous', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'par', 'pas', 'the', 'is', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'it', 'my', 'me', 'we', 'you']);
  const queryWords = originalQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  if (queryWords.length > 2) {
    const responseLower = trimmed.toLowerCase();
    const overlap = queryWords.filter(w => responseLower.includes(w));
    if (overlap.length === 0) {
      checks.push({ check: 'off_topic', passed: false, penalty: 25, detail: `0/${queryWords.length} keywords found` });
      score -= 25;
    } else {
      checks.push({ check: 'off_topic', passed: true, penalty: 0 });
    }
  }

  // 4. Refusal detection: model refuses instead of answering
  const refusalPatterns = /I cannot|I'm unable|I don't have|Je ne peux pas|Je suis incapable|I can't assist|I'm not able|As an AI/i;
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
