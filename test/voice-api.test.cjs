/**
 * VocalIA Voice API Tests
 *
 * Tests for voice-api-resilient.cjs module
 * Note: This module is a server script without exports.
 * Full unit tests require refactoring to export functions.
 *
 * Run: node --test test/voice-api.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const VOICE_API_PATH = path.join(__dirname, '../core/voice-api-resilient.cjs');

describe('Voice API Module Structure', () => {
  test('Module file exists', () => {
    assert.ok(fs.existsSync(VOICE_API_PATH), 'voice-api-resilient.cjs should exist');
  });

  test('Module is substantial (>1000 lines)', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines > 1000, `Should have >1000 lines, has ${lines}`);
  });

  test('Module contains AI provider configs', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('PROVIDERS'), 'Should have PROVIDERS config');
    assert.ok(content.includes('grok'), 'Should have grok provider');
    assert.ok(content.includes('gemini'), 'Should have gemini provider');
    assert.ok(content.includes('anthropic'), 'Should have anthropic provider');
  });

  test('Module contains lead qualification system', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('calculateLeadScore'), 'Should have calculateLeadScore function');
    assert.ok(content.includes('getLeadStatus'), 'Should have getLeadStatus function');
    assert.ok(content.includes('QUALIFICATION'), 'Should have QUALIFICATION config');
  });

  test('Module contains resilient response system', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('getResilisentResponse'), 'Should have getResilisentResponse function');
    assert.ok(content.includes('fallback'), 'Should have fallback mechanism');
  });
});

describe('Voice API Provider Functions', () => {
  test('Has Grok call function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('async function callGrok'), 'Should have callGrok function');
  });

  test('Has OpenAI call function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('async function callOpenAI'), 'Should have callOpenAI function');
  });

  test('Has Gemini call function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('async function callGemini'), 'Should have callGemini function');
  });

  test('Has Anthropic call function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('async function callAnthropic'), 'Should have callAnthropic function');
  });

  test('Has AtlasChat call function (Darija)', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('async function callAtlasChat'), 'Should have callAtlasChat function');
  });
});

describe('Voice API BANT Qualification', () => {
  test('Has budget extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractBudget'), 'Should have extractBudget function');
  });

  test('Has timeline extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractTimeline'), 'Should have extractTimeline function');
  });

  test('Has decision maker extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractDecisionMaker'), 'Should have extractDecisionMaker function');
  });

  test('Has industry fit extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractIndustryFit'), 'Should have extractIndustryFit function');
  });
});

describe('Voice API Contact Extraction', () => {
  test('Has email extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractEmail'), 'Should have extractEmail function');
  });

  test('Has phone extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractPhone'), 'Should have extractPhone function');
  });

  test('Has name extraction', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function extractName'), 'Should have extractName function');
  });
});

describe('Voice API Multilingual Support', () => {
  test('Has language assets loader', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function loadLanguageAssets'), 'Should have loadLanguageAssets function');
  });

  test('Has language-specific system prompt', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function getSystemPromptForLanguage'), 'Should have getSystemPromptForLanguage function');
  });

  test('Has local response function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function getLocalResponse'), 'Should have getLocalResponse function');
  });

  test('Supports 5 languages', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    const languages = ['fr', 'en', 'es', 'ar', 'ary'];
    for (const lang of languages) {
      assert.ok(content.includes(`'${lang}'`) || content.includes(`"${lang}"`),
        `Should support ${lang} language`);
    }
  });
});

describe('Voice API Server Endpoints', () => {
  test('Has health endpoint', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('/health'), 'Should have /health endpoint');
  });

  test('Has respond endpoint', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('/respond'), 'Should have /respond endpoint');
  });

  test('Has lead endpoint', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('/lead'), 'Should have /lead endpoint');
  });

  test('Has server startup function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function startServer'), 'Should have startServer function');
  });
});

describe('Voice API HubSpot Integration', () => {
  test('Has HubSpot sync function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('syncLeadToHubSpot'), 'Should have syncLeadToHubSpot function');
  });

  test('Has HubSpot API configuration', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('HUBSPOT_API_KEY') || content.includes('hubspot'),
      'Should have HubSpot configuration');
  });
});

describe('Voice API Latency Monitoring', () => {
  test('Has latency recording function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function recordLatency'), 'Should have recordLatency function');
  });

  test('Has provider latency tracking', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('latencyMs') || content.includes('latency'),
      'Should track provider latency');
  });
});

describe('Voice API Session Management', () => {
  test('Has session creation function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('getOrCreateLeadSession'), 'Should have getOrCreateLeadSession function');
  });

  test('Has session persistence function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('persistLeadSession'), 'Should have persistLeadSession function');
  });
});

describe('Voice API Utility Functions', () => {
  test('Has safe JSON parser', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function safeJsonParse'), 'Should have safeJsonParse function');
  });

  test('Has HTTP request function', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function httpRequest'), 'Should have httpRequest function');
  });

  test('Has environment loader', () => {
    const content = fs.readFileSync(VOICE_API_PATH, 'utf8');
    assert.ok(content.includes('function loadEnv'), 'Should have loadEnv function');
  });
});
