#!/usr/bin/env node
/**
 * TenantLogger - Isolated Logging per Tenant
 *
 * Provides tenant-specific logging with:
 * - Separate log files per tenant
 * - Structured JSON logging
 * - Log levels (debug, info, warn, error)
 * - Automatic log rotation
 * - Context tracking (script, runId)
 *
 * @module TenantLogger
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class TenantLogger {
  /**
   * Create a tenant-specific logger
   * @param {string} tenantId - Tenant identifier
   * @param {Object} options - Logger options
   */
  constructor(tenantId, options = {}) {
    this.tenantId = tenantId;
    this.scriptName = options.scriptName || 'unknown';
    this.runId = options.runId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.minLevel = LOG_LEVELS[options.level || process.env.LOG_LEVEL || 'info'];
    this.console = options.console !== false;

    // Log directory
    this.logDir = path.join(
      process.cwd(),
      '..',
      'logs',
      'tenants',
      tenantId
    );

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Daily log file
    this.logFile = path.join(
      this.logDir,
      `${new Date().toISOString().split('T')[0]}.jsonl`
    );
  }

  /**
   * Format log entry
   */
  _formatEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      tenant: this.tenantId,
      script: this.scriptName,
      runId: this.runId,
      message,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    };
  }

  /**
   * Write log entry to file
   */
  _writeLog(entry) {
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error(`[TenantLogger] Failed to write log:`, error.message);
    }
  }

  /**
   * Output to console with color
   */
  _consoleOutput(level, entry) {
    if (!this.console) return;

    const colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';

    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const context = `[${this.tenantId}/${this.scriptName}]`;

    if (level === 'error') {
      console.error(`${prefix} ${context} ${entry.message}`, entry.data || '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${context} ${entry.message}`, entry.data || '');
    } else {
      console.log(`${prefix} ${context} ${entry.message}`, entry.data || '');
    }
  }

  /**
   * Log at specified level
   */
  _log(level, message, data) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry = this._formatEntry(level, message, data);
    this._writeLog(entry);
    this._consoleOutput(level, entry);

    return entry;
  }

  /**
   * Debug level log
   */
  debug(message, data = {}) {
    return this._log('debug', message, data);
  }

  /**
   * Info level log
   */
  info(message, data = {}) {
    return this._log('info', message, data);
  }

  /**
   * Warning level log
   */
  warn(message, data = {}) {
    return this._log('warn', message, data);
  }

  /**
   * Error level log
   */
  error(message, data = {}) {
    return this._log('error', message, data);
  }

  /**
   * Log script start
   */
  start(params = {}) {
    return this.info('Script started', { params });
  }

  /**
   * Log script completion
   */
  complete(result = {}) {
    const duration = Date.now() - parseInt(this.runId.split('-')[0]);
    return this.info('Script completed', { duration, result });
  }

  /**
   * Log script failure
   */
  fail(error) {
    const duration = Date.now() - parseInt(this.runId.split('-')[0]);
    return this.error('Script failed', {
      duration,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    const child = new TenantLogger(this.tenantId, {
      scriptName: context.scriptName || this.scriptName,
      runId: this.runId,
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.minLevel),
      console: this.console,
    });
    return child;
  }

  /**
   * Get recent logs for tenant
   */
  static getRecentLogs(tenantId, options = {}) {
    const { lines = 100, level = null, script = null } = options;
    const logDir = path.join(process.cwd(), '..', 'logs', 'tenants', tenantId);

    if (!fs.existsSync(logDir)) {
      return [];
    }

    // Get today's log file
    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.jsonl`);

    if (!fs.existsSync(logFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(logFile, 'utf8');
      let entries = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);

      // Filter by level
      if (level) {
        entries = entries.filter(e => e.level === level);
      }

      // Filter by script
      if (script) {
        entries = entries.filter(e => e.script === script);
      }

      // Return last N entries
      return entries.slice(-lines);
    } catch (error) {
      console.error(`[TenantLogger] Failed to read logs:`, error.message);
      return [];
    }
  }

  /**
   * Clean old logs (older than N days)
   */
  static cleanOldLogs(tenantId, daysToKeep = 30) {
    const logDir = path.join(process.cwd(), '..', 'logs', 'tenants', tenantId);

    if (!fs.existsSync(logDir)) {
      return 0;
    }

    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deleted = 0;

    const files = fs.readdirSync(logDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(logDir, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    return deleted;
  }
}

module.exports = TenantLogger;

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
TenantLogger - Isolated Logging per Tenant

Usage:
  node TenantLogger.cjs --tenant <id> --logs [options]
  node TenantLogger.cjs --tenant <id> --clean [days]

Options:
  --tenant <id>     Tenant ID (required)
  --logs            Show recent logs
  --lines <n>       Number of lines (default: 100)
  --level <level>   Filter by level (debug/info/warn/error)
  --script <name>   Filter by script name
  --clean [days]    Clean logs older than N days (default: 30)
`);
    process.exit(0);
  }

  const tenantIdx = args.indexOf('--tenant');
  const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;

  if (!tenantId) {
    console.error('Error: --tenant is required');
    process.exit(1);
  }

  if (args.includes('--logs')) {
    const linesIdx = args.indexOf('--lines');
    const lines = linesIdx !== -1 ? parseInt(args[linesIdx + 1]) : 100;

    const levelIdx = args.indexOf('--level');
    const level = levelIdx !== -1 ? args[levelIdx + 1] : null;

    const scriptIdx = args.indexOf('--script');
    const script = scriptIdx !== -1 ? args[scriptIdx + 1] : null;

    const logs = TenantLogger.getRecentLogs(tenantId, { lines, level, script });
    console.log(JSON.stringify(logs, null, 2));
  }

  if (args.includes('--clean')) {
    const cleanIdx = args.indexOf('--clean');
    const days = args[cleanIdx + 1] ? parseInt(args[cleanIdx + 1]) : 30;

    const deleted = TenantLogger.cleanOldLogs(tenantId, days);
    console.log(`Deleted ${deleted} old log files`);
  }
}
