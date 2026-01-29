#!/usr/bin/env node
/**
 * Fix Newsletter CTA - Replace duplicate CTAs with shared component
 * Run: node website/scripts/fix-newsletter-cta.js
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.join(__dirname, '..');

// Files to process (excluding index.html and blog/index.html already fixed)
const FILES_TO_PROCESS = [
  'about.html',
  'contact.html',
  'pricing.html',
  'terms.html',
  'privacy.html',
  'features.html',
  'integrations.html',
  'docs/index.html',
  'docs/api.html',
  'industries/index.html',
  'industries/healthcare.html',
  'industries/real-estate.html',
  'industries/finance.html',
  'industries/retail.html',
  'use-cases/lead-qualification.html',
  'use-cases/customer-support.html',
  'use-cases/e-commerce.html',
  'use-cases/appointments.html',
  'products/voice-widget.html',
  'products/voice-telephony.html',
  'blog/articles/ai-act-europe-voice-ai.html',
  'blog/articles/vocalia-lance-support-darija.html',
  'blog/articles/integrer-vocalia-shopify.html',
  'blog/articles/clinique-amal-rappels-vocaux.html',
  'blog/articles/rgpd-voice-ai-guide-2026.html',
  'blog/articles/reduire-couts-support-voice-ai.html',
  'blog/articles/agence-immo-plus-conversion.html'
];

// Pattern: Footer newsletter section to remove
const FOOTER_NEWSLETTER_PATTERN = /<!-- Newsletter Section -->\s*<div class="border-b border-slate-800">\s*<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">\s*<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">\s*<div class="lg:max-w-md">\s*<h3 class="text-xl font-bold text-white mb-2">Restez informé<\/h3>\s*<p class="text-zinc-400 text-sm">Recevez nos dernières actualités sur l'IA vocale et les nouvelles fonctionnalités\.<\/p>\s*<\/div>\s*<form[^>]*>[^]*?<\/form>\s*<\/div>\s*<\/div>\s*<\/div>\s*/g;

// Pattern: Add component before footer
const FOOTER_START_PATTERN = /(<footer class="bg-slate-900 border-t border-slate-800">)/;

// Pattern: Check if components.js already added
const COMPONENTS_SCRIPT_CHECK = /components\.js/;

// Pattern: Add script before Lucide
const LUCIDE_PATTERN = /(<!-- Lucide Icons[^>]*-->\s*<script src="https:\/\/unpkg\.com\/lucide)/;

let processed = 0;
let skipped = 0;
let errors = 0;

for (const relPath of FILES_TO_PROCESS) {
  const filePath = path.join(WEBSITE_DIR, relPath);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skip (not found): ${relPath}`);
    skipped++;
    continue;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Remove footer newsletter section
    if (FOOTER_NEWSLETTER_PATTERN.test(content)) {
      content = content.replace(FOOTER_NEWSLETTER_PATTERN, '');
      modified = true;
    }

    // 2. Add component placeholder before footer (if not already there)
    if (!content.includes('data-component="newsletter-cta"')) {
      content = content.replace(
        FOOTER_START_PATTERN,
        '  <!-- Newsletter CTA (Shared Component) -->\n  <div data-component="newsletter-cta"></div>\n\n  $1'
      );
      modified = true;
    }

    // 3. Add components.js script (if not already there)
    if (!COMPONENTS_SCRIPT_CHECK.test(content)) {
      content = content.replace(
        LUCIDE_PATTERN,
        '<!-- Component Loader -->\n    <script src="/src/lib/components.js" defer></script>\n\n    $1'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${relPath}`);
      processed++;
    } else {
      console.log(`⏭️  Skip (already fixed): ${relPath}`);
      skipped++;
    }
  } catch (error) {
    console.error(`❌ Error: ${relPath} - ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Summary: ${processed} fixed, ${skipped} skipped, ${errors} errors`);
