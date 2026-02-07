#!/usr/bin/env node
'use strict';

/**
 * VocalIA Widget Build Script
 * Concatenates source widget IIFEs into deployed bundles + checksums.
 *
 * Usage: node scripts/build-widgets.cjs [--check]
 *   --check: Verify deployed matches source (no write)
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
      'voice-quiz.js'
    ],
    description: 'E-commerce widget (core + cart recovery + quiz)'
  }
};

// B2B widget is a single-file deploy (source = deployed)
const SINGLE_FILE_WIDGETS = [
  { src: 'voice-widget-b2b.js', dest: 'voice-widget-b2b.js' }
];

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  let errors = 0;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VocalIA Widget Build Script          ║');
  console.log(`║     Mode: ${checkOnly ? 'CHECK' : 'BUILD'}                          ║`);
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

    const bundled = parts.join('\n\n');
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
      console.log(`  → Written: ${lines} lines, MD5: ${bundleMd5}`);
    }
    console.log();
  }

  // ── Check single-file widgets ──
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
      console.log(`  → ${dest}: copied (${srcMd5})`);
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
