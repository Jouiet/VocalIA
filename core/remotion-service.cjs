#!/usr/bin/env node
/**
 * Remotion Service - Video Generation Orchestrator
 * VocalIA - Session 250.43
 *
 * Orchestrates Remotion video rendering from VocalIA.
 * Provides programmatic API for generating marketing videos.
 * ADMIN USE ONLY - Not for client-facing applications.
 *
 * Usage:
 *   node remotion-service.cjs --render demo
 *   node remotion-service.cjs --render demo --lang en
 *   node remotion-service.cjs --render features --lang ar
 *   node remotion-service.cjs --render-all
 *   node remotion-service.cjs --render-all-langs
 *   node remotion-service.cjs --health
 *   node remotion-service.cjs --install
 *   node remotion-service.cjs --list
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const REMOTION_DIR = path.join(__dirname, '../remotion');
const OUTPUT_DIR = path.join(REMOTION_DIR, 'out');

// HITL Configuration
const HITL_ENABLED = process.env.REMOTION_HITL_ENABLED !== 'false'; // Enabled by default
let hitlService = null;

/**
 * Get HITL service (lazy load)
 */
function getHITL() {
  if (!hitlService) {
    try {
      hitlService = require('./remotion-hitl.cjs');
    } catch (error) {
      console.warn('[Remotion] HITL service not available:', error.message);
      return null;
    }
  }
  return hitlService;
}

// Supported languages
const LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];

// VocalIA Metrics (must match i18n.ts)
const VOCALIA_METRICS = {
  personas: 40,
  languages: 5,
  mcpTools: 182,
  integrations: 28,
  ecommercePlatforms: 7,
  stripeTools: 19
};

// Available compositions
const COMPOSITIONS = {
  demo: {
    id: 'VocaliaDemo',
    output: 'demo.mp4',
    duration: 30,
    description: 'Main product demo video'
  },
  features: {
    id: 'FeatureShowcase',
    output: 'features.mp4',
    duration: 45,
    description: 'Feature showcase video'
  },
  testimonial: {
    id: 'Testimonial',
    output: 'testimonial.mp4',
    duration: 20,
    description: 'Customer testimonial video'
  },
  thumbnail: {
    id: 'Thumbnail',
    output: 'thumbnail.png',
    duration: 0,
    description: 'Video thumbnail image',
    isStill: true
  },
  // === NEW USE-CASE COMPOSITIONS (Session 250.43) ===
  onboarding: {
    id: 'OnboardingVideo',
    output: 'onboarding.mp4',
    duration: 60,
    description: 'New client onboarding video (5 steps)'
  },
  datareport: {
    id: 'DataReport',
    output: 'datareport.mp4',
    duration: 45,
    description: 'Monthly analytics report video'
  },
  socialclip: {
    id: 'SocialClip',
    output: 'socialclip.mp4',
    duration: 15,
    description: 'Short-form social media clip (square)'
  },
  'socialclip-vertical': {
    id: 'SocialClip-Vertical',
    output: 'socialclip-vertical.mp4',
    duration: 15,
    description: 'Vertical social clip (Stories/Reels)'
  },
  'socialclip-horizontal': {
    id: 'SocialClip-Horizontal',
    output: 'socialclip-horizontal.mp4',
    duration: 15,
    description: 'Horizontal social clip (YouTube)'
  },
  pricing: {
    id: 'PricingExplainer',
    output: 'pricing.mp4',
    duration: 30,
    description: 'Pricing plans comparison video'
  },
  'integration-hubspot': {
    id: 'IntegrationGuide-HubSpot',
    output: 'integration-hubspot.mp4',
    duration: 40,
    description: 'HubSpot integration tutorial'
  },
  'integration-shopify': {
    id: 'IntegrationGuide-Shopify',
    output: 'integration-shopify.mp4',
    duration: 40,
    description: 'Shopify integration tutorial'
  },
  'integration-stripe': {
    id: 'IntegrationGuide-Stripe',
    output: 'integration-stripe.mp4',
    duration: 40,
    description: 'Stripe integration tutorial'
  }
};

/**
 * Check if Remotion is installed
 */
function isRemotionInstalled() {
  const nodeModulesPath = path.join(REMOTION_DIR, 'node_modules');
  const remotionPath = path.join(nodeModulesPath, 'remotion');
  return fs.existsSync(remotionPath);
}

/**
 * Install Remotion dependencies
 */
function installDependencies() {
  console.log('[Remotion] Installing dependencies...');

  if (!fs.existsSync(REMOTION_DIR)) {
    console.error(`[Remotion] Directory not found: ${REMOTION_DIR}`);
    return false;
  }

  try {
    execSync('npm install', {
      cwd: REMOTION_DIR,
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    console.log('[Remotion] Dependencies installed successfully');
    return true;
  } catch (error) {
    console.error('[Remotion] Failed to install dependencies:', error.message);
    return false;
  }
}

/**
 * Get composition ID with language suffix
 */
function getCompositionId(baseId, language) {
  if (!language || language === 'fr') {
    return baseId; // French is default
  }
  return `${baseId}-${language.toUpperCase()}`;
}

/**
 * Queue video for HITL approval
 */
async function queueForApproval(compositionKey, options = {}) {
  const { language = 'fr', props = {}, requestedBy = 'admin' } = options;
  const composition = COMPOSITIONS[compositionKey];

  if (!composition) {
    throw new Error(`Unknown composition: ${compositionKey}. Available: ${Object.keys(COMPOSITIONS).join(', ')}`);
  }

  const hitl = getHITL();
  if (!hitl) {
    throw new Error('HITL service not available');
  }

  const item = hitl.queueVideo({
    composition: compositionKey,
    language,
    props,
    requestedBy
  });

  console.log(`[Remotion] Video queued for approval: ${item.id}`);
  return item;
}

/**
 * Process approved video (render after HITL approval)
 */
async function processApproved(videoId) {
  const hitl = getHITL();
  if (!hitl) {
    throw new Error('HITL service not available');
  }

  const video = hitl.getVideo(videoId);
  if (!video) {
    throw new Error(`Video not found: ${videoId}`);
  }

  if (video.state !== hitl.STATES.APPROVED) {
    throw new Error(`Video not approved: ${video.state}`);
  }

  // Mark as rendering
  hitl.markRendering(videoId);

  try {
    // Render the video (bypass HITL check)
    const result = await renderCompositionDirect(video.composition, {
      language: video.language,
      props: video.props
    });

    // Mark as completed
    hitl.markCompleted(videoId, result.output);
    return result;

  } catch (error) {
    hitl.markFailed(videoId, error);
    throw error;
  }
}

/**
 * Render a single composition (with HITL check)
 */
async function renderComposition(compositionKey, options = {}) {
  const { language = 'fr', props = {}, skipHITL = false, requestedBy = 'admin' } = options;

  // Check if HITL is enabled and should be used
  if (HITL_ENABLED && !skipHITL) {
    console.log('[Remotion] HITL enabled - queueing for approval');
    return queueForApproval(compositionKey, { language, props, requestedBy });
  }

  // Direct render (HITL disabled or skipped)
  return renderCompositionDirect(compositionKey, options);
}

/**
 * Render a single composition directly (no HITL)
 */
async function renderCompositionDirect(compositionKey, options = {}) {
  const { language = 'fr', props = {} } = options;
  const composition = COMPOSITIONS[compositionKey];

  if (!composition) {
    throw new Error(`Unknown composition: ${compositionKey}. Available: ${Object.keys(COMPOSITIONS).join(', ')}`);
  }

  if (!isRemotionInstalled()) {
    console.log('[Remotion] Not installed. Run: node remotion-service.cjs --install');
    return null;
  }

  const compositionId = getCompositionId(composition.id, language);
  const outputFilename = language === 'fr'
    ? composition.output
    : composition.output.replace(/(\.[^.]+)$/, `-${language}$1`);

  console.log(`[Remotion] Rendering ${compositionId}...`);
  console.log(`  Language: ${language}`);
  console.log(`  Duration: ${composition.duration}s`);
  console.log(`  Output: ${outputFilename}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  const entryPoint = path.join(REMOTION_DIR, 'src/index.ts');

  // Build render command
  const command = composition.isStill ? 'still' : 'render';
  const args = [
    'npx', 'remotion', command,
    entryPoint,
    compositionId,
    outputPath
  ];

  // Add props if provided
  if (Object.keys(props).length > 0) {
    args.push('--props', JSON.stringify(props));
  }

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const process = spawn(args[0], args.slice(1), {
      cwd: REMOTION_DIR,
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      // Log progress
      const match = data.toString().match(/(\d+)%/);
      if (match) {
        console.log(`  Progress: ${match[1]}%`);
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        console.log(`[Remotion] Rendered successfully in ${(duration / 1000).toFixed(1)}s`);
        console.log(`  Output: ${outputPath}`);

        resolve({
          success: true,
          composition: compositionKey,
          language,
          output: outputPath,
          duration,
          size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
        });
      } else {
        console.error(`[Remotion] Render failed with code ${code}`);
        console.error(stderr);

        reject(new Error(`Render failed: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Render all compositions (default language)
 */
async function renderAll() {
  const results = [];

  for (const key of Object.keys(COMPOSITIONS)) {
    try {
      const result = await renderComposition(key);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        composition: key,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Render all compositions in all languages
 */
async function renderAllLanguages() {
  const results = [];

  for (const lang of LANGUAGES) {
    for (const key of Object.keys(COMPOSITIONS)) {
      try {
        const result = await renderComposition(key, { language: lang });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          composition: key,
          language: lang,
          error: error.message
        });
      }
    }
  }

  return results;
}

/**
 * List available compositions
 */
function listCompositions() {
  console.log('\n=== Available Compositions ===\n');

  console.log('Base Compositions:');
  for (const [key, comp] of Object.entries(COMPOSITIONS)) {
    console.log(`  ${key.padEnd(15)} ${comp.description} (${comp.duration}s)`);
  }

  console.log('\nLanguages:');
  for (const lang of LANGUAGES) {
    console.log(`  ${lang}`);
  }

  console.log('\nTotal compositions: ' + (Object.keys(COMPOSITIONS).length * LANGUAGES.length + Object.keys(COMPOSITIONS).length));
  console.log('\nExamples:');
  console.log('  node remotion-service.cjs --render demo');
  console.log('  node remotion-service.cjs --render features --lang ar');
  console.log('  node remotion-service.cjs --render testimonial --lang en');
}

/**
 * Start Remotion Studio (preview server)
 */
function startStudio() {
  if (!isRemotionInstalled()) {
    console.log('[Remotion] Not installed. Run: node remotion-service.cjs --install');
    return;
  }

  console.log('[Remotion] Starting studio...');
  console.log('  URL: http://localhost:3000');

  const studio = spawn('npm', ['run', 'dev'], {
    cwd: REMOTION_DIR,
    stdio: 'inherit',
    shell: true
  });

  studio.on('error', (error) => {
    console.error('[Remotion] Studio failed:', error.message);
  });

  return studio;
}

/**
 * Health check
 */
function healthCheck() {
  const installed = isRemotionInstalled();
  const packageJson = path.join(REMOTION_DIR, 'package.json');
  const hasPackageJson = fs.existsSync(packageJson);

  let version = null;
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      version = pkg.dependencies?.remotion || pkg.devDependencies?.remotion;
    } catch (e) {
      // ignore
    }
  }

  // Check output files
  const outputs = {};
  for (const [key, comp] of Object.entries(COMPOSITIONS)) {
    const outputPath = path.join(OUTPUT_DIR, comp.output);
    outputs[key] = {
      exists: fs.existsSync(outputPath),
      path: outputPath,
      size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
    };
  }

  return {
    service: 'Remotion',
    version: version || 'unknown',
    installed,
    directory: REMOTION_DIR,
    outputDirectory: OUTPUT_DIR,
    compositions: Object.keys(COMPOSITIONS),
    languages: LANGUAGES,
    totalCompositions: Object.keys(COMPOSITIONS).length * LANGUAGES.length + Object.keys(COMPOSITIONS).length,
    metrics: VOCALIA_METRICS,
    outputs,
    ready: installed && hasPackageJson
  };
}

/**
 * Generate video with custom props
 */
async function generateVideo(type, customProps = {}, language = 'fr') {
  const defaultProps = {
    demo: {
      title: 'VocalIA',
      subtitle: language === 'en' ? 'Voice AI Agents for Business' : 'Agents Vocaux IA pour Entreprises',
      features: [
        `${VOCALIA_METRICS.personas} Personas SOTA`,
        `${VOCALIA_METRICS.languages} Langues + Darija`,
        `${VOCALIA_METRICS.mcpTools} MCP Tools`,
        `${VOCALIA_METRICS.integrations} Intégrations`
      ]
    },
    features: {
      features: [
        { title: 'Voice Widget', description: 'Intégration web en 2 lignes de code', icon: '🎙️' },
        { title: 'Voice Telephony', description: 'Bridge PSTN ↔ AI pour appels entrants', icon: '📞' },
        { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} personas métier pré-configurés`, icon: '🎭' },
        { title: 'Multilingue', description: 'FR, EN, ES, AR, Darija natif', icon: '🌍' }
      ]
    },
    testimonial: {
      quote: 'VocalIA a réduit nos coûts support de 60% tout en améliorant la satisfaction client.',
      author: 'Clinique Amal',
      role: 'Directeur Opérations',
      metric: '-60%',
      metricLabel: 'Coûts Support'
    }
  };

  const props = { ...defaultProps[type], ...customProps };
  return renderComposition(type, { language, props });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    console.log(JSON.stringify(healthCheck(), null, 2));
    return;
  }

  if (args.includes('--install')) {
    installDependencies();
    return;
  }

  if (args.includes('--list')) {
    listCompositions();
    return;
  }

  if (args.includes('--studio') || args.includes('--dev')) {
    startStudio();
    return;
  }

  if (args.includes('--render-all-langs')) {
    const results = await renderAllLanguages();
    console.log('\n=== Render Results (All Languages) ===');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (args.includes('--render-all')) {
    const results = await renderAll();
    console.log('\n=== Render Results ===');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // HITL: List pending
  if (args.includes('--pending')) {
    const hitl = getHITL();
    if (!hitl) {
      console.error('HITL service not available');
      process.exit(1);
    }
    const pending = hitl.getPending();
    console.log('\n=== Pending Video Approvals ===\n');
    if (pending.length === 0) {
      console.log('No pending videos.');
    } else {
      for (const item of pending) {
        console.log(`  ${item.id}`);
        console.log(`    Composition: ${item.composition}`);
        console.log(`    Language: ${item.language}`);
        console.log(`    Requested: ${item.requestedAt}`);
        console.log('');
      }
    }
    console.log(`Total: ${pending.length}`);
    return;
  }

  // HITL: Approve
  const approveIndex = args.indexOf('--approve');
  if (approveIndex !== -1) {
    const videoId = args[approveIndex + 1];
    if (!videoId) {
      console.error('Usage: --approve <video-id>');
      process.exit(1);
    }
    try {
      const hitl = getHITL();
      if (!hitl) throw new Error('HITL service not available');

      // Approve the video
      hitl.approveVideo(videoId, 'cli-admin', 'Approved via CLI');
      console.log(`[HITL] Video approved: ${videoId}`);

      // Process (render) the approved video
      console.log('[Remotion] Rendering approved video...');
      const result = await processApproved(videoId);
      console.log('\n=== Render Complete ===');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    return;
  }

  // HITL: Reject
  const rejectIndex = args.indexOf('--reject');
  if (rejectIndex !== -1) {
    const videoId = args[rejectIndex + 1];
    const reason = args[rejectIndex + 2] || 'Rejected via CLI';
    if (!videoId) {
      console.error('Usage: --reject <video-id> [reason]');
      process.exit(1);
    }
    try {
      const hitl = getHITL();
      if (!hitl) throw new Error('HITL service not available');

      hitl.rejectVideo(videoId, 'cli-admin', reason);
      console.log(`[HITL] Video rejected: ${videoId}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    return;
  }

  const renderIndex = args.indexOf('--render');
  if (renderIndex !== -1) {
    const compositionKey = args[renderIndex + 1];
    if (!compositionKey) {
      console.error('Usage: node remotion-service.cjs --render <demo|features|testimonial|thumbnail> [--lang <fr|en|es|ar|ary>] [--skip-hitl]');
      process.exit(1);
    }

    // Get language
    const langIndex = args.indexOf('--lang');
    const language = langIndex !== -1 ? args[langIndex + 1] : 'fr';

    // Check for skip-hitl flag
    const skipHITL = args.includes('--skip-hitl');

    if (!LANGUAGES.includes(language)) {
      console.error(`Invalid language: ${language}. Available: ${LANGUAGES.join(', ')}`);
      process.exit(1);
    }

    try {
      const result = await renderComposition(compositionKey, { language, skipHITL });
      console.log('\n=== Render Result ===');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Render failed:', error.message);
      process.exit(1);
    }
    return;
  }

  // Default: show help
  console.log(`
Remotion Service - VocalIA Video Generation (ADMIN ONLY)
=========================================================

Commands:
  --health              Check service status
  --install             Install Remotion dependencies
  --list                List available compositions
  --studio              Start Remotion Studio (preview)
  --render <type>       Render a video (queues for HITL approval)
  --render-direct <type> Render immediately (skip HITL)
  --render-all          Render all compositions (default language)
  --render-all-langs    Render all compositions in all languages

HITL Workflow:
  --pending             List videos pending approval
  --approve <id>        Approve and render video
  --reject <id>         Reject video

Options:
  --lang <code>         Language: fr, en, es, ar, ary (default: fr)
  --skip-hitl           Skip HITL approval (direct render)

Video Types:
  demo                  Main product demo (30s)
  features              Feature showcase (45s)
  testimonial           Customer testimonial (20s)
  thumbnail             Video thumbnail (still image)
  onboarding            New client onboarding (60s)
  datareport            Monthly analytics report (45s)
  socialclip            Social media clip - square (15s)
  socialclip-vertical   Social clip - vertical/Stories (15s)
  socialclip-horizontal Social clip - horizontal/YouTube (15s)
  pricing               Pricing plans explainer (30s)
  integration-hubspot   HubSpot integration guide (40s)
  integration-shopify   Shopify integration guide (40s)
  integration-stripe    Stripe integration guide (40s)

Languages: ${LANGUAGES.join(', ')}

HITL: ${HITL_ENABLED ? 'ENABLED (set REMOTION_HITL_ENABLED=false to disable)' : 'DISABLED'}

Metrics (${VOCALIA_METRICS.mcpTools} MCP Tools verified):
  - ${VOCALIA_METRICS.personas} Personas
  - ${VOCALIA_METRICS.languages} Languages
  - ${VOCALIA_METRICS.integrations} Integrations
  - ${VOCALIA_METRICS.ecommercePlatforms} E-commerce Platforms

Examples:
  node remotion-service.cjs --install
  node remotion-service.cjs --render demo           # Queues for HITL
  node remotion-service.cjs --render demo --skip-hitl  # Direct render
  node remotion-service.cjs --pending               # View pending
  node remotion-service.cjs --approve vid_12345_abc # Approve & render
  node remotion-service.cjs --studio
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  renderComposition,
  renderCompositionDirect,
  queueForApproval,
  processApproved,
  renderAll,
  renderAllLanguages,
  generateVideo,
  healthCheck,
  installDependencies,
  startStudio,
  listCompositions,
  getHITL,
  HITL_ENABLED,
  COMPOSITIONS,
  LANGUAGES,
  VOCALIA_METRICS
};
