'use strict';

/**
 * Build Plugin ZIPs — VocalIA
 *
 * Creates distributable ZIP archives for CMS plugins:
 * - WordPress: vocalia-voice-assistant.zip
 * - PrestaShop: vocalia.zip
 * - Joomla: vocalia-joomla.zip
 * - Drupal: vocalia-drupal.zip
 * - Magento: vocalia-magento.zip
 * - OpenCart: vocalia-opencart.zip
 *
 * Output: dist/plugins/*.zip
 *
 * Usage:
 *   node scripts/build-plugin-zips.cjs           # Build all
 *   node scripts/build-plugin-zips.cjs wordpress  # Build one
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'plugins');
const WEB_DOWNLOADS = path.join(ROOT, 'website', 'downloads');

// Plugin definitions: source dir → zip name → internal folder name
const PLUGINS = {
  wordpress: {
    src: 'integrations/wordpress/vocalia-voice-assistant',
    zip: 'vocalia-voice-assistant.zip',
    folder: 'vocalia-voice-assistant'
  },
  prestashop: {
    src: 'integrations/prestashop',
    zip: 'vocalia.zip',
    folder: 'vocalia'
  },
  joomla: {
    src: 'integrations/joomla',
    zip: 'vocalia-joomla.zip',
    folder: 'vocalia'
  },
  drupal: {
    src: 'integrations/drupal',
    zip: 'vocalia-drupal.zip',
    folder: 'vocalia'
  },
  magento: {
    src: 'integrations/magento',
    zip: 'vocalia-magento.zip',
    folder: 'VocalIA/VoiceAssistant',
    excludeFlat: true
  },
  opencart: {
    src: 'integrations/opencart',
    zip: 'vocalia-opencart.zip',
    folder: 'vocalia-opencart',
    ocmod: true
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildZip(name, config) {
  const srcPath = path.join(ROOT, config.src);
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ [${name}] Source not found: ${config.src}`);
    return false;
  }

  const zipPath = path.join(DIST, config.zip);

  // Remove old ZIP if exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const excludes = '-x "*.DS_Store" -x "__MACOSX/*" -x "*/vendor/*" -x "*/tests/*" -x "*/composer.lock" -x "*/phpunit.xml" -x "*/composer.json" -x "*/.phpunit.result.cache"';

  // For nested folder names (e.g. VocalIA/VoiceAssistant), use a temp staging dir
  if (config.folder.includes('/')) {
    const tmpDir = path.join(ROOT, 'dist', '.tmp-zip-' + name);
    const targetDir = path.join(tmpDir, config.folder);
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    // Copy source files (excluding tests, vendor, etc.)
    copyDirFiltered(srcPath, targetDir);
    try {
      const topFolder = config.folder.split('/')[0];
      execSync(`cd "${tmpDir}" && zip -r "${zipPath}" "${topFolder}" ${excludes}`, { stdio: 'pipe' });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  } else if (config.ocmod) {
    // OpenCart OCMOD: zip install.xml + upload/ from source dir
    execSync(`cd "${srcPath}" && zip -r "${zipPath}" install.xml upload/ ${excludes}`, { stdio: 'pipe' });
  } else {
    // Standard: symlink approach for flat renames
    const parentDir = path.dirname(srcPath);
    const folderName = path.basename(srcPath);
    let cleanup = null;
    let zipTarget = folderName;

    if (folderName !== config.folder) {
      const linkPath = path.join(parentDir, config.folder);
      if (!fs.existsSync(linkPath)) {
        fs.symlinkSync(srcPath, linkPath);
        cleanup = linkPath;
      }
      zipTarget = config.folder;
    }

    try {
      execSync(`cd "${parentDir}" && zip -r "${zipPath}" "${zipTarget}" ${excludes}`, { stdio: 'pipe' });
    } finally {
      if (cleanup && fs.existsSync(cleanup)) {
        fs.unlinkSync(cleanup);
      }
    }
  }

  const stats = fs.statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  // Also copy to website/downloads/ for static serving
  if (fs.existsSync(WEB_DOWNLOADS)) {
    fs.copyFileSync(zipPath, path.join(WEB_DOWNLOADS, config.zip));
  }

  console.log(`✅ [${name}] ${config.zip} (${sizeKB} KB)`);
  return true;
}

/**
 * Copy directory contents excluding tests, vendor, phpunit, composer files
 */
function copyDirFiltered(src, dest) {
  const EXCLUDE = ['tests', 'vendor', 'phpunit.xml', 'composer.json', 'composer.lock', '.phpunit.result.cache', '.DS_Store'];
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.includes(entry.name)) continue;
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destEntry, { recursive: true });
      copyDirFiltered(srcEntry, destEntry);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

function main() {
  const target = process.argv[2]; // optional: 'wordpress', 'prestashop', etc.

  console.log('📦 Building VocalIA Plugin ZIPs...\n');
  ensureDir(DIST);

  let built = 0;
  let failed = 0;

  const targets = target ? { [target]: PLUGINS[target] } : PLUGINS;

  if (target && !PLUGINS[target]) {
    console.error(`❌ Unknown plugin: ${target}`);
    console.log(`Available: ${Object.keys(PLUGINS).join(', ')}`);
    process.exit(1);
  }

  for (const [name, config] of Object.entries(targets)) {
    if (buildZip(name, config)) {
      built++;
    } else {
      failed++;
    }
  }

  console.log(`\n📊 Built: ${built}, Failed: ${failed}`);
  console.log(`📁 Output: ${DIST}/`);

  if (failed > 0) process.exit(1);
}

// Export for programmatic use (by voice-api download endpoint)
function getZipPath(platform) {
  const config = PLUGINS[platform];
  if (!config) return null;
  const zipPath = path.join(DIST, config.zip);
  return fs.existsSync(zipPath) ? zipPath : null;
}

function getAvailablePlugins() {
  return Object.entries(PLUGINS).map(([name, config]) => {
    const zipPath = path.join(DIST, config.zip);
    const exists = fs.existsSync(zipPath);
    let size = 0;
    if (exists) {
      size = fs.statSync(zipPath).size;
    }
    return { name, zip: config.zip, exists, size };
  });
}

module.exports = { buildZip, getZipPath, getAvailablePlugins, PLUGINS, DIST };

if (require.main === module) {
  main();
}
