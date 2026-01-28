#!/usr/bin/env node
/**
 * Update HTML files to use minified voice widget
 */

const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join(__dirname, '..', 'website');

// Get all HTML files
function getHtmlFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.')) {
      files.push(...getHtmlFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

let modified = 0;

const htmlFiles = getHtmlFiles(SITE_DIR);

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  const relPath = path.relative(SITE_DIR, file);

  // Update FR voice widget
  if (content.includes('voice-widget.js') && !content.includes('voice-widget.min.js')) {
    content = content.replace(
      /voice-widget\.js(\?v=[0-9.]+)?/g,
      'voice-widget.min.js$1'
    );
    changed = true;
  }

  // Update EN voice widget
  if (content.includes('voice-widget-en.js') && !content.includes('voice-widget-en.min.js')) {
    content = content.replace(
      /voice-widget-en\.js(\?v=[0-9.]+)?/g,
      'voice-widget-en.min.js$1'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`✅ Updated: ${relPath}`);
    modified++;
  }
}

console.log(`\nUpdated ${modified} files to use minified voice widget`);
