#!/usr/bin/env node
/**
 * Restore Inline CTA - Replace dynamic component with inline HTML
 * The JS fetch approach doesn't work reliably on static hosts
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.join(__dirname, '..');

// The CTA HTML to inject (single source - copy this block)
const CTA_HTML = `  <!-- Newsletter CTA -->
  <section class="py-12 bg-slate-900/50" id="newsletter">
    <div class="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="glass rounded-2xl p-6 md:p-8 border border-slate-700/50">
        <div class="text-center mb-6">
          <h3 class="text-lg md:text-xl font-semibold text-white mb-2">
            Restez informé des actualités <span class="gradient-text">Voice AI</span>
          </h3>
          <p class="text-slate-400 text-sm">
            Recevez nos conseils Voice AI et mises à jour produit.
          </p>
        </div>
        <form class="flex flex-col sm:flex-row gap-3" onsubmit="event.preventDefault(); this.querySelector('button').textContent = '✓ Inscrit!'; this.querySelector('button').disabled = true;">
          <input
            type="email"
            placeholder="votre@email.com"
            class="flex-1 px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-vocalia-400 focus:ring-1 focus:ring-vocalia-400/20 transition text-sm"
            required
            aria-label="Adresse email"
          >
          <button type="submit" class="px-5 py-2.5 bg-vocalia-500 hover:bg-vocalia-400 rounded-lg font-semibold text-sm text-white transition-all whitespace-nowrap">
            S'inscrire
          </button>
        </form>
      </div>
    </div>
  </section>`;

// Pattern to find the component placeholder
const COMPONENT_PATTERN = /\s*<!-- Newsletter CTA \(Shared Component\) -->\s*\n\s*<div data-component="newsletter-cta"><\/div>/g;

// Pattern to remove components.js script
const SCRIPT_PATTERN = /\s*<!-- Component Loader -->\s*\n\s*<script src="\/src\/lib\/components\.js" defer><\/script>\s*\n?/g;

// All HTML files to process
const files = [];

function findHtmlFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findHtmlFiles(fullPath);
    } else if (item.endsWith('.html') && !item.includes('newsletter-cta')) {
      files.push(fullPath);
    }
  }
}

findHtmlFiles(WEBSITE_DIR);

let fixed = 0;
let skipped = 0;

for (const filePath of files) {
  const relPath = path.relative(WEBSITE_DIR, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace component placeholder with inline CTA
  if (content.includes('data-component="newsletter-cta"')) {
    content = content.replace(COMPONENT_PATTERN, '\n' + CTA_HTML);
    modified = true;
  }

  // Remove components.js script reference
  if (content.includes('components.js')) {
    content = content.replace(SCRIPT_PATTERN, '\n');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${relPath}`);
    fixed++;
  } else {
    skipped++;
  }
}

console.log(`\n📊 Summary: ${fixed} fixed, ${skipped} skipped`);
