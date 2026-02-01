/**
 * VocalIA MCP Server Tests
 *
 * Tests for the MCP server (182 tools across 25 categories)
 * Run: node --test test/mcp-server.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const MCP_INDEX_PATH = path.join(__dirname, '../mcp-server/src/index.ts');
const MCP_TOOLS_DIR = path.join(__dirname, '../mcp-server/src/tools');

describe('MCP Server Structure', () => {
  test('Index file exists', () => {
    assert.ok(fs.existsSync(MCP_INDEX_PATH), 'index.ts should exist');
  });

  test('Tools directory exists', () => {
    assert.ok(fs.existsSync(MCP_TOOLS_DIR), 'tools directory should exist');
  });

  test('Index has 182 tool registrations', () => {
    const content = fs.readFileSync(MCP_INDEX_PATH, 'utf8');
    const toolCount = (content.match(/server\.tool\(/g) || []).length;
    assert.strictEqual(toolCount, 182, `Should have 182 tools, found ${toolCount}`);
  });

  test('Index is substantial (>70k chars)', () => {
    const content = fs.readFileSync(MCP_INDEX_PATH, 'utf8');
    assert.ok(content.length > 70000, `Should have >70k chars, has ${content.length}`);
  });
});

describe('MCP Tool Files', () => {
  const expectedTools = [
    'stripe.ts',
    'shopify.ts',
    'woocommerce.ts',
    'magento.ts',
    'wix.ts',
    'squarespace.ts',
    'bigcommerce.ts',
    'prestashop.ts',
    'pipedrive.ts',
    'zoho.ts',
    'freshdesk.ts',
    'zendesk.ts',
    'calendly.ts',
    'sheets.ts',
    'drive.ts',
    'docs.ts',
    'gmail.ts',
    'calendar.ts',
    'zapier.ts',
    'make.ts',
    'n8n.ts',
    'slack.ts',
    'ucp.ts',
    'export.ts',
    'email.ts'
  ];

  for (const tool of expectedTools) {
    test(`Has ${tool} tool file`, () => {
      const toolPath = path.join(MCP_TOOLS_DIR, tool);
      assert.ok(fs.existsSync(toolPath), `${tool} should exist`);
    });
  }
});

describe('MCP Stripe Tools (19)', () => {
  test('Stripe file exists', () => {
    const stripePath = path.join(MCP_TOOLS_DIR, 'stripe.ts');
    assert.ok(fs.existsSync(stripePath), 'stripe.ts should exist');
  });

  test('Stripe has payment link tool', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'stripe.ts'), 'utf8');
    assert.ok(content.includes('payment_link') || content.includes('paymentLink'),
      'Should have payment link functionality');
  });

  test('Stripe has checkout tool', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'stripe.ts'), 'utf8');
    assert.ok(content.includes('checkout'),
      'Should have checkout functionality');
  });

  test('Stripe has invoice tool', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'stripe.ts'), 'utf8');
    assert.ok(content.includes('invoice'),
      'Should have invoice functionality');
  });

  test('Stripe has refund tool', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'stripe.ts'), 'utf8');
    assert.ok(content.includes('refund'),
      'Should have refund functionality');
  });
});

describe('MCP E-commerce Tools', () => {
  test('Shopify file has CRUD operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'shopify.ts'), 'utf8');
    assert.ok(content.includes('create') || content.includes('Create'),
      'Should have create operations');
    assert.ok(content.includes('cancel') || content.includes('Cancel'),
      'Should have cancel operations');
  });

  test('WooCommerce file has order operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'woocommerce.ts'), 'utf8');
    assert.ok(content.includes('order') || content.includes('Order'),
      'Should have order operations');
  });

  test('Magento file has product operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'magento.ts'), 'utf8');
    assert.ok(content.includes('product') || content.includes('Product'),
      'Should have product operations');
  });
});

describe('MCP CRM Tools', () => {
  test('Pipedrive has deal operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'pipedrive.ts'), 'utf8');
    assert.ok(content.includes('deal') || content.includes('Deal'),
      'Should have deal operations');
  });

  test('Zoho has lead operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'zoho.ts'), 'utf8');
    assert.ok(content.includes('lead') || content.includes('Lead') ||
              content.includes('contact') || content.includes('Contact'),
      'Should have lead/contact operations');
  });
});

describe('MCP Support Tools', () => {
  test('Freshdesk has ticket operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'freshdesk.ts'), 'utf8');
    assert.ok(content.includes('ticket') || content.includes('Ticket'),
      'Should have ticket operations');
  });

  test('Zendesk has ticket operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'zendesk.ts'), 'utf8');
    assert.ok(content.includes('ticket') || content.includes('Ticket'),
      'Should have ticket operations');
  });
});

describe('MCP Google Tools', () => {
  test('Google Sheets has read/write operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'sheets.ts'), 'utf8');
    assert.ok(content.includes('read') || content.includes('get'),
      'Should have read operations');
    assert.ok(content.includes('write') || content.includes('update'),
      'Should have write operations');
  });

  test('Google Drive has file operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'drive.ts'), 'utf8');
    assert.ok(content.includes('file') || content.includes('File'),
      'Should have file operations');
  });

  test('Gmail has send operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'gmail.ts'), 'utf8');
    assert.ok(content.includes('send') || content.includes('Send'),
      'Should have send operations');
  });
});

describe('MCP iPaaS Tools', () => {
  test('Zapier has trigger operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'zapier.ts'), 'utf8');
    assert.ok(content.includes('trigger') || content.includes('webhook') ||
              content.includes('Zapier'),
      'Should have trigger/webhook operations');
  });

  test('Make has scenario operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'make.ts'), 'utf8');
    assert.ok(content.includes('scenario') || content.includes('Scenario') ||
              content.includes('Make'),
      'Should have scenario operations');
  });

  test('n8n has workflow operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'n8n.ts'), 'utf8');
    assert.ok(content.includes('workflow') || content.includes('Workflow') ||
              content.includes('n8n'),
      'Should have workflow operations');
  });
});

describe('MCP Export Tools', () => {
  test('Export file exists and has formats', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'export.ts'), 'utf8');
    assert.ok(content.includes('csv') || content.includes('CSV'),
      'Should support CSV export');
    assert.ok(content.includes('xlsx') || content.includes('excel') || content.includes('Excel'),
      'Should support Excel export');
  });
});

describe('MCP UCP (Unified Customer Profile) Tools', () => {
  test('UCP file exists', () => {
    const ucpPath = path.join(MCP_TOOLS_DIR, 'ucp.ts');
    assert.ok(fs.existsSync(ucpPath), 'ucp.ts should exist');
  });

  test('UCP has profile operations', () => {
    const content = fs.readFileSync(path.join(MCP_TOOLS_DIR, 'ucp.ts'), 'utf8');
    assert.ok(content.includes('profile') || content.includes('Profile'),
      'Should have profile operations');
  });
});

describe('MCP Build Verification', () => {
  test('Dist folder exists', () => {
    const distPath = path.join(__dirname, '../mcp-server/dist');
    assert.ok(fs.existsSync(distPath), 'dist folder should exist');
  });

  test('Compiled index.js exists', () => {
    const indexPath = path.join(__dirname, '../mcp-server/dist/index.js');
    assert.ok(fs.existsSync(indexPath), 'index.js should exist');
  });

  test('Compiled tools folder exists', () => {
    const toolsPath = path.join(__dirname, '../mcp-server/dist/tools');
    assert.ok(fs.existsSync(toolsPath), 'tools folder should exist');
  });
});
