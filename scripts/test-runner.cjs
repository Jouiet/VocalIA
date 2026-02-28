'use strict';

/**
 * VocalIA Test Runner — B52 IPC Workaround + Solo Runner
 *
 * Node.js v22 test runner has a known IPC deserialization bug:
 * heavy CJS modules (voice-api-resilient, HybridRAG) leave TLS Socket
 * handles that can't be serialized via structured clone in child processes.
 *
 * Solution:
 * - Normal files: default isolation (most files)
 * - B52 files: --experimental-test-isolation=none (IPC-sensitive)
 * - Solo files: run individually (API rate-limit sensitive or IPC in batch)
 *
 * Result: ZERO false fails across the entire suite.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COVERAGE_MODE = process.argv.includes('--coverage');

// Files that trigger B52 IPC deserialization error due to heavy CJS modules
const B52_FILES = new Set([
  'integration-chains.test.mjs',
  'route-smoke.test.mjs'
]);

// Files that must run individually (fail in batch due to API rate limits or IPC)
const SOLO_FILES = new Set([
  'provision-tenant.test.mjs',
  'grok-voice-realtime.test.mjs',
  'whatsapp-webhook.test.mjs',
  'voice-api-http.test.mjs',
  'coverage-push-88.test.mjs',
  'coverage-push-low.test.mjs',
  'coverage-push-deep.test.mjs',
  'regression-bug-audit-248.test.mjs',
  'cov-sensors-main.test.mjs',
  'cov-webhook-core.test.mjs',
  'cov-near-threshold.test.mjs'
]);

const TEST_DIR = path.join(__dirname, '..', 'test');
const TIMEOUT = '180000';

// Collect all test files
const allMjs = fs.readdirSync(TEST_DIR)
  .filter(f => f.endsWith('.test.mjs'));

const allCjs = fs.readdirSync(TEST_DIR)
  .filter(f => f.endsWith('.test.cjs') || f.endsWith('-test.cjs'));

const normalFiles = [];
const heavyFiles = [];
const soloFiles = [];

for (const f of [...allMjs, ...allCjs]) {
  if (SOLO_FILES.has(f)) {
    soloFiles.push(path.join('test', f));
  } else if (B52_FILES.has(f)) {
    heavyFiles.push(path.join('test', f));
  } else {
    normalFiles.push(path.join('test', f));
  }
}

let exitCode = 0;

// Coverage mode: set NODE_V8_COVERAGE so ALL child processes write coverage data
const COV_DIR = path.join(__dirname, '..', '.coverage', 'v8');
if (COVERAGE_MODE) {
  fs.mkdirSync(COV_DIR, { recursive: true });
  process.env.NODE_V8_COVERAGE = COV_DIR;
  console.log(`[test-runner] Coverage mode: NODE_V8_COVERAGE=${COV_DIR}\n`);
}

function run(label, cmd) {
  console.log(`\n[test-runner] ${label}\n`);
  try {
    execSync(cmd, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 600000
    });
  } catch (err) {
    exitCode = 1;
  }
}

// Step 1: Run normal files with default isolation
run(
  `${normalFiles.length} files (normal isolation)`,
  `node --test --test-timeout=${TIMEOUT} ${normalFiles.join(' ')}`
);

// Step 2: Run B52-affected files with --experimental-test-isolation=none
if (heavyFiles.length > 0) {
  run(
    `${heavyFiles.length} B52-affected files (isolation=none)`,
    `node --test --experimental-test-isolation=none --test-timeout=${TIMEOUT} ${heavyFiles.join(' ')}`
  );
}

// Step 3: Run solo files individually (API rate-limit or IPC sensitive)
for (const file of soloFiles) {
  const basename = path.basename(file);
  const needsNoIsolation = B52_FILES.has(basename);
  const isolationFlag = needsNoIsolation ? ' --experimental-test-isolation=none' : '';
  run(
    `${file} (solo${needsNoIsolation ? '+isolation=none' : ''})`,
    `node --test${isolationFlag} --test-timeout=${TIMEOUT} ${file}`
  );
}

// Step 4: Run coverage runners directly (no --test flag)
// c8 cannot track V8 coverage through Node.js test runner child processes.
// These runners call exported functions directly in-process so c8 picks up coverage.
const COV_RUNNERS = fs.readdirSync(TEST_DIR)
  .filter(f => f.startsWith('cov-') && f.endsWith('.cjs') && !f.endsWith('.test.cjs'));

for (const runner of COV_RUNNERS) {
  run(
    `${runner} (direct coverage)`,
    `node ${path.join('test', runner)}`
  );
}

// Step 5: Generate coverage report if --coverage
if (COVERAGE_MODE) {
  console.log('\n[test-runner] Generating c8 coverage report...\n');
  try {
    execSync(
      `npx c8 report --temp-directory=${COV_DIR} --reporter=text --reporter=lcov`,
      { cwd: path.join(__dirname, '..'), stdio: 'inherit', timeout: 60000 }
    );
  } catch (err) {
    console.error('❌ c8 report failed:', err.message);
    exitCode = 1;
  }
}

process.exit(exitCode);
