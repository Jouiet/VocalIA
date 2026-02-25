#!/usr/bin/env node
/**
 * VocalIA i18n Translation Script
 * Session 250.87 - Fix 7,143 untranslated keys
 * Uses Gemini API for batch translation
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../website/src/locales');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Target languages with context
const LANG_CONFIG = {
  en: { name: 'English', context: 'Professional business English for a Voice AI SaaS platform' },
  es: { name: 'Spanish', context: 'Professional Spanish (Spain) for a Voice AI SaaS platform' },
  ar: { name: 'Arabic (MSA)', context: 'Modern Standard Arabic for a Voice AI SaaS platform, formal business tone' },
  ary: { name: 'Moroccan Darija', context: 'Moroccan Arabic (Darija) for a Voice AI platform, casual but professional' }
};

// Load all locales
function loadLocales() {
  const locales = {};
  for (const locale of ['fr', 'en', 'es', 'ar', 'ary']) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    locales[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return locales;
}

// Get all keys recursively
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

// Get nested value
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Set nested value
function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Find untranslated keys (value equals FR value)
function findUntranslatedKeys(frLocale, targetLocale) {
  const frKeys = getAllKeys(frLocale);
  const untranslated = [];
  
  for (const key of frKeys) {
    const frValue = getNestedValue(frLocale, key);
    const targetValue = getNestedValue(targetLocale, key);
    
    if (typeof frValue === 'string' && frValue === targetValue) {
      untranslated.push({ key, value: frValue });
    }
  }
  return untranslated;
}

// Batch translate using Gemini
async function translateBatch(texts, targetLang, batchNum, totalBatches) {
  const config = LANG_CONFIG[targetLang];
  
  const prompt = `Translate the following French texts to ${config.name}.
Context: ${config.context}

IMPORTANT RULES:
1. Keep JSON keys/values format (translate only the value part after ":")
2. Keep technical terms like "VocalIA", "Widget", "API", "CRM", "B2B", "BANT", "ROI" unchanged
3. Keep numbers, percentages, currency symbols unchanged
4. For Arabic (ar/ary): use appropriate RTL punctuation
5. Keep placeholders like {variable} or {{variable}} unchanged
6. Be concise but professional

Input format: "key": "French text"
Output format: "key": "Translated text"

---
${texts.map(t => `"${t.key}": "${t.value}"`).join('\n')}
---

Return ONLY the translated key-value pairs, one per line.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        })
      }
    );
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      console.error(`[${targetLang}] Batch ${batchNum}/${totalBatches}: API error`);
      return {};
    }
    
    const text = data.candidates[0].content.parts[0].text;
    const translations = {};
    
    // Parse responses
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/"([^"]+)":\s*"(.+)"/);
      if (match) {
        translations[match[1]] = match[2];
      }
    }
    
    console.log(`[${targetLang}] Batch ${batchNum}/${totalBatches}: ${Object.keys(translations).length}/${texts.length} translated`);
    return translations;
    
  } catch (error) {
    console.error(`[${targetLang}] Batch ${batchNum}/${totalBatches}: ${error.message}`);
    return {};
  }
}

// Main translation function
async function translateLocale(targetLang, maxKeys = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Translating to ${LANG_CONFIG[targetLang].name}`);
  console.log(`${'='.repeat(60)}`);
  
  const locales = loadLocales();
  const untranslated = findUntranslatedKeys(locales.fr, locales[targetLang]);
  
  console.log(`Found ${untranslated.length} untranslated keys`);
  
  // Limit for testing
  const toTranslate = untranslated.slice(0, maxKeys);
  console.log(`Processing ${toTranslate.length} keys (limit: ${maxKeys})`);
  
  // Batch translate (50 at a time to avoid token limits)
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }
  
  let totalTranslated = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const translations = await translateBatch(batches[i], targetLang, i + 1, batches.length);
    
    // Apply translations
    for (const [key, value] of Object.entries(translations)) {
      setNestedValue(locales[targetLang], key, value);
      totalTranslated++;
    }
    
    // Rate limit: 100ms between batches
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Save updated locale
  const outputPath = path.join(LOCALES_DIR, `${targetLang}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(locales[targetLang], null, 2) + '\n', 'utf8');
  
  console.log(`\n✅ ${targetLang}: ${totalTranslated}/${toTranslate.length} keys translated`);
  console.log(`   Saved to: ${outputPath}`);
  
  return totalTranslated;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const lang = args[0] || 'en';
  const limit = parseInt(args[1]) || 100;
  
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }
  
  if (lang === 'all') {
    for (const targetLang of ['en', 'es', 'ar', 'ary']) {
      await translateLocale(targetLang, limit);
    }
  } else {
    await translateLocale(lang, limit);
  }
}

main().catch(console.error);
