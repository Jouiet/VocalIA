#!/usr/bin/env node
/**
 * CATALOG EXTRACTOR - Knowledge Base
 * ==================================
 * Extracts structured catalog data from markdown
 * Creates JSON API for products, services, and pricing
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  catalogPath: path.join(__dirname, '../../AAA-AUTOMATIONS-CATALOG-2025.md'),
  businessPath: path.join(__dirname, '../../BUSINESS-MODEL-FACTUEL-2025.md'),
  outputDir: path.join(__dirname, '../data')
};

/**
 * Parse pricing from ASCII art format
 */
function parsePricingTable(content) {
  const packages = [];

  // Find packages section (uses ### not ##)
  const packagesMatch = content.match(/### 6\.1 Packages Agence AAA[\s\S]*?(?=### 6\.2|## 7|$)/);
  if (!packagesMatch) return packages;

  const section = packagesMatch[0];

  // Extract STARTER package
  const starterSetup = section.match(/STARTER[\s\S]*?Setup: \$([0-9,]+)-([0-9,]+)/);
  const starterMonthly = section.match(/STARTER[\s\S]*?Monthly: \$([0-9,]+)-([0-9,]+)/);
  if (starterSetup && starterMonthly) {
    packages.push({
      name: 'STARTER',
      setup: `$${starterSetup[1]}-${starterSetup[2]}`,
      monthly: `$${starterMonthly[1]}-${starterMonthly[2]}`,
      automations: '~15 scripts',
      flows: '3 Klaviyo Flows',
      features: ['Lead Sync (1 source)', 'Basic SEO', 'Weekly reporting', 'Email support']
    });
  }

  // Extract GROWTH package
  const growthSetup = section.match(/GROWTH[\s\S]*?Setup: \$([0-9,]+)-([0-9,]+)/);
  const growthMonthly = section.match(/GROWTH[\s\S]*?Monthly: \$([0-9,]+)-([0-9,]+)/);
  if (growthSetup && growthMonthly) {
    packages.push({
      name: 'GROWTH',
      setup: `$${growthSetup[1]}-${growthSetup[2]}`,
      monthly: `$${growthMonthly[1]}-${growthMonthly[2]}`,
      automations: '~35 scripts',
      flows: '6 Klaviyo Flows',
      features: ['Lead Sync (3 sources)', 'Full SEO automation', 'Daily reporting', 'Slack support', 'Monthly strategy call']
    });
  }

  // Extract SCALE package
  const scaleSetup = section.match(/SCALE[\s\S]*?Setup: \$([0-9,]+)-([0-9,]+)/);
  const scaleMonthly = section.match(/SCALE[\s\S]*?Monthly: \$([0-9,]+)-([0-9,]+)/);
  if (scaleSetup && scaleMonthly) {
    packages.push({
      name: 'SCALE',
      setup: `$${scaleSetup[1]}-${scaleSetup[2]}`,
      monthly: `$${scaleMonthly[1]}-${scaleMonthly[2]}`,
      automations: '~70+ scripts',
      flows: '12+ Klaviyo Flows',
      features: ['All sources', 'Full SEO', 'Real-time reporting', 'Dedicated strategist', 'Custom integrations']
    });
  }

  return packages;
}

/**
 * Parse automations from catalog
 */
function parseAutomations(content) {
  const automations = [];

  // Categories based on actual structure: ### 2.X CATEGORY NAME
  const categories = [
    { id: 'lead_generation', regex: /### 2\.1 LEAD GENERATION & ACQUISITION[\s\S]*?(?=### 2\.2|## 3|$)/, name: 'Lead Generation & Acquisition' },
    { id: 'seo_content', regex: /### 2\.2 SEO & CONTENT AUTOMATION[\s\S]*?(?=### 2\.3|## 3|$)/, name: 'SEO & Content' },
    { id: 'email_sms', regex: /### 2\.3 EMAIL\/SMS MARKETING[\s\S]*?(?=### 2\.4|## 3|$)/, name: 'Email/SMS Marketing' },
    { id: 'shopify', regex: /### 2\.4 SHOPIFY ADMIN AUTOMATION[\s\S]*?(?=### 2\.5|## 3|$)/, name: 'Shopify Admin' },
    { id: 'analytics', regex: /### 2\.5 ANALYTICS & REPORTING[\s\S]*?(?=### 2\.6|## 3|$)/, name: 'Analytics & Reporting' },
    { id: 'merchant_center', regex: /### 2\.6 GOOGLE MERCHANT CENTER[\s\S]*?(?=### 2\.7|## 3|$)/, name: 'Google Merchant Center' },
    { id: 'video', regex: /### 2\.7 VIDEO GENERATION[\s\S]*?(?=### 2\.8|## 3|$)/, name: 'Video Generation' },
    { id: 'n8n', regex: /### 2\.8 N8N WORKFLOW AUTOMATION[\s\S]*?(?=## 3|$)/, name: 'n8n Workflows' }
  ];

  for (const cat of categories) {
    const match = content.match(cat.regex);
    if (!match) continue;

    const section = match[0];

    // Extract automation entries (#### headers like "#### 2.1.1 Facebook/Meta Lead Ads")
    const entries = section.match(/#### \d+\.\d+\.\d+ [^\n]+/g) || [];

    for (const entry of entries) {
      const nameMatch = entry.match(/#### (\d+\.\d+\.\d+) (.+)/);
      if (nameMatch) {
        automations.push({
          id: nameMatch[1],
          name: nameMatch[2].trim(),
          category: cat.id,
          categoryName: cat.name
        });
      }
    }

    // Also count scripts mentioned in each category header
    const scriptsMatch = cat.name.match(/\((\d+) scripts\)/);
    if (scriptsMatch) {
      // Category-level script count already captured in category info
    }
  }

  return automations;
}

/**
 * Parse services from business model (ASCII art format)
 */
function parseServices(content) {
  const services = [];

  // Find services section (uses ### not ##)
  const servicesMatch = content.match(/### 4\.1 Services Proposés[\s\S]*?(?=### 4\.2|## 5|$)/);
  if (!servicesMatch) return services;

  const section = servicesMatch[0];

  // Extract SERVICE entries from ASCII art
  const serviceMatches = section.match(/SERVICE \d+: [^\n]+/g) || [];
  for (const match of serviceMatches) {
    const nameMatch = match.match(/SERVICE \d+: ([^(]+)/);
    if (nameMatch) {
      services.push({
        name: nameMatch[1].trim(),
        type: 'service'
      });
    }
  }

  // Also extract pricing entries
  const prixMatches = section.match(/Prix: [^\n]+/g) || [];
  for (let i = 0; i < services.length && i < prixMatches.length; i++) {
    services[i].price = prixMatches[i].replace('Prix:', '').trim();
  }

  return services;
}

/**
 * Parse MCPs from CLAUDE.md (table format)
 */
function parseMCPs(claudeContent) {
  const mcps = [];

  // Find MCPs table section
  const mcpMatch = claudeContent.match(/### État MCPs[\s\S]*?\| MCP \| Statut \| Détail \|[\s\S]*?(?=###|$)/);
  if (!mcpMatch) return mcps;

  const section = mcpMatch[0];

  // Parse table rows
  const rows = section.match(/\| [✅⚠️❌] [^|]+ \|[^|]+\|[^|]+\|/g) || [];

  for (const row of rows) {
    const cols = row.split('|').map(c => c.trim()).filter(c => c);
    if (cols.length >= 3) {
      const statusEmoji = cols[0].charAt(0);
      const name = cols[0].replace(/[✅⚠️❌]\s*/, '').trim();
      const status = cols[1].replace(/\*\*/g, '').trim();
      const detail = cols[2].trim();

      let statusCode = 'unknown';
      if (statusEmoji === '✅') statusCode = 'active';
      else if (statusEmoji === '⚠') statusCode = 'warning';
      else if (statusEmoji === '❌') statusCode = 'inactive';

      mcps.push({
        name,
        status: statusCode,
        statusText: status,
        detail
      });
    }
  }

  return mcps;
}

/**
 * Main extraction function
 */
function extractCatalog() {
  console.log('\n' + '═'.repeat(60));
  console.log('  CATALOG EXTRACTOR');
  console.log('═'.repeat(60));

  const catalog = {
    version: '2025.1',
    generated: new Date().toISOString(),
    packages: [],
    automations: [],
    services: [],
    mcps: [],
    stats: {}
  };

  // Extract from AAA-AUTOMATIONS-CATALOG-2025.md
  if (fs.existsSync(CONFIG.catalogPath)) {
    console.log('\n📄 Processing: AAA-AUTOMATIONS-CATALOG-2025.md');
    const content = fs.readFileSync(CONFIG.catalogPath, 'utf-8');

    catalog.packages = parsePricingTable(content);
    console.log(`   └─ Packages: ${catalog.packages.length}`);

    catalog.automations = parseAutomations(content);
    console.log(`   └─ Automations: ${catalog.automations.length}`);
  }

  // Extract from BUSINESS-MODEL-FACTUEL-2025.md
  if (fs.existsSync(CONFIG.businessPath)) {
    console.log('\n📄 Processing: BUSINESS-MODEL-FACTUEL-2025.md');
    const content = fs.readFileSync(CONFIG.businessPath, 'utf-8');

    catalog.services = parseServices(content);
    console.log(`   └─ Services: ${catalog.services.length}`);
  }

  // Extract MCPs from CLAUDE.md
  const claudePath = path.join(__dirname, '../../CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    console.log('\n📄 Processing: CLAUDE.md');
    const content = fs.readFileSync(claudePath, 'utf-8');

    catalog.mcps = parseMCPs(content);
    console.log(`   └─ MCPs: ${catalog.mcps.length}`);
  }

  // Compute stats
  catalog.stats = {
    totalPackages: catalog.packages.length,
    totalAutomations: catalog.automations.length,
    totalServices: catalog.services.length,
    totalMCPs: catalog.mcps.length,
    automationsByCategory: {}
  };

  for (const auto of catalog.automations) {
    catalog.stats.automationsByCategory[auto.category] =
      (catalog.stats.automationsByCategory[auto.category] || 0) + 1;
  }

  // Save catalog
  const outputPath = path.join(CONFIG.outputDir, 'catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('  SUMMARY');
  console.log('─'.repeat(60));
  console.log(`  Packages:     ${catalog.stats.totalPackages}`);
  console.log(`  Automations:  ${catalog.stats.totalAutomations}`);
  console.log(`  Services:     ${catalog.stats.totalServices}`);
  console.log(`  MCPs:         ${catalog.stats.totalMCPs}`);
  console.log('\n  Automations by category:');
  for (const [cat, count] of Object.entries(catalog.stats.automationsByCategory)) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log('\n  Output: ' + outputPath);
  console.log('═'.repeat(60) + '\n');

  return catalog;
}

/**
 * API Functions
 */
function getCatalog() {
  const catalogPath = path.join(CONFIG.outputDir, 'catalog.json');
  if (fs.existsSync(catalogPath)) {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  }
  return extractCatalog();
}

function getPackages() {
  return getCatalog().packages;
}

function getAutomations(category = null) {
  const automations = getCatalog().automations;
  if (category) {
    return automations.filter(a => a.category === category);
  }
  return automations;
}

function getServices() {
  return getCatalog().services;
}

function searchAutomations(query) {
  const automations = getCatalog().automations;
  const queryLower = query.toLowerCase();
  return automations.filter(a =>
    a.name.toLowerCase().includes(queryLower) ||
    a.category.toLowerCase().includes(queryLower)
  );
}

// Run if called directly
if (require.main === module) {
  extractCatalog();
}

module.exports = {
  extractCatalog,
  getCatalog,
  getPackages,
  getAutomations,
  getServices,
  searchAutomations
};
