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
  'voice-widget-ecommerce.js': {
    sources: [
      'voice-widget-v3.js',
      'abandoned-cart-recovery.js',
      'voice-quiz.js',
      'spin-wheel.js',
      'free-shipping-bar.js',
      'recommendation-carousel.js'
    ],
    description: 'E-commerce widget (core + cart recovery + quiz + gamification + shipping bar + recommendations)'
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
        preamble: `/* VocalIA Widget v2.5.0 - ${new Date().toISOString().split('T')[0]} */`
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

  // ── Summary ──
  if (errors > 0) {
    console.log(`❌ ${errors} issue(s) found`);
    process.exit(1);
  } else {
    console.log(checkOnly ? '✅ All widgets in sync' : '✅ All widgets built successfully');
  }
}

main();
