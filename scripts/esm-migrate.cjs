'use strict';

/**
 * VocalIA ESM Migration Script
 *
 * Converts CommonJS (.cjs) files to ESM (.mjs) files.
 * Handles: require→import, module.exports→export, __dirname/__filename, cross-references.
 *
 * Usage:
 *   node scripts/esm-migrate.cjs --dry-run     # Show changes without writing
 *   node scripts/esm-migrate.cjs --execute      # Actually perform migration
 *   node scripts/esm-migrate.cjs --execute --dir core   # Only convert core/
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');
const DIR_FILTER = process.argv.find(a => a.startsWith('--dir='))?.split('=')[1]
  || (process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : null);

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node scripts/esm-migrate.cjs --dry-run|--execute [--dir <dir>]');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');

// Directories to migrate
const DIRS = DIR_FILTER
  ? [DIR_FILTER]
  : ['core', 'lib', 'telephony', 'personas', 'scripts', 'test', 'sensors', 'integrations'];

// Files to SKIP (entry points, special files)
const SKIP_FILES = new Set([
  'scripts/esm-migrate.cjs',       // This script
  'scripts/build-widgets.cjs',     // Uses process.argv, stays CJS for now
  'scripts/validate-design-tokens.cjs',
  'scripts/health-check.cjs',
  'scripts/production-monitor.cjs',
  'scripts/voice-widget-templates.cjs',
  'scripts/translation-quality-check.py',
]);

// Node built-in modules (no path change needed)
const BUILTINS = new Set([
  'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util',
  'stream', 'events', 'child_process', 'net', 'tls', 'dns',
  'assert', 'buffer', 'querystring', 'zlib', 'readline',
  'node:fs', 'node:path', 'node:http', 'node:https', 'node:url',
  'node:crypto', 'node:os', 'node:util', 'node:stream', 'node:events',
  'node:child_process', 'node:net', 'node:tls', 'node:dns',
  'node:assert', 'node:buffer', 'node:querystring', 'node:zlib',
  'node:readline', 'node:test', 'node:worker_threads', 'node:perf_hooks',
]);

// Track all files being migrated for cross-reference updates
const migratedFiles = new Map(); // old relative path → new relative path

function collectFiles() {
  const files = [];
  for (const dir of DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      if (!entry.endsWith('.cjs')) continue;
      const relPath = path.join(dir, entry);
      if (SKIP_FILES.has(relPath)) continue;
      files.push(relPath);
    }
  }
  return files;
}

function isBuiltinOrNpm(specifier) {
  if (BUILTINS.has(specifier)) return true;
  // npm packages: don't start with . or /
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return true;
  return false;
}

function convertRequireToImport(line, filePath) {
  // Skip comments
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return line;
  }

  // Pattern 1: const { A, B } = require('module')
  const destructuredMatch = line.match(/^(\s*)const\s+(\{[^}]+\})\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\);?\s*$/);
  if (destructuredMatch) {
    const [, indent, destructured, specifier] = destructuredMatch;
    const newSpec = convertSpecifier(specifier, filePath);
    return `${indent}import ${destructured} from '${newSpec}';`;
  }

  // Pattern 2: const X = require('module')
  const simpleMatch = line.match(/^(\s*)const\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\);?\s*$/);
  if (simpleMatch) {
    const [, indent, name, specifier] = simpleMatch;
    const newSpec = convertSpecifier(specifier, filePath);
    return `${indent}import ${name} from '${newSpec}';`;
  }

  // Pattern 3: require('module') without assignment (side effect)
  const sideEffectMatch = line.match(/^(\s*)require\(\s*['"]([^'"]+)['"]\s*\);?\s*$/);
  if (sideEffectMatch) {
    const [, indent, specifier] = sideEffectMatch;
    const newSpec = convertSpecifier(specifier, filePath);
    return `${indent}import '${newSpec}';`;
  }

  // Pattern 4: const X = require('module').something
  const propertyMatch = line.match(/^(\s*)const\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)\.(\w+);?\s*$/);
  if (propertyMatch) {
    const [, indent, name, specifier, prop] = propertyMatch;
    const newSpec = convertSpecifier(specifier, filePath);
    // Use named import if prop matches name, otherwise destructure
    if (name === prop) {
      return `${indent}import { ${name} } from '${newSpec}';`;
    }
    return `${indent}import { ${prop} as ${name} } from '${newSpec}';`;
  }

  return line;
}

function convertSpecifier(specifier, filePath) {
  if (isBuiltinOrNpm(specifier)) {
    return specifier;
  }
  // Local file: change .cjs → .mjs
  if (specifier.endsWith('.cjs')) {
    return specifier.replace(/\.cjs$/, '.mjs');
  }
  // Local file without extension: add .mjs
  if (specifier.startsWith('.') && !specifier.includes('.')) {
    return specifier + '.mjs';
  }
  // JSON files stay the same (but need assert in ESM)
  if (specifier.endsWith('.json')) {
    return specifier;
  }
  return specifier;
}

function convertExports(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Pattern: module.exports = { A, B, C };
    const objExportMatch = trimmed.match(/^module\.exports\s*=\s*\{([^}]+)\};?\s*$/);
    if (objExportMatch) {
      const exports = objExportMatch[1].trim();
      result.push(`export { ${exports} };`);
      i++;
      continue;
    }

    // Pattern: module.exports = ClassName;
    const defaultExportMatch = trimmed.match(/^module\.exports\s*=\s*(\w+);?\s*$/);
    if (defaultExportMatch) {
      const name = defaultExportMatch[1];
      result.push(`export default ${name};`);
      i++;
      continue;
    }

    // Pattern: module.exports = { ... } (multiline)
    if (trimmed.startsWith('module.exports = {') && !trimmed.endsWith('};')) {
      let block = line;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('}')) {
        block += '\n' + lines[i];
        i++;
      }
      if (i < lines.length) {
        block += '\n' + lines[i];
      }
      // Extract the object content
      const fullMatch = block.match(/module\.exports\s*=\s*\{([\s\S]*)\}/);
      if (fullMatch) {
        result.push(`export {${fullMatch[1]}};`);
      } else {
        result.push(block); // Can't parse, keep as-is
      }
      i++;
      continue;
    }

    // Pattern: exports.X = Y;
    const namedExportMatch = trimmed.match(/^exports\.(\w+)\s*=\s*(.+);?\s*$/);
    if (namedExportMatch) {
      const [, name, value] = namedExportMatch;
      if (name === value.trim()) {
        result.push(`export { ${name} };`);
      } else {
        result.push(`export const ${name} = ${value};`);
      }
      i++;
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

function convertDirnameFilename(content) {
  // __dirname → import.meta.dirname (Node 21.2+)
  content = content.replace(/\b__dirname\b/g, 'import.meta.dirname');
  // __filename → import.meta.filename (Node 21.2+)
  content = content.replace(/\b__filename\b/g, 'import.meta.filename');
  return content;
}

function convertRequireMainModule(content) {
  // if (require.main === module) → simple check
  content = content.replace(
    /if\s*\(\s*require\.main\s*===\s*module\s*\)/g,
    "if (import.meta.url === `file://${process.argv[1]}`)"
  );
  return content;
}

function addJsonImportAssertions(content) {
  // import X from './file.json' → import X from './file.json' with { type: 'json' }
  content = content.replace(
    /import\s+(\w+)\s+from\s+'([^']+\.json)';/g,
    "import $1 from '$2' with { type: 'json' };"
  );
  return content;
}

function removeUseStrict(content) {
  // ESM is always strict mode
  return content.replace(/^'use strict';\s*\n?/m, '');
}

function convertFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  let content = fs.readFileSync(absPath, 'utf8');
  const originalContent = content;

  // Step 1: Remove 'use strict' (ESM is always strict)
  content = removeUseStrict(content);

  // Step 2: Convert require() → import
  const lines = content.split('\n');
  const convertedLines = lines.map(line => convertRequireToImport(line, relPath));
  content = convertedLines.join('\n');

  // Step 3: Convert module.exports → export
  content = convertExports(content);

  // Step 4: Convert __dirname/__filename
  content = convertDirnameFilename(content);

  // Step 5: Convert require.main === module
  content = convertRequireMainModule(content);

  // Step 6: Add JSON import assertions
  content = addJsonImportAssertions(content);

  // Compute new path
  const newRelPath = relPath.replace(/\.cjs$/, '.mjs');
  migratedFiles.set(relPath, newRelPath);

  return {
    oldPath: relPath,
    newPath: newRelPath,
    oldContent: originalContent,
    newContent: content,
    changed: content !== originalContent,
  };
}

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VocalIA ESM Migration Script         ║');
  console.log(`║     Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}${DIR_FILTER ? ` (${DIR_FILTER})` : ''}              ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const files = collectFiles();
  console.log(`Found ${files.length} .cjs files to migrate\n`);

  let converted = 0;
  let skipped = 0;
  const errors = [];
  const results = [];

  for (const file of files) {
    try {
      const result = convertFile(file);
      results.push(result);

      if (result.changed) {
        converted++;
        if (DRY_RUN) {
          console.log(`  ✏️  ${file} → ${result.newPath}`);
        }
      } else {
        skipped++;
        if (DRY_RUN) {
          console.log(`  ⏭️  ${file} (no changes needed)`);
        }
      }
    } catch (err) {
      errors.push({ file, error: err.message });
      console.error(`  ❌ ${file}: ${err.message}`);
    }
  }

  if (EXECUTE) {
    console.log('\nWriting files...\n');
    for (const result of results) {
      const newAbsPath = path.join(ROOT, result.newPath);
      const oldAbsPath = path.join(ROOT, result.oldPath);

      // Write new .mjs file
      fs.writeFileSync(newAbsPath, result.newContent, 'utf8');
      // Remove old .cjs file
      if (result.oldPath !== result.newPath) {
        fs.unlinkSync(oldAbsPath);
      }
      console.log(`  ✅ ${result.oldPath} → ${result.newPath}`);
    }
  }

  console.log('\n┌────────────────────────────────┐');
  console.log(`│ Converted: ${String(converted).padStart(3)} files           │`);
  console.log(`│ Unchanged: ${String(skipped).padStart(3)} files           │`);
  console.log(`│ Errors:    ${String(errors.length).padStart(3)} files           │`);
  console.log(`│ Total:     ${String(files.length).padStart(3)} files           │`);
  console.log('└────────────────────────────────┘');

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const { file, error } of errors) {
      console.log(`  ${file}: ${error}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no files were changed. Use --execute to apply.');
  }
}

main();
