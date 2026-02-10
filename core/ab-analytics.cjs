/**
 * VocalIA A/B Testing Analytics Collector
 * Session 250 - Task #32
 *
 * Lightweight analytics endpoint for A/B testing data.
 * Stores events in JSON files, can be extended to database/BigQuery.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'ab-analytics');
const MAX_EVENTS_PER_FILE = 10000;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Auto-purge old files on startup and every 24h
const AB_RETENTION_DAYS = 30;
const _purgeTimer = setInterval(() => {
  try {
    const { purgeOldFiles } = module.exports;
    purgeOldFiles(AB_RETENTION_DAYS);
  } catch (e) { /* startup race — module not yet exported */ }
}, 24 * 60 * 60 * 1000);
if (_purgeTimer.unref) _purgeTimer.unref();

/**
 * Get current log file path
 */
function getCurrentLogFile() {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(DATA_DIR, `ab-events-${date}.jsonl`);
}

/**
 * Log an A/B test event
 */
function logEvent(event) {
  const logFile = getCurrentLogFile();
  const line = JSON.stringify({
    ...event,
    receivedAt: Date.now(),
    serverTimestamp: new Date().toISOString()
  }) + '\n';

  fs.appendFileSync(logFile, line);
}

/**
 * Get aggregated stats for an experiment
 */
function getExperimentStats(experimentName, startDate = null, endDate = null) {
  const stats = {
    experiment: experimentName,
    variants: {},
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    conversionRate: 0,
    clickThroughRate: 0
  };

  // Read all log files in date range
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('ab-events-') && f.endsWith('.jsonl'))
    .sort();

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.experiment !== experimentName) continue;

        const variant = event.variant || 'unknown';

        // Initialize variant stats
        if (!stats.variants[variant]) {
          stats.variants[variant] = {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversionRate: 0,
            clickThroughRate: 0
          };
        }

        // Count events
        switch (event.eventType) {
          case 'impression':
            stats.variants[variant].impressions++;
            stats.totalImpressions++;
            break;
          case 'click':
            stats.variants[variant].clicks++;
            stats.totalClicks++;
            break;
          case 'conversion':
            stats.variants[variant].conversions++;
            stats.totalConversions++;
            break;
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }

  // Calculate rates
  if (stats.totalImpressions > 0) {
    stats.conversionRate = (stats.totalConversions / stats.totalImpressions * 100).toFixed(2);
    stats.clickThroughRate = (stats.totalClicks / stats.totalImpressions * 100).toFixed(2);
  }

  for (const [variant, data] of Object.entries(stats.variants)) {
    if (data.impressions > 0) {
      data.conversionRate = (data.conversions / data.impressions * 100).toFixed(2);
      data.clickThroughRate = (data.clicks / data.impressions * 100).toFixed(2);
    }
  }

  return stats;
}

/**
 * Get all experiments summary
 */
function getAllExperiments() {
  const experiments = new Set();

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('ab-events-') && f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.experiment) {
          experiments.add(event.experiment);
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }

  return Array.from(experiments).map(exp => getExperimentStats(exp));
}

/**
 * Express middleware for A/B analytics endpoint
 */
function createAnalyticsMiddleware() {
  return (req, res, next) => {
    if (req.method === 'POST' && req.url === '/api/analytics/ab') {
      let body = '';
      let bytes = 0;
      const MAX_BODY = 1048576; // 1MB
      req.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX_BODY) { req.destroy(); return; }
        body += chunk;
      });
      req.on('end', () => {
        try {
          const event = JSON.parse(body);

          // Validate required fields
          if (!event.experiment || !event.eventType) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing experiment or eventType' }));
            return;
          }

          // Log the event
          logEvent(event);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/analytics/ab') {
      try {
        const results = getAllExperiments();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ experiments: results }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/analytics/ab/')) {
      const experiment = req.url.split('/').pop();
      try {
        const stats = getExperimentStats(experiment);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    next();
  };
}

/**
 * Purge JSONL files older than retentionDays (default: 30)
 */
function purgeOldFiles(retentionDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('ab-events-') && f.endsWith('.jsonl'));

  let purged = 0;
  for (const file of files) {
    const dateMatch = file.match(/ab-events-(\d{4}-\d{2}-\d{2})\.jsonl/);
    if (dateMatch && dateMatch[1] < cutoffStr) {
      fs.unlinkSync(path.join(DATA_DIR, file));
      purged++;
    }
  }
  if (purged > 0) {
    console.log(`[AB Analytics] Purged ${purged} files older than ${retentionDays} days`);
  }
  return purged;
}

module.exports = {
  logEvent,
  getExperimentStats,
  getAllExperiments,
  createAnalyticsMiddleware,
  purgeOldFiles
};

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--stats') {
    const experiment = args[1];
    if (experiment) {
      console.log(JSON.stringify(getExperimentStats(experiment), null, 2));
    } else {
      console.log(JSON.stringify(getAllExperiments(), null, 2));
    }
  } else {
    console.log('Usage:');
    console.log('  node ab-analytics.cjs --stats [experiment]');
  }
}
