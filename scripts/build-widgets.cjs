#!/usr/bin/env node
'use strict';

/**
 * VocalIA Widget Build Script
 * Concatenates source widget IIFEs into deployed bundles + minification + checksums.
 *
 * Usage: node scripts/build-widgets.cjs [--check] [--no-minify]
 *   --check:     Verify deployed matches source (no write)
 *   --no-minify: Skip minification step
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function minifyCode(code, filename) {
  try {
    const { minify } = require('terser');
    const result = await minify(code, {
      compress: {
        dead_code: true,
        drop_console: false, // Keep console.warn/error for debugging
        passes: 2
      },
      mangle: {
        reserved: ['VocalIA', 'VOCALIA_CONFIG', 'VOCALIA_CONFIG_INJECTED']
      },
      format: {
        comments: /^!/,  // Keep /*! banner comments
        preamble: `/* VocalIA Widget - Minified ${new Date().toISOString().split('T')[0]} */`
      }
    });
    return result.code;
  } catch (e) {
    console.error(`  ⚠️  Minification failed for ${filename}: ${e.message}`);
    return null;
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const skipMinify = process.argv.includes('--no-minify');
  let errors = 0;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VocalIA Widget Build Script          ║');
  console.log(`║     Mode: ${checkOnly ? 'CHECK' : 'BUILD'}${skipMinify ? ' (no-minify)' : ''}                          ║`);
  console.log('╚══════════════════════════════════════════╝\n');

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
      const lines = bundled.split('\n').length;
      const sizeKb = (Buffer.byteLength(bundled) / 1024).toFixed(1);
      console.log(`  → Written: ${lines} lines (${sizeKb} KB), MD5: ${bundleMd5}`);

      // Minify
      if (!skipMinify) {
        const minified = await minifyCode(bundled, outputFile);
        if (minified) {
          const minPath = destPath.replace('.js', '.min.js');
          fs.writeFileSync(minPath, minified, 'utf-8');
          const minSizeKb = (Buffer.byteLength(minified) / 1024).toFixed(1);
          const savings = ((1 - Buffer.byteLength(minified) / Buffer.byteLength(bundled)) * 100).toFixed(0);
          console.log(`  → Minified: ${minSizeKb} KB (-${savings}%), MD5: ${md5(minified)}`);
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
      const sizeKb = (Buffer.byteLength(srcContent) / 1024).toFixed(1);
      console.log(`  → ${dest}: copied (${sizeKb} KB, ${srcMd5})`);

      // Minify
      if (!skipMinify) {
        const minified = await minifyCode(srcContent, dest);
        if (minified) {
          const minPath = destPath.replace('.js', '.min.js');
          fs.writeFileSync(minPath, minified, 'utf-8');
          const minSizeKb = (Buffer.byteLength(minified) / 1024).toFixed(1);
          const savings = ((1 - Buffer.byteLength(minified) / Buffer.byteLength(srcContent)) * 100).toFixed(0);
          console.log(`  → ${dest.replace('.js', '.min.js')}: ${minSizeKb} KB (-${savings}%)`)
        }
      }
    }
  }

  console.log();

  // ── Summary ──
  if (errors > 0) {
    console.log(`❌ ${errors} issue(s) found`);
    process.exit(1);
  } else {
    console.log(checkOnly ? '✅ All widgets in sync' : '✅ All widgets built successfully');
  }
}

main();
