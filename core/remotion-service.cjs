#!/usr/bin/env node
/**
 * Remotion Service - Video Generation Orchestrator
 * VocalIA - Session 250.39
 *
 * Orchestrates Remotion video rendering from VocalIA.
 * Provides programmatic API for generating marketing videos.
 *
 * Usage:
 *   node remotion-service.cjs --render demo
 *   node remotion-service.cjs --render features
 *   node remotion-service.cjs --render testimonial
 *   node remotion-service.cjs --render-all
 *   node remotion-service.cjs --health
 *   node remotion-service.cjs --install
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const REMOTION_DIR = path.join(__dirname, '../remotion');
const OUTPUT_DIR = path.join(REMOTION_DIR, 'out');

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
 * Render a single composition
 */
async function renderComposition(compositionKey, props = {}) {
  const composition = COMPOSITIONS[compositionKey];
  if (!composition) {
    throw new Error(`Unknown composition: ${compositionKey}. Available: ${Object.keys(COMPOSITIONS).join(', ')}`);
  }

  if (!isRemotionInstalled()) {
    console.log('[Remotion] Not installed. Run: node remotion-service.cjs --install');
    return null;
  }

  console.log(`[Remotion] Rendering ${composition.id}...`);
  console.log(`  Duration: ${composition.duration}s`);
  console.log(`  Output: ${composition.output}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, composition.output);
  const entryPoint = path.join(REMOTION_DIR, 'src/index.ts');

  // Build render command
  const command = composition.isStill ? 'still' : 'render';
  const args = [
    'npx', 'remotion', command,
    entryPoint,
    composition.id,
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
 * Render all compositions
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
    outputs,
    ready: installed && hasPackageJson
  };
}

/**
 * Generate video with custom props
 */
async function generateVideo(type, customProps = {}) {
  const defaultProps = {
    demo: {
      title: 'VocalIA',
      subtitle: 'Agents Vocaux IA pour Entreprises',
      features: [
        '40 Personas SOTA',
        '5 Langues + Darija',
        '182 MCP Tools',
        '28 Intégrations'
      ]
    },
    features: {
      features: [
        { title: 'Voice Widget', description: 'Intégration web en 2 lignes de code', icon: '🎙️' },
        { title: 'Voice Telephony', description: 'Bridge PSTN ↔ AI pour appels entrants', icon: '📞' },
        { title: 'Multi-Persona', description: '40 personas métier pré-configurés', icon: '🎭' },
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
  return renderComposition(type, props);
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

  if (args.includes('--studio') || args.includes('--dev')) {
    startStudio();
    return;
  }

  if (args.includes('--render-all')) {
    const results = await renderAll();
    console.log('\n=== Render Results ===');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const renderIndex = args.indexOf('--render');
  if (renderIndex !== -1) {
    const compositionKey = args[renderIndex + 1];
    if (!compositionKey) {
      console.error('Usage: node remotion-service.cjs --render <demo|features|testimonial|thumbnail>');
      process.exit(1);
    }

    try {
      const result = await renderComposition(compositionKey);
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
Remotion Service - VocalIA Video Generation
============================================

Commands:
  --health           Check service status
  --install          Install Remotion dependencies
  --studio           Start Remotion Studio (preview)
  --render <type>    Render a video
  --render-all       Render all compositions

Video Types:
  demo               Main product demo (30s)
  features           Feature showcase (45s)
  testimonial        Customer testimonial (20s)
  thumbnail          Video thumbnail (still image)

Examples:
  node remotion-service.cjs --install
  node remotion-service.cjs --render demo
  node remotion-service.cjs --studio
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  renderComposition,
  renderAll,
  generateVideo,
  healthCheck,
  installDependencies,
  startStudio,
  COMPOSITIONS
};
