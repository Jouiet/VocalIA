/**
 * Function Coverage Audit — Empirical verification
 * Scans ALL exported functions and checks if they appear in test code
 * @session 250.241
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dirs = ['core', 'telephony', 'integrations', 'sensors', 'lib'];
const modules = [];

for (const dir of dirs) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) continue;

  // Include subdirs like core/gateways/
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && (e.name.endsWith('.cjs') || e.name.endsWith('.js')));
  const subdirs = entries.filter(e => e.isDirectory());

  for (const subdir of subdirs) {
    const subPath = path.join(dirPath, subdir.name);
    const subFiles = fs.readdirSync(subPath).filter(f => f.endsWith('.cjs') || f.endsWith('.js'));
    for (const sf of subFiles) {
      files.push({ name: path.join(subdir.name, sf), parentPath: dirPath });
    }
  }

  for (const fileEntry of files) {
    const fileName = typeof fileEntry === 'string' ? fileEntry : fileEntry.name;
    const fullPath = path.join(dirPath, fileName);
    const relPath = path.join(dir, fileName);

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch(e) { continue; }

    const exports = [];

    // Singleton class: extract methods
    const singletonMatch = content.match(/module\.exports\s*=\s*new\s+(\w+)\(/);
    if (singletonMatch) {
      const methodMatches = [...content.matchAll(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm)];
      for (const m of methodMatches) {
        const name = m[1];
        if (['constructor','if','for','while','switch','catch','return','try','else'].includes(name)) continue;
        exports.push({ name, type: name.startsWith('_') ? 'private' : 'method' });
      }
      // Static properties
      const statics = [...content.matchAll(/^\s+static\s+(\w+)\s*=/gm)];
      for (const m of statics) {
        exports.push({ name: m[1], type: 'constant' });
      }
    }

    // Object export: { fn1, fn2 }
    const objExportMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
    if (objExportMatch && !singletonMatch) {
      const block = objExportMatch[1];
      const names = [...new Set(block.match(/\b([a-zA-Z_]\w*)\b(?=\s*[,}:])/g) || [])];
      for (const name of names) {
        const isUpper = /^[A-Z_]+$/.test(name) || name === name.toUpperCase();
        exports.push({ name, type: isUpper ? 'constant' : (name.startsWith('_') ? 'private' : 'function') });
      }
    }

    // module.exports.x = ...
    const dotExports = [...content.matchAll(/module\.exports\.(\w+)\s*=/g)];
    for (const m of dotExports) {
      const name = m[1];
      const isUpper = /^[A-Z_]+$/.test(name);
      if (!exports.find(e => e.name === name)) {
        exports.push({ name, type: isUpper ? 'constant' : 'function' });
      }
    }

    // Class export: module.exports = ClassName  or module.exports = class X
    const classExport = content.match(/module\.exports\s*=\s*(?:class\s+)?(\w+)(?:\s*\{|\s*;|\s*$)/m);
    if (classExport && !singletonMatch && !objExportMatch) {
      const className = classExport[1];
      // Check if it's a class with methods
      const classBlock = content.match(new RegExp('class\\s+' + className + '[^{]*\\{([\\s\\S]*)'));
      if (classBlock) {
        const methods = [...classBlock[1].matchAll(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm)];
        for (const m of methods) {
          const name = m[1];
          if (['constructor','if','for','while','switch','catch','return','try','else'].includes(name)) continue;
          exports.push({ name, type: name.startsWith('_') ? 'private' : 'method' });
        }
      }
    }

    if (exports.length > 0) {
      modules.push({ file: relPath, exports });
    }
  }
}

// Read ALL test files
const testDir = path.join(ROOT, 'test');
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
let allTestCode = '';
for (const f of testFiles) {
  allTestCode += fs.readFileSync(path.join(testDir, f), 'utf8') + '\n';
}

// Check coverage
const critical = [];   // Public functions not tested
const privates = [];   // Private methods not tested
const constants = [];  // Constants not referenced

let totalFunctions = 0;
let testedFunctions = 0;
let totalAll = 0;
let testedAll = 0;

for (const mod of modules) {
  for (const exp of mod.exports) {
    totalAll++;
    if (exp.type !== 'constant') totalFunctions++;

    const fn = exp.name;
    // Multiple patterns to detect usage
    let found = false;

    // Direct call: fn( or .fn(
    if (allTestCode.includes(fn + '(') || allTestCode.includes('.' + fn + '(')) found = true;
    // String reference: 'fn' or "fn"
    if (!found && (allTestCode.includes("'" + fn + "'") || allTestCode.includes('"' + fn + '"'))) found = true;
    // Property access: .fn
    if (!found && allTestCode.includes('.' + fn)) found = true;

    if (found) {
      testedAll++;
      if (exp.type !== 'constant') testedFunctions++;
    } else {
      const entry = { file: mod.file, name: fn };
      if (exp.type === 'constant') constants.push(entry);
      else if (exp.type === 'private') privates.push(entry);
      else critical.push(entry);
    }
  }
}

// Group and display
function groupByFile(arr) {
  const grouped = {};
  for (const item of arr) {
    if (!grouped[item.file]) grouped[item.file] = [];
    grouped[item.file].push(item.name);
  }
  return grouped;
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         FUNCTION COVERAGE AUDIT — EMPIRICAL                ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Total exports scanned: ${totalAll} (across ${modules.length} modules)`);
console.log(`Functions (public+private): ${totalFunctions} | Constants: ${totalAll - totalFunctions}`);
console.log(`Functions tested: ${testedFunctions}/${totalFunctions} (${Math.round(testedFunctions/totalFunctions*100)}%)`);
console.log(`All exports tested: ${testedAll}/${totalAll} (${Math.round(testedAll/totalAll*100)}%)`);
console.log('');

console.log('┌──────────────────────────────────────────────────────────────┐');
console.log('│ CRITICAL: Public functions NOT found in any test file        │');
console.log('└──────────────────────────────────────────────────────────────┘');
const crit = groupByFile(critical);
if (Object.keys(crit).length === 0) {
  console.log('  (none)');
} else {
  for (const [file, fns] of Object.entries(crit)) {
    console.log(`  ${file}:`);
    for (const fn of fns) console.log(`    - ${fn}`);
  }
}
console.log(`  Total: ${critical.length}`);

console.log('');
console.log('┌──────────────────────────────────────────────────────────────┐');
console.log('│ MINOR: Private methods (_prefixed) — tested indirectly      │');
console.log('└──────────────────────────────────────────────────────────────┘');
const priv = groupByFile(privates);
if (Object.keys(priv).length === 0) {
  console.log('  (none)');
} else {
  for (const [file, fns] of Object.entries(priv)) {
    console.log(`  ${file}: ${fns.join(', ')}`);
  }
}
console.log(`  Total: ${privates.length}`);

console.log('');
console.log('┌──────────────────────────────────────────────────────────────┐');
console.log('│ INFO: Constants not referenced in tests                     │');
console.log('└──────────────────────────────────────────────────────────────┘');
const con = groupByFile(constants);
if (Object.keys(con).length === 0) {
  console.log('  (none)');
} else {
  for (const [file, fns] of Object.entries(con)) {
    console.log(`  ${file}: ${fns.join(', ')}`);
  }
}
console.log(`  Total: ${constants.length}`);
