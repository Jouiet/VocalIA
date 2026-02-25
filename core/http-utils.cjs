'use strict';

/**
 * Shared HTTP Utilities
 */

/**
 * Parse JSON body from request
 * @param {IncomingMessage} req
 * @param {number} maxBodySize - Max size in bytes (default 1MB)
 * @returns {Promise<Object>}
 */
function parseBody(req, maxBodySize = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > maxBodySize) {
                req.destroy();
                reject(new Error(`Request body too large (max ${maxBodySize} bytes)`));
                return;
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
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {Object} data
 * @param {Object} headers - Optional extra headers
 */
function sendJson(res, statusCode, data, headers = {}) {
    const cors = res._corsHeaders || {};
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...cors,
        ...headers
    });
    res.end(JSON.stringify(data));
}

/**
 * Send Error response
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 * @param {Object} headers
 */
function sendError(res, statusCode, message, headers = {}) {
    // Never bleed internal 500 errors to client
    const safeMessage = statusCode >= 500 ? 'Internal server error' : message;

    // Log internal errors
    if (statusCode >= 500) {
        console.error(`[HTTP] 500 Error: ${message}`);
    }

    sendJson(res, statusCode, { error: safeMessage }, headers);
}

module.exports = {
    parseBody,
    sendJson,
    sendError
};
