const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

/**
 * Check if a file exists (Async)
 * @param {string} p - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(p) {
    try {
        await fsp.access(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Write file atomically (write to .tmp then rename)
 * @param {string} filePath - Target file path
 * @param {string|Buffer} data - Content to write
 */
async function atomicWriteFile(filePath, data) {
    const tmpPath = `${filePath}.tmp`;
    await fsp.writeFile(tmpPath, data);
    await fsp.rename(tmpPath, filePath);
}

module.exports = {
    fileExists,
    atomicWriteFile
};
