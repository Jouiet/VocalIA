#!/usr/bin/env node
/**
 * Function-level coverage audit
 * Checks if exported functions are actually CALLED in test files
 */
const fs = require('fs');
const path = require('path');
const w = (s) => process.stdout.write(s + '\n');

// Suppress module side effects
const _log = console.log;
const _err = console.error;
const _warn = console.warn;
console.log = () => {};
console.error = () => {};
console.warn = () => {};

const ROOT = path.join(__dirname, '..');
const dirs = ['core', 'lib', 'telephony', 'sensors', 'integrations'];
const modules = [];

for (const dir of dirs) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;
  for (const f of fs.readdirSync(fullDir)) {
    if (f.endsWith('.cjs') || (f.endsWith('.js') && dir === 'lib')) {
      modules.push(path.join(dir, f));
    }
  }
}

const testDir = path.join(ROOT, 'test');
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.mjs'));
const testContents = testFiles.map(f =>
  fs.readFileSync(path.join(testDir, f), 'utf8')
).join('\n');

const uncalled = [];
let totalFns = 0;
let calledFns = 0;
const byModule = {};
const loadErrors = [];

for (const mod of modules) {
  try {
    const m = require(path.join(ROOT, mod));
    const fns = Object.keys(m).filter(k => typeof m[k] === 'function');
    if (fns.length === 0) continue;
    const modName = path.basename(mod);
    byModule[modName] = { total: fns.length, called: 0, uncalled: [] };
    for (const fn of fns) {
      totalFns++;
      if (testContents.includes(fn + '(')) {
        calledFns++;
        byModule[modName].called++;
      } else {
        uncalled.push({ mod: modName, fn });
        byModule[modName].uncalled.push(fn);
      }
    }
  } catch (e) {
    loadErrors.push(path.basename(mod));
  }
}

// Restore console
console.log = _log;
console.error = _err;
console.warn = _warn;

w('=== UNCALLED EXPORTED FUNCTIONS ===');
if (uncalled.length === 0) {
  w('None');
} else {
  for (const u of uncalled) {
    w('  X ' + u.mod + ' -> ' + u.fn);
  }
}
w('');
w('=== PER-MODULE (gaps only) ===');
for (const [mod, info] of Object.entries(byModule).sort((a, b) => b[1].uncalled.length - a[1].uncalled.length)) {
  if (info.uncalled.length > 0) {
    w('  ' + mod + ': ' + info.called + '/' + info.total + ' (MISSING: ' + info.uncalled.join(', ') + ')');
  }
}
if (loadErrors.length > 0) {
  w('');
  w('=== LOAD ERRORS ===');
  for (const e of loadErrors) w('  ! ' + e);
}
w('');
w('=== TOTALS ===');
w('Total exported functions: ' + totalFns);
w('Called in tests: ' + calledFns);
w('Uncalled: ' + uncalled.length);
w('Load errors: ' + loadErrors.length);
if (totalFns > 0) w('Coverage: ' + ((calledFns / totalFns) * 100).toFixed(1) + '%');
