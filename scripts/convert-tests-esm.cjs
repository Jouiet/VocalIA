'use strict';

/**
 * VocalIA Test File ESM Converter
 *
 * Converts test/*.test.cjs → test/*.test.mjs (CommonJS → ESM)
 *
 * Handles:
 * - Top-level require() → import
 * - Inline require() inside test bodies → top-level import
 * - 'use strict' removal (ESM is always strict)
 * - .cjs → .cjs in specifiers (source modules stay CJS)
 * - Run comment updates
 *
 * Usage:
 *   node scripts/convert-tests-esm.cjs --dry-run
 *   node scripts/convert-tests-esm.cjs --execute
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node scripts/convert-tests-esm.cjs --dry-run|--execute');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'test');

// Node built-in modules
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

function isBuiltinOrNpm(specifier) {
  if (BUILTINS.has(specifier)) return true;
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return true;
  return false;
}

function convertFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Phase 1: Collect ALL require() calls (top-level AND inline)
  const topImports = [];
  const inlineRequires = new Map(); // line index → { varName, destructured, specifier }
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip 'use strict'
    if (trimmed === "'use strict';" || trimmed === '"use strict";') {
      continue;
    }

    // Skip empty line after 'use strict'
    if (i > 0 && (lines[i - 1].trim() === "'use strict';" || lines[i - 1].trim() === '"use strict";') && trimmed === '') {
      continue;
    }

    // Top-level destructured require: const { A, B } = require('module')
    const destructuredTop = line.match(/^(\s*)const\s+(\{[^}]+\})\s*=\s*require\(\s*'([^']+)'\s*\);?\s*$/);
    if (destructuredTop && destructuredTop[1].trim() === '') {
      const [, , destructured, specifier] = destructuredTop;
      topImports.push({ destructured, specifier, type: 'destructured' });
      continue;
    }

    // Top-level simple require: const X = require('module')
    const simpleTop = line.match(/^(\s*)const\s+(\w+)\s*=\s*require\(\s*'([^']+)'\s*\);?\s*$/);
    if (simpleTop && simpleTop[1].trim() === '') {
      const [, , name, specifier] = simpleTop;
      topImports.push({ name, specifier, type: 'simple' });
      continue;
    }

    // Inline require inside function/test body
    const inlineDestructured = line.match(/^(\s+)const\s+(\{[^}]+\})\s*=\s*require\(\s*'([^']+)'\s*\);?\s*$/);
    if (inlineDestructured && inlineDestructured[1].length >= 2) {
      const [, indent, destructured, specifier] = inlineDestructured;
      // Hoist to top-level import
      topImports.push({ destructured, specifier, type: 'destructured', hoisted: true });
      // Don't add to processedLines (remove the line)
      continue;
    }

    const inlineSimple = line.match(/^(\s+)const\s+(\w+)\s*=\s*require\(\s*'([^']+)'\s*\);?\s*$/);
    if (inlineSimple && inlineSimple[1].length >= 2) {
      const [, indent, name, specifier] = inlineSimple;
      topImports.push({ name, specifier, type: 'simple', hoisted: true });
      continue;
    }

    processedLines.push(line);
  }

  // Phase 2: Deduplicate imports (same specifier)
  const importMap = new Map(); // specifier → { names: Set, destructured: Set }
  for (const imp of topImports) {
    const spec = imp.specifier;
    if (!importMap.has(spec)) {
      importMap.set(spec, { names: new Set(), destructured: new Set(), type: imp.type });
    }
    const entry = importMap.get(spec);
    if (imp.type === 'simple' && imp.name) {
      entry.names.add(imp.name);
    }
    if (imp.type === 'destructured' && imp.destructured) {
      // Parse destructured: { A, B, C } → ['A', 'B', 'C']
      const members = imp.destructured.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      members.forEach(m => entry.destructured.add(m));
    }
  }

  // Phase 3: Generate import statements
  const importLines = [];
  for (const [specifier, entry] of importMap) {
    const spec = isBuiltinOrNpm(specifier) ? specifier : specifier;

    if (entry.destructured.size > 0 && entry.names.size > 0) {
      // Has both default and named: import X, { A, B } from 'module'
      const name = [...entry.names][0];
      const named = [...entry.destructured].join(', ');
      importLines.push(`import ${name}, { ${named} } from '${spec}';`);
    } else if (entry.destructured.size > 0) {
      const named = [...entry.destructured].join(', ');
      importLines.push(`import { ${named} } from '${spec}';`);
    } else if (entry.names.size > 0) {
      const name = [...entry.names][0];
      importLines.push(`import ${name} from '${spec}';`);
    }
  }

  // Phase 4: Build output
  // Find insertion point: AFTER the header comment block (after the first `*/`)
  let insertIndex = 0;
  let inBlockComment = false;
  for (let i = 0; i < processedLines.length; i++) {
    const trimmed = processedLines[i].trim();
    if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
      inBlockComment = true;
      insertIndex = i + 1;
      continue;
    }
    if (inBlockComment) {
      insertIndex = i + 1;
      if (trimmed.endsWith('*/') || trimmed === '*/') {
        inBlockComment = false;
        // Skip any empty lines after the block comment
        while (insertIndex < processedLines.length && processedLines[insertIndex].trim() === '') {
          insertIndex++;
        }
        break;
      }
      continue;
    }
    // Single-line comments or empty lines at the start
    if (trimmed === '' || trimmed.startsWith('//')) {
      insertIndex = i + 1;
      continue;
    }
    break;
  }

  // Update Run comment to .mjs
  const result = [];
  for (const line of processedLines) {
    result.push(line.replace(/test\/([^.]+)\.test\.cjs/g, 'test/$1.test.mjs'));
  }

  // Insert imports after the header comment block
  result.splice(insertIndex, 0, ...importLines, '');

  return result.join('\n');
}

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VocalIA Test ESM Converter           ║');
  console.log(`║     Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}                         ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  const testFiles = fs.readdirSync(TEST_DIR)
    .filter(f => f.endsWith('.test.cjs'))
    .map(f => path.join(TEST_DIR, f));

  // Also check subdirectories
  const unitDir = path.join(TEST_DIR, 'unit');
  if (fs.existsSync(unitDir)) {
    const unitFiles = fs.readdirSync(unitDir)
      .filter(f => f.endsWith('.test.cjs'))
      .map(f => path.join(unitDir, f));
    testFiles.push(...unitFiles);
  }

  console.log(`Found ${testFiles.length} test files\n`);

  let converted = 0;
  let errors = 0;

  for (const filePath of testFiles) {
    const relPath = path.relative(ROOT, filePath);
    const newRelPath = relPath.replace(/\.test\.cjs$/, '.test.mjs');
    const newAbsPath = path.join(ROOT, newRelPath);

    try {
      const newContent = convertFile(filePath);

      if (EXECUTE) {
        fs.writeFileSync(newAbsPath, newContent, 'utf8');
        fs.unlinkSync(filePath);
        console.log(`  ✅ ${relPath} → ${newRelPath}`);
      } else {
        console.log(`  ✏️  ${relPath} → ${newRelPath}`);
      }
      converted++;
    } catch (err) {
      console.error(`  ❌ ${relPath}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n┌────────────────────────────────┐`);
  console.log(`│ Converted: ${String(converted).padStart(3)}                 │`);
  console.log(`│ Errors:    ${String(errors).padStart(3)}                 │`);
  console.log(`└────────────────────────────────┘`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no files changed. Use --execute to apply.');
  } else if (EXECUTE) {
    console.log('\n📝 Update package.json test command to: node --test \'test/**/*.test.mjs\'');
  }
}

main();
