#!/usr/bin/env node
/**
 * Remotion HITL (Human In The Loop) Service
 * VocalIA - Session 250.43
 *
 * Manages video approval workflow before publishing/exporting.
 * Provides queue, preview, approve/reject functionality.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Configuration
const PORT = process.env.REMOTION_HITL_PORT || 3012;
const DATA_DIR = path.join(__dirname, '../data/remotion-hitl');
const QUEUE_FILE = process.env.REMOTION_HITL_QUEUE_FILE || path.join(DATA_DIR, 'pending-queue.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.jsonl');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// HITL Event Emitter for real-time notifications
class HITLEvents extends EventEmitter { }
const hitlEvents = new HITLEvents();

// Video approval states
const STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  GENERATING: 'generating',
  RENDERING: 'rendering',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const TYPES = {
  REMOTION: 'remotion',
  KLING_VIDEO: 'kling_video',
  VEO_VIDEO: 'veo_video'
};

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

function saveQueue(queue) {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function generateId() {
  return `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function queueVideo(videoRequest) {
  const queue = loadQueue();
  const item = {
    id: generateId(),
    type: videoRequest.type || TYPES.REMOTION,
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
    reviewNotes: null,
    externalTaskId: videoRequest.externalTaskId || null
  };
  queue.items.push(item);
  saveQueue(queue);
  hitlEvents.emit('video:queued', item);
  logAudit('VIDEO_QUEUED', item);
  return item;
}

function getPending() {
  return loadQueue().items.filter(item => item.state === STATES.PENDING);
}

function getVideo(id) {
  return loadQueue().items.find(item => item.id === id);
}

function updateVideo(id, updates) {
  const queue = loadQueue();
  const index = queue.items.findIndex(item => item.id === id);
  if (index === -1) throw new Error(`Video not found: ${id}`);
  queue.items[index] = { ...queue.items[index], ...updates };
  saveQueue(queue);
  return queue.items[index];
}

function approveVideo(id, reviewer, notes = '') {
  const video = getVideo(id);
  if (!video) throw new Error(`Video not found: ${id}`);
  if (video.state !== STATES.PENDING) throw new Error(`Video ${id} is not in pending state (current: ${video.state})`);
  const updated = updateVideo(id, {
    state: STATES.APPROVED,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    reviewNotes: notes
  });
  hitlEvents.emit('video:approved', updated);
  logAudit('VIDEO_APPROVED', { id, reviewer, notes });
  return updated;
}

function rejectVideo(id, reviewer, reason = '') {
  const video = getVideo(id);
  if (!video) throw new Error(`Video not found: ${id}`);
  if (video.state !== STATES.PENDING) throw new Error(`Video ${id} is not in pending state (current: ${video.state})`);
  const updated = updateVideo(id, {
    state: STATES.REJECTED,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    reviewNotes: reason
  });
  hitlEvents.emit('video:rejected', updated);
  logAudit('VIDEO_REJECTED', { id, reviewer, reason });
  return updated;
}

function markRendering(id) {
  return updateVideo(id, { state: STATES.RENDERING, renderStartedAt: new Date().toISOString() });
}

function markCompleted(id, outputPath) {
  return updateVideo(id, { state: STATES.COMPLETED, outputPath, completedAt: new Date().toISOString() });
}

function markGenerating(id) {
  return updateVideo(id, { state: STATES.GENERATING });
}

function markFailed(id, error) {
  return updateVideo(id, { state: STATES.FAILED, error: error.message || error, failedAt: new Date().toISOString() });
}

function logAudit(action, data) {
  const entry = { timestamp: new Date().toISOString(), action, data };
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const stat = fs.statSync(AUDIT_FILE);
      if (stat.size > 5 * 1024 * 1024) {
        const rotated = AUDIT_FILE.replace('.jsonl', '.old.jsonl');
        if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
        fs.renameSync(AUDIT_FILE, rotated);
      }
    }
  } catch (_) { /* rotation failure is non-critical */ }
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
}

function getAuditLog(limit = 100) {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(line => line.trim()).slice(-limit).reverse();
    return lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  } catch (error) { return []; }
}

function getStats() {
  const queue = loadQueue();
  const stats = { total: queue.items.length, pending: 0, approved: 0, rejected: 0, generating: 0, rendering: 0, completed: 0, failed: 0, lastUpdated: queue.lastUpdated };
  for (const item of queue.items) stats[item.state] = (stats[item.state] || 0) + 1;
  return stats;
}

async function parseBody(req, maxBytes = 1048576) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > maxBytes) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const CORS_ALLOWED_ORIGINS = [
  'https://vocalia.ma',
  'https://www.vocalia.ma',
  'https://api.vocalia.ma',
  'http://localhost:8081',
  'http://localhost:8080',
  'http://localhost:3000'
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    // Extract origin part (protocol + host + port)
    try {
      const url = new URL(origin);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      if (origin.includes('localhost:8081')) return 'http://localhost:8081';
      if (origin.includes('localhost:8080')) return 'http://localhost:8080';
    }
  }
  for (const allowed of CORS_ALLOWED_ORIGINS) {
    if (origin.startsWith(allowed)) return allowed;
  }
  return CORS_ALLOWED_ORIGINS[0];
}

function sendJson(res, data, status = 200, req = null) {
  const corsOrigin = req ? getCorsOrigin(req) : CORS_ALLOWED_ORIGINS[0];
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

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
    // Serve generated video files
    const outputMatch = url.pathname.match(/^\/outputs\/([^/]+)$/);
    if (outputMatch && method === 'GET') {
      const filename = decodeURIComponent(outputMatch[1]);
      if (filename.includes('..') || filename.includes('/')) return sendJson(res, { error: 'Invalid filename' }, 400, req);
      const filePath = path.join(DATA_DIR, 'outputs', filename);
      if (!fs.existsSync(filePath)) return sendJson(res, { error: 'File not found' }, 404, req);
      const stat = fs.statSync(filePath);
      const corsOrigin = getCorsOrigin(req);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': corsOrigin,
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    if (url.pathname === '/health' && method === 'GET') {
      return sendJson(res, { service: 'Remotion HITL', status: 'healthy', stats: getStats(), timestamp: new Date().toISOString() }, 200, req);
    }
    if (url.pathname === '/stats' && method === 'GET') {
      return sendJson(res, getStats(), 200, req);
    }
    if (url.pathname === '/queue' && method === 'GET') {
      const state = url.searchParams.get('state');
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit') || '200');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const queue = loadQueue();
      let items = queue.items;
      if (state) items = items.filter(item => item.state === state);
      if (type) items = items.filter(item => item.type === type);
      const total = items.length;
      items = items.slice(offset, offset + limit);
      return sendJson(res, { items, total, limit, offset }, 200, req);
    }
    if (url.pathname === '/queue' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.composition) return sendJson(res, { error: 'composition is required' }, 400, req);
      const item = queueVideo(body);
      return sendJson(res, item, 201, req);
    }
    if (url.pathname === '/pending' && method === 'GET') {
      return sendJson(res, { items: getPending() }, 200, req);
    }
    const videoMatch = url.pathname.match(/^\/video\/([^/]+)$/);
    if (videoMatch && method === 'GET') {
      const video = getVideo(videoMatch[1]);
      if (!video) return sendJson(res, { error: 'Video not found' }, 404, req);
      return sendJson(res, video, 200, req);
    }
    if (videoMatch && method === 'DELETE') {
      try {
        const queue = loadQueue();
        const idx = queue.items.findIndex(item => item.id === videoMatch[1]);
        if (idx === -1) return sendJson(res, { error: 'Video not found' }, 404, req);
        const removed = queue.items.splice(idx, 1)[0];
        saveQueue(queue);
        logAudit('VIDEO_DELETED', { id: removed.id });
        return sendJson(res, { success: true, deleted: removed.id }, 200, req);
      } catch (e) { return sendJson(res, { error: e.message }, 400, req); }
    }
    const approveMatch = url.pathname.match(/^\/video\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      const body = await parseBody(req);
      try { return sendJson(res, approveVideo(approveMatch[1], body.reviewer || 'admin', body.notes || ''), 200, req); } catch (e) { return sendJson(res, { error: e.message }, 400, req); }
    }
    const rejectMatch = url.pathname.match(/^\/video\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const body = await parseBody(req);
      try { return sendJson(res, rejectVideo(rejectMatch[1], body.reviewer || 'admin', body.reason || ''), 200, req); } catch (e) { return sendJson(res, { error: e.message }, 400, req); }
    }
    if (url.pathname === '/audit' && method === 'GET') {
      return sendJson(res, { entries: getAuditLog(parseInt(url.searchParams.get('limit') || '100')) }, 200, req);
    }
    sendJson(res, { error: 'Not found' }, 404, req);
  } catch (error) {
    sendJson(res, { error: 'Internal server error' }, 500, req);
  }
}

function startServer() {
  const server = http.createServer(handleRequest);

  // Wire auto-generation pipeline for video engine types
  try {
    const klingService = require('./kling-service.cjs');
    const veoService = require('./veo-service.cjs');

    hitlEvents.on('video:approved', async (video) => {
      if (video.type === TYPES.KLING_VIDEO) {
        console.log(`[HITL] Auto-triggering Kling generation for ${video.id}`);
        klingService.generateApproved(video.id).catch(err => {
          console.error(`[HITL] Kling generation failed for ${video.id}:`, err.message);
        });
      } else if (video.type === TYPES.VEO_VIDEO) {
        console.log(`[HITL] Auto-triggering Veo 3.1 generation for ${video.id}`);
        veoService.generateApproved(video.id).catch(err => {
          console.error(`[HITL] Veo generation failed for ${video.id}:`, err.message);
        });
      }
    });
    console.log('[HITL] Video generation pipeline connected (Kling + Veo 3.1)');
  } catch (err) {
    console.warn('[HITL] Video generation services not available:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`[HITL] Remotion HITL server running on http://localhost:${PORT}`);
  });
  return server;
}

// CRITICAL: exports MUST be set BEFORE startServer() to avoid circular require deadlock.
// startServer() requires kling-service.cjs/veo-service.cjs which require THIS module back.
// If module.exports is still {} when they require us, all methods resolve to undefined.
module.exports = { queueVideo, getPending, getVideo, updateVideo, approveVideo, rejectVideo, markGenerating, markRendering, markCompleted, markFailed, getStats, getAuditLog, startServer, hitlEvents, STATES, TYPES };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--server')) {
    startServer();
  } else {
    console.log("Usage: node remotion-hitl.cjs --server");
  }
}
