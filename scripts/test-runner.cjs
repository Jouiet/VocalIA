'use strict';

/**
 * VocalIA Test Runner — B52 IPC Workaround
 *
 * Node.js v22 test runner has a known IPC deserialization bug:
 * heavy CJS modules (voice-api-resilient, HybridRAG) leave TLS Socket
 * handles that can't be serialized via structured clone in child processes.
 *
 * Solution: Run B52-affected files with --experimental-test-isolation=none
 * (same-process, no IPC serialization), and all other files with normal isolation.
 *
 * Result: ZERO false fails across the entire suite.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Files that trigger B52 IPC deserialization error due to heavy CJS modules
const B52_FILES = new Set([
  'integration-chains.test.mjs',
  'route-smoke.test.mjs'
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

for (const f of [...allMjs, ...allCjs]) {
  if (B52_FILES.has(f)) {
    heavyFiles.push(path.join('test', f));
  } else {
    normalFiles.push(path.join('test', f));
  }
}

let exitCode = 0;

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

process.exit(exitCode);
