'use strict';

/**
 * VocalIA Database API
 * REST API for Google Sheets Database
 *
 * Endpoints:
 * - GET    /api/db/:sheet           - List all records
 * - GET    /api/db/:sheet/:id       - Get single record
 * - POST   /api/db/:sheet           - Create record
 * - PUT    /api/db/:sheet/:id       - Update record
 * - DELETE /api/db/:sheet/:id       - Delete record
 * - GET    /api/db/:sheet/query     - Query with filters
 * - GET    /api/db/health           - Health check
 *
 * @port 3013
 */

const http = require('http');
const url = require('url');
const { getDB } = require('./GoogleSheetsDB.cjs');

const PORT = process.env.DB_API_PORT || 3013; // Changed from 3012 to avoid conflict with remotion-hitl.cjs
const ALLOWED_SHEETS = ['tenants', 'sessions', 'logs', 'users'];

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * Parse JSON body
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
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
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

/**
 * API Router
 */
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (path === '/api/db/health' && method === 'GET') {
    try {
      const db = getDB();
      const health = await db.health();
      sendJson(res, 200, health);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // Parse path: /api/db/:sheet/:id?
  const match = path.match(/^\/api\/db\/(\w+)(?:\/(\w+))?$/);
  if (!match) {
    sendError(res, 404, 'Not found');
    return;
  }

  const sheet = match[1];
  const id = match[2];

  // Validate sheet
  if (!ALLOWED_SHEETS.includes(sheet)) {
    sendError(res, 400, `Invalid sheet: ${sheet}`);
    return;
  }

  const db = getDB();

  try {
    switch (method) {
      // GET /api/db/:sheet - List all or query
      case 'GET':
        if (id) {
          // GET /api/db/:sheet/:id - Get by ID
          const record = await db.findById(sheet, id);
          if (!record) {
            sendError(res, 404, 'Record not found');
            return;
          }
          sendJson(res, 200, record);
        } else if (Object.keys(query).length > 0) {
          // GET /api/db/:sheet?field=value - Query
          const records = await db.find(sheet, query);
          sendJson(res, 200, { count: records.length, data: records });
        } else {
          // GET /api/db/:sheet - List all
          const records = await db.findAll(sheet);
          sendJson(res, 200, { count: records.length, data: records });
        }
        break;

      // POST /api/db/:sheet - Create
      case 'POST':
        const createData = await parseBody(req);
        const created = await db.create(sheet, createData);
        sendJson(res, 201, created);
        break;

      // PUT /api/db/:sheet/:id - Update
      case 'PUT':
        if (!id) {
          sendError(res, 400, 'ID required for update');
          return;
        }
        const updateData = await parseBody(req);
        const updated = await db.update(sheet, id, updateData);
        sendJson(res, 200, updated);
        break;

      // DELETE /api/db/:sheet/:id - Delete
      case 'DELETE':
        if (!id) {
          sendError(res, 400, 'ID required for delete');
          return;
        }
        await db.delete(sheet, id);
        sendJson(res, 200, { deleted: true, id });
        break;

      default:
        sendError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    console.error(`❌ [DB-API] ${method} ${path}:`, error.message);
    sendError(res, 500, error.message);
  }
}

/**
 * Start server
 */
function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║         VocalIA Database API                      ║
╠═══════════════════════════════════════════════════╣
║  Port: ${PORT}                                       ║
║  URL:  http://localhost:${PORT}/api/db              ║
╠═══════════════════════════════════════════════════╣
║  Endpoints:                                       ║
║  GET    /api/db/health        - Health check      ║
║  GET    /api/db/:sheet        - List all          ║
║  GET    /api/db/:sheet/:id    - Get by ID         ║
║  GET    /api/db/:sheet?q=v    - Query             ║
║  POST   /api/db/:sheet        - Create            ║
║  PUT    /api/db/:sheet/:id    - Update            ║
║  DELETE /api/db/:sheet/:id    - Delete            ║
╠═══════════════════════════════════════════════════╣
║  Sheets: tenants, sessions, logs, users           ║
╚═══════════════════════════════════════════════════╝
`);
  });

  return server;
}

// CLI
if (require.main === module) {
  startServer();
}

module.exports = { startServer, handleRequest };
