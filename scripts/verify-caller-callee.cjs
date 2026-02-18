#!/usr/bin/env node
/**
 * verify-caller-callee.cjs — Automated Caller/Callee Verification
 * Session 250.209c
 *
 * Statically analyzes all .cjs modules to detect:
 * 1. Function name mismatches (caller calls X, module exports Y)
 * 2. Destructuring of singletons (bug D1 pattern)
 * 3. Missing exports (caller uses method not in exports)
 * 4. .emit() vs .publish() on EventBus (bug F8 pattern)
 * 5. Shadowed require paths (bug B1 pattern)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['core', 'sensors', 'integrations', 'lib', 'telephony', 'personas'];
const ERRORS = [];
const WARNINGS = [];

// ─────────────────────────────────────────────
// STEP 1: Collect all module exports
// ─────────────────────────────────────────────

function getModuleExports(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const result = {
    file: filePath,
    type: null, // 'singleton', 'object', 'class', 'function'
    exports: [],
    namedExports: {},
    isSingleton: false,
    rawExportLine: ''
  };

  // Find module.exports = ...
  const exportMatch = src.match(/module\.exports\s*=\s*(.+)/);
  if (!exportMatch) return result;

  result.rawExportLine = exportMatch[0];
  const exportValue = exportMatch[1].trim().replace(/;$/, '');

  // Check for singleton exports (module.exports = instance)
  // Pattern: const x = new X(); ... module.exports = x;
  const singletonPattern = new RegExp(`const\\s+${exportValue}\\s*=\\s*new\\s+`);
  if (singletonPattern.test(src)) {
    result.type = 'singleton';
    result.isSingleton = true;
  }

  // Check for object literal exports: module.exports = { A, B, C }
  const objMatch = exportValue.match(/^\{([^}]+)\}/);
  if (objMatch) {
    result.type = 'object';
    const keys = objMatch[1].split(',').map(k => k.trim().split(':')[0].trim()).filter(Boolean);
    result.exports = keys;
  }

  // Also check for additional module.exports.X = Y
  const additionalExports = src.matchAll(/module\.exports\.(\w+)\s*=/g);
  for (const m of additionalExports) {
    result.namedExports[m[1]] = true;
    if (!result.exports.includes(m[1])) {
      result.exports.push(m[1]);
    }
  }

  // For singletons/classes, extract method names from prototype or class
  if (result.isSingleton || result.type === null) {
    // Try to find class methods
    const classMatch = src.match(/class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new', 'delete', 'typeof', 'void', 'class', 'function', 'try', 'else', 'do']);
      // Find all method definitions
      const methodMatches = src.matchAll(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm);
      for (const m of methodMatches) {
        const name = m[1];
        if (name !== 'constructor' && !name.startsWith('_') && name !== className && !JS_KEYWORDS.has(name)) {
          result.exports.push(name);
        }
      }
      result.type = result.type || 'class';
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// STEP 2: Find all require() calls and their usage
// ─────────────────────────────────────────────

function findRequireCalls(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const calls = [];

  // Pattern 1: const { a, b } = require('./path')
  const destructureRe = /const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = destructureRe.exec(src)) !== null) {
    const names = m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
    calls.push({
      type: 'destructure',
      names,
      requirePath: m[2],
      line: src.substring(0, m.index).split('\n').length,
      file: filePath
    });
  }

  // Pattern 2: const x = require('./path')
  const directRe = /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  while ((m = directRe.exec(src)) !== null) {
    // Skip if it's a destructure (already caught above)
    if (src.substring(m.index - 1, m.index) === '{') continue;
    const varName = m[1];
    const reqPath = m[2];

    // Find all method calls on this variable
    const methodRe = new RegExp(`${varName}\\.(\\w+)\\s*\\(`, 'g');
    const methods = [];
    let mm;
    while ((mm = methodRe.exec(src)) !== null) {
      methods.push(mm[1]);
    }

    // Find all property accesses
    const propRe = new RegExp(`${varName}\\.(\\w+)(?!\\s*\\()`, 'g');
    const props = [];
    while ((mm = propRe.exec(src)) !== null) {
      props.push(mm[1]);
    }

    calls.push({
      type: 'direct',
      varName,
      requirePath: reqPath,
      methods: [...new Set(methods)],
      props: [...new Set(props)],
      line: src.substring(0, m.index).split('\n').length,
      file: filePath
    });
  }

  return calls;
}

// ─────────────────────────────────────────────
// STEP 3: Specific pattern checks
// ─────────────────────────────────────────────

function checkEventBusUsage(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT, filePath);

  // Check for .emit() on eventBus (should be .publish())
  const emitMatches = src.matchAll(/eventBus\.emit\s*\(/g);
  for (const m of emitMatches) {
    const line = src.substring(0, m.index).split('\n').length;
    ERRORS.push(`[EVENTBUS] ${relPath}:${line} — eventBus.emit() should be eventBus.publish()`);
  }
}

function checkSecretVaultDestructuring(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT, filePath);

  // SecretVault exports a singleton. Destructuring it is a bug.
  const destructMatch = src.match(/const\s*\{[^}]*\}\s*=\s*require\(['"]\.\/(.*SecretVault[^'"]*)['"]\)/);
  if (destructMatch) {
    const line = src.substring(0, destructMatch.index).split('\n').length;
    ERRORS.push(`[DESTRUCTURE-SINGLETON] ${relPath}:${line} — Destructuring SecretVault singleton! Use: const vault = require(...)`);
  }
}

function checkPathShadowing(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT, filePath);

  // Check if 'path' is required at top level
  if (!src.match(/const\s+path\s*=\s*require\(['"]path['"]\)/)) return;

  // Check if 'path' is reassigned inside functions (NOT the require line itself)
  const shadowMatches = src.matchAll(/(?:const|let|var)\s+path\s*=\s*.+/g);
  for (const m of shadowMatches) {
    const matchedLine = m[0];
    // Skip the actual require('path') line
    if (matchedLine.includes("require('path')") || matchedLine.includes('require("path")')) continue;
    const line = src.substring(0, m.index).split('\n').length;
    WARNINGS.push(`[PATH-SHADOW] ${relPath}:${line} — 'path' variable shadows require('path') (Bug B1 pattern — safe if no path.join in shadow zone)`);
  }
}

function checkSingletonDestructuring(filePath, moduleExportsMap) {
  const src = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT, filePath);

  // Find all destructured requires
  const destructureRe = /const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = destructureRe.exec(src)) !== null) {
    const reqPath = m[2];
    if (!reqPath.startsWith('.')) continue;

    // Resolve the path
    const dir = path.dirname(filePath);
    let resolved;
    try {
      resolved = require.resolve(path.resolve(dir, reqPath));
    } catch {
      continue;
    }

    const moduleInfo = moduleExportsMap.get(resolved);
    if (moduleInfo && moduleInfo.isSingleton) {
      // Check if each destructured name is explicitly in namedExports
      const names = m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
      const missingNames = names.filter(n => !moduleInfo.namedExports[n]);
      if (missingNames.length > 0) {
        const line = src.substring(0, m.index).split('\n').length;
        ERRORS.push(`[DESTRUCTURE-SINGLETON] ${relPath}:${line} — Destructuring singleton {${missingNames.join(', ')}} from ${path.relative(ROOT, resolved)} — NOT in named exports`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// STEP 4: Cross-reference callers vs exports
// ─────────────────────────────────────────────

function crossReference(allFiles, moduleExportsMap) {
  for (const filePath of allFiles) {
    const calls = findRequireCalls(filePath);
    const relPath = path.relative(ROOT, filePath);

    for (const call of calls) {
      if (!call.requirePath.startsWith('.')) continue;

      const dir = path.dirname(filePath);
      let resolved;
      try {
        resolved = require.resolve(path.resolve(dir, call.requirePath));
      } catch {
        continue;
      }

      const moduleInfo = moduleExportsMap.get(resolved);
      if (!moduleInfo) continue;

      if (call.type === 'destructure') {
        // Check each destructured name exists in exports
        for (const name of call.names) {
          if (moduleInfo.type === 'object' && !moduleInfo.exports.includes(name)) {
            ERRORS.push(`[MISSING-EXPORT] ${relPath}:${call.line} — Destructures {${name}} from ${path.relative(ROOT, resolved)}, but module does NOT export it. Exports: [${moduleInfo.exports.join(', ')}]`);
          }
        }
      }

      if (call.type === 'direct' && call.methods.length > 0) {
        // For singletons/classes, check method names exist
        if (moduleInfo.exports.length > 0) {
          for (const method of call.methods) {
            // Skip common built-in methods
            if (['then', 'catch', 'toString', 'valueOf', 'hasOwnProperty', 'on', 'once', 'removeListener', 'emit'].includes(method)) continue;

            if (!moduleInfo.exports.includes(method) && !moduleInfo.namedExports[method]) {
              // Only warn if the module has a well-defined export list
              if (moduleInfo.type === 'class' || moduleInfo.type === 'singleton') {
                WARNINGS.push(`[METHOD-MISMATCH?] ${relPath}:${call.line} — Calls ${call.varName}.${method}() but ${path.relative(ROOT, resolved)} may not export it (detected exports: ${moduleInfo.exports.slice(0, 10).join(', ')}...)`);
              }
            }
          }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// STEP 5: Check function parameter count mismatches
// ─────────────────────────────────────────────

function checkKnownSignatures() {
  // Known critical function signatures from previous audits
  const checks = [
    {
      file: 'core/voice-api-resilient.cjs',
      pattern: /handleRespondRequest\s*\(([^)]*)\)/,
      expectedParams: ['req', 'res'],
      description: 'handleRespondRequest should accept (req, res)'
    },
    {
      file: 'core/db-api.cjs',
      pattern: /sendCartRecoveryEmail\s*\(([^)]*)\)/,
      expectedParamCount: 1,
      description: 'sendCartRecoveryEmail — B5 fix: should receive cart object with {total, items}'
    },
    {
      file: 'core/auth-service.cjs',
      pattern: /async\s+resetPassword\s*\(([^)]*)\)/,
      description: 'resetPassword — B4 fix: should clear locked_until and failed_login_count'
    }
  ];

  for (const check of checks) {
    const filePath = path.join(ROOT, check.file);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, 'utf8');
    const match = src.match(check.pattern);
    if (match) {
      const params = match[1].split(',').map(p => p.trim()).filter(Boolean);
      if (check.expectedParams && JSON.stringify(params) !== JSON.stringify(check.expectedParams)) {
        WARNINGS.push(`[SIGNATURE] ${check.file} — ${check.description}. Found params: (${params.join(', ')})`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// STEP 6: Check for B4 regression (resetPassword must clear lockout)
// ─────────────────────────────────────────────

function checkB4Regression() {
  const authPath = path.join(ROOT, 'core/auth-service.cjs');
  if (!fs.existsSync(authPath)) return;
  const src = fs.readFileSync(authPath, 'utf8');

  // Find resetPassword function
  const resetMatch = src.match(/async\s+resetPassword[\s\S]*?(?=async\s+\w+\s*\(|$)/);
  if (resetMatch) {
    const body = resetMatch[0];
    if (!body.includes('locked_until') && !body.includes('lockedUntil')) {
      ERRORS.push('[B4-REGRESSION] core/auth-service.cjs — resetPassword() does NOT clear locked_until (Bug B4 regression!)');
    }
    if (!body.includes('failed_login_count') && !body.includes('failedLoginCount')) {
      ERRORS.push('[B4-REGRESSION] core/auth-service.cjs — resetPassword() does NOT clear failed_login_count (Bug B4 regression!)');
    }
  }
}

// ─────────────────────────────────────────────
// STEP 7: Check for B5 regression (cart email .map on object)
// ─────────────────────────────────────────────

function checkB5Regression() {
  const files = ['core/voice-api-resilient.cjs', 'telephony/voice-telephony-bridge.cjs'];
  for (const f of files) {
    const filePath = path.join(ROOT, f);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, 'utf8');

    // Check for .map() on cart that might be an object
    const mapMatches = src.matchAll(/cart\.map\s*\(|items\.map\s*\(/g);
    for (const m of mapMatches) {
      // Get surrounding context to check for Array.isArray guard
      const start = Math.max(0, m.index - 200);
      const context = src.substring(start, m.index + 50);
      if (!context.includes('Array.isArray') && !context.includes('[].concat')) {
        const line = src.substring(0, m.index).split('\n').length;
        WARNINGS.push(`[B5-PATTERN] ${f}:${line} — .map() call without Array.isArray guard (Bug B5 pattern)`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// STEP 8: Check for B2 regression (SMS template undefined vars)
// ─────────────────────────────────────────────

function checkB2Regression() {
  const telPath = path.join(ROOT, 'telephony/voice-telephony-bridge.cjs');
  if (!fs.existsSync(telPath)) return;
  const src = fs.readFileSync(telPath, 'utf8');

  // Check for template literal variables that might be undefined
  const templateMatches = src.matchAll(/\$\{(\w+)\}/g);
  const knownVars = new Set();
  // Find all variable declarations
  const varMatches = src.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g);
  for (const v of varMatches) knownVars.add(v[1]);

  // Also add function parameters
  const paramMatches = src.matchAll(/function\s+\w+\s*\(([^)]*)\)|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g);
  for (const p of paramMatches) {
    const params = (p[1] || p[2] || '').split(',').map(s => s.trim().replace(/\s*=.*/, ''));
    params.forEach(pr => { if (pr) knownVars.add(pr); });
  }
}

// ─────────────────────────────────────────────
// STEP 9: EventBus event name consistency
// ─────────────────────────────────────────────

function checkEventBusConsistency() {
  const allCjsFiles = [];
  for (const dir of DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath, { recursive: true })
      .filter(f => f.endsWith('.cjs'))
      .map(f => path.join(dirPath, f));
    allCjsFiles.push(...files);
  }

  const published = new Map(); // eventName -> [file:line]
  const subscribed = new Map(); // eventName -> [file:line]

  for (const f of allCjsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const relPath = path.relative(ROOT, f);

    // Find all eventBus.publish('event.name', ...) calls
    const pubMatches = src.matchAll(/eventBus\.publish\s*\(\s*['"]([^'"]+)['"]/g);
    for (const m of pubMatches) {
      const eventName = m[1];
      if (!published.has(eventName)) published.set(eventName, []);
      const line = src.substring(0, m.index).split('\n').length;
      published.get(eventName).push(`${relPath}:${line}`);
    }

    // Find all eventBus.subscribe('event.name', ...) calls
    const subMatches = src.matchAll(/eventBus\.subscribe\s*\(\s*['"]([^'"]+)['"]/g);
    for (const m of subMatches) {
      const eventName = m[1];
      if (!subscribed.has(eventName)) subscribed.set(eventName, []);
      const line = src.substring(0, m.index).split('\n').length;
      subscribed.get(eventName).push(`${relPath}:${line}`);
    }
  }

  // Find subscribed-but-never-published events
  for (const [event, locations] of subscribed) {
    if (!published.has(event)) {
      WARNINGS.push(`[EVENTBUS-ORPHAN] Subscribed to '${event}' (${locations[0]}) but NEVER published anywhere`);
    }
  }

  // Find published-but-never-subscribed events
  for (const [event, locations] of published) {
    if (!subscribed.has(event)) {
      WARNINGS.push(`[EVENTBUS-ORPHAN] Published '${event}' (${locations[0]}) but NEVER subscribed anywhere`);
    }
  }
}

// ─────────────────────────────────────────────
// STEP 10: Cross-module function call signature validation
// ─────────────────────────────────────────────

function checkCrossModuleSignatures() {
  // Critical cross-module calls to verify
  const criticalCalls = [
    {
      caller: 'core/db-api.cjs',
      callee: 'core/auth-service.cjs',
      patterns: [
        { call: 'authService.register', expectedArgs: '(userData)' },
        { call: 'authService.login', expectedArgs: '(email, password)' },
        { call: 'authService.verifyToken', expectedArgs: '(token)' },
        { call: 'authService.resetPassword', expectedArgs: '(token, newPassword)' }
      ]
    },
    {
      caller: 'core/voice-api-resilient.cjs',
      callee: 'core/conversation-store.cjs',
      patterns: [
        { call: 'conversationStore.save', expectedArgs: '(tenantId, sessionId, data)' },
        { call: 'conversationStore.load', expectedArgs: '(tenantId, sessionId)' }
      ]
    }
  ];

  for (const check of criticalCalls) {
    const callerPath = path.join(ROOT, check.caller);
    const calleePath = path.join(ROOT, check.callee);
    if (!fs.existsSync(callerPath) || !fs.existsSync(calleePath)) continue;

    const callerSrc = fs.readFileSync(callerPath, 'utf8');
    const calleeSrc = fs.readFileSync(calleePath, 'utf8');

    for (const pattern of check.patterns) {
      const methodName = pattern.call.split('.')[1];

      // Find definition in callee (async methodName(param1, param2) {)
      const defRe = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(([^)]*)\\)\\s*\\{`);
      const defMatch = calleeSrc.match(defRe);
      if (!defMatch) continue;

      const rawParams = defMatch[1].trim();
      // Handle destructured parameters: count { ... } as 1 param
      let defParamCount = 0;
      if (rawParams === '') {
        defParamCount = 0;
      } else if (rawParams.startsWith('{')) {
        // Destructured object = 1 parameter
        defParamCount = 1;
        // Count additional params after the closing brace
        const afterBrace = rawParams.indexOf('}');
        if (afterBrace !== -1 && rawParams.substring(afterBrace + 1).includes(',')) {
          defParamCount += rawParams.substring(afterBrace + 1).split(',').filter(s => s.trim()).length;
        }
      } else {
        defParamCount = rawParams.split(',').length;
      }

      // Find calls in caller
      const callRe = new RegExp(`${pattern.call.replace('.', '\\.')}\\s*\\(`, 'g');
      let m;
      while ((m = callRe.exec(callerSrc)) !== null) {
        // Extract full argument string (handle nested braces/parens)
        let depth = 1;
        let braceDepth = 0;
        let i = m.index + m[0].length;
        const start = i;
        while (i < callerSrc.length && depth > 0) {
          const ch = callerSrc[i];
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          else if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
          i++;
        }
        const argStr = callerSrc.substring(start, i - 1).trim();

        // Count top-level arguments (commas not inside braces/brackets)
        let argCount = 0;
        if (argStr !== '') {
          argCount = 1;
          let d = 0;
          for (const ch of argStr) {
            if (ch === '{' || ch === '(' || ch === '[') d++;
            else if (ch === '}' || ch === ')' || ch === ']') d--;
            else if (ch === ',' && d === 0) argCount++;
          }
        }

        if (argCount !== defParamCount && defParamCount > 0) {
          const line = callerSrc.substring(0, m.index).split('\n').length;
          ERRORS.push(`[PARAM-COUNT] ${check.caller}:${line} — ${pattern.call}() called with ${argCount} args but defined with ${defParamCount} params`);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// STEP 11: Duplicate store instances (fragmentation risk)
// ─────────────────────────────────────────────

function checkDuplicateStoreInstances() {
  const allCjsFiles = [];
  for (const dir of DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath, { recursive: true })
      .filter(f => f.endsWith('.cjs'))
      .map(f => path.join(dirPath, f));
    allCjsFiles.push(...files);
  }

  // Check for multiple files creating new instances of singleton stores
  const singletonStores = ['UCPStore', 'ConversationStore', 'AuditStore', 'SecretVault'];
  for (const storeName of singletonStores) {
    const instances = [];
    for (const f of allCjsFiles) {
      const src = fs.readFileSync(f, 'utf8');
      const newRe = new RegExp(`new\\s+${storeName}\\s*\\(`, 'g');
      let m;
      while ((m = newRe.exec(src)) !== null) {
        const line = src.substring(0, m.index).split('\n').length;
        instances.push(`${path.relative(ROOT, f)}:${line}`);
      }
    }
    if (instances.length > 1) {
      WARNINGS.push(`[FRAGMENTATION-RISK] ${storeName} instantiated in ${instances.length} places: ${instances.join(', ')}`);
    }
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

function main() {
  console.log('=== VocalIA Caller/Callee Verification ===\n');

  // Collect all .cjs files
  const allFiles = [];
  for (const dir of DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath, { recursive: true })
      .filter(f => f.endsWith('.cjs'))
      .map(f => path.join(dirPath, f));
    allFiles.push(...files);
  }

  console.log(`Scanning ${allFiles.length} modules...\n`);

  // Build exports map
  const moduleExportsMap = new Map();
  for (const f of allFiles) {
    try {
      const info = getModuleExports(f);
      moduleExportsMap.set(f, info);
    } catch (e) {
      WARNINGS.push(`[PARSE-ERROR] ${path.relative(ROOT, f)} — ${e.message}`);
    }
  }

  // Run all checks
  console.log('--- Check 1: EventBus .emit() vs .publish() ---');
  for (const f of allFiles) checkEventBusUsage(f);

  console.log('--- Check 2: SecretVault destructuring ---');
  for (const f of allFiles) checkSecretVaultDestructuring(f);

  console.log('--- Check 3: path variable shadowing ---');
  for (const f of allFiles) checkPathShadowing(f);

  console.log('--- Check 4: Singleton destructuring ---');
  for (const f of allFiles) checkSingletonDestructuring(f, moduleExportsMap);

  console.log('--- Check 5: Cross-reference callers vs exports ---');
  crossReference(allFiles, moduleExportsMap);

  console.log('--- Check 6: Known function signatures ---');
  checkKnownSignatures();

  console.log('--- Check 7: B4 regression (resetPassword lockout) ---');
  checkB4Regression();

  console.log('--- Check 8: B5 regression (cart .map on object) ---');
  checkB5Regression();

  console.log('--- Check 9: B2 regression (SMS templates) ---');
  checkB2Regression();

  console.log('--- Check 10: EventBus event name consistency ---');
  checkEventBusConsistency();

  console.log('--- Check 11: Cross-module function signatures ---');
  checkCrossModuleSignatures();

  console.log('--- Check 12: Duplicate store instances ---');
  checkDuplicateStoreInstances();

  // Report
  console.log('\n' + '='.repeat(60));
  console.log(`\n  ERRORS: ${ERRORS.length}`);
  console.log(`  WARNINGS: ${WARNINGS.length}\n`);

  if (ERRORS.length > 0) {
    console.log('--- ERRORS (must fix) ---');
    ERRORS.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  if (WARNINGS.length > 0) {
    console.log('\n--- WARNINGS (review) ---');
    WARNINGS.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  if (ERRORS.length === 0 && WARNINGS.length === 0) {
    console.log('  ALL CHECKS PASSED');
  }

  console.log('\n' + '='.repeat(60));
  process.exit(ERRORS.length > 0 ? 1 : 0);
}

main();
