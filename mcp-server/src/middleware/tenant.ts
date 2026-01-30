import { createRequire } from 'module';
import path from 'path';

// Use createRequire to load CommonJS module from TypeScript
const require = createRequire(import.meta.url);
const RegistryPath = path.join(process.cwd(), '..', 'core', 'client-registry.cjs');

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
 * Tenant Middleware
 * Resolves properties based on x-tenant-id header or request meta.
 */
export async function tenantMiddleware(request: any): Promise<TenantContext> {
    // Extract tenantId
    // In MCP stdio transport, headers might not be standard. 
    // We look for _meta.tenantId commonly injected by clients.
    // Default to 'agency_internal' if missing.

    // 1. args._meta.tenantId (Zod schema injection)
    // 2. request.params._meta.tenantId (Raw JSON-RPC)
    // 3. headers (HTTP/Network)

    const tenantId = request?._meta?.tenantId ||
        request?.params?._meta?.tenantId ||
        request?.headers?.['x-tenant-id'] ||
        'agency_internal';

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
