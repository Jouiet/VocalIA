'use strict';

/**
 * VocalIA Marketing Science Core Tests
 *
 * Tests:
 * - FRAMEWORKS constant (6 frameworks: PAS, AIDA, SB7, CIALDINI, UVP, BANT)
 * - getAvailableFrameworks listing
 * - getFramework by key (case insensitive)
 * - inject() framework into base prompt
 * - analyze() with no API key (self-critique fallback)
 * - analyze() with unknown framework
 *
 * Run: node --test test/marketing-science.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const MarketingScience = require('../core/marketing-science-core.cjs');

describe('MarketingScience Frameworks', () => {
  test('getAvailableFrameworks returns 6 frameworks', () => {
    const frameworks = MarketingScience.getAvailableFrameworks();
    assert.strictEqual(frameworks.length, 6);
  });

  test('includes PAS, AIDA, SB7, CIALDINI, UVP, BANT', () => {
    const frameworks = MarketingScience.getAvailableFrameworks();
    assert.ok(frameworks.includes('PAS'));
    assert.ok(frameworks.includes('AIDA'));
    assert.ok(frameworks.includes('SB7'));
    assert.ok(frameworks.includes('CIALDINI'));
    assert.ok(frameworks.includes('UVP'));
    assert.ok(frameworks.includes('BANT'));
  });

  test('getFramework returns PAS details', () => {
    const pas = MarketingScience.getFramework('PAS');
    assert.ok(pas);
    assert.strictEqual(pas.name, 'Pain-Agitate-Solution');
    assert.ok(pas.instruction.includes('PAIN'));
    assert.ok(pas.instruction.includes('AGITATE'));
    assert.ok(pas.instruction.includes('SOLUTION'));
  });

  test('getFramework returns AIDA details', () => {
    const aida = MarketingScience.getFramework('AIDA');
    assert.ok(aida);
    assert.strictEqual(aida.name, 'Attention-Interest-Desire-Action');
    assert.ok(aida.instruction.includes('ATTENTION'));
    assert.ok(aida.instruction.includes('ACTION'));
  });

  test('getFramework returns SB7 details', () => {
    const sb7 = MarketingScience.getFramework('SB7');
    assert.ok(sb7);
    assert.strictEqual(sb7.name, 'StoryBrand 7');
    assert.ok(sb7.instruction.includes('HERO'));
    assert.ok(sb7.instruction.includes('GUIDE'));
  });

  test('getFramework returns CIALDINI details', () => {
    const cialdini = MarketingScience.getFramework('CIALDINI');
    assert.ok(cialdini);
    assert.ok(cialdini.instruction.includes('RECIPROCITY'));
    assert.ok(cialdini.instruction.includes('SCARCITY'));
  });

  test('getFramework returns BANT details', () => {
    const bant = MarketingScience.getFramework('BANT');
    assert.ok(bant);
    assert.strictEqual(bant.name, 'BANT Qualification');
    assert.ok(bant.instruction.includes('BUDGET'));
    assert.ok(bant.instruction.includes('AUTHORITY'));
    assert.ok(bant.instruction.includes('NEED'));
    assert.ok(bant.instruction.includes('TIME'));
  });

  test('getFramework is case insensitive', () => {
    const lower = MarketingScience.getFramework('pas');
    const upper = MarketingScience.getFramework('PAS');
    assert.deepStrictEqual(lower, upper);
  });

  test('getFramework returns null for unknown', () => {
    const result = MarketingScience.getFramework('NONEXISTENT');
    assert.strictEqual(result, null);
  });

  test('each framework has name, description, instruction', () => {
    for (const key of MarketingScience.getAvailableFrameworks()) {
      const fw = MarketingScience.getFramework(key);
      assert.ok(fw.name, `${key} missing name`);
      assert.ok(fw.description, `${key} missing description`);
      assert.ok(fw.instruction, `${key} missing instruction`);
    }
  });
});

describe('MarketingScience inject()', () => {
  test('injects PAS framework into context', () => {
    const result = MarketingScience.inject('PAS', 'Write a LinkedIn post about AI');
    assert.ok(result.includes('Write a LinkedIn post about AI'));
    assert.ok(result.includes('MARKETING SCIENCE INJECTION'));
    assert.ok(result.includes('Pain-Agitate-Solution'));
    assert.ok(result.includes('MANDATORY EXECUTION'));
  });

  test('injects AIDA framework', () => {
    const result = MarketingScience.inject('AIDA', 'Product description for voice AI');
    assert.ok(result.includes('Product description for voice AI'));
    assert.ok(result.includes('Attention-Interest-Desire-Action'));
  });

  test('unknown framework returns base context', () => {
    const result = MarketingScience.inject('NONEXISTENT', 'Base context');
    assert.strictEqual(result, 'Base context');
  });

  test('inject is case insensitive', () => {
    const lower = MarketingScience.inject('pas', 'Test');
    const upper = MarketingScience.inject('PAS', 'Test');
    assert.strictEqual(lower, upper);
  });
});

describe('MarketingScience analyze()', () => {
  test('returns fallback when no API config', async () => {
    const result = await MarketingScience.analyze('Some text', 'PAS');
    assert.ok(result);
    assert.strictEqual(result.score, 5);
    assert.ok(result.feedback.includes('Self-check'));
    assert.strictEqual(result.framework, 'Pain-Agitate-Solution');
  });

  test('returns fallback when API key missing', async () => {
    const result = await MarketingScience.analyze('Some text', 'AIDA', {});
    assert.ok(result);
    assert.strictEqual(result.score, 5);
  });

  test('throws for unknown framework', async () => {
    await assert.rejects(
      () => MarketingScience.analyze('text', 'NONEXISTENT'),
      { message: /not found/ }
    );
  });

  test('uses callAI function when provided', async () => {
    let calledPrompt = null;
    const result = await MarketingScience.analyze('Test copy', 'PAS', {
      apiKey: 'test-key',
      callAI: async (prompt, system) => {
        calledPrompt = prompt;
        return { score: 8, feedback: 'Good PAS structure', issues: [] };
      }
    });
    assert.ok(calledPrompt);
    assert.ok(calledPrompt.includes('Test copy'));
    assert.strictEqual(result.score, 8);
    assert.strictEqual(result.framework, 'Pain-Agitate-Solution');
  });

  test('handles callAI error gracefully', async () => {
    const result = await MarketingScience.analyze('Test', 'PAS', {
      apiKey: 'test',
      callAI: async () => { throw new Error('API down'); }
    });
    assert.strictEqual(result.score, 0);
    assert.ok(result.feedback.includes('API down'));
  });
});

// ─── Framework detail checks ─────────────────────────────────────

describe('MarketingScience framework details', () => {
  test('UVP framework includes clarity rules', () => {
    const uvp = MarketingScience.getFramework('UVP');
    assert.ok(uvp);
    assert.strictEqual(uvp.name, 'Unique Value Proposition');
    assert.ok(uvp.instruction.includes('What is it'));
    assert.ok(uvp.instruction.includes('Who is it for'));
  });

  test('CIALDINI has 6 principles', () => {
    const cialdini = MarketingScience.getFramework('CIALDINI');
    assert.ok(cialdini.instruction.includes('RECIPROCITY'));
    assert.ok(cialdini.instruction.includes('SCARCITY'));
    assert.ok(cialdini.instruction.includes('AUTHORITY'));
    assert.ok(cialdini.instruction.includes('CONSISTENCY'));
    assert.ok(cialdini.instruction.includes('LIKING'));
    assert.ok(cialdini.instruction.includes('SOCIAL PROOF'));
  });

  test('SB7 has all 6 elements', () => {
    const sb7 = MarketingScience.getFramework('SB7');
    assert.ok(sb7.instruction.includes('HERO'));
    assert.ok(sb7.instruction.includes('VILLAIN'));
    assert.ok(sb7.instruction.includes('GUIDE'));
    assert.ok(sb7.instruction.includes('PLAN'));
    assert.ok(sb7.instruction.includes('FAILURE'));
    assert.ok(sb7.instruction.includes('SUCCESS'));
  });

  test('each framework has non-empty description', () => {
    for (const key of MarketingScience.getAvailableFrameworks()) {
      const fw = MarketingScience.getFramework(key);
      assert.ok(fw.description.length > 5, `${key} description too short`);
    }
  });
});

// ─── inject edge cases ───────────────────────────────────────────

describe('MarketingScience inject edge cases', () => {
  test('inject SB7 includes StoryBrand', () => {
    const result = MarketingScience.inject('SB7', 'Company story');
    assert.ok(result.includes('StoryBrand 7'));
  });

  test('inject CIALDINI includes persuasion', () => {
    const result = MarketingScience.inject('CIALDINI', 'Sales email');
    assert.ok(result.includes('Persuasion') || result.includes('PERSUASION'));
  });

  test('inject BANT includes qualification', () => {
    const result = MarketingScience.inject('BANT', 'Lead call script');
    assert.ok(result.includes('BANT') || result.includes('BUDGET'));
  });

  test('inject UVP includes clarity', () => {
    const result = MarketingScience.inject('UVP', 'Landing page');
    assert.ok(result.includes('CLARITY') || result.includes('Unique Value'));
  });
});

// ─── trackV2 ─────────────────────────────────────────────────────

describe('MarketingScience trackV2', () => {
  test('trackV2 is a static method', () => {
    assert.strictEqual(typeof MarketingScience.trackV2, 'function');
  });

  test('trackV2 completes without error', async () => {
    await MarketingScience.trackV2('test_event', { sector: 'DENTAL', value: 100 });
  });

  test('trackV2 handles missing sector', async () => {
    await MarketingScience.trackV2('test_event', { value: 50 });
    // Should not throw
  });
});

// ─── heal ────────────────────────────────────────────────────────

describe('MarketingScience heal', () => {
  test('heal is a static method', () => {
    assert.strictEqual(typeof MarketingScience.heal, 'function');
  });
});

// ─── exports ─────────────────────────────────────────────────────

describe('MarketingScience exports', () => {
  test('exports MarketingScience class', () => {
    assert.strictEqual(typeof MarketingScience, 'function');
  });

  test('has all 5 static methods', () => {
    assert.strictEqual(typeof MarketingScience.getAvailableFrameworks, 'function');
    assert.strictEqual(typeof MarketingScience.getFramework, 'function');
    assert.strictEqual(typeof MarketingScience.inject, 'function');
    assert.strictEqual(typeof MarketingScience.analyze, 'function');
    assert.strictEqual(typeof MarketingScience.trackV2, 'function');
  });
});
