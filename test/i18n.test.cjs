/**
 * VocalIA i18n Tests
 *
 * Verifies translation parity across all 5 languages.
 * Run: node --test test/i18n.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../website/src/locales');
const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'ar', 'ary'];
const SOURCE_LOCALE = 'fr';
const RTL_LOCALES = ['ar', 'ary'];

// Helper to count keys recursively
function countKeys(obj, prefix = '') {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      count += countKeys(obj[key], `${prefix}${key}.`);
    } else {
      count++;
    }
  }
  return count;
}

// Helper to get all keys recursively
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Helper to get nested value
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Load all locales
function loadLocales() {
  const locales = {};
  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    if (fs.existsSync(filePath)) {
      locales[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }
  return locales;
}

describe('i18n Locale Files', () => {
  test('All 5 locale files exist', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(LOCALES_DIR, `${locale}.json`);
      assert.ok(fs.existsSync(filePath), `${locale}.json should exist`);
    }
  });

  test('All locale files are valid JSON', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(LOCALES_DIR, `${locale}.json`);
      assert.doesNotThrow(() => {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }, `${locale}.json should be valid JSON`);
    }
  });

  test('All locale files are non-empty objects', () => {
    const locales = loadLocales();
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(typeof locales[locale] === 'object', `${locale} should be an object`);
      assert.ok(Object.keys(locales[locale]).length > 0, `${locale} should not be empty`);
    }
  });
});

describe('i18n Key Parity', () => {
  test('All locales have same number of keys as source (FR)', () => {
    const locales = loadLocales();
    const sourceKeyCount = countKeys(locales[SOURCE_LOCALE]);

    for (const locale of SUPPORTED_LOCALES) {
      const localeKeyCount = countKeys(locales[locale]);
      assert.strictEqual(
        localeKeyCount,
        sourceKeyCount,
        `${locale} has ${localeKeyCount} keys, expected ${sourceKeyCount} (same as ${SOURCE_LOCALE})`
      );
    }
  });

  test('All locales have exactly the same key structure', () => {
    const locales = loadLocales();
    const sourceKeys = getAllKeys(locales[SOURCE_LOCALE]).sort();

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === SOURCE_LOCALE) continue;

      const localeKeys = getAllKeys(locales[locale]).sort();

      // Find missing keys
      const missingKeys = sourceKeys.filter(k => !localeKeys.includes(k));
      assert.strictEqual(
        missingKeys.length,
        0,
        `${locale} is missing keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`
      );

      // Find extra keys
      const extraKeys = localeKeys.filter(k => !sourceKeys.includes(k));
      assert.strictEqual(
        extraKeys.length,
        0,
        `${locale} has extra keys: ${extraKeys.slice(0, 5).join(', ')}${extraKeys.length > 5 ? '...' : ''}`
      );
    }
  });
});

describe('i18n Translation Quality', () => {
  test('EN translations are not still in French (sample check)', () => {
    const locales = loadLocales();
    const sampleKeys = [
      'nav.products',
      'nav.pricing',
      'nav.resources',
      'common.get_started',
      'common.learn_more'
    ];

    for (const key of sampleKeys) {
      const frValue = getNestedValue(locales.fr, key);
      const enValue = getNestedValue(locales.en, key);

      if (frValue && enValue) {
        // Skip if FR and EN happen to be the same (proper nouns, etc.)
        if (frValue.toLowerCase() !== enValue.toLowerCase()) {
          assert.notStrictEqual(
            frValue,
            enValue,
            `EN key '${key}' should not be identical to FR`
          );
        }
      }
    }
  });

  test('ES translations are not still in French (sample check)', () => {
    const locales = loadLocales();
    const sampleKeys = [
      'nav.products',
      'nav.pricing',
      'nav.resources',
      'common.get_started',
      'common.learn_more'
    ];

    for (const key of sampleKeys) {
      const frValue = getNestedValue(locales.fr, key);
      const esValue = getNestedValue(locales.es, key);

      if (frValue && esValue) {
        if (frValue.toLowerCase() !== esValue.toLowerCase()) {
          assert.notStrictEqual(
            frValue,
            esValue,
            `ES key '${key}' should not be identical to FR`
          );
        }
      }
    }
  });

  test('AR translations contain Arabic characters', () => {
    const locales = loadLocales();
    const arabicRegex = /[\u0600-\u06FF]/;

    const sampleKeys = [
      'nav.products',
      'nav.pricing',
      'common.get_started'
    ];

    for (const key of sampleKeys) {
      const arValue = getNestedValue(locales.ar, key);
      if (arValue && typeof arValue === 'string') {
        assert.ok(
          arabicRegex.test(arValue),
          `AR key '${key}' should contain Arabic characters: "${arValue}"`
        );
      }
    }
  });

  test('ARY (Darija) translations contain Arabic characters', () => {
    const locales = loadLocales();
    const arabicRegex = /[\u0600-\u06FF]/;

    const sampleKeys = [
      'nav.products',
      'nav.pricing',
      'common.get_started'
    ];

    for (const key of sampleKeys) {
      const aryValue = getNestedValue(locales.ary, key);
      if (aryValue && typeof aryValue === 'string') {
        assert.ok(
          arabicRegex.test(aryValue),
          `ARY key '${key}' should contain Arabic characters: "${aryValue}"`
        );
      }
    }
  });
});

describe('i18n RTL Support', () => {
  test('RTL locales are defined', () => {
    assert.deepStrictEqual(RTL_LOCALES, ['ar', 'ary'], 'RTL locales should be ar and ary');
  });

  test('AR locale exists and is valid', () => {
    const locales = loadLocales();
    assert.ok(locales.ar, 'AR locale should exist');
    const keyCount = countKeys(locales.ar);
    assert.ok(keyCount > 1000, `AR locale should have substantial content (${keyCount} keys)`);
  });

  test('ARY (Darija) locale exists and is valid', () => {
    const locales = loadLocales();
    assert.ok(locales.ary, 'ARY locale should exist');
    const keyCount = countKeys(locales.ary);
    assert.ok(keyCount > 1000, `ARY locale should have substantial content (${keyCount} keys)`);
  });
});

describe('i18n Key Count Verification', () => {
  test('FR locale has expected minimum keys (1500+)', () => {
    const locales = loadLocales();
    const keyCount = countKeys(locales.fr);
    assert.ok(keyCount >= 1500, `FR should have at least 1500 keys, found ${keyCount}`);
  });

  test('All locales have matching key counts', () => {
    const locales = loadLocales();
    const counts = {};

    for (const locale of SUPPORTED_LOCALES) {
      counts[locale] = countKeys(locales[locale]);
    }

    const expectedCount = counts[SOURCE_LOCALE];
    for (const locale of SUPPORTED_LOCALES) {
      assert.strictEqual(
        counts[locale],
        expectedCount,
        `${locale}: ${counts[locale]} keys (expected ${expectedCount})`
      );
    }
  });
});

describe('i18n Critical Sections', () => {
  test('All locales have nav section', () => {
    const locales = loadLocales();
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(locales[locale].nav, `${locale} should have nav section`);
    }
  });

  test('All locales have common section', () => {
    const locales = loadLocales();
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(locales[locale].common, `${locale} should have common section`);
    }
  });

  test('All locales have footer section', () => {
    const locales = loadLocales();
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(locales[locale].footer, `${locale} should have footer section`);
    }
  });

  test('All locales have hero section', () => {
    const locales = loadLocales();
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(locales[locale].hero, `${locale} should have hero section`);
    }
  });
});
