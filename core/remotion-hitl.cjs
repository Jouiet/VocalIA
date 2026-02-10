#!/usr/bin/env node
/**
 * Remotion HITL (Human In The Loop) Service
 * VocalIA - Session 250.43
 *
 * Manages video approval workflow before publishing/exporting.
 * Provides queue, preview, approve/reject functionality.
 *
 * Usage:
 *   node remotion-hitl.cjs --server        # Start HITL API server
 *   node remotion-hitl.cjs --list          # List pending approvals
 *   node remotion-hitl.cjs --approve <id>  # Approve video
 *   node remotion-hitl.cjs --reject <id>   # Reject video
 *   node remotion-hitl.cjs --health        # Health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Configuration
const PORT = process.env.REMOTION_HITL_PORT || 3012;
const DATA_DIR = path.join(__dirname, '../data/remotion-hitl');
const QUEUE_FILE = path.join(DATA_DIR, 'pending-queue.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.jsonl');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// HITL Event Emitter for real-time notifications
class HITLEvents extends EventEmitter {}
const hitlEvents = new HITLEvents();

// Video approval states
const STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RENDERING: 'rendering',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// ─────────────────────────────────────────────────────────────────────────────
// Queue Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load pending queue from disk
 */
function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('[HITL] Error loading queue:', error.message);
  }
  return { items: [], lastUpdated: null };
}

/**
 * Save queue to disk
 */
function saveQueue(queue) {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * Generate unique ID
 */
function generateId() {
  return `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Add video to approval queue
 */
function queueVideo(videoRequest) {
  const queue = loadQueue();

  const item = {
    id: generateId(),
    state: STATES.PENDING,
    composition: videoRequest.composition,
    language: videoRequest.language || 'fr',
    props: videoRequest.props || {},
    requestedBy: videoRequest.requestedBy || 'system',
    requestedAt: new Date().toISOString(),
    previewUrl: null,
    outputPath: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null
  };

  // BL30 fix: Bound queue to prevent unbounded growth
  const MAX_QUEUE_SIZE = 10000;
  if (queue.items.length >= MAX_QUEUE_SIZE) {
    // Remove oldest completed/failed items first
    const removableStates = [STATES.COMPLETED, STATES.FAILED, STATES.REJECTED];
    const idx = queue.items.findIndex(i => removableStates.includes(i.state));
    if (idx !== -1) {
      queue.items.splice(idx, 1);
    } else {
      queue.items.shift(); // Remove oldest if none removable
    }
  }
  queue.items.push(item);
  saveQueue(queue);

  // Emit event
  hitlEvents.emit('video:queued', item);

  // Log audit
  logAudit('VIDEO_QUEUED', item);

  console.log(`[HITL] Video queued: ${item.id} (${item.composition})`);
  return item;
}

/**
 * Get pending videos
 */
function getPending() {
  const queue = loadQueue();
  return queue.items.filter(item => item.state === STATES.PENDING);
}

/**
 * Get video by ID
 */
function getVideo(id) {
  const queue = loadQueue();
  return queue.items.find(item => item.id === id);
}

/**
 * Update video state
 */
function updateVideo(id, updates) {
  const queue = loadQueue();
  const index = queue.items.findIndex(item => item.id === id);

  if (index === -1) {
    throw new Error(`Video not found: ${id}`);
  }

  queue.items[index] = { ...queue.items[index], ...updates };
  saveQueue(queue);

  return queue.items[index];
}

/**
 * Approve video for rendering
 */
function approveVideo(id, reviewer, notes = '') {
  const video = getVideo(id);

  if (!video) {
    throw new Error(`Video not found: ${id}`);
  }

  if (video.state !== STATES.PENDING) {
    throw new Error(`Video not in pending state: ${video.state}`);
  }

  const updated = updateVideo(id, {
    state: STATES.APPROVED,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    reviewNotes: notes
  });

  // Emit event
  hitlEvents.emit('video:approved', updated);

  // Log audit
  logAudit('VIDEO_APPROVED', { id, reviewer, notes });

  console.log(`[HITL] Video approved: ${id} by ${reviewer}`);
  return updated;
}

/**
 * Reject video
 */
function rejectVideo(id, reviewer, reason = '') {
  const video = getVideo(id);

  if (!video) {
    throw new Error(`Video not found: ${id}`);
  }

  if (video.state !== STATES.PENDING) {
    throw new Error(`Video not in pending state: ${video.state}`);
  }

  const updated = updateVideo(id, {
    state: STATES.REJECTED,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reason
  });

  // Emit event
  hitlEvents.emit('video:rejected', updated);

  // Log audit
  logAudit('VIDEO_REJECTED', { id, reviewer, reason });

  console.log(`[HITL] Video rejected: ${id} by ${reviewer} - ${reason}`);
  return updated;
}

/**
 * Mark video as rendering
 */
function markRendering(id) {
  const updated = updateVideo(id, {
    state: STATES.RENDERING,
    renderStartedAt: new Date().toISOString()
  });

  hitlEvents.emit('video:rendering', updated);
  logAudit('VIDEO_RENDERING', { id });

  return updated;
}

/**
 * Mark video as completed
 */
function markCompleted(id, outputPath) {
  const updated = updateVideo(id, {
    state: STATES.COMPLETED,
    outputPath,
    completedAt: new Date().toISOString()
  });

  hitlEvents.emit('video:completed', updated);
  logAudit('VIDEO_COMPLETED', { id, outputPath });

  console.log(`[HITL] Video completed: ${id} → ${outputPath}`);
  return updated;
}

/**
 * Mark video as failed
 */
function markFailed(id, error) {
  const updated = updateVideo(id, {
    state: STATES.FAILED,
    error: error.message || error,
    failedAt: new Date().toISOString()
  });

  hitlEvents.emit('video:failed', updated);
  logAudit('VIDEO_FAILED', { id, error: error.message || error });

  console.error(`[HITL] Video failed: ${id} - ${error}`);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log audit event
 */
function logAudit(action, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    data
  };

  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
}

/**
 * Get audit log
 */
function getAuditLog(limit = 100) {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return [];
    }

    const lines = fs.readFileSync(AUDIT_FILE, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .slice(-limit)
      .reverse();

    return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  } catch (error) {
    console.error('[HITL] Error reading audit log:', error.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get queue statistics
 */
function getStats() {
  const queue = loadQueue();

  const stats = {
    total: queue.items.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    rendering: 0,
    completed: 0,
    failed: 0,
    lastUpdated: queue.lastUpdated
  };

  for (const item of queue.items) {
    stats[item.state] = (stats[item.state] || 0) + 1;
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP API Server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse JSON body from request
 */
async function parseBody(req, maxBytes = 1048576) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        return reject(new Error(`Body exceeds ${maxBytes} bytes limit`));
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
// Session 250.43: CORS whitelist instead of '*'
const CORS_ALLOWED_ORIGINS = [
  'https://vocalia.ma',
  'https://www.vocalia.ma',
  'https://api.vocalia.ma',
  'http://localhost:8080',
  'http://localhost:3000'
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer?.replace(/\/$/, '') || '';
  return CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0];
}

function sendJson(res, data, status = 200, req = null) {
  const corsOrigin = req ? getCorsOrigin(req) : CORS_ALLOWED_ORIGINS[0];
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Handle HTTP request
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    const corsOrigin = getCorsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // Routes
    if (url.pathname === '/health' && method === 'GET') {
      return sendJson(res, {
        service: 'Remotion HITL',
        status: 'healthy',
        stats: getStats(),
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/stats' && method === 'GET') {
      return sendJson(res, getStats());
    }

    if (url.pathname === '/queue' && method === 'GET') {
      const state = url.searchParams.get('state');
      const queue = loadQueue();
      const items = state
        ? queue.items.filter(item => item.state === state)
        : queue.items;
      return sendJson(res, { items, total: items.length });
    }

    if (url.pathname === '/queue' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.composition) {
        return sendJson(res, { error: 'composition is required' }, 400);
      }
      const item = queueVideo(body);
      return sendJson(res, item, 201);
    }

    if (url.pathname === '/pending' && method === 'GET') {
      return sendJson(res, { items: getPending() });
    }

    // Video operations: /video/:id
    const videoMatch = url.pathname.match(/^\/video\/([^/]+)$/);
    if (videoMatch) {
      const id = videoMatch[1];

      if (method === 'GET') {
        const video = getVideo(id);
        if (!video) {
          return sendJson(res, { error: 'Video not found' }, 404);
        }
        return sendJson(res, video);
      }
    }

    // Approve: /video/:id/approve
    const approveMatch = url.pathname.match(/^\/video\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      const id = approveMatch[1];
      const body = await parseBody(req);
      const reviewer = body.reviewer || 'admin';
      const notes = body.notes || '';

      try {
        const video = approveVideo(id, reviewer, notes);
        return sendJson(res, video);
      } catch (error) {
        return sendJson(res, { error: error.message }, 400);
      }
    }

    // Reject: /video/:id/reject
    const rejectMatch = url.pathname.match(/^\/video\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const id = rejectMatch[1];
      const body = await parseBody(req);
      const reviewer = body.reviewer || 'admin';
      const reason = body.reason || '';

      try {
        const video = rejectVideo(id, reviewer, reason);
        return sendJson(res, video);
      } catch (error) {
        return sendJson(res, { error: error.message }, 400);
      }
    }

    // Audit log
    if (url.pathname === '/audit' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      return sendJson(res, { entries: getAuditLog(limit) });
    }

    // 404
    sendJson(res, { error: 'Not found' }, 404);

  } catch (error) {
    console.error('[HITL] Request error:', error);
    // BL29 fix: Generic error to client (don't leak internal details)
    sendJson(res, { error: 'Internal server error' }, 500);
  }
}

/**
 * Start HTTP server
 */
function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`[HITL] Remotion HITL server running on http://localhost:${PORT}`);
    console.log(`[HITL] Endpoints:`);
    console.log(`  GET  /health          - Health check`);
    console.log(`  GET  /stats           - Queue statistics`);
    console.log(`  GET  /queue           - List all videos`);
    console.log(`  GET  /pending         - List pending videos`);
    console.log(`  POST /queue           - Queue new video`);
    console.log(`  GET  /video/:id       - Get video details`);
    console.log(`  POST /video/:id/approve - Approve video`);
    console.log(`  POST /video/:id/reject  - Reject video`);
    console.log(`  GET  /audit           - Get audit log`);
  });

  return server;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--server')) {
    startServer();
    return;
  }

  if (args.includes('--health')) {
    console.log(JSON.stringify({
      service: 'Remotion HITL',
      stats: getStats(),
      dataDir: DATA_DIR,
      queueFile: QUEUE_FILE
    }, null, 2));
    return;
  }

  if (args.includes('--list')) {
    const pending = getPending();
    console.log('\n=== Pending Video Approvals ===\n');
    if (pending.length === 0) {
      console.log('No pending videos.');
    } else {
      for (const item of pending) {
        console.log(`  ${item.id}`);
        console.log(`    Composition: ${item.composition}`);
        console.log(`    Language: ${item.language}`);
        console.log(`    Requested: ${item.requestedAt}`);
        console.log(`    By: ${item.requestedBy}`);
        console.log('');
      }
    }
    console.log(`Total pending: ${pending.length}`);
    return;
  }

  if (args.includes('--stats')) {
    console.log(JSON.stringify(getStats(), null, 2));
    return;
  }

  const approveIndex = args.indexOf('--approve');
  if (approveIndex !== -1) {
    const id = args[approveIndex + 1];
    if (!id) {
      console.error('Usage: --approve <video-id>');
      process.exit(1);
    }
    try {
      const video = approveVideo(id, 'cli-admin', 'Approved via CLI');
      console.log(`Approved: ${video.id}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  const rejectIndex = args.indexOf('--reject');
  if (rejectIndex !== -1) {
    const id = args[rejectIndex + 1];
    const reason = args[rejectIndex + 2] || 'Rejected via CLI';
    if (!id) {
      console.error('Usage: --reject <video-id> [reason]');
      process.exit(1);
    }
    try {
      const video = rejectVideo(id, 'cli-admin', reason);
      console.log(`Rejected: ${video.id}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Default: show help
  console.log(`
Remotion HITL Service - Video Approval Workflow
================================================

Commands:
  --server              Start HITL API server (port ${PORT})
  --list                List pending approvals
  --stats               Show queue statistics
  --approve <id>        Approve video for rendering
  --reject <id> [reason] Reject video
  --health              Health check

API Endpoints (when server running):
  GET  /health          - Service health
  GET  /stats           - Queue statistics
  GET  /queue           - List all videos
  GET  /pending         - List pending videos
  POST /queue           - Queue new video
  POST /video/:id/approve - Approve video
  POST /video/:id/reject  - Reject video
  GET  /audit           - Audit log

Examples:
  node remotion-hitl.cjs --server
  node remotion-hitl.cjs --list
  node remotion-hitl.cjs --approve vid_12345_abc
  node remotion-hitl.cjs --reject vid_12345_abc "Wrong content"
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  queueVideo,
  getPending,
  getVideo,
  approveVideo,
  rejectVideo,
  markRendering,
  markCompleted,
  markFailed,
  getStats,
  getAuditLog,
  startServer,
  hitlEvents,
  STATES
};
