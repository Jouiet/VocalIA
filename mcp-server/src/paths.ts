/**
 * Centralized path resolution for VocalIA MCP Server (MH5 fix).
 *
 * Replaces 35 process.cwd() calls with stable __dirname-based paths.
 * Works regardless of which directory the process is launched from.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// From dist/ → up 2 levels to VocalIA project root
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// MCP server root (mcp-server/)
export const MCP_ROOT = path.resolve(__dirname, '..');

// Common path helpers
export const corePath = (...segments: string[]) => path.join(PROJECT_ROOT, 'core', ...segments);
export const dataPath = (...segments: string[]) => path.join(PROJECT_ROOT, 'data', ...segments);
export const personasPath = (...segments: string[]) => path.join(PROJECT_ROOT, 'personas', ...segments);
export const scriptsPath = (...segments: string[]) => path.join(PROJECT_ROOT, 'scripts', ...segments);
