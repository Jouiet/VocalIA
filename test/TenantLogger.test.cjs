'use strict';

/**
 * VocalIA TenantLogger Tests
 *
 * Tests:
 * - Constructor (tenantId, scriptName, runId, log level, console flag, logDir, logFile)
 * - _formatEntry (structured JSON entry format)
 * - Log levels (debug, info, warn, error) with level filtering
 * - start/complete/fail convenience methods
 * - child logger creation
 * - Static getRecentLogs (returns empty for non-existent tenant)
 * - Static cleanOldLogs (returns 0 for non-existent tenant)
 *
 * Run: node --test test/TenantLogger.test.cjs
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const TenantLogger = require('../core/TenantLogger.cjs');

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('TenantLogger constructor', () => {
  test('sets tenantId', () => {
    const logger = new TenantLogger('test-tenant', { console: false });
    assert.strictEqual(logger.tenantId, 'test-tenant');
  });

  test('sets default scriptName to unknown', () => {
    const logger = new TenantLogger('t1', { console: false });
    assert.strictEqual(logger.scriptName, 'unknown');
  });

  test('sets custom scriptName', () => {
    const logger = new TenantLogger('t1', { scriptName: 'kb-sync', console: false });
    assert.strictEqual(logger.scriptName, 'kb-sync');
  });

  test('generates runId if not provided', () => {
    const logger = new TenantLogger('t1', { console: false });
    assert.ok(logger.runId);
    assert.ok(logger.runId.length > 5);
  });

  test('uses provided runId', () => {
    const logger = new TenantLogger('t1', { runId: 'my-run-123', console: false });
    assert.strictEqual(logger.runId, 'my-run-123');
  });

  test('default log level is info', () => {
    const logger = new TenantLogger('t1', { console: false });
    assert.strictEqual(logger.minLevel, 1); // info = 1
  });

  test('custom log level debug', () => {
    const logger = new TenantLogger('t1', { level: 'debug', console: false });
    assert.strictEqual(logger.minLevel, 0); // debug = 0
  });

  test('custom log level error', () => {
    const logger = new TenantLogger('t1', { level: 'error', console: false });
    assert.strictEqual(logger.minLevel, 3); // error = 3
  });

  test('logDir includes tenant path', () => {
    const logger = new TenantLogger('my-tenant', { console: false });
    assert.ok(logger.logDir.includes('my-tenant'));
    assert.ok(logger.logDir.includes('tenants'));
  });

  test('logFile is daily JSONL', () => {
    const logger = new TenantLogger('t1', { console: false });
    const filename = path.basename(logger.logFile);
    assert.match(filename, /^\d{4}-\d{2}-\d{2}\.jsonl$/);
  });
});

// ─── _formatEntry ────────────────────────────────────────────────────────────

describe('TenantLogger _formatEntry', () => {
  const logger = new TenantLogger('test-fmt', { scriptName: 'test-script', runId: 'run-001', console: false });

  test('includes timestamp', () => {
    const entry = logger._formatEntry('info', 'test message');
    assert.ok(entry.timestamp);
    assert.ok(!isNaN(Date.parse(entry.timestamp)));
  });

  test('includes level', () => {
    const entry = logger._formatEntry('error', 'test');
    assert.strictEqual(entry.level, 'error');
  });

  test('includes tenant', () => {
    const entry = logger._formatEntry('info', 'test');
    assert.strictEqual(entry.tenant, 'test-fmt');
  });

  test('includes script', () => {
    const entry = logger._formatEntry('info', 'test');
    assert.strictEqual(entry.script, 'test-script');
  });

  test('includes runId', () => {
    const entry = logger._formatEntry('info', 'test');
    assert.strictEqual(entry.runId, 'run-001');
  });

  test('includes message', () => {
    const entry = logger._formatEntry('info', 'Hello world');
    assert.strictEqual(entry.message, 'Hello world');
  });

  test('includes data when provided', () => {
    const entry = logger._formatEntry('info', 'test', { key: 'value' });
    assert.deepStrictEqual(entry.data, { key: 'value' });
  });

  test('omits data when empty', () => {
    const entry = logger._formatEntry('info', 'test', {});
    assert.ok(!('data' in entry));
  });

  test('omits data when not provided', () => {
    const entry = logger._formatEntry('info', 'test');
    assert.ok(!('data' in entry));
  });
});

// ─── Log level filtering ─────────────────────────────────────────────────────

describe('TenantLogger log level filtering', () => {
  test('info logger filters out debug', () => {
    const logger = new TenantLogger('t-filter', { level: 'info', console: false });
    const result = logger.debug('debug message');
    assert.strictEqual(result, undefined); // filtered out
  });

  test('info logger allows info', () => {
    const logger = new TenantLogger('t-filter', { level: 'info', console: false });
    const result = logger.info('info message');
    assert.ok(result);
    assert.strictEqual(result.level, 'info');
  });

  test('info logger allows warn', () => {
    const logger = new TenantLogger('t-filter', { level: 'info', console: false });
    const result = logger.warn('warn message');
    assert.ok(result);
    assert.strictEqual(result.level, 'warn');
  });

  test('info logger allows error', () => {
    const logger = new TenantLogger('t-filter', { level: 'info', console: false });
    const result = logger.error('error message');
    assert.ok(result);
    assert.strictEqual(result.level, 'error');
  });

  test('error logger filters out info', () => {
    const logger = new TenantLogger('t-filter', { level: 'error', console: false });
    const result = logger.info('info message');
    assert.strictEqual(result, undefined);
  });

  test('error logger filters out warn', () => {
    const logger = new TenantLogger('t-filter', { level: 'error', console: false });
    const result = logger.warn('warn message');
    assert.strictEqual(result, undefined);
  });

  test('debug logger allows all levels', () => {
    const logger = new TenantLogger('t-filter', { level: 'debug', console: false });
    assert.ok(logger.debug('d'));
    assert.ok(logger.info('i'));
    assert.ok(logger.warn('w'));
    assert.ok(logger.error('e'));
  });
});

// ─── Convenience methods ─────────────────────────────────────────────────────

describe('TenantLogger convenience methods', () => {
  const logger = new TenantLogger('t-conv', { console: false, runId: `${Date.now()}-test` });

  test('start logs with params', () => {
    const entry = logger.start({ input: 'test' });
    assert.strictEqual(entry.message, 'Script started');
    assert.deepStrictEqual(entry.data.params, { input: 'test' });
  });

  test('complete logs with duration', () => {
    const entry = logger.complete({ success: true });
    assert.strictEqual(entry.message, 'Script completed');
    assert.ok(typeof entry.data.duration === 'number');
    assert.deepStrictEqual(entry.data.result, { success: true });
  });

  test('fail logs Error object', () => {
    const entry = logger.fail(new Error('test error'));
    assert.strictEqual(entry.level, 'error');
    assert.strictEqual(entry.message, 'Script failed');
    assert.strictEqual(entry.data.error, 'test error');
    assert.ok(entry.data.stack);
  });

  test('fail logs string error', () => {
    const entry = logger.fail('string error');
    assert.strictEqual(entry.data.error, 'string error');
  });
});

// ─── Child logger ────────────────────────────────────────────────────────────

describe('TenantLogger child', () => {
  test('creates child with same tenantId', () => {
    const parent = new TenantLogger('t-parent', { console: false });
    const child = parent.child({});
    assert.strictEqual(child.tenantId, 't-parent');
  });

  test('inherits runId from parent', () => {
    const parent = new TenantLogger('t-parent', { runId: 'parent-run', console: false });
    const child = parent.child({});
    assert.strictEqual(child.runId, 'parent-run');
  });

  test('allows override scriptName', () => {
    const parent = new TenantLogger('t-parent', { scriptName: 'main', console: false });
    const child = parent.child({ scriptName: 'sub-task' });
    assert.strictEqual(child.scriptName, 'sub-task');
  });

  test('child is a TenantLogger instance', () => {
    const parent = new TenantLogger('t-parent', { console: false });
    const child = parent.child({});
    assert.ok(child instanceof TenantLogger);
  });
});

// ─── Static methods ──────────────────────────────────────────────────────────

describe('TenantLogger static methods', () => {
  test('getRecentLogs returns empty array for non-existent tenant', () => {
    const logs = TenantLogger.getRecentLogs('__nonexistent_tenant_xyz__');
    assert.deepStrictEqual(logs, []);
  });

  test('cleanOldLogs returns 0 for non-existent tenant', () => {
    const count = TenantLogger.cleanOldLogs('__nonexistent_tenant_xyz__');
    assert.strictEqual(count, 0);
  });

});

// ─── File I/O (merged from tenant-logger.test.cjs) ─────────────────────────

describe('TenantLogger file I/O', () => {
  const fs = require('fs');
  const TEST_TENANT_IO = '__test_logger_io_tenant__';
  let logger;

  afterEach(() => {
    try {
      if (logger && fs.existsSync(logger.logDir)) {
        fs.rmSync(logger.logDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
  });

  test('writes JSONL entry to log file', () => {
    logger = new TenantLogger(TEST_TENANT_IO, { console: false });
    logger.info('Test write', { testData: true });

    assert.ok(fs.existsSync(logger.logFile));
    const content = fs.readFileSync(logger.logFile, 'utf8').trim();
    const lines = content.split('\n').filter(l => l.trim());
    assert.ok(lines.length >= 1);

    const parsed = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(parsed.message, 'Test write');
    assert.strictEqual(parsed.level, 'info');
    assert.strictEqual(parsed.tenant, TEST_TENANT_IO);
  });

  test('appends multiple entries', () => {
    logger = new TenantLogger(TEST_TENANT_IO, { console: false });
    logger.info('Entry 1');
    logger.warn('Entry 2');
    logger.error('Entry 3');

    const content = fs.readFileSync(logger.logFile, 'utf8').trim();
    const lines = content.split('\n').filter(l => l.trim());
    assert.ok(lines.length >= 3);
  });
});
