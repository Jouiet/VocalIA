#!/usr/bin/env node
/**
 * Batch translation using Gemini API
 * Session 250.44
 *
 * Run: node scripts/batch-translate-gemini.cjs
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../website/src/locales');
const DATA_DIR = path.join(__dirname, '../data');
const BATCH_SIZE = 40;

const LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  ar: 'Modern Standard Arabic',
  ary: 'Moroccan Arabic (Darija)'
};

// Load French locale
function loadFrenchKeys() {
  const frFile = path.join(LOCALES_DIR, 'fr.json');
  return JSON.parse(fs.readFileSync(frFile, 'utf8'));
}

// Extract leaf keys
function extractLeaves(obj, prefix = '') {
  const leaves = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(leaves, extractLeaves(v, key));
    } else {
      leaves[key] = v;
    }
  }
  return leaves;
}

// Split into batches
function splitIntoBatches(obj, size) {
  const entries = Object.entries(obj);
  const batches = [];
  for (let i = 0; i < entries.length; i += size) {
    batches.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return batches;
}

// Generate translation prompts
function generatePrompts() {
  const frData = loadFrenchKeys();
  const allKeys = extractLeaves(frData);
  const batches = splitIntoBatches(allKeys, BATCH_SIZE);

  console.log(`Total keys: ${Object.keys(allKeys).length}`);
  console.log(`Batches: ${batches.length}`);
  console.log(`Languages: ${Object.values(LANGUAGES).join(', ')}`);
  console.log(`Total API calls needed: ${batches.length * Object.keys(LANGUAGES).length}`);

  // Save batches for reference
  fs.writeFileSync(
    path.join(DATA_DIR, 'translation_batches.json'),
    JSON.stringify(batches, null, 2)
  );

  // Generate MCP command templates
  const commands = [];
  for (let i = 0; i < batches.length; i++) {
    for (const [lang, langName] of Object.entries(LANGUAGES)) {
      commands.push({
        batch: i,
        lang,
        langName,
        keysCount: Object.keys(batches[i]).length
      });
    }
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'translation_commands.json'),
    JSON.stringify(commands, null, 2)
  );

  console.log(`\nSaved ${commands.length} command templates to data/translation_commands.json`);
  console.log('\nTo translate, use the Gemini MCP tool with each batch.');
}

// Update locale file with translations
function updateLocale(lang, translations) {
  const localeFile = path.join(LOCALES_DIR, `${lang}.json`);
  let existing = {};

  try {
    existing = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
  } catch (e) {
    console.log(`Creating new ${lang}.json`);
  }

  // Merge translations (nested structure)
  for (const [key, value] of Object.entries(translations)) {
    const parts = key.split('.');
    let current = existing;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  fs.writeFileSync(localeFile, JSON.stringify(existing, null, 2));
  console.log(`Updated ${lang}.json with ${Object.keys(translations).length} keys`);
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'generate') {
    generatePrompts();
  } else if (args[0] === 'update' && args[1] && args[2]) {
    // node script.cjs update en '{"key":"value"}'
    const lang = args[1];
    const translations = JSON.parse(args[2]);
    updateLocale(lang, translations);
  } else {
    console.log('Usage:');
    console.log('  node batch-translate-gemini.cjs generate');
    console.log('  node batch-translate-gemini.cjs update <lang> <json>');
  }
}

module.exports = { loadFrenchKeys, extractLeaves, splitIntoBatches, updateLocale };
