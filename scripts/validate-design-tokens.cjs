'use strict';

/**
 * VocalIA Design Token Validator
 * Scans HTML files for forbidden/rogue colors and inconsistent patterns.
 * Run: node scripts/validate-design-tokens.cjs
 *
 * Session 250.122 | 07/02/2026
 */

const fs = require('fs');
const path = require('path');

// ── Approved palette (from homepage + input.css @theme) ──
const APPROVED_HEX = new Set([
  '#050505', // quantum-void (body)
  '#09090b', // surface-900 (nav, footer)
  '#0c0c0f', // surface-800 (dropdowns, cards)
  '#111114', // surface-700
  '#18181b', // surface-600
  '#27272a', // surface-500
  '#3f3f46', // surface-400
  '#52525b', // surface-300
  '#71717a', // surface-200 / zinc-500
  '#a1a1aa', // surface-100 / zinc-400
  '#fafafa', // surface-50 / zinc-50
  '#f4f4f5', '#e4e4e7', '#d4d4d8', // zinc 100-300
  '#5e6ad2', '#5E6AD2', // vocalia primary
  '#a5b4fc', // indigo-300
  '#60a5fa', '#3b82f6', '#2563eb', // blue
  '#a78bfa', '#8b5cf6', '#7c3aed', // violet
  '#34d399', '#10b981', '#059669', // emerald
  '#fbbf24', '#f59e0b', // amber
  '#fb7185', '#f43f5e', '#e11d48', // rose
  '#1e293b', '#334155', '#475569', '#64748b', // bg-base/raised/elevated/overlay
  // Extended Tailwind palette (used in features, blog, docs, auth)
  '#6366f1', '#4f46e5', '#818cf8', '#c4b5fd', // indigo extended
  '#a855f7', '#c792ea', // purple
  '#22c55e', '#6ee7b7', // green
  '#ef4444', '#f87171', // red
  '#f97316', '#fb923c', '#fdba74', // orange
  '#06b6d4', // cyan
  '#94a3b8', '#cbd5e1', '#e2e8f0', // slate
  '#0f172a', '#0f0f23', // slate-900 / dark variants
  '#667eea', '#764ba2', '#4f5abd', // auth gradient
  '#c3e88d', '#82aaff', '#546e7a', // syntax highlight (code blocks)
  '#4285f4', '#34a853', '#fbbc05', '#ea4335', // Google brand (OAuth)
]);

// ── Explicitly forbidden colors ──
const FORBIDDEN_HEX = {
  '#0c0e1a': 'Blue-tint rogue. Use #0c0c0f (surface-800)',
  '#0a0a0a': 'Off-void rogue. Use #050505 (quantum-void)',
  '#1a1a2e': 'Purple-tint rogue. Use surface colors',
  '#0d0d12': 'Rogue dark. Use #0c0c0f (surface-800)',
  '#1e1e2e': 'Rogue blue-dark. Use #18181b (surface-600)',
};

// ── Forbidden patterns (regex + reason) ──
const FORBIDDEN_PATTERNS = [
  {
    regex: /<section[^>]*bg-white\/\[0\.02\]/g,
    reason: 'bg-white/[0.02] on <section> creates banding. Use transparent body.'
  },
  {
    regex: /to-\[#0a0a0a\]/g,
    reason: 'Gradient endpoint #0a0a0a != body #050505. Use to-[#050505].'
  },
  {
    regex: /via-\[#0a0a0a\]/g,
    reason: 'Gradient via-stop #0a0a0a != body #050505. Use via-[#050505].'
  },
  {
    regex: /bg-\[#0c0e1a\]/g,
    reason: 'Rogue color #0c0e1a. Use bg-[#0c0c0f] (surface-800).'
  },
  {
    regex: /\/\[0\.92\]/g,
    reason: '92% opacity = semi-transparent. Use 100% opaque or /95 minimum.'
  },
];

// ── Scan all HTML files ──
function findHtmlFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !['node_modules', '.git', 'coverage', 'clients'].includes(item.name)) {
      results.push(...findHtmlFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function validate() {
  const websiteDir = path.join(__dirname, '..', 'website');
  const files = findHtmlFiles(websiteDir);
  let totalErrors = 0;
  let totalWarnings = 0;
  const errors = [];
  const warnings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(path.join(__dirname, '..'), file);
    const lines = content.split('\n');

    // Check forbidden hex colors
    for (const [hex, reason] of Object.entries(FORBIDDEN_HEX)) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(hex)) {
          errors.push(`${relPath}:${i + 1} FORBIDDEN ${hex} — ${reason}`);
          totalErrors++;
        }
      }
    }

    // Check forbidden patterns
    for (const { regex, reason } of FORBIDDEN_PATTERNS) {
      const globalRegex = new RegExp(regex.source, 'g');
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        errors.push(`${relPath}:${lineNum} FORBIDDEN PATTERN ${match[0]} — ${reason}`);
        totalErrors++;
      }
    }

    // Check for unapproved arbitrary hex colors (warnings)
    const hexMatches = content.matchAll(/#[0-9a-fA-F]{6}/g);
    for (const match of hexMatches) {
      const hex = match[0].toLowerCase();
      if (!APPROVED_HEX.has(hex) && !FORBIDDEN_HEX[hex]) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNum - 1] || '';
        // Skip if it's inside a <script> or <style> or HTML entities
        if (!line.includes('&#x') && !line.includes('script')) {
          warnings.push(`${relPath}:${lineNum} UNKNOWN HEX ${match[0]} — not in approved palette`);
          totalWarnings++;
        }
      }
    }
  }

  // ── Report ──
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     VocalIA Design Token Validator v1.0         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Scanned: ${files.length} HTML files\n`);

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${totalErrors}):`);
    for (const e of errors) {
      console.log(`  ${e}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${totalWarnings}):`);
    for (const w of warnings) {
      console.log(`  ${w}`);
    }
    console.log();
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('✅ All design tokens are consistent with the approved palette.');
  } else if (totalErrors === 0) {
    console.log(`✅ No forbidden colors. ${totalWarnings} unknown hex values (review recommended).`);
  } else {
    console.log(`❌ ${totalErrors} errors, ${totalWarnings} warnings. Fix errors before committing.`);
    process.exit(1);
  }
}

validate();
