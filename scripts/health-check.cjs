#!/usr/bin/env node
/**
 * VocalIA Health Check
 *
 * Quick verification of all modules without starting servers.
 * Usage: node scripts/health-check.cjs
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

console.log(`\n${COLORS.cyan}╔══════════════════════════════════════════════════════════════╗${COLORS.reset}`);
console.log(`${COLORS.cyan}║              VocalIA Health Check v1.0                        ║${COLORS.reset}`);
console.log(`${COLORS.cyan}╚══════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);

const modules = {
  'Core': [
    'core/AgencyEventBus.cjs',
    'core/ContextBox.cjs',
    'core/BillingAgent.cjs',
    'core/ErrorScience.cjs',
    'core/RevenueScience.cjs',
    'core/marketing-science-core.cjs',
    'core/knowledge-base-services.cjs'
  ],
  'Integrations': [
    'integrations/hubspot-b2b-crm.cjs',
    'integrations/voice-ecommerce-tools.cjs',
    'integrations/voice-crm-tools.cjs'
  ],
  'Personas': [
    'personas/voice-persona-injector.cjs',
    'personas/agency-financial-config.cjs'
  ],
  'Sensors': [
    'sensors/voice-quality-sensor.cjs',
    'sensors/cost-tracking-sensor.cjs',
    'sensors/lead-velocity-sensor.cjs',
    'sensors/retention-sensor.cjs'
  ],
  'Widget': [
    'widget/voice-widget-templates.cjs'
  ],
  'Knowledge Base': [
    'knowledge-base/src/vector-store.cjs',
    'knowledge-base/src/rag-query.cjs',
    'knowledge-base/src/catalog-extractor.cjs'
  ]
};

let totalOk = 0;
let totalFail = 0;

for (const [category, paths] of Object.entries(modules)) {
  console.log(`${COLORS.cyan}${category}:${COLORS.reset}`);

  for (const modulePath of paths) {
    const fullPath = path.join(__dirname, '..', modulePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`  ${COLORS.red}❌ ${modulePath} (NOT FOUND)${COLORS.reset}`);
      totalFail++;
      continue;
    }

    try {
      require(fullPath);
      console.log(`  ${COLORS.green}✅ ${path.basename(modulePath)}${COLORS.reset}`);
      totalOk++;
    } catch (e) {
      console.log(`  ${COLORS.red}❌ ${path.basename(modulePath)}: ${e.message.split('\n')[0]}${COLORS.reset}`);
      totalFail++;
    }
  }
  console.log('');
}

// Check config files
console.log(`${COLORS.cyan}Configuration:${COLORS.reset}`);
const configFiles = [
  '.mcp.json',
  'automations-registry.json',
  'data/pressure-matrix.json',
  'package.json'
];

for (const file of configFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ${COLORS.green}✅ ${file}${COLORS.reset}`);
    totalOk++;
  } else {
    console.log(`  ${COLORS.red}❌ ${file} (NOT FOUND)${COLORS.reset}`);
    totalFail++;
  }
}

// Check rules
console.log(`\n${COLORS.cyan}Rules:${COLORS.reset}`);
const rulesDir = path.join(__dirname, '..', '.claude/rules');
if (fs.existsSync(rulesDir)) {
  const rules = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
  console.log(`  ${COLORS.green}✅ ${rules.length} rules found${COLORS.reset}`);
  totalOk++;
} else {
  console.log(`  ${COLORS.red}❌ No rules directory${COLORS.reset}`);
  totalFail++;
}

// Summary
console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
console.log(`${COLORS.cyan}Summary:${COLORS.reset}`);
console.log(`  ${COLORS.green}✅ Passed: ${totalOk}${COLORS.reset}`);
console.log(`  ${COLORS.red}❌ Failed: ${totalFail}${COLORS.reset}`);
console.log(`  📊 Score: ${Math.round((totalOk / (totalOk + totalFail)) * 100)}%`);

if (totalFail === 0) {
  console.log(`\n${COLORS.green}🎉 All checks passed!${COLORS.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${COLORS.yellow}⚠️ Some checks failed${COLORS.reset}\n`);
  process.exit(1);
}
