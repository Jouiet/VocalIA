#!/usr/bin/env node
'use strict';

/**
 * VocalIA Widget Build Script v2.0
 * Two-pass pipeline: esbuild DCE → terser 3-pass minification + pre-compression.
 *
 * Usage: node scripts/build-widgets.cjs [--check] [--no-minify] [--production]
 *   --check:       Verify deployed matches source (no write)
 *   --no-minify:   Skip minification step
 *   --production:  Strip console.log (keep warn/error)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const WIDGET_SRC = path.join(ROOT, 'widget');
const DEPLOYED = path.join(ROOT, 'website', 'voice-assistant');

// ── Bundle definitions ──
const BUNDLES = {
  // Full monolith (backwards compatible for WordPress/Shopify/Wix distributions)
  'voice-widget-ecommerce.js': {
    sources: [
      'voice-widget-v3.js',
      'abandoned-cart-recovery.js',
      'voice-quiz.js',
      'spin-wheel.js',
      'free-shipping-bar.js',
      'recommendation-carousel.js'
    ],
    description: 'E-commerce FULL monolith (all-in-one)'
  },
  // Code-split: core only (lazy-loads sub-widgets via loadChunk)
  'voice-widget-ecommerce-core.js': {
    sources: ['voice-widget-v3.js'],
    description: 'E-commerce CORE (code-split entry point)'
  },
  // Code-split: individual chunks
  'voice-widget-ecommerce-cart.js': {
    sources: ['abandoned-cart-recovery.js'],
    description: 'Chunk: cart recovery'
  },
  'voice-widget-ecommerce-quiz.js': {
    sources: ['voice-quiz.js'],
    description: 'Chunk: product quiz'
  },
  'voice-widget-ecommerce-spin.js': {
    sources: ['spin-wheel.js'],
    description: 'Chunk: spin wheel gamification'
  },
  'voice-widget-ecommerce-shipping.js': {
    sources: ['free-shipping-bar.js'],
    description: 'Chunk: free shipping bar'
  },
  'voice-widget-ecommerce-carousel.js': {
    sources: ['recommendation-carousel.js'],
    description: 'Chunk: recommendation carousel'
  }
};

// B2B widget is a single-file deploy (source = deployed)
const SINGLE_FILE_WIDGETS = [
  { src: 'voice-widget-b2b.js', dest: 'voice-widget-b2b.js' }
];

// Reserved identifiers that must never be mangled
const MANGLE_RESERVED = ['VocalIA', 'VOCALIA_CONFIG', 'VOCALIA_CONFIG_INJECTED'];

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function gzipSize(str) {
  return zlib.gzipSync(Buffer.from(str), { level: 9 }).length;
}

function brotliSize(str) {
  return zlib.brotliCompressSync(Buffer.from(str)).length;
}

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

/**
 * Pass 1: esbuild — syntax simplification + dead code elimination.
 * Simplifies ternaries, removes debugger, eliminates unreachable branches.
 */
function esbuildDCE(code, isProduction) {
  try {
    const { transformSync } = require('esbuild');
    const drop = ['debugger'];
    if (isProduction) drop.push('console');
    const result = transformSync(code, {
      treeShaking: true,
      minifySyntax: true,
      minifyWhitespace: false,
      minifyIdentifiers: false,
      target: 'es2020',
      drop,
      legalComments: 'none',
    });
    return result.code;
  } catch (e) {
    // Fallback: skip DCE pass if esbuild not available
    return code;
  }
}

/**
 * Pass 2: terser — aggressive 3-pass minification + mangle.
 */
async function terserMinify(code, filename, isProduction) {
  try {
    const { minify } = require('terser');
    const result = await minify(code, {
      compress: {
        dead_code: true,
        drop_console: isProduction,
        drop_debugger: true,
        passes: 3,
        collapse_vars: true,
        reduce_vars: true,
        pure_getters: true,
        toplevel: false
      },
      mangle: {
        reserved: MANGLE_RESERVED
      },
      format: {
        comments: false,
        preamble: `/* VocalIA Widget v2.7.0 - ${new Date().toISOString().split('T')[0]} */`
      }
    });
    return result.code;
  } catch (e) {
    console.error(`  ⚠️  Minification failed for ${filename}: ${e.message}`);
    return null;
  }
}

/**
 * Full pipeline: esbuild DCE → terser minification → pre-compression.
 * Returns { minified, gzipped, brotli } buffers.
 */
async function optimizeCode(code, filename, isProduction) {
  // Pass 1: esbuild DCE
  const dced = esbuildDCE(code, isProduction);

  // Pass 2: terser minification
  const minified = await terserMinify(dced, filename, isProduction);
  if (!minified) return null;

  // Pass 3: pre-compression
  const minBuf = Buffer.from(minified);
  const gzipped = zlib.gzipSync(minBuf, { level: 9 });
  const brotli = zlib.brotliCompressSync(minBuf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
  });

  return { minified, gzipped, brotli };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const skipMinify = process.argv.includes('--no-minify');
  const isProduction = process.argv.includes('--production');
  let errors = 0;
  const summary = [];

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     VocalIA Widget Build v2.0 (tree-shaking pipeline)   ║');
  console.log(`║     Mode: ${checkOnly ? 'CHECK' : 'BUILD'}${skipMinify ? ' (no-minify)' : ''}${isProduction ? ' [PRODUCTION]' : ''}                          ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── Build bundles ──
  for (const [outputFile, config] of Object.entries(BUNDLES)) {
    console.log(`📦 ${outputFile} (${config.description})`);

    const parts = [];
    let allExist = true;

    for (const srcFile of config.sources) {
      const srcPath = path.join(WIDGET_SRC, srcFile);
      if (!fs.existsSync(srcPath)) {
        console.error(`  ❌ Source missing: ${srcFile}`);
        allExist = false;
        errors++;
        continue;
      }
      const content = fs.readFileSync(srcPath, 'utf-8');
      const lines = content.split('\n').length;
      console.log(`  ✅ ${srcFile} (${lines} lines)`);
      parts.push(content);
    }

    if (!allExist) {
      console.log(`  ⚠️  Skipped — missing source files\n`);
      continue;
    }

    const bundled = parts.join('');
    const bundleMd5 = md5(bundled);
    const destPath = path.join(DEPLOYED, outputFile);

    if (checkOnly) {
      if (fs.existsSync(destPath)) {
        const deployed = fs.readFileSync(destPath, 'utf-8');
        const deployedMd5 = md5(deployed);
        if (bundleMd5 === deployedMd5) {
          console.log(`  ✅ Deployed matches source (${bundleMd5})`);
        } else {
          console.log(`  ⚠️  DRIFT detected:`);
          console.log(`     Source MD5:   ${bundleMd5}`);
          console.log(`     Deployed MD5: ${deployedMd5}`);
          console.log(`     Run without --check to rebuild`);
          errors++;
        }
      } else {
        console.log(`  ❌ Deployed file missing: ${outputFile}`);
        errors++;
      }
    } else {
      fs.writeFileSync(destPath, bundled, 'utf-8');
      const rawSize = Buffer.byteLength(bundled);
      console.log(`  → Written: ${bundled.split('\n').length} lines (${fmtKb(rawSize)} KB), MD5: ${bundleMd5}`);

      // Optimize
      if (!skipMinify) {
        const result = await optimizeCode(bundled, outputFile, isProduction);
        if (result) {
          const minPath = destPath.replace('.js', '.min.js');
          fs.writeFileSync(minPath, result.minified, 'utf-8');
          fs.writeFileSync(minPath + '.gz', result.gzipped);
          fs.writeFileSync(minPath + '.br', result.brotli);

          const minSize = Buffer.byteLength(result.minified);
          const gzSize = result.gzipped.length;
          const brSize = result.brotli.length;
          const savings = ((1 - minSize / rawSize) * 100).toFixed(0);

          console.log(`  → Minified:   ${fmtKb(minSize)} KB (-${savings}%)`);
          console.log(`  → Gzip:       ${fmtKb(gzSize)} KB (transfer size)`);
          console.log(`  → Brotli:     ${fmtKb(brSize)} KB (optimal transfer)`);

          summary.push({
            name: outputFile.replace('.js', ''),
            raw: rawSize, min: minSize, gz: gzSize, br: brSize
          });
        }
      }
    }
    console.log();
  }

  // ── Check/build single-file widgets ──
  console.log('📄 Single-file widgets:');
  for (const { src, dest } of SINGLE_FILE_WIDGETS) {
    const srcPath = path.join(WIDGET_SRC, src);
    const destPath = path.join(DEPLOYED, dest);

    if (!fs.existsSync(srcPath)) {
      console.error(`  ❌ Source missing: ${src}`);
      errors++;
      continue;
    }

    const srcContent = fs.readFileSync(srcPath, 'utf-8');
    const srcMd5 = md5(srcContent);

    if (checkOnly) {
      if (fs.existsSync(destPath)) {
        const deployedContent = fs.readFileSync(destPath, 'utf-8');
        const deployedMd5 = md5(deployedContent);
        if (srcMd5 === deployedMd5) {
          console.log(`  ✅ ${dest}: source = deployed (${srcMd5})`);
        } else {
          console.log(`  ⚠️  ${dest}: DRIFT (src=${srcMd5} vs deployed=${deployedMd5})`);
          errors++;
        }
      } else {
        console.log(`  ❌ ${dest}: deployed file missing`);
        errors++;
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
      const rawSize = Buffer.byteLength(srcContent);
      console.log(`  → ${dest}: copied (${fmtKb(rawSize)} KB, ${srcMd5})`);

      // Optimize
      if (!skipMinify) {
        const result = await optimizeCode(srcContent, dest, isProduction);
        if (result) {
          const minPath = destPath.replace('.js', '.min.js');
          fs.writeFileSync(minPath, result.minified, 'utf-8');
          fs.writeFileSync(minPath + '.gz', result.gzipped);
          fs.writeFileSync(minPath + '.br', result.brotli);

          const minSize = Buffer.byteLength(result.minified);
          const gzSize = result.gzipped.length;
          const brSize = result.brotli.length;
          const savings = ((1 - minSize / rawSize) * 100).toFixed(0);

          console.log(`  → ${dest.replace('.js', '.min.js')}: ${fmtKb(minSize)} KB (-${savings}%)`);
          console.log(`  → Gzip:   ${fmtKb(gzSize)} KB  |  Brotli: ${fmtKb(brSize)} KB`);

          summary.push({
            name: dest.replace('.js', ''),
            raw: rawSize, min: minSize, gz: gzSize, br: brSize
          });
        }
      }
    }
  }

  console.log();

  // ── Transfer size summary table ──
  if (summary.length > 0 && !checkOnly) {
    console.log('┌──────────────────────────────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('│ Widget                           │ Raw      │ Min      │ Gzip     │ Brotli   │');
    console.log('├──────────────────────────────────┼──────────┼──────────┼──────────┼──────────┤');
    for (const s of summary) {
      const name = s.name.padEnd(32);
      const raw = (fmtKb(s.raw) + ' KB').padStart(8);
      const min = (fmtKb(s.min) + ' KB').padStart(8);
      const gz = (fmtKb(s.gz) + ' KB').padStart(8);
      const br = (fmtKb(s.br) + ' KB').padStart(8);
      console.log(`│ ${name} │ ${raw} │ ${min} │ ${gz} │ ${br} │`);
    }
    console.log('└──────────────────────────────────┴──────────┴──────────┴──────────┴──────────┘');
    console.log();
  }

  // ── Generate SRI hashes ──
  if (!checkOnly) {
    generateSRIHashes();
    updatePluginSRIHashes();
  }

  // ── Summary ──
  if (errors > 0) {
    console.log(`❌ ${errors} issue(s) found`);
    process.exit(1);
  } else {
    console.log(checkOnly ? '✅ All widgets in sync' : '✅ All widgets built successfully');
  }
}

/**
 * Generate SRI (Subresource Integrity) SHA-384 hashes for all deployed JS files.
 * Writes sri-hashes.json — single source of truth for all plugins and pages.
 */
function generateSRIHashes() {
  const SRI_FILE = path.join(DEPLOYED, 'sri-hashes.json');
  const hashes = {};
  const files = fs.readdirSync(DEPLOYED)
    .filter(f => f.endsWith('.js') && !f.endsWith('.min.js') && !f.endsWith('.map'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(DEPLOYED, file));
    const hash = crypto.createHash('sha384').update(content).digest('base64');
    hashes[file] = `sha384-${hash}`;
  }
  fs.writeFileSync(SRI_FILE, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`\n🔒 SRI hashes: ${Object.keys(hashes).length} files → sri-hashes.json`);
  return hashes;
}

/**
 * Auto-update SRI constants in PHP plugins and HTML snippets.
 * Reads sri-hashes.json and replaces hardcoded hashes in plugin source files.
 */
function updatePluginSRIHashes() {
  const SRI_FILE = path.join(DEPLOYED, 'sri-hashes.json');
  if (!fs.existsSync(SRI_FILE)) return;

  const hashes = JSON.parse(fs.readFileSync(SRI_FILE, 'utf-8'));
  const sriEcom = hashes['voice-widget-ecommerce.js'] || '';
  const sriB2b = hashes['voice-widget-b2b.js'] || '';
  if (!sriEcom || !sriB2b) return;

  const SRI_MARKER = '// Auto-updated by build-widgets.cjs';
  let updated = 0;

  // PHP plugins — inject/replace SRI constants
  const phpPlugins = [
    path.join(ROOT, 'integrations/wordpress/vocalia-voice-assistant/vocalia-voice-assistant.php'),
    path.join(ROOT, 'integrations/prestashop/vocalia.php'),
    path.join(ROOT, 'integrations/joomla/src/Extension/Vocalia.php'),
    path.join(ROOT, 'integrations/drupal/vocalia.module'),
    path.join(ROOT, 'integrations/magento/Block/Widget.php'),
    path.join(ROOT, 'integrations/opencart/upload/catalog/controller/extension/module/vocalia.php'),
  ];

  for (const file of phpPlugins) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf-8');
    // Replace existing SRI hashes — handles both:
    //   const FOO = 'sha384-...'   (class constant)
    //   define('FOO', 'sha384-...') (define — has extra quotes between name and value)
    const before = content;
    content = content.replace(/(VOCALIA_SRI_ECOMMERCE.*?')sha384-[A-Za-z0-9+/=]+'/g, `$1${sriEcom}'`);
    content = content.replace(/(VOCALIA_SRI_B2B.*?')sha384-[A-Za-z0-9+/=]+'/g, `$1${sriB2b}'`);
    if (content !== before) {
      fs.writeFileSync(file, content, 'utf-8');
      updated++;
    }
  }

  // BigCommerce HTML — replace integrity attribute value
  const bigcFile = path.join(ROOT, 'integrations/bigcommerce/vocalia-bigcommerce-script.html');
  if (fs.existsSync(bigcFile)) {
    let content = fs.readFileSync(bigcFile, 'utf-8');
    const before = content;
    content = content.replace(/integrity="sha384-[A-Za-z0-9+/=]+"/, `integrity="${sriEcom}"`);
    if (content !== before) {
      fs.writeFileSync(bigcFile, content, 'utf-8');
      updated++;
    }
  }

  // HTML snippets — replace integrity attribute values (default to b2b widget)
  const htmlSnippets = [
    path.join(ROOT, 'integrations/squarespace/vocalia-squarespace-injection.html'),
    path.join(ROOT, 'integrations/webflow/vocalia-webflow-embed.html'),
  ];
  for (const file of htmlSnippets) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf-8');
    const before = content;
    content = content.replace(/integrity="sha384-[A-Za-z0-9+/=]+"/, `integrity="${sriB2b}"`);
    if (content !== before) {
      fs.writeFileSync(file, content, 'utf-8');
      updated++;
    }
  }

  // Wix comment snippet — integrity attribute in documentation
  const wixFile = path.join(ROOT, 'integrations/wix/vocalia-wix-custom-element.js');
  if (fs.existsSync(wixFile)) {
    let content = fs.readFileSync(wixFile, 'utf-8');
    const before = content;
    content = content.replace(/integrity="sha384-[A-Za-z0-9+/=]+"/, `integrity="${sriB2b}"`);
    if (content !== before) {
      fs.writeFileSync(wixFile, content, 'utf-8');
      updated++;
    }
  }

  // GTM tag — SRI object with both hashes
  const gtmFile = path.join(ROOT, 'integrations/gtm/vocalia-gtm-tag.html');
  if (fs.existsSync(gtmFile)) {
    let content = fs.readFileSync(gtmFile, 'utf-8');
    const before = content;
    content = content.replace(
      /('voice-widget-ecommerce\.js':\s*')sha384-[A-Za-z0-9+/=]+'/,
      `$1${sriEcom}'`
    );
    content = content.replace(
      /('voice-widget-b2b\.js':\s*')sha384-[A-Za-z0-9+/=]+'/,
      `$1${sriB2b}'`
    );
    if (content !== before) {
      fs.writeFileSync(gtmFile, content, 'utf-8');
      updated++;
    }
  }

  console.log(`🔒 SRI auto-updated: ${updated} plugin files`);
}

main();
