#!/usr/bin/env node
/**
 * Stitch API Wrapper (MCP Protocol)
 *
 * Uses MCP JSON-RPC protocol to call Stitch API
 * Bypasses Claude Code MCP DCR authentication issue
 *
 * Usage: node stitch-api.cjs [command] [options]
 */

const { execSync } = require('child_process');
const https = require('https');

const STITCH_CONFIG = '/Users/mac/.stitch-mcp/config';
const GCLOUD_PATH = '/Users/mac/.stitch-mcp/google-cloud-sdk/bin/gcloud';
const QUOTA_PROJECT = 'gen-lang-client-0843127575';
const BASE_URL = 'stitch.googleapis.com';
const MCP_PATH = '/mcp';

function getAccessToken() {
  try {
    const token = execSync(
      `CLOUDSDK_CONFIG="${STITCH_CONFIG}" ${GCLOUD_PATH} auth application-default print-access-token 2>/dev/null`,
      { encoding: 'utf8' }
    ).trim();
    return token;
  } catch (e) {
    console.error('❌ Failed to get access token:', e.message);
    process.exit(1);
  }
}

function mcpRequest(method, args = {}) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();

    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: method,
        arguments: args
      },
      id: Date.now()
    });

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: MCP_PATH,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-goog-user-project': QUOTA_PROJECT,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed.result);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function listProjects() {
  console.log('📋 Listing Stitch projects...');
  const result = await mcpRequest('list_projects', {});

  if (result?.content?.[0]?.text) {
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function createProject(title) {
  console.log(`🆕 Creating project: ${title}...`);
  const result = await mcpRequest('create_project', { title });

  if (result?.content?.[0]?.text) {
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function generateScreen(projectId, prompt, deviceType = 'DESKTOP', modelId = 'GEMINI_3_PRO') {
  console.log(`🎨 Generating screen for project ${projectId}...`);
  console.log(`   Prompt: ${prompt.substring(0, 60)}...`);
  console.log(`   Device: ${deviceType}, Model: ${modelId}`);
  console.log('   ⏳ This may take 30-60 seconds...\n');

  const result = await mcpRequest('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType,
    modelId
  });

  if (result?.structuredContent) {
    const screens = result.structuredContent.outputComponents?.[0]?.design?.screens || [];

    console.log(`✅ Generated ${screens.length} variant(s):\n`);

    screens.forEach((screen, i) => {
      console.log(`--- Variant ${i + 1}: ${screen.title} ---`);
      console.log(`ID: ${screen.id}`);
      console.log(`Size: ${screen.width}x${screen.height}`);
      console.log(`Screenshot: ${screen.screenshot?.downloadUrl}`);
      console.log(`HTML Code: ${screen.htmlCode?.downloadUrl}`);
      console.log('');
    });

    // Print suggestions
    const suggestions = result.structuredContent.outputComponents?.filter(c => c.suggestion) || [];
    if (suggestions.length > 0) {
      console.log('💡 Suggestions:');
      suggestions.forEach(s => console.log(`   - ${s.suggestion}`));
    }

    return result.structuredContent;
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function listScreens(projectId) {
  console.log(`📱 Listing screens for project ${projectId}...`);
  const result = await mcpRequest('list_screens', { projectId });

  if (result?.content?.[0]?.text) {
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function getScreen(projectId, screenId) {
  console.log(`🖼️ Getting screen ${screenId}...`);
  const result = await mcpRequest('get_screen', { projectId, screenId });

  if (result?.content?.[0]?.text) {
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function getProject(name) {
  console.log(`📂 Getting project ${name}...`);
  const result = await mcpRequest('get_project', { name: `projects/${name}` });

  if (result?.content?.[0]?.text) {
    const data = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// CLI
const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'list':
    case 'list-projects':
      await listProjects();
      break;

    case 'create':
    case 'create-project':
      if (!args[0]) {
        console.error('Usage: node stitch-api.cjs create <title>');
        process.exit(1);
      }
      await createProject(args[0]);
      break;

    case 'generate':
    case 'generate-screen':
      if (!args[0] || !args[1]) {
        console.error('Usage: node stitch-api.cjs generate <projectId> "<prompt>" [DESKTOP|MOBILE] [GEMINI_3_PRO|GEMINI_3_FLASH]');
        process.exit(1);
      }
      await generateScreen(args[0], args[1], args[2] || 'DESKTOP', args[3] || 'GEMINI_3_PRO');
      break;

    case 'screens':
    case 'list-screens':
      if (!args[0]) {
        console.error('Usage: node stitch-api.cjs screens <projectId>');
        process.exit(1);
      }
      await listScreens(args[0]);
      break;

    case 'get':
    case 'get-screen':
      if (!args[0] || !args[1]) {
        console.error('Usage: node stitch-api.cjs get <projectId> <screenId>');
        process.exit(1);
      }
      await getScreen(args[0], args[1]);
      break;

    case 'project':
    case 'get-project':
      if (!args[0]) {
        console.error('Usage: node stitch-api.cjs project <projectId>');
        process.exit(1);
      }
      await getProject(args[0]);
      break;

    case '--health':
      console.log('✅ Stitch API wrapper ready (MCP Protocol)');
      const token = getAccessToken();
      console.log(`   Token: ${token.substring(0, 20)}...`);
      console.log(`   Endpoint: https://${BASE_URL}${MCP_PATH}`);
      console.log(`   Quota Project: ${QUOTA_PROJECT}`);
      break;

    default:
      console.log(`
Stitch API Wrapper (MCP Protocol)
=================================
Bypass Claude Code MCP DCR authentication issue

Usage:
  node stitch-api.cjs list                                    # List all projects
  node stitch-api.cjs create <title>                          # Create new project
  node stitch-api.cjs project <projectId>                     # Get project details
  node stitch-api.cjs generate <projectId> "<prompt>"         # Generate screen (DESKTOP, GEMINI_3_PRO)
  node stitch-api.cjs generate <projectId> "<prompt>" MOBILE  # Generate mobile screen
  node stitch-api.cjs screens <projectId>                     # List screens in project
  node stitch-api.cjs get <projectId> <screenId>              # Get screen details
  node stitch-api.cjs --health                                # Check API access

Examples:
  node stitch-api.cjs create "My App"
  node stitch-api.cjs generate 705686758968107418 "Modern dashboard with charts"
  node stitch-api.cjs generate 705686758968107418 "Login page" MOBILE GEMINI_3_FLASH
      `);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
