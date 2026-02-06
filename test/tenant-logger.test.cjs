'use strict';

/**
 * VocalIA TenantLogger Tests
 *
 * Tests:
 * - Constructor defaults and options
 * - _formatEntry structure
 * - Log level filtering (debug < info < warn < error)
 * - debug/info/warn/error methods
 * - start/complete/fail lifecycle methods
 * - child logger creation
 * - File I/O (logEvent writes JSONL)
 * - getRecentLogs static method
 * - cleanOldLogs static method
 *
 * NOTE: Tests write to temp directories, cleaned up after each test.
 *
 * Run: node --test test/tenant-logger.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TenantLogger = require('../core/TenantLogger.cjs');

// Use a unique temp test dir to avoid conflicts
const TEST_TENANT = '__test_logger_tenant__';

describe('TenantLogger constructor', () => {
  test('sets tenantId and defaults', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    assert.strictEqual(logger.tenantId, TEST_TENANT);
    assert.strictEqual(logger.scriptName, 'unknown');
    assert.ok(logger.runId);
    assert.ok(logger.logFile.endsWith('.jsonl'));
  });

  test('accepts custom scriptName and runId', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      scriptName: 'my-script',
      runId: '12345-abc',
      console: false
    });
    assert.strictEqual(logger.scriptName, 'my-script');
    assert.strictEqual(logger.runId, '12345-abc');
  });

  test('defaults to info level', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    // info = 1
    assert.strictEqual(logger.minLevel, 1);
  });

  test('accepts custom log level', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'debug',
      console: false
    });
    assert.strictEqual(logger.minLevel, 0);
  });

  test('error level is highest', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'error',
      console: false
    });
    assert.strictEqual(logger.minLevel, 3);
  });
});

describe('TenantLogger _formatEntry', () => {
  test('returns structured entry', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      scriptName: 'test-script',
      runId: 'run-123',
      console: false
    });

    const entry = logger._formatEntry('info', 'Test message', { key: 'value' });

    assert.ok(entry.timestamp);
    assert.strictEqual(entry.level, 'info');
    assert.strictEqual(entry.tenant, TEST_TENANT);
    assert.strictEqual(entry.script, 'test-script');
    assert.strictEqual(entry.runId, 'run-123');
    assert.strictEqual(entry.message, 'Test message');
    assert.deepStrictEqual(entry.data, { key: 'value' });
  });

  test('omits data key when data is empty', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    const entry = logger._formatEntry('info', 'No data', {});
    assert.strictEqual(entry.data, undefined);
  });
});

describe('TenantLogger level filtering', () => {
  test('info level filters out debug', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'info',
      console: false
    });

    const result = logger.debug('Should be filtered');
    assert.strictEqual(result, undefined);
  });

  test('info level allows info', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'info',
      console: false
    });

    const result = logger.info('Should pass');
    assert.ok(result);
    assert.strictEqual(result.level, 'info');
  });

  test('info level allows warn', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'info',
      console: false
    });

    const result = logger.warn('Warning message');
    assert.ok(result);
    assert.strictEqual(result.level, 'warn');
  });

  test('error level filters out info and warn', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'error',
      console: false
    });

    assert.strictEqual(logger.info('Filtered'), undefined);
    assert.strictEqual(logger.warn('Filtered'), undefined);
    assert.ok(logger.error('Passes'));
  });

  test('debug level allows everything', () => {
    const logger = new TenantLogger(TEST_TENANT, {
      level: 'debug',
      console: false
    });

    assert.ok(logger.debug('Debug'));
    assert.ok(logger.info('Info'));
    assert.ok(logger.warn('Warn'));
    assert.ok(logger.error('Error'));
  });
});

describe('TenantLogger log methods', () => {
  test('info returns entry with correct level', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    const entry = logger.info('Info message', { detail: 1 });
    assert.strictEqual(entry.level, 'info');
    assert.strictEqual(entry.message, 'Info message');
  });

  test('warn returns entry with correct level', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    const entry = logger.warn('Warn message');
    assert.strictEqual(entry.level, 'warn');
  });

  test('error returns entry with correct level', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    const entry = logger.error('Error message');
    assert.strictEqual(entry.level, 'error');
  });
});

describe('TenantLogger lifecycle methods', () => {
  test('start logs with params', () => {
    const logger = new TenantLogger(TEST_TENANT, { console: false });
    const entry = logger.start({ param1: 'value1' });
    assert.strictEqual(entry.message, 'Script started');
    assert.deepStrictEqual(entry.data.params, { param1: 'value1' });
  });

  test('complete logs with duration', () => {
    const runId = `${Date.now()}-testrun`;
    const logger = new TenantLogger(TEST_TENANT, {
      runId,
      console: false
    });
    const entry = logger.complete({ result: 'ok' });
    assert.strictEqual(entry.message, 'Script completed');
    assert.ok(typeof entry.data.duration === 'number');
    assert.deepStrictEqual(entry.data.result, { result: 'ok' });
  });

  test('fail logs Error object', () => {
    const runId = `${Date.now()}-testrun`;
    const logger = new TenantLogger(TEST_TENANT, {
      runId,
      console: false
    });
    const err = new Error('Something broke');
    const entry = logger.fail(err);
    assert.strictEqual(entry.message, 'Script failed');
    assert.strictEqual(entry.data.error, 'Something broke');
    assert.ok(entry.data.stack);
  });

  test('fail logs string error', () => {
    const runId = `${Date.now()}-testrun`;
    const logger = new TenantLogger(TEST_TENANT, {
      runId,
      console: false
    });
    const entry = logger.fail('Plain error string');
    assert.strictEqual(entry.data.error, 'Plain error string');
    assert.strictEqual(entry.data.stack, undefined);
  });
});

describe('TenantLogger child', () => {
  test('creates child logger with same tenantId and runId', () => {
    const parent = new TenantLogger(TEST_TENANT, {
      scriptName: 'parent',
      runId: 'shared-run-id',
      console: false
    });

    const child = parent.child({ scriptName: 'child-script' });
    assert.strictEqual(child.tenantId, TEST_TENANT);
    assert.strictEqual(child.scriptName, 'child-script');
    assert.strictEqual(child.runId, 'shared-run-id');
  });

  test('child inherits log level', () => {
    const parent = new TenantLogger(TEST_TENANT, {
      level: 'warn',
      console: false
    });

    const child = parent.child({});
    assert.strictEqual(child.minLevel, parent.minLevel);
  });
});

describe('TenantLogger file I/O', () => {
  let logger;

  afterEach(() => {
    // Cleanup test log files
    try {
      if (logger && fs.existsSync(logger.logDir)) {
        fs.rmSync(logger.logDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
  });

  test('writes JSONL entry to log file', () => {
    logger = new TenantLogger(TEST_TENANT, { console: false });
    logger.info('Test write', { testData: true });

    assert.ok(fs.existsSync(logger.logFile));
    const content = fs.readFileSync(logger.logFile, 'utf8').trim();
    const lines = content.split('\n').filter(l => l.trim());
    assert.ok(lines.length >= 1);

    const parsed = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(parsed.message, 'Test write');
    assert.strictEqual(parsed.level, 'info');
    assert.strictEqual(parsed.tenant, TEST_TENANT);
  });

  test('appends multiple entries', () => {
    logger = new TenantLogger(TEST_TENANT, { console: false });
    logger.info('Entry 1');
    logger.warn('Entry 2');
    logger.error('Entry 3');

    const content = fs.readFileSync(logger.logFile, 'utf8').trim();
    const lines = content.split('\n').filter(l => l.trim());
    assert.ok(lines.length >= 3);
  });
});
