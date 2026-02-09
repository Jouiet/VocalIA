import { createRequire } from 'module';
import { corePath } from '../paths.js';

// Use createRequire to load CommonJS module from TypeScript
const require = createRequire(import.meta.url);
const RegistryPath = corePath('client-registry.cjs');

let ClientRegistry: any;
try {
    ClientRegistry = require(RegistryPath);
} catch (e) {
    console.error("Failed to load ClientRegistry", e);
    ClientRegistry = { getClient: () => ({ id: 'agency_internal', name: 'Fallback Internal' }) }
}

export interface TenantContext {
    id: string;
    name: string;
    config: any;
}

/**
 * Sanitize tenant ID to prevent path traversal and injection (MM4 fix).
 * Allows only alphanumeric, dash, underscore.
 */
function sanitizeTenantId(raw: string): string {
    const safe = raw.replace(/[^a-zA-Z0-9\-_]/g, '');
    return safe || 'agency_internal';
}

/**
 * Tenant Middleware
 * Resolves properties based on x-tenant-id header or request meta.
 */
export async function tenantMiddleware(request: any): Promise<TenantContext> {
    const rawTenantId = request?._meta?.tenantId ||
        request?.params?._meta?.tenantId ||
        request?.headers?.['x-tenant-id'] ||
        'agency_internal';

    const tenantId = sanitizeTenantId(String(rawTenantId));

    const config = ClientRegistry.getClient(tenantId);

    // console.error(`[TenantMiddleware] Resolved: ${tenantId} -> ${config.name}`);
    // console.error(`[TenantMiddleware] Input Request Keys: ${Object.keys(request).join(',')}`);
    // console.error(`[TenantMiddleware] Extracted tenantId: ${tenantId}`);
    // console.error(`[TenantMiddleware] Registry Config Found: ${config.id}`);

    return {
        id: config.id,
        name: config.name,
        config: config
    };
}
