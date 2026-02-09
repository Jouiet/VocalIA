/**
 * VocalIA MCP Server Structural Validation Tests
 *
 * Validates the MCP server's tool registration structure by parsing
 * the actual TypeScript source code and tool module files.
 * Tests real structure — not source-grep theater.
 *
 * Session 250.171c: Updated to match server.registerTool() + registerModuleTool() patterns
 * + Resources (registerResource) + Prompts (registerPrompt) validation
 *
 * Run: node --test test/mcp-server.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';

const MCP_INDEX_PATH = path.join(import.meta.dirname, '../mcp-server/src/index.ts');
const MCP_TOOLS_DIR = path.join(import.meta.dirname, '../mcp-server/src/tools');
const MCP_DIST_DIR = path.join(import.meta.dirname, '../mcp-server/dist');

// ─── Parse tool registrations from source ───────────────────────────────────

function parseToolRegistrations() {
  const content = fs.readFileSync(MCP_INDEX_PATH, 'utf8');

  // Pattern 1: Inline tools — server.registerTool(\n  "tool_name"
  const inlineRegex = /server\.registerTool\(\s*\n\s*"([^"]+)"/g;
  const inlineTools = [];
  let m;
  while ((m = inlineRegex.exec(content)) !== null) {
    inlineTools.push(m[1]);
  }

  // Pattern 2: External tools — registerModuleTool(xxxTools.yyy)
  const externalRegex = /registerModuleTool\((\w+)\.(\w+)\)/g;
  const externalTools = [];
  while ((m = externalRegex.exec(content)) !== null) {
    externalTools.push({ module: m[1], tool: m[2] });
  }

  return { inlineTools, externalTools, content };
}

const { inlineTools, externalTools, content: indexContent } = parseToolRegistrations();
const allToolNames = [
  ...inlineTools,
  ...externalTools.map(e => `${e.module.replace('Tools', '')}_${e.tool}`)
];

// ─── Tool Count Validation ──────────────────────────────────────────────────

describe('MCP tool count', () => {
  test('exactly 203 total tool registrations', () => {
    const total = inlineTools.length + externalTools.length;
    assert.strictEqual(total, 203, `Expected 203 tools, found ${total} (${inlineTools.length} inline + ${externalTools.length} external)`);
  });

  test('22 inline tools', () => {
    assert.strictEqual(inlineTools.length, 22, `Expected 22 inline tools, found ${inlineTools.length}`);
  });

  test('181 external module tools', () => {
    assert.strictEqual(externalTools.length, 181, `Expected 181 external tools, found ${externalTools.length}`);
  });
});

// ─── Tool Name Quality ──────────────────────────────────────────────────────

describe('MCP tool naming', () => {
  test('no duplicate inline tool names', () => {
    const dupes = inlineTools.filter((t, i) => inlineTools.indexOf(t) !== i);
    assert.strictEqual(dupes.length, 0, `Duplicate inline tools: ${dupes.join(', ')}`);
  });

  test('no duplicate external tool registrations', () => {
    const keys = externalTools.map(e => `${e.module}.${e.tool}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.strictEqual(dupes.length, 0, `Duplicate external tools: ${dupes.join(', ')}`);
  });

  test('all inline tool names are snake_case', () => {
    const bad = inlineTools.filter(t => t !== t.toLowerCase() || t.includes('-'));
    assert.strictEqual(bad.length, 0, `Non-snake_case tools: ${bad.join(', ')}`);
  });

  test('all external tool keys are snake_case', () => {
    const bad = externalTools.filter(e => e.tool !== e.tool.toLowerCase() || e.tool.includes('-'));
    assert.strictEqual(bad.length, 0, `Non-snake_case tools: ${bad.map(e => e.tool).join(', ')}`);
  });
});

// ─── Tool File Existence ────────────────────────────────────────────────────

describe('MCP tool files', () => {
  const expectedFiles = [
    'stripe.ts', 'shopify.ts', 'woocommerce.ts', 'magento.ts', 'wix.ts',
    'squarespace.ts', 'bigcommerce.ts', 'prestashop.ts', 'pipedrive.ts',
    'zoho.ts', 'freshdesk.ts', 'zendesk.ts', 'calendly.ts', 'sheets.ts',
    'drive.ts', 'docs.ts', 'gmail.ts', 'calendar.ts', 'zapier.ts',
    'make.ts', 'n8n.ts', 'slack.ts', 'ucp.ts', 'export.ts', 'email.ts',
    'hubspot.ts', 'klaviyo.ts', 'twilio.ts', 'recommendations.ts'
  ];

  test(`all ${expectedFiles.length} tool files exist`, () => {
    const missing = expectedFiles.filter(f => !fs.existsSync(path.join(MCP_TOOLS_DIR, f)));
    assert.strictEqual(missing.length, 0, `Missing tool files: ${missing.join(', ')}`);
  });

  test('no unexpected .ts files in tools directory', () => {
    const actual = fs.readdirSync(MCP_TOOLS_DIR).filter(f => f.endsWith('.ts'));
    const extra = actual.filter(f => !expectedFiles.includes(f));
    assert.strictEqual(extra.length, 0, `Unexpected tool files: ${extra.join(', ')}`);
  });
});

// ─── Tool File Structure (exports validation) ──────────────────────────────

describe('MCP tool file exports', () => {
  // Each tool file should export an object with tool definitions
  const moduleToFile = {
    stripeTools: 'stripe.ts',
    shopifyTools: 'shopify.ts',
    woocommerceTools: 'woocommerce.ts',
    magentoTools: 'magento.ts',
    wixTools: 'wix.ts',
    squarespaceTools: 'squarespace.ts',
    bigcommerceTools: 'bigcommerce.ts',
    prestashopTools: 'prestashop.ts',
    pipedriveTools: 'pipedrive.ts',
    zohoTools: 'zoho.ts',
    freshdeskTools: 'freshdesk.ts',
    zendeskTools: 'zendesk.ts',
    calendlyTools: 'calendly.ts',
    sheetsTools: 'sheets.ts',
    driveTools: 'drive.ts',
    docsTools: 'docs.ts',
    gmailTools: 'gmail.ts',
    calendarTools: 'calendar.ts',
    zapierTools: 'zapier.ts',
    makeTools: 'make.ts',
    n8nTools: 'n8n.ts',
    slackTools: 'slack.ts',
    ucpTools: 'ucp.ts',
    exportTools: 'export.ts',
    emailTools: 'email.ts',
    hubspotTools: 'hubspot.ts',
    klaviyoTools: 'klaviyo.ts',
    twilioTools: 'twilio.ts',
    recommendationTools: 'recommendations.ts'
  };

  for (const [moduleName, fileName] of Object.entries(moduleToFile)) {
    test(`${fileName} exports ${moduleName}`, () => {
      const filePath = path.join(MCP_TOOLS_DIR, fileName);
      const content = fs.readFileSync(filePath, 'utf8');
      // Verify the module exports the expected object name
      const exportPattern = new RegExp(`export\\s+(?:const|let|function)\\s+${moduleName}\\b`);
      assert.ok(
        exportPattern.test(content),
        `${fileName} should export '${moduleName}', but doesn't match pattern`
      );
    });
  }
});

// ─── External Module Tool Counts ────────────────────────────────────────────

describe('MCP external tool counts per module', () => {
  // Group external tools by module
  const byModule = {};
  for (const e of externalTools) {
    byModule[e.module] = (byModule[e.module] || []);
    byModule[e.module].push(e.tool);
  }

  const expectedCounts = {
    stripeTools: 19,
    shopifyTools: 8,
    woocommerceTools: 7,
    magentoTools: 10,
    bigcommerceTools: 9,
    prestashopTools: 10,
    squarespaceTools: 7,
    wixTools: 6,
    pipedriveTools: 7,
    freshdeskTools: 6,
    zendeskTools: 6,
    zohoTools: 6,
    calendlyTools: 6,
    hubspotTools: 7,
    klaviyoTools: 5,
    twilioTools: 5,
    sheetsTools: 5,
    driveTools: 6,
    docsTools: 4,
    gmailTools: 7,
    calendarTools: 2,
    slackTools: 1,
    ucpTools: 7,
    exportTools: 5,
    emailTools: 3,
    zapierTools: 3,
    makeTools: 5,
    n8nTools: 5,
    recommendationTools: 4
  };

  for (const [module, expected] of Object.entries(expectedCounts)) {
    test(`${module} has ${expected} tools registered`, () => {
      const actual = (byModule[module] || []).length;
      assert.strictEqual(actual, expected,
        `${module}: expected ${expected} tools, found ${actual} (${(byModule[module] || []).join(', ')})`);
    });
  }
});

// ─── Tool Handler Structure ─────────────────────────────────────────────────

describe('MCP tool handler structure', () => {
  // All external tools should use registerModuleTool() helper
  test('all external tools use registerModuleTool() pattern', () => {
    const handlerRegex = /registerModuleTool\((\w+)\.(\w+)\)/g;
    const withHandler = [];
    let m;
    while ((m = handlerRegex.exec(indexContent)) !== null) {
      withHandler.push(`${m[1]}.${m[2]}`);
    }
    assert.strictEqual(withHandler.length, externalTools.length,
      `Expected ${externalTools.length} tools with registerModuleTool(), found ${withHandler.length}`);
  });

  // All inline tools should use server.registerTool() with description + annotations
  test('all inline tools have description', () => {
    const registerBlocks = indexContent.match(/server\.registerTool\(\s*\n\s*"[^"]+",\s*\n\s*\{[\s\S]*?description:/g) || [];
    assert.strictEqual(registerBlocks.length, inlineTools.length,
      `Expected ${inlineTools.length} inline tools with description, found ${registerBlocks.length}`);
  });

  // No deprecated server.tool() calls should remain (exclude comments)
  test('zero deprecated server.tool() calls', () => {
    const lines = indexContent.split('\n');
    const deprecated = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes('server.tool(');
    }).length;
    assert.strictEqual(deprecated, 0, `Found ${deprecated} deprecated server.tool() calls — should be 0`);
  });
});

// ─── Build Artifacts ────────────────────────────────────────────────────────

describe('MCP build artifacts', () => {
  test('dist directory exists', () => {
    assert.ok(fs.existsSync(MCP_DIST_DIR), 'dist/ should exist');
  });

  test('compiled index.js exists', () => {
    assert.ok(fs.existsSync(path.join(MCP_DIST_DIR, 'index.js')), 'dist/index.js should exist');
  });

  test('compiled tools directory exists', () => {
    assert.ok(fs.existsSync(path.join(MCP_DIST_DIR, 'tools')), 'dist/tools/ should exist');
  });

  test('each source tool has compiled counterpart', () => {
    const sourceFiles = fs.readdirSync(MCP_TOOLS_DIR).filter(f => f.endsWith('.ts'));
    const distFiles = fs.readdirSync(path.join(MCP_DIST_DIR, 'tools')).filter(f => f.endsWith('.js'));
    const missing = sourceFiles.filter(f => {
      const jsName = f.replace('.ts', '.js');
      return !distFiles.includes(jsName);
    });
    assert.strictEqual(missing.length, 0, `Missing compiled files for: ${missing.join(', ')}`);
  });
});

// ─── Index Imports Validation ───────────────────────────────────────────────

describe('MCP index imports', () => {
  const expectedImports = [
    'calendarTools', 'slackTools', 'ucpTools', 'sheetsTools', 'driveTools',
    'calendlyTools', 'freshdeskTools', 'pipedriveTools', 'docsTools',
    'zendeskTools', 'woocommerceTools', 'zohoTools', 'magentoTools',
    'exportTools', 'emailTools', 'gmailTools', 'zapierTools', 'makeTools',
    'n8nTools', 'shopifyTools', 'wixTools', 'squarespaceTools',
    'bigcommerceTools', 'prestashopTools', 'stripeTools', 'recommendationTools',
    'hubspotTools', 'klaviyoTools', 'twilioTools'
  ];

  test(`all ${expectedImports.length} tool modules are imported`, () => {
    const missing = expectedImports.filter(imp => !indexContent.includes(`import { ${imp} }`));
    assert.strictEqual(missing.length, 0, `Missing imports: ${missing.join(', ')}`);
  });
});

// ─── Critical Tool Categories ───────────────────────────────────────────────

describe('MCP critical inline tools', () => {
  test('has translation_qa_check', () => {
    assert.ok(inlineTools.includes('translation_qa_check'));
  });

  test('has voice_generate_response', () => {
    assert.ok(inlineTools.includes('voice_generate_response'));
  });

  test('has qualify_lead', () => {
    assert.ok(inlineTools.includes('qualify_lead'));
  });

  test('has knowledge_search', () => {
    assert.ok(inlineTools.includes('knowledge_search'));
  });

  test('has api_status', () => {
    assert.ok(inlineTools.includes('api_status'));
  });

  test('has booking_create', () => {
    assert.ok(inlineTools.includes('booking_create'));
  });

  test('has telephony_initiate_call', () => {
    assert.ok(inlineTools.includes('telephony_initiate_call'));
  });
});

// ─── Resource Registrations ────────────────────────────────────────────────

describe('MCP resources', () => {
  // Static resources: server.registerResource(\n  "name",\n  "vocalia://..."
  const staticResourceRegex = /server\.registerResource\(\s*\n\s*"([^"]+)",\s*\n\s*"(vocalia:\/\/[^"]+)"/g;
  const staticResources = [];
  let rm;
  while ((rm = staticResourceRegex.exec(indexContent)) !== null) {
    staticResources.push({ name: rm[1], uri: rm[2] });
  }

  // Template resources: server.registerResource(\n  "name",\n  new ResourceTemplate(
  const templateResourceRegex = /server\.registerResource\(\s*\n\s*"([^"]+)",\s*\n\s*new ResourceTemplate\("(vocalia:\/\/[^"]+)"/g;
  const templateResources = [];
  while ((rm = templateResourceRegex.exec(indexContent)) !== null) {
    templateResources.push({ name: rm[1], uri: rm[2] });
  }

  test('5 static resources registered', () => {
    assert.strictEqual(staticResources.length, 5,
      `Expected 5 static resources, found ${staticResources.length}: ${staticResources.map(r => r.name).join(', ')}`);
  });

  test('1 template resource registered', () => {
    assert.strictEqual(templateResources.length, 1,
      `Expected 1 template resource, found ${templateResources.length}: ${templateResources.map(r => r.name).join(', ')}`);
  });

  test('6 total resources', () => {
    const total = staticResources.length + templateResources.length;
    assert.strictEqual(total, 6, `Expected 6 total resources, found ${total}`);
  });

  const expectedResources = [
    { name: 'personas', uri: 'vocalia://personas' },
    { name: 'knowledge-base', uri: 'vocalia://knowledge-base' },
    { name: 'market-rules', uri: 'vocalia://market-rules' },
    { name: 'pricing', uri: 'vocalia://pricing' },
    { name: 'languages', uri: 'vocalia://languages' },
  ];

  for (const { name, uri } of expectedResources) {
    test(`has static resource '${name}' at ${uri}`, () => {
      const found = staticResources.find(r => r.name === name && r.uri === uri);
      assert.ok(found, `Missing resource: ${name} (${uri})`);
    });
  }

  test('has template resource persona-detail', () => {
    const found = templateResources.find(r => r.name === 'persona-detail');
    assert.ok(found, 'Missing template resource: persona-detail');
  });

  test('all resources have description', () => {
    const resourceBlocks = indexContent.match(/server\.registerResource\(\s*\n\s*"[^"]+",[\s\S]*?description:/g) || [];
    assert.strictEqual(resourceBlocks.length, 6,
      `Expected 6 resources with description, found ${resourceBlocks.length}`);
  });
});

// ─── Prompt Registrations ──────────────────────────────────────────────────

describe('MCP prompts', () => {
  // Pattern: server.registerPrompt(\n  "prompt-name"
  const promptRegex = /server\.registerPrompt\(\s*\n\s*"([^"]+)"/g;
  const prompts = [];
  let pm;
  while ((pm = promptRegex.exec(indexContent)) !== null) {
    prompts.push(pm[1]);
  }

  test('8 prompts registered', () => {
    assert.strictEqual(prompts.length, 8,
      `Expected 8 prompts, found ${prompts.length}: ${prompts.join(', ')}`);
  });

  const expectedPrompts = [
    'voice-response', 'qualify-lead', 'book-appointment', 'check-order',
    'create-invoice', 'export-report', 'onboard-tenant', 'troubleshoot'
  ];

  for (const name of expectedPrompts) {
    test(`has prompt '${name}'`, () => {
      assert.ok(prompts.includes(name), `Missing prompt: ${name}`);
    });
  }

  test('all prompts use kebab-case', () => {
    const bad = prompts.filter(p => p !== p.toLowerCase() || p.includes('_'));
    assert.strictEqual(bad.length, 0, `Non-kebab-case prompts: ${bad.join(', ')}`);
  });

  test('all prompts have description', () => {
    const promptBlocks = indexContent.match(/server\.registerPrompt\(\s*\n\s*"[^"]+",\s*\n\s*\{[\s\S]*?description:/g) || [];
    assert.strictEqual(promptBlocks.length, 8,
      `Expected 8 prompts with description, found ${promptBlocks.length}`);
  });

  test('zero deprecated server.prompt() calls', () => {
    const lines = indexContent.split('\n');
    const deprecated = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes('server.prompt(');
    }).length;
    assert.strictEqual(deprecated, 0, `Found ${deprecated} deprecated server.prompt() calls — should be 0`);
  });

  test('zero deprecated server.resource() calls', () => {
    const lines = indexContent.split('\n');
    const deprecated = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes('server.resource(');
    }).length;
    assert.strictEqual(deprecated, 0, `Found ${deprecated} deprecated server.resource() calls — should be 0`);
  });
});
