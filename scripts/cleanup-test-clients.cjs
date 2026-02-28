'use strict';

/**
 * cleanup-test-clients.cjs
 * Removes orphaned test-generated folders from clients/
 *
 * Patterns removed:
 *   _test_*, parsed_*, wrong_*, oauth_test_*, testco_*, test_*,
 *   user_*, tenant_*, locktest_*, login_*, aliceco*, dupco*, testcorp*,
 *   hex UUIDs (8+ hex chars)
 *
 * Protected (NEVER deleted):
 *   _template, agency_internal, client_demo, default,
 *   b2b_*, b2c_*, ecom_*, satellite_*
 *
 * Usage: node scripts/cleanup-test-clients.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');
const DRY_RUN = process.argv.includes('--dry-run');

const PROTECTED = new Set(['_template', 'agency_internal', 'client_demo', 'default']);
const PROTECTED_PREFIXES = ['b2b_', 'b2c_', 'ecom_', 'satellite_'];

const TEST_PATTERNS = [
  /^_test_/,
  /^parsed_/,
  /^wrong_/,
  /^oauth_test_/,
  /^testco_/,
  /^test_/,
  /^user_/,
  /^tenant_/,
  /^locktest_/,
  /^login_/,
  /^aliceco/,
  /^dupco/,
  /^testcorp/,
  /^conc_/,
  /^conflict_/,
  /^corrupt_/,
  /^empty_/,
  /^noconfig_/,
  /^nonexist/,
  /^orig_/,
  /^dup_/,
  /^iso_/,
  /^register_test/,
  /^reg_/,
  /^onboard_/,
  /^new_/,
  /^[0-9a-f]{6,}$/,
];

function isTestFolder(name) {
  if (PROTECTED.has(name)) return false;
  if (PROTECTED_PREFIXES.some(p => name.startsWith(p))) return false;
  return TEST_PATTERNS.some(p => p.test(name));
}

const entries = fs.readdirSync(CLIENTS_DIR);
const toDelete = entries.filter(e => {
  const full = path.join(CLIENTS_DIR, e);
  return fs.statSync(full).isDirectory() && isTestFolder(e);
});

console.log(`\n📊 clients/ analysis:`);
console.log(`   Total folders: ${entries.length}`);
console.log(`   Test folders to remove: ${toDelete.length}`);
console.log(`   Remaining after cleanup: ${entries.length - toDelete.length}`);

if (DRY_RUN) {
  console.log(`\n🔍 DRY RUN — no deletions. Sample (first 20):`);
  toDelete.slice(0, 20).forEach(d => console.log(`   ${d}`));
  if (toDelete.length > 20) console.log(`   ... and ${toDelete.length - 20} more`);
  process.exit(0);
}

console.log(`\n🗑️  Deleting ${toDelete.length} test folders...`);
let deleted = 0;
let errors = 0;

for (const dir of toDelete) {
  try {
    fs.rmSync(path.join(CLIENTS_DIR, dir), { recursive: true, force: true });
    deleted++;
  } catch (e) {
    console.error(`❌ Failed to delete ${dir}: ${e.message}`);
    errors++;
  }
}

const remaining = fs.readdirSync(CLIENTS_DIR).filter(e =>
  fs.statSync(path.join(CLIENTS_DIR, e)).isDirectory()
).length;

console.log(`\n✅ Cleanup complete:`);
console.log(`   Deleted: ${deleted}`);
console.log(`   Errors: ${errors}`);
console.log(`   Remaining folders: ${remaining}`);
