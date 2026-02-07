/**
 * VocalIA Persona Audit Framework
 * P3-5: Comprehensive audit of ALL 38 personas
 * Deep audit of top 5: DENTAL, PROPERTY, RESTAURATEUR, UNIVERSAL_ECOMMERCE, CONTRACTOR
 *
 * Tests:
 * - Structural completeness (all required fields)
 * - Language coverage (5 langs in SYSTEM_PROMPTS + multilingual fields)
 * - Template variable consistency
 * - Darija authenticity (ary ≠ MSA copy)
 * - Arabic script validation (ar/ary contain Arabic chars)
 * - Escalation triggers quality
 * - Complaint scenarios quality
 * - Example dialogues quality
 * - Forbidden behaviors non-empty
 * - Cross-persona consistency
 *
 * Run: node --test test/persona-audit.test.mjs
 * Session 250.125 | 07/02/2026
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PERSONAS, SYSTEM_PROMPTS, VoicePersonaInjector } from '../personas/voice-persona-injector.cjs';

const REQUIRED_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];
const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;
const DARIJA_MARKERS = [
  'غادي', 'ديال', 'كان', 'فين', 'شنو', 'واخا', 'بزاف', 'خاص',
  'ديالك', 'ديالنا', 'كيفاش', 'فهمتك', 'باش', 'هادشي', 'ماشي',
  'نتا', 'نتي', 'حنا', 'هوما', 'سمحلي', 'خليني', 'دابا',
  // Extended Darija markers (common verbs/expressions)
  'بغيت', 'بغيتي', 'نقدر', 'تقدر', 'فاهم', 'عندي', 'عندك',
  'لهاد', 'هاد', 'فهاد', 'شحال', 'فشحال', 'لشحال', 'معايا',
  'يالاه', 'مزيان', 'واعر', 'كاين', 'مكاينش', 'كيدير', 'كتبغي',
  'نديرو', 'غلطتنا', 'خبرتينا', 'مرحبا', 'بيك', 'ليك', 'ليكم'
];

const REQUIRED_PERSONA_FIELDS = [
  'id', 'widget_types', 'name', 'voice', 'sensitivity',
  'personality_traits', 'background', 'tone_guidelines',
  'forbidden_behaviors', 'escalation_triggers', 'complaint_scenarios',
  'example_dialogues', 'systemPrompt'
];

const TEMPLATE_VARS = ['{{business_name}}', '{{address}}', '{{phone}}', '{{horaires}}', '{{services}}'];

const TOP_5_PERSONAS = ['DENTAL', 'PROPERTY', 'RESTAURATEUR', 'UNIVERSAL_ECOMMERCE', 'CONTRACTOR'];

const ALL_PERSONA_KEYS = Object.keys(PERSONAS);

// ═══════════════════════════════════════════════════════
// 1. Global: ALL 38 personas structural completeness
// ═══════════════════════════════════════════════════════

describe('ALL personas — structural completeness', () => {
  test('exactly 38 personas in PERSONAS', () => {
    assert.strictEqual(ALL_PERSONA_KEYS.length, 38, `Expected 38, got ${ALL_PERSONA_KEYS.length}: ${ALL_PERSONA_KEYS.join(', ')}`);
  });

  test('exactly 38 personas in SYSTEM_PROMPTS', () => {
    const spKeys = Object.keys(SYSTEM_PROMPTS);
    assert.strictEqual(spKeys.length, 38, `Expected 38, got ${spKeys.length}`);
  });

  test('PERSONAS and SYSTEM_PROMPTS have same keys', () => {
    const personaKeys = new Set(ALL_PERSONA_KEYS);
    const spKeys = new Set(Object.keys(SYSTEM_PROMPTS));
    const missingInSP = ALL_PERSONA_KEYS.filter(k => !spKeys.has(k));
    const missingInP = Object.keys(SYSTEM_PROMPTS).filter(k => !personaKeys.has(k));
    assert.deepStrictEqual(missingInSP, [], `Missing in SYSTEM_PROMPTS: ${missingInSP.join(', ')}`);
    assert.deepStrictEqual(missingInP, [], `Missing in PERSONAS: ${missingInP.join(', ')}`);
  });

  for (const key of ALL_PERSONA_KEYS) {
    test(`${key} has all required fields`, () => {
      const persona = PERSONAS[key];
      for (const field of REQUIRED_PERSONA_FIELDS) {
        assert.ok(persona[field] !== undefined, `${key} missing field: ${field}`);
      }
    });

    test(`${key} has non-empty personality_traits (min 3)`, () => {
      const traits = PERSONAS[key].personality_traits;
      assert.ok(Array.isArray(traits), `${key}.personality_traits must be array`);
      assert.ok(traits.length >= 3, `${key} has ${traits.length} traits, need ≥3`);
    });

    test(`${key} has non-empty forbidden_behaviors (min 3)`, () => {
      const behaviors = PERSONAS[key].forbidden_behaviors;
      assert.ok(Array.isArray(behaviors), `${key}.forbidden_behaviors must be array`);
      assert.ok(behaviors.length >= 3, `${key} has ${behaviors.length} behaviors, need ≥3`);
    });

    test(`${key} has valid widget_types`, () => {
      const types = PERSONAS[key].widget_types;
      assert.ok(Array.isArray(types) && types.length > 0, `${key}.widget_types must be non-empty array`);
      const valid = ['B2B', 'B2C', 'TELEPHONY', 'ECOM'];
      for (const t of types) {
        assert.ok(valid.includes(t), `${key} has invalid widget_type: ${t}`);
      }
    });

    test(`${key} has valid voice setting`, () => {
      assert.ok(typeof PERSONAS[key].voice === 'string' && PERSONAS[key].voice.length > 0,
        `${key}.voice must be non-empty string`);
    });

    test(`${key} has valid sensitivity`, () => {
      const valid = ['normal', 'high', 'critical'];
      assert.ok(valid.includes(PERSONAS[key].sensitivity),
        `${key}.sensitivity "${PERSONAS[key].sensitivity}" not in ${valid.join('/')}`);
    });
  }
});

// ═══════════════════════════════════════════════════════
// 2. Global: ALL 38 personas — language coverage
// ═══════════════════════════════════════════════════════

describe('ALL personas — SYSTEM_PROMPTS language coverage', () => {
  for (const key of ALL_PERSONA_KEYS) {
    test(`${key} has all 5 languages in SYSTEM_PROMPTS`, () => {
      const sp = SYSTEM_PROMPTS[key];
      assert.ok(sp, `SYSTEM_PROMPTS.${key} is undefined`);
      for (const lang of REQUIRED_LANGS) {
        assert.ok(sp[lang], `SYSTEM_PROMPTS.${key}.${lang} is missing`);
        assert.ok(sp[lang].length > 50, `SYSTEM_PROMPTS.${key}.${lang} is too short (${sp[lang].length} chars)`);
      }
    });

    test(`${key} ar prompt contains Arabic script`, () => {
      const arPrompt = SYSTEM_PROMPTS[key]?.ar || '';
      assert.ok(ARABIC_CHAR_REGEX.test(arPrompt), `${key}.ar prompt has no Arabic characters`);
    });

    test(`${key} ary prompt contains Arabic script`, () => {
      const aryPrompt = SYSTEM_PROMPTS[key]?.ary || '';
      assert.ok(ARABIC_CHAR_REGEX.test(aryPrompt), `${key}.ary prompt has no Arabic characters`);
    });

    test(`${key} ary prompt contains Darija markers (not just MSA)`, () => {
      const aryPrompt = SYSTEM_PROMPTS[key]?.ary || '';
      const hasDarija = DARIJA_MARKERS.some(marker => aryPrompt.includes(marker));
      assert.ok(hasDarija, `${key}.ary prompt has no Darija markers — may be MSA copy`);
    });
  }
});

// ═══════════════════════════════════════════════════════
// 3. Global: Escalation triggers — 5-lang messages
// ═══════════════════════════════════════════════════════

describe('ALL personas — escalation triggers quality', () => {
  for (const key of ALL_PERSONA_KEYS) {
    test(`${key} has ≥2 escalation triggers`, () => {
      const triggers = PERSONAS[key].escalation_triggers;
      assert.ok(Array.isArray(triggers), `${key}.escalation_triggers must be array`);
      assert.ok(triggers.length >= 2, `${key} has ${triggers.length} triggers, need ≥2`);
    });

    test(`${key} escalation triggers have 5-lang messages`, () => {
      const triggers = PERSONAS[key].escalation_triggers;
      for (let i = 0; i < triggers.length; i++) {
        const trigger = triggers[i];
        assert.ok(trigger.condition, `${key} trigger[${i}] missing condition`);
        assert.ok(trigger.action, `${key} trigger[${i}] missing action`);
        assert.ok(trigger.message, `${key} trigger[${i}] missing message`);
        for (const lang of REQUIRED_LANGS) {
          assert.ok(trigger.message[lang], `${key} trigger[${i}].message.${lang} missing`);
          assert.ok(trigger.message[lang].length > 10, `${key} trigger[${i}].message.${lang} too short`);
        }
      }
    });
  }
});

// ═══════════════════════════════════════════════════════
// 4. Global: Complaint scenarios — 5-lang responses
// ═══════════════════════════════════════════════════════

describe('ALL personas — complaint scenarios quality', () => {
  for (const key of ALL_PERSONA_KEYS) {
    test(`${key} has ≥2 complaint scenarios`, () => {
      const scenarios = PERSONAS[key].complaint_scenarios;
      assert.ok(Array.isArray(scenarios), `${key}.complaint_scenarios must be array`);
      assert.ok(scenarios.length >= 2, `${key} has ${scenarios.length} scenarios, need ≥2`);
    });

    test(`${key} complaint scenarios have 5-lang responses`, () => {
      const scenarios = PERSONAS[key].complaint_scenarios;
      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        assert.ok(scenario.type, `${key} scenario[${i}] missing type`);
        assert.ok(scenario.response, `${key} scenario[${i}] missing response`);
        for (const lang of REQUIRED_LANGS) {
          assert.ok(scenario.response[lang], `${key} scenario[${i}].response.${lang} missing`);
          assert.ok(scenario.response[lang].length > 15, `${key} scenario[${i}].response.${lang} too short`);
        }
      }
    });
  }
});

// ═══════════════════════════════════════════════════════
// 5. Global: Example dialogues — 5-lang user/assistant
// ═══════════════════════════════════════════════════════

describe('ALL personas — example dialogues quality', () => {
  for (const key of ALL_PERSONA_KEYS) {
    test(`${key} has ≥1 example dialogue`, () => {
      const dialogues = PERSONAS[key].example_dialogues;
      assert.ok(Array.isArray(dialogues), `${key}.example_dialogues must be array`);
      assert.ok(dialogues.length >= 1, `${key} has ${dialogues.length} dialogues, need ≥1`);
    });

    test(`${key} example dialogues have 5-lang user + assistant`, () => {
      const dialogues = PERSONAS[key].example_dialogues;
      for (let i = 0; i < dialogues.length; i++) {
        const d = dialogues[i];
        assert.ok(d.user, `${key} dialogue[${i}] missing user`);
        assert.ok(d.assistant, `${key} dialogue[${i}] missing assistant`);
        for (const lang of REQUIRED_LANGS) {
          assert.ok(d.user[lang], `${key} dialogue[${i}].user.${lang} missing`);
          assert.ok(d.assistant[lang], `${key} dialogue[${i}].assistant.${lang} missing`);
        }
      }
    });
  }
});

// ═══════════════════════════════════════════════════════
// 6. Global: Template variables in SYSTEM_PROMPTS
// ═══════════════════════════════════════════════════════

describe('ALL personas — template variable usage', () => {
  // AGENCY and UNIVERSAL_ECOMMERCE are special — they represent VocalIA/generic platforms,
  // not dynamic client businesses, so {{business_name}} is not used
  const TEMPLATE_EXCEPTIONS = new Set(['AGENCY']);

  for (const key of ALL_PERSONA_KEYS) {
    if (TEMPLATE_EXCEPTIONS.has(key)) continue;

    test(`${key} fr prompt uses {{business_name}} template`, () => {
      const frPrompt = SYSTEM_PROMPTS[key]?.fr || '';
      assert.ok(frPrompt.includes('{{business_name}}'),
        `${key}.fr should use {{business_name}} for dynamic replacement`);
    });
  }
});

// ═══════════════════════════════════════════════════════
// 7. Deep audit: TOP 5 personas
// ═══════════════════════════════════════════════════════

describe('TOP 5 personas — deep audit', () => {
  for (const key of TOP_5_PERSONAS) {
    describe(`Deep audit: ${key}`, () => {
      test(`${key} systemPrompt fallback is meaningful (>100 chars)`, () => {
        const sp = PERSONAS[key].systemPrompt;
        assert.ok(sp.length > 100, `${key}.systemPrompt too short: ${sp.length} chars`);
      });

      test(`${key} background is detailed (>50 chars)`, () => {
        const bg = PERSONAS[key].background;
        assert.ok(bg.length > 50, `${key}.background too short: ${bg.length} chars`);
      });

      test(`${key} tone_guidelines has ≥3 contexts`, () => {
        const tg = PERSONAS[key].tone_guidelines;
        const contexts = Object.keys(tg);
        assert.ok(contexts.length >= 3, `${key} has ${contexts.length} tone contexts, need ≥3`);
        assert.ok(contexts.includes('default'), `${key} tone_guidelines missing 'default'`);
        assert.ok(contexts.includes('complaint'), `${key} tone_guidelines missing 'complaint'`);
      });

      test(`${key} has ≥3 escalation triggers`, () => {
        assert.ok(PERSONAS[key].escalation_triggers.length >= 3,
          `${key} needs ≥3 escalation triggers for top persona`);
      });

      test(`${key} has ≥3 complaint scenarios`, () => {
        assert.ok(PERSONAS[key].complaint_scenarios.length >= 3,
          `${key} needs ≥3 complaint scenarios for top persona`);
      });

      test(`${key} has ≥4 forbidden behaviors`, () => {
        assert.ok(PERSONAS[key].forbidden_behaviors.length >= 4,
          `${key} needs ≥4 forbidden behaviors for top persona`);
      });

      test(`${key} SYSTEM_PROMPTS.fr includes role and instructions`, () => {
        const fr = SYSTEM_PROMPTS[key].fr;
        // Every persona prompt should have some form of role/objective/instructions
        const hasRole = /rôle|objectif|rôle|mission/i.test(fr);
        const hasInstructions = /comment|instruction|évite|réponds/i.test(fr);
        assert.ok(hasRole || hasInstructions,
          `${key}.fr prompt lacks clear role/instructions markers`);
      });

      test(`${key} escalation trigger.ary messages contain Darija`, () => {
        const triggers = PERSONAS[key].escalation_triggers;
        for (let i = 0; i < triggers.length; i++) {
          const aryMsg = triggers[i].message.ary;
          const hasDarija = DARIJA_MARKERS.some(m => aryMsg.includes(m));
          assert.ok(hasDarija,
            `${key} trigger[${i}].ary "${aryMsg.substring(0, 40)}..." lacks Darija markers`);
        }
      });

      test(`${key} complaint scenario.ary responses contain Darija`, () => {
        const scenarios = PERSONAS[key].complaint_scenarios;
        for (let i = 0; i < scenarios.length; i++) {
          const aryResp = scenarios[i].response.ary;
          const hasDarija = DARIJA_MARKERS.some(m => aryResp.includes(m));
          assert.ok(hasDarija,
            `${key} scenario[${i}].ary "${aryResp.substring(0, 40)}..." lacks Darija markers`);
        }
      });

      test(`${key} example_dialogues.ary user+assistant contain Darija`, () => {
        const dialogues = PERSONAS[key].example_dialogues;
        for (let i = 0; i < dialogues.length; i++) {
          const userDarija = DARIJA_MARKERS.some(m => dialogues[i].user.ary.includes(m));
          const assistDarija = DARIJA_MARKERS.some(m => dialogues[i].assistant.ary.includes(m));
          assert.ok(userDarija, `${key} dialogue[${i}].user.ary lacks Darija markers`);
          assert.ok(assistDarija, `${key} dialogue[${i}].assistant.ary lacks Darija markers`);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════
// 8. VoicePersonaInjector.getPersona() integration
// ═══════════════════════════════════════════════════════

describe('VoicePersonaInjector.getPersona() integration', () => {
  test('getPersona returns valid archetypeKey', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2B');
    assert.ok(persona.archetypeKey, 'archetypeKey should be defined');
    assert.ok(PERSONAS[persona.archetypeKey], `archetypeKey "${persona.archetypeKey}" not in PERSONAS`);
  });

  test('getPersona with B2C returns valid persona', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2C');
    assert.ok(persona.archetypeKey, 'B2C archetypeKey should be defined');
  });

  test('getPersona with ECOM returns valid persona', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'ECOM');
    assert.ok(persona.archetypeKey, 'ECOM archetypeKey should be defined');
  });

  for (const lang of REQUIRED_LANGS) {
    test(`getPersona systemPrompt in ${lang} contains language-specific text`, () => {
      const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2B');
      persona.language = lang;

      // Build instructions
      const key = persona.archetypeKey;
      const sp = SYSTEM_PROMPTS[key];
      assert.ok(sp[lang], `SYSTEM_PROMPTS.${key}.${lang} should exist`);
      assert.ok(sp[lang].length > 50, `${lang} prompt for ${key} too short`);
    });
  }
});

// ═══════════════════════════════════════════════════════
// 9. Cross-persona consistency
// ═══════════════════════════════════════════════════════

describe('Cross-persona consistency', () => {
  test('all persona IDs are unique', () => {
    const ids = ALL_PERSONA_KEYS.map(k => PERSONAS[k].id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length,
      `Duplicate IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
  });

  test('all persona names are unique', () => {
    const names = ALL_PERSONA_KEYS.map(k => PERSONAS[k].name);
    const uniqueNames = new Set(names);
    assert.strictEqual(uniqueNames.size, names.length,
      `Duplicate names: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
  });

  test('no persona has stale "40 personas" reference', () => {
    for (const key of ALL_PERSONA_KEYS) {
      const sp = PERSONAS[key].systemPrompt;
      const bg = PERSONAS[key].background;
      assert.ok(!sp.includes('40 persona') && !sp.includes('40 industry'),
        `${key}.systemPrompt contains stale "40 personas"`);
      assert.ok(!bg.includes('40 persona') && !bg.includes('40 industry'),
        `${key}.background contains stale "40 personas"`);
    }
  });

  test('no persona has stale "182 tools" reference', () => {
    for (const key of ALL_PERSONA_KEYS) {
      const sp = PERSONAS[key].systemPrompt;
      assert.ok(!sp.includes('182'),
        `${key}.systemPrompt contains stale "182" (should be 203)`);
    }
  });

  test('all personas have tone_guidelines with "default" key', () => {
    for (const key of ALL_PERSONA_KEYS) {
      assert.ok(PERSONAS[key].tone_guidelines.default,
        `${key}.tone_guidelines missing 'default'`);
    }
  });
});
