#!/usr/bin/env node
/**
 * Test SYSTEM_PROMPTS structure
 */

// Read the file to check SYSTEM_PROMPTS
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../personas/voice-persona-injector.cjs'), 'utf8');

// Check if SYSTEM_PROMPTS is exported
console.log('=== SYSTEM_PROMPTS Analysis ===\n');
console.log('1. SYSTEM_PROMPTS in exports:', code.includes('SYSTEM_PROMPTS'));
console.log('   - module.exports contains SYSTEM_PROMPTS:', code.includes('module.exports') && code.includes('SYSTEM_PROMPTS'));

// Check what's actually exported
const exported = require('../personas/voice-persona-injector.cjs');
console.log('\n2. Exported keys:', Object.keys(exported));

// Check if SYSTEM_PROMPTS exists in the module
const lines = code.split('\n');
let foundSystemPrompts = false;
let agencyKeys = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const SYSTEM_PROMPTS = {') || lines[i].includes('SYSTEM_PROMPTS = {')) {
    foundSystemPrompts = true;
    console.log('\n3. SYSTEM_PROMPTS found at line:', i + 1);
  }
  if (foundSystemPrompts && lines[i].includes('AGENCY: {')) {
    console.log('   AGENCY block at line:', i + 1);
    // Look for language keys
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      if (lines[j].match(/^\s+(fr|en|es|ar|ary):/)) {
        agencyKeys.push(lines[j].trim().split(':')[0]);
      }
      if (lines[j].includes('}') && !lines[j].includes('{')) break;
    }
    break;
  }
}

console.log('   AGENCY language keys found:', agencyKeys.join(', '));

// Check inject function logic
const injectLine = code.indexOf('static inject(');
const archetypeKeyLine = code.indexOf('archetypeKey && SYSTEM_PROMPTS[archetypeKey]');
console.log('\n4. inject() function at line:', code.substring(0, injectLine).split('\n').length);
console.log('   SYSTEM_PROMPTS lookup check:', archetypeKeyLine > 0 ? 'Found' : 'Not found');

// Check the actual module.exports line
const exportMatch = code.match(/module\.exports\s*=\s*\{([^}]+)\}/);
if (exportMatch) {
  console.log('\n5. module.exports contents:', exportMatch[1].trim());
}
