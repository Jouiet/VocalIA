/**
 * Analyze Archetypes for Enrichment
 * Session 250.97quater - Quality Improvement
 */

const { SYSTEM_PROMPTS } = require('../personas/voice-persona-injector.cjs');

// AGENCY is VocalIA's internal widget - EXCLUDE from multi-tenant work
const EXCLUDE = ['AGENCY'];

const archetypes = Object.keys(SYSTEM_PROMPTS).filter(k => EXCLUDE.indexOf(k) === -1);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  ARCHETYPES STATUS - MULTI-TENANT ONLY (excl. AGENCY)');
console.log('═══════════════════════════════════════════════════════════════════\n');

const results = [];
const needsEnrichment = [];

for (const arch of archetypes) {
  const fr = SYSTEM_PROMPTS[arch]?.fr || '';
  const len = fr.length;

  // Check tone indicators
  const indicators = ['bonjour', 'bienvenue', 'service', 'client', 'aide'];
  const found = indicators.filter(i => fr.toLowerCase().includes(i));
  const missing = indicators.filter(i => fr.toLowerCase().indexOf(i) === -1);

  // Check templates
  const hasTemplates = fr.includes('{{business_name}}');

  // Status determination
  const lengthOK = len >= 1000;
  const toneOK = found.length === 5;
  const status = lengthOK && toneOK ? 'PERFECT' :
                 len >= 500 ? 'GOOD' : 'NEEDS_WORK';

  results.push({ arch, len, found: found.length, missing, hasTemplates, status, lengthOK, toneOK });

  if (status !== 'PERFECT') {
    needsEnrichment.push({ arch, len, missing, hasTemplates });
  }
}

// Sort by length (shortest first = most work needed)
results.sort((a, b) => a.len - b.len);

console.log('| Archetype            | Chars | Templates | Tone  | Length OK | Status |');
console.log('|:---------------------|------:|:---------:|:-----:|:---------:|:------:|');

for (const r of results) {
  const tIcon = r.hasTemplates ? '✅' : '❌';
  const toneIcon = r.toneOK ? '✅' : `${r.found}/5`;
  const lenIcon = r.lengthOK ? '✅' : '❌';
  const statusIcon = r.status === 'PERFECT' ? '✅' : r.status === 'GOOD' ? '⚠️' : '❌';
  console.log(`| ${r.arch.padEnd(20)} | ${String(r.len).padStart(5)} | ${tIcon}        | ${String(toneIcon).padEnd(5)} | ${lenIcon}        | ${statusIcon}     |`);
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Total archetypes (excl. AGENCY): ${results.length}`);
console.log(`PERFECT (1000+ chars, 5/5 tone): ${results.filter(r => r.status === 'PERFECT').length}`);
console.log(`GOOD (500-999 chars): ${results.filter(r => r.status === 'GOOD').length}`);
console.log(`NEEDS_WORK (<500 chars): ${results.filter(r => r.status === 'NEEDS_WORK').length}`);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  ARCHETYPES REQUIRING ENRICHMENT');
console.log('═══════════════════════════════════════════════════════════════════\n');

needsEnrichment.sort((a, b) => a.len - b.len);
for (const e of needsEnrichment) {
  console.log(`${e.arch}:`);
  console.log(`  Current: ${e.len} chars`);
  console.log(`  Has templates: ${e.hasTemplates ? 'Yes' : 'No'}`);
  console.log(`  Missing tone: ${e.missing.join(', ') || 'None'}`);
  console.log(`  Gap to 1000: +${1000 - e.len} chars needed`);
  console.log();
}

// Export for script use
module.exports = { needsEnrichment, results };
