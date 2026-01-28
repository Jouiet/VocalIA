#!/usr/bin/env node
/**
 * stitch-to-3a-css.cjs
 *
 * Converts Google Stitch UI components (Tailwind CSS) to 3A Automation design system.
 *
 * Usage:
 *   node stitch-to-3a-css.cjs <input.html> [--output=output.html]
 *   node stitch-to-3a-css.cjs --health
 *   node stitch-to-3a-css.cjs --batch assets/stitch/
 *
 * @version 1.0.0
 * @session 163
 * @author Claude Code for 3A Automation
 */

const fs = require('fs');
const path = require('path');

// 3A Design System Tokens
const DESIGN_TOKENS = {
  colors: {
    '#191E35': 'var(--secondary)',
    '#4FBAF1': 'var(--primary)',
    '#10B981': 'var(--accent)',
    '#8B5CF6': 'var(--purple)',
    '#F59E0B': 'var(--orange)',
    '#95bf47': 'var(--shopify-green)',
    '#7f0df2': 'var(--purple)',
    '#191022': 'var(--bg-dark)',
    '#1a1023': 'var(--bg-dark)',
    '#1B2F54': 'var(--secondary-light)',
  },

  // Tailwind to 3A class mappings
  classMap: {
    // Glassmorphism
    'bg-white/3': 'glass-bg',
    'backdrop-blur-md': 'glass-backdrop',
    'backdrop-blur-[20px]': 'glass-backdrop',
    'border-white/10': 'glass-border',

    // Typography
    'font-extrabold': 'font-bold',
    'tracking-tight': '', // Not needed, handled by 3A font
    'leading-tight': '',

    // Layout
    'rounded-2xl': 'rounded-lg',
    'rounded-xl': 'rounded-lg',
    'rounded-lg': 'rounded-md',
    'rounded-full': 'rounded-full',

    // Spacing (keep Tailwind for now, could map to 3A vars)
    'gap-6': 'gap-lg',
    'gap-8': 'gap-xl',
    'p-8': 'p-xl',
    'px-6': 'px-lg',
    'py-4': 'py-md',

    // Buttons
    'bg-primary': 'btn-cyber',
    'hover:bg-primary/90': 'btn-cyber',
    'shadow-lg shadow-primary/25': 'btn-glow',
  },

  // Component class conversions
  components: {
    'glass-card': 'glass-panel',
    'mesh-gradient-1': 'mesh-gradient-purple',
    'mesh-gradient-2': 'mesh-gradient-cyan',
  }
};

// CSS Variable definitions for output
const CSS_VARS = `
/* 3A Design System Variables (injected) */
:root {
  --primary: #4FBAF1;
  --secondary: #191E35;
  --accent: #10B981;
  --purple: #8B5CF6;
  --orange: #F59E0B;
  --shopify-green: #95bf47;
  --bg-dark: #191022;
  --secondary-light: #1B2F54;
  --text-light: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.7);
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-backdrop: blur(20px);
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
}
`;

// 3A CSS class definitions
const CLASS_DEFINITIONS = `
/* 3A Glass Panel */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
}

.glass-panel:hover {
  border-color: rgba(79, 186, 241, 0.5);
  box-shadow: 0 0 20px rgba(79, 186, 241, 0.2);
  transform: translateY(-5px);
}

/* 3A Mesh Gradients */
.mesh-gradient-purple {
  background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%);
}

.mesh-gradient-cyan {
  background: radial-gradient(circle, rgba(79,186,241,0.15) 0%, rgba(0,0,0,0) 70%);
}

/* 3A Button Styles */
.btn-cyber {
  background: var(--primary);
  color: var(--text-light);
  font-weight: 700;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
  box-shadow: 0 0 20px rgba(79, 186, 241, 0.25);
}

.btn-cyber:hover {
  background: rgba(79, 186, 241, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(79, 186, 241, 0.4);
}

/* 3A Section Badge */
.section-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  background: rgba(79, 186, 241, 0.1);
  border: 1px solid rgba(79, 186, 241, 0.2);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* 3A Service Icon */
.service-icon-circle {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-icon-circle.purple { background: var(--purple); box-shadow: 0 0 20px rgba(139, 92, 246, 0.2); }
.service-icon-circle.green { background: var(--accent); box-shadow: 0 0 20px rgba(16, 185, 129, 0.2); }
.service-icon-circle.cyan { background: var(--primary); box-shadow: 0 0 20px rgba(79, 186, 241, 0.2); }
.service-icon-circle.orange { background: var(--orange); box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
.service-icon-circle.shopify { background: var(--shopify-green); box-shadow: 0 0 20px rgba(149, 191, 71, 0.2); }
`;

/**
 * Convert hardcoded colors to CSS variables
 */
function convertColors(html) {
  let result = html;

  // Replace inline style colors
  for (const [hex, variable] of Object.entries(DESIGN_TOKENS.colors)) {
    // Replace in bg-[#xxx]
    result = result.replace(new RegExp(`bg-\\[${hex}\\]`, 'gi'), `bg-[${variable}]`);

    // Replace in text-[#xxx]
    result = result.replace(new RegExp(`text-\\[${hex}\\]`, 'gi'), `text-[${variable}]`);

    // Replace in shadow-[#xxx]
    result = result.replace(new RegExp(`shadow-\\[${hex}\\]`, 'gi'), `shadow-[${variable}]`);

    // Replace in border-[#xxx]
    result = result.replace(new RegExp(`border-\\[${hex}\\]`, 'gi'), `border-[${variable}]`);

    // Replace standalone hex colors
    result = result.replace(new RegExp(`"${hex}"`, 'gi'), `"${variable}"`);
    result = result.replace(new RegExp(`:${hex};`, 'gi'), `:${variable};`);
  }

  return result;
}

/**
 * Convert Tailwind classes to 3A classes
 */
function convertClasses(html) {
  let result = html;

  // Replace component class names
  for (const [tailwind, threeA] of Object.entries(DESIGN_TOKENS.components)) {
    result = result.replace(new RegExp(`class="([^"]*?)\\b${tailwind}\\b([^"]*?)"`, 'g'),
      `class="$1${threeA}$2"`);
  }

  return result;
}

/**
 * Remove Tailwind CDN and inject 3A styles
 */
function replaceStylesheet(html, mode = 'inline') {
  let result = html;

  // Remove Tailwind CDN script
  result = result.replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>/g, '');

  // Remove Tailwind config script
  result = result.replace(/<script id="tailwind-config">[\s\S]*?<\/script>/g, '');

  // Remove existing inline style blocks (we'll replace with 3A)
  result = result.replace(/<style>[\s\S]*?<\/style>/g, '');

  if (mode === 'inline') {
    // Inject 3A CSS inline
    const styleBlock = `<style>\n${CSS_VARS}\n${CLASS_DEFINITIONS}\n</style>`;
    result = result.replace('</head>', `${styleBlock}\n</head>`);
  } else if (mode === 'link') {
    // Link to 3A stylesheet
    const link = `<link rel="stylesheet" href="/styles.css?v=84.0">`;
    result = result.replace('</head>', `${link}\n</head>`);
  }

  return result;
}

/**
 * Add 3A branding and meta tags
 */
function addBranding(html, options = {}) {
  let result = html;

  // Update copyright year
  result = result.replace(/© \d{4}/, `© ${new Date().getFullYear()}`);

  // Add 3A meta tags
  const metaTags = `
    <meta name="author" content="3A Automation">
    <meta name="generator" content="Stitch-to-3A-CSS v1.0.0">
    <meta name="stitch-converted" content="${new Date().toISOString()}">
  `;
  result = result.replace('</head>', `${metaTags}\n</head>`);

  return result;
}

/**
 * Main conversion function
 */
function convertStitchTo3A(inputPath, options = {}) {
  const html = fs.readFileSync(inputPath, 'utf-8');

  let result = html;

  // Step 1: Convert colors
  result = convertColors(result);

  // Step 2: Convert classes
  result = convertClasses(result);

  // Step 3: Replace stylesheet
  result = replaceStylesheet(result, options.mode || 'inline');

  // Step 4: Add branding
  result = addBranding(result, options);

  return result;
}

/**
 * Health check
 */
function healthCheck() {
  console.log('✅ stitch-to-3a-css.cjs ready');
  console.log(`   Version: 1.0.0`);
  console.log(`   Design Tokens: ${Object.keys(DESIGN_TOKENS.colors).length} colors`);
  console.log(`   Class Mappings: ${Object.keys(DESIGN_TOKENS.classMap).length}`);
  console.log(`   Component Mappings: ${Object.keys(DESIGN_TOKENS.components).length}`);
  return true;
}

/**
 * Process batch of files
 */
function processBatch(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  const results = [];

  for (const file of files) {
    const inputPath = path.join(dirPath, file);
    const outputPath = path.join(dirPath, '3a-' + file);

    try {
      const converted = convertStitchTo3A(inputPath);
      fs.writeFileSync(outputPath, converted);
      results.push({ file, status: 'OK', output: outputPath });
      console.log(`✅ ${file} → ${outputPath}`);
    } catch (error) {
      results.push({ file, status: 'ERROR', error: error.message });
      console.error(`❌ ${file}: ${error.message}`);
    }
  }

  return results;
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Health check
  if (args.includes('--health')) {
    healthCheck();
    process.exit(0);
  }

  // Batch mode
  const batchArg = args.find(a => a.startsWith('--batch='));
  if (batchArg) {
    const dirPath = batchArg.split('=')[1];
    const results = processBatch(dirPath);
    console.log(`\n📊 Batch complete: ${results.filter(r => r.status === 'OK').length}/${results.length} files converted`);
    process.exit(0);
  }

  // Single file mode
  const inputPath = args.find(a => !a.startsWith('--'));
  if (!inputPath) {
    console.log('Usage:');
    console.log('  node stitch-to-3a-css.cjs <input.html> [--output=output.html]');
    console.log('  node stitch-to-3a-css.cjs --batch=assets/stitch/');
    console.log('  node stitch-to-3a-css.cjs --health');
    process.exit(1);
  }

  // Get output path
  const outputArg = args.find(a => a.startsWith('--output='));
  const outputPath = outputArg
    ? outputArg.split('=')[1]
    : inputPath.replace('.html', '-3a.html');

  // Get mode
  const modeArg = args.find(a => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'inline';

  try {
    const converted = convertStitchTo3A(inputPath, { mode });
    fs.writeFileSync(outputPath, converted);
    console.log(`✅ Converted: ${inputPath} → ${outputPath}`);
    console.log(`   Mode: ${mode}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { convertStitchTo3A, healthCheck, DESIGN_TOKENS };
