/**
 * Brutally Honest Coverage Audit
 * 
 * Scans `core/*.cjs` for exported functions.
 * Scans `test/` for their usage.
 * Distinguishes between:
 * - REAL: Function called `func(...)`
 * - THEATER: Function name stringified or statically checked `includes('func')`
 * - UNUSED: Not found in tests
 */

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '../core');
const TEST_DIR = path.join(__dirname, '../test');

// Files to audit
const CORE_FILES = [
    'voice-api-utils.cjs',
    'voice-api-resilient.cjs',
    'voice-crm-tools.cjs',
    'voice-ecommerce-tools.cjs',
    'db-api.cjs',
    'SecretVault.cjs',
    'GoogleSheetsDB.cjs'
];

function getExportedFunctions(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const exports = [];

    // Pattern 1: module.exports = { ... }
    const modExportMatch = content.match(/module\.exports\s*=\s*{([\s\S]*?)};/);
    if (modExportMatch) {
        const body = modExportMatch[1];
        // Extract keys
        const keys = body.split(',').map(k => k.trim()).filter(k => k && !k.startsWith('//') && !k.startsWith('/*'));
        keys.forEach(k => {
            const name = k.split(':')[0].trim();
            if (name) exports.push(name);
        });
    }

    // Pattern 2: exports.foo = ...
    const specificExportRegex = /exports\.(\w+)\s*=/g;
    let match;
    while ((match = specificExportRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    // Pattern 3: class methods for specific files (DB)
    if (filePath.includes('GoogleSheetsDB') || filePath.includes('SecretVault')) {
        const methodRegex = /^\s*(static\s+)?(async\s+)?(\w+)\s*\(/gm;
        while ((match = methodRegex.exec(content)) !== null) {
            const name = match[3];
            if (name !== 'constructor' && !exports.includes(name)) {
                exports.push(name);
            }
        }
    }

    return [...new Set(exports)]; // Dedup
}

function checkUsage(funcName, testDir) {
    const files = fs.readdirSync(testDir).filter(f => f.endsWith('.mjs') || f.endsWith('.cjs') || f.endsWith('.js'));
    let status = 'UNUSED';
    let locations = [];

    for (const file of files) {
        if (file === 'security-regression.test.mjs') continue; // Skip known theater file for "Real" check

        const content = fs.readFileSync(path.join(testDir, file), 'utf8');

        // Search for call signature: funcName(
        // Or specific usage patterns
        if (content.includes(`${funcName}(`)) {
            status = 'REAL';
            locations.push(file);
        } else if (content.includes(`.${funcName}(`)) {
            status = 'REAL';
            locations.push(file);
        } else if (content.includes(funcName)) {
            // Just the name, maybe theater or import
            if (status !== 'REAL') status = 'MENTIONED';
        }
    }

    return { status, locations };
}

console.log('| Module | Function | Status | Test Files |');
console.log('|---|---|---|---|');

CORE_FILES.forEach(file => {
    const funcs = getExportedFunctions(path.join(CORE_DIR, file));
    funcs.forEach(func => {
        const { status, locations } = checkUsage(func, TEST_DIR);
        const icon = status === 'REAL' ? '✅' : status === 'MENTIONED' ? '⚠️' : '❌';
        console.log(`| ${file} | \`${func}\` | ${icon} ${status} | ${locations.join(', ') || '-'} |`);
    });
});
