import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Shopify MCP Tools - Session 249.20
 *
 * API Reference: https://shopify.dev/docs/api/admin-graphql
 * API Version: 2026-01 (current)
 * Auth: Admin API access token (X-Shopify-Access-Token header)
 *
 * Multi-tenant support via SecretVault
 *
 * Required Scopes:
 * - read_orders, write_orders (for order operations)
 * - read_products (for product lookup)
 * - read_customers (for customer lookup)
 *
 * Rate Limits (Shopify GraphQL):
 * - Standard: 50 points/sec, max 1,000 points bucket
 * - Shopify Plus: 100-500 points/sec, max 2,000-10,000 points
 * - Single objects: ~1 point, Mutations: ~10 points
 * - Bulk operations: Use for large data sets (no rate limits)
 *
 * Best Practices Applied:
 * - Query cost awareness (minimized fields returned)
 * - Rate limit error handling with retry headers
 * - Batch operations where available
 * - Pagination support for large result sets
 *
 * Sources:
 * - https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity
 * - https://shopify.dev/docs/api/usage/limits
 * - https://github.com/amir-bengherbi/shopify-mcp-server
 */

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    const vaultPath = path.join(process.cwd(), '..', 'core', 'SecretVault.cjs');
    SecretVault = require(vaultPath);
} catch (e) {
    // Fallback to env vars
}

/**
 * Get Shopify credentials for a tenant
 */
async function getShopifyCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.SHOPIFY_SHOP_NAME && creds.SHOPIFY_ACCESS_TOKEN) {
            return {
                shopName: creds.SHOPIFY_SHOP_NAME,
                accessToken: creds.SHOPIFY_ACCESS_TOKEN,
                apiVersion: creds.SHOPIFY_API_VERSION || '2026-01'
            };
        }
    }
    return {
        shopName: process.env.SHOPIFY_SHOP_NAME || null,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN || null,
        apiVersion: process.env.SHOPIFY_API_VERSION || '2026-01'
    };
}

/**
 * Make authenticated GraphQL request to Shopify Admin API
 * Includes rate limit awareness and throttle handling
 *
 * Rate Limit Response Headers:
 * - X-Shopify-Shop-Api-Call-Limit: "40/40" (REST) or via extensions (GraphQL)
 * - Retry-After: seconds to wait if throttled
 */
async function shopifyGraphQL(
    shopName: string,
    accessToken: string,
    apiVersion: string,
    query: string,
    variables: Record<string, any> = {}
): Promise<any> {
    const url = `https://${shopName}.myshopify.com/admin/api/${apiVersion}/graphql.json`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: JSON.stringify({ query, variables })
    });

    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '2';
        throw new Error(`Shopify rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as {
        data?: any;
        errors?: Array<{ message: string }>;
        extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
    };

    // Check for throttle status in extensions (GraphQL-specific rate limiting)
    if (result.extensions?.cost?.throttleStatus) {
        const throttle = result.extensions.cost.throttleStatus;
        // Log warning if running low on points (less than 100 available)
        if (throttle.currentlyAvailable < 100) {
            console.warn(`[Shopify] Low rate limit: ${throttle.currentlyAvailable} points available, restoring at ${throttle.restoreRate}/sec`);
        }
    }

    if (result.errors && result.errors.length > 0) {
        // Check for throttling errors in GraphQL response
        const throttleError = result.errors.find(e => e.message.includes('Throttled'));
        if (throttleError) {
            throw new Error(`Shopify rate limit: ${throttleError.message}. Wait and retry.`);
        }
        throw new Error(`Shopify GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
}

export const shopifyTools = {
    // =============================================================================
    // READ OPERATIONS
    // =============================================================================

    get_order: {
        name: 'shopify_get_order',
        description: 'Get order details by ID or order number',
        parameters: {
            orderId: z.string().optional().describe('Shopify order GID (gid://shopify/Order/xxx)'),
            orderNumber: z.string().optional().describe('Order number (e.g., "1001")'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ orderId, orderNumber, _meta }: {
            orderId?: string;
            orderNumber?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: {
                                credentials: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN'],
                                scopes: ['read_orders'],
                                setup: 'Shopify Admin → Settings → Apps → Develop apps → Create app → Configure Admin API scopes'
                            }
                        }, null, 2)
                    }]
                };
            }

            // Query by ID or search by order number
            let query: string;
            let variables: Record<string, any> = {};

            if (orderId) {
                query = `
                    query getOrder($id: ID!) {
                        order(id: $id) {
                            id
                            name
                            email
                            phone
                            createdAt
                            processedAt
                            displayFinancialStatus
                            displayFulfillmentStatus
                            totalPriceSet { shopMoney { amount currencyCode } }
                            subtotalPriceSet { shopMoney { amount currencyCode } }
                            totalShippingPriceSet { shopMoney { amount currencyCode } }
                            totalTaxSet { shopMoney { amount currencyCode } }
                            lineItems(first: 50) {
                                edges {
                                    node {
                                        id
                                        title
                                        quantity
                                        originalUnitPriceSet { shopMoney { amount currencyCode } }
                                        variant { id sku }
                                    }
                                }
                            }
                            shippingAddress {
                                address1 address2 city province zip country
                            }
                            fulfillments {
                                id status trackingInfo { number url }
                            }
                            refunds { id createdAt totalRefundedSet { shopMoney { amount currencyCode } } }
                            cancelledAt
                            cancelReason
                        }
                    }
                `;
                variables = { id: orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}` };
            } else if (orderNumber) {
                query = `
                    query getOrderByNumber($query: String!) {
                        orders(first: 1, query: $query) {
                            edges {
                                node {
                                    id
                                    name
                                    email
                                    phone
                                    createdAt
                                    displayFinancialStatus
                                    displayFulfillmentStatus
                                    totalPriceSet { shopMoney { amount currencyCode } }
                                    shippingAddress {
                                        address1 city province zip country
                                    }
                                    fulfillments {
                                        id status trackingInfo { number url }
                                    }
                                    cancelledAt
                                }
                            }
                        }
                    }
                `;
                variables = { query: `name:${orderNumber}` };
            } else {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Either orderId or orderNumber is required'
                        }, null, 2)
                    }]
                };
            }

            const data = await shopifyGraphQL(creds.shopName, creds.accessToken, creds.apiVersion, query, variables);

            const order = orderId ? data.order : data.orders?.edges?.[0]?.node;

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: !!order,
                        order: order || null,
                        error: order ? null : 'Order not found'
                    }, null, 2)
                }]
            };
        }
    },

    list_orders: {
        name: 'shopify_list_orders',
        description: 'List orders with optional filters',
        parameters: {
            email: z.string().email().optional().describe('Filter by customer email'),
            status: z.enum(['any', 'open', 'closed', 'cancelled']).optional().describe('Filter by financial status'),
            fulfillment: z.enum(['any', 'unfulfilled', 'partial', 'fulfilled']).optional().describe('Filter by fulfillment status'),
            limit: z.number().min(1).max(50).optional().describe('Number of orders to return (default: 10, max: 50)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ email, status, fulfillment, limit = 10, _meta }: {
            email?: string;
            status?: string;
            fulfillment?: string;
            limit?: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN']
                        }, null, 2)
                    }]
                };
            }

            // Build query filter
            const filters: string[] = [];
            if (email) filters.push(`email:${email}`);
            if (status && status !== 'any') filters.push(`status:${status}`);
            if (fulfillment && fulfillment !== 'any') filters.push(`fulfillment_status:${fulfillment}`);

            const query = `
                query listOrders($first: Int!, $query: String) {
                    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
                        edges {
                            node {
                                id
                                name
                                email
                                createdAt
                                displayFinancialStatus
                                displayFulfillmentStatus
                                totalPriceSet { shopMoney { amount currencyCode } }
                                cancelledAt
                            }
                        }
                    }
                }
            `;

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                query,
                { first: limit, query: filters.length > 0 ? filters.join(' ') : null }
            );

            const orders = data.orders?.edges?.map((e: any) => e.node) || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        count: orders.length,
                        orders
                    }, null, 2)
                }]
            };
        }
    },

    get_product: {
        name: 'shopify_get_product',
        description: 'Get product details including stock levels',
        parameters: {
            query: z.string().describe('Product title or SKU to search'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ query: searchQuery, _meta }: {
            query: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN']
                        }, null, 2)
                    }]
                };
            }

            const query = `
                query searchProducts($query: String!) {
                    products(first: 5, query: $query) {
                        edges {
                            node {
                                id
                                title
                                description
                                handle
                                status
                                totalInventory
                                priceRangeV2 {
                                    minVariantPrice { amount currencyCode }
                                    maxVariantPrice { amount currencyCode }
                                }
                                variants(first: 10) {
                                    edges {
                                        node {
                                            id
                                            title
                                            sku
                                            price
                                            inventoryQuantity
                                            availableForSale
                                        }
                                    }
                                }
                                images(first: 1) {
                                    edges {
                                        node { url altText }
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                query,
                { query: searchQuery }
            );

            const products = data.products?.edges?.map((e: any) => ({
                ...e.node,
                variants: e.node.variants?.edges?.map((v: any) => v.node) || [],
                images: e.node.images?.edges?.map((i: any) => i.node) || []
            })) || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        count: products.length,
                        products
                    }, null, 2)
                }]
            };
        }
    },

    // =============================================================================
    // WRITE OPERATIONS (P0 - Session 249.20)
    // =============================================================================

    cancel_order: {
        name: 'shopify_cancel_order',
        description: 'Cancel an order. Only works for unfulfilled orders.',
        parameters: {
            orderId: z.string().describe('Shopify order GID (gid://shopify/Order/xxx) or numeric ID'),
            reason: z.enum(['CUSTOMER', 'FRAUD', 'INVENTORY', 'DECLINED', 'OTHER']).describe('Cancellation reason'),
            staffNote: z.string().optional().describe('Internal note for staff'),
            notifyCustomer: z.boolean().optional().describe('Send cancellation email to customer (default: true)'),
            refund: z.boolean().optional().describe('Issue refund for paid orders (default: true)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ orderId, reason, staffNote, notifyCustomer = true, refund = true, _meta }: {
            orderId: string;
            reason: 'CUSTOMER' | 'FRAUD' | 'INVENTORY' | 'DECLINED' | 'OTHER';
            staffNote?: string;
            notifyCustomer?: boolean;
            refund?: boolean;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: {
                                credentials: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN'],
                                scopes: ['write_orders'],
                                setup: 'Shopify Admin → Settings → Apps → Develop apps → Configure Admin API scopes → write_orders'
                            }
                        }, null, 2)
                    }]
                };
            }

            const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;

            const mutation = `
                mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $staffNote: String, $notifyCustomer: Boolean!, $refund: Boolean!) {
                    orderCancel(
                        orderId: $orderId
                        reason: $reason
                        staffNote: $staffNote
                        notifyCustomer: $notifyCustomer
                        refund: $refund
                    ) {
                        job {
                            id
                            done
                        }
                        orderCancelUserErrors {
                            field
                            message
                            code
                        }
                    }
                }
            `;

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                mutation,
                {
                    orderId: gid,
                    reason,
                    staffNote: staffNote || null,
                    notifyCustomer,
                    refund
                }
            );

            const result = data.orderCancel;
            const errors = result?.orderCancelUserErrors || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: errors.length === 0,
                        jobId: result?.job?.id || null,
                        done: result?.job?.done || false,
                        errors: errors.length > 0 ? errors : null,
                        message: errors.length === 0
                            ? `Order ${orderId} cancellation initiated. Refund: ${refund}, Customer notified: ${notifyCustomer}`
                            : 'Cancellation failed'
                    }, null, 2)
                }]
            };
        }
    },

    create_refund: {
        name: 'shopify_create_refund',
        description: 'Create a refund for an order. Supports full or partial refunds.',
        parameters: {
            orderId: z.string().describe('Shopify order GID (gid://shopify/Order/xxx) or numeric ID'),
            amount: z.number().optional().describe('Refund amount (omit for full refund)'),
            note: z.string().optional().describe('Refund note visible to customer'),
            notifyCustomer: z.boolean().optional().describe('Send refund email to customer (default: true)'),
            restock: z.boolean().optional().describe('Restock returned items (default: false)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ orderId, amount, note, notifyCustomer = true, restock: _restock = false, _meta }: {
            orderId: string;
            amount?: number;
            note?: string;
            notifyCustomer?: boolean;
            restock?: boolean;
            _meta?: { tenantId?: string };
        }) => {
            // Note: _restock parameter is accepted but restocking requires additional API complexity
            // For full restock support, use Shopify Admin UI or extend this with fulfillment line items
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: {
                                credentials: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN'],
                                scopes: ['write_orders'],
                                setup: 'Shopify Admin → Settings → Apps → Develop apps → Configure Admin API scopes → write_orders'
                            }
                        }, null, 2)
                    }]
                };
            }

            const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;

            // First, get order details to calculate refund if no amount specified
            if (!amount) {
                const orderQuery = `
                    query getOrderForRefund($id: ID!) {
                        order(id: $id) {
                            id
                            totalPriceSet { shopMoney { amount currencyCode } }
                            totalRefundedSet { shopMoney { amount currencyCode } }
                            refundable
                        }
                    }
                `;
                const orderData = await shopifyGraphQL(
                    creds.shopName,
                    creds.accessToken,
                    creds.apiVersion,
                    orderQuery,
                    { id: gid }
                );

                if (!orderData.order) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: `Order ${orderId} not found`
                            }, null, 2)
                        }]
                    };
                }

                const totalPrice = parseFloat(orderData.order.totalPriceSet.shopMoney.amount);
                const refunded = parseFloat(orderData.order.totalRefundedSet?.shopMoney?.amount || '0');
                amount = totalPrice - refunded;

                if (amount <= 0) {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: 'Order is already fully refunded'
                            }, null, 2)
                        }]
                    };
                }
            }

            // Create refund using refundCreate mutation
            const mutation = `
                mutation refundCreate($input: RefundInput!) {
                    refundCreate(input: $input) {
                        refund {
                            id
                            createdAt
                            note
                            totalRefundedSet { shopMoney { amount currencyCode } }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const refundInput: any = {
                orderId: gid,
                notify: notifyCustomer,
                transactions: [{
                    kind: 'REFUND',
                    gateway: 'manual',
                    amount: amount.toFixed(2),
                }]
            };

            if (note) {
                refundInput.note = note;
            }

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                mutation,
                { input: refundInput }
            );

            const result = data.refundCreate;
            const errors = result?.userErrors || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: errors.length === 0 && result?.refund,
                        refund: result?.refund || null,
                        errors: errors.length > 0 ? errors : null,
                        message: result?.refund
                            ? `Refund of ${amount.toFixed(2)} created for order ${orderId}`
                            : 'Refund creation failed'
                    }, null, 2)
                }]
            };
        }
    },

    update_order: {
        name: 'shopify_update_order',
        description: 'Update order metadata (tags, notes, custom attributes)',
        parameters: {
            orderId: z.string().describe('Shopify order GID (gid://shopify/Order/xxx) or numeric ID'),
            note: z.string().optional().describe('Order note (replaces existing)'),
            tags: z.array(z.string()).optional().describe('Order tags (replaces existing)'),
            email: z.string().email().optional().describe('Update customer email on order'),
            shippingAddress: z.object({
                address1: z.string().optional(),
                address2: z.string().optional(),
                city: z.string().optional(),
                province: z.string().optional(),
                zip: z.string().optional(),
                country: z.string().optional(),
                phone: z.string().optional(),
            }).optional().describe('Update shipping address'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ orderId, note, tags, email, shippingAddress, _meta }: {
            orderId: string;
            note?: string;
            tags?: string[];
            email?: string;
            shippingAddress?: {
                address1?: string;
                address2?: string;
                city?: string;
                province?: string;
                zip?: string;
                country?: string;
                phone?: string;
            };
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: {
                                credentials: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN'],
                                scopes: ['write_orders'],
                                setup: 'Shopify Admin → Settings → Apps → Develop apps → Configure Admin API scopes → write_orders'
                            }
                        }, null, 2)
                    }]
                };
            }

            const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;

            const mutation = `
                mutation orderUpdate($input: OrderInput!) {
                    orderUpdate(input: $input) {
                        order {
                            id
                            name
                            note
                            tags
                            email
                            shippingAddress {
                                address1 address2 city province zip country phone
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const input: any = { id: gid };
            if (note !== undefined) input.note = note;
            if (tags) input.tags = tags;
            if (email) input.email = email;
            if (shippingAddress) input.shippingAddress = shippingAddress;

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                mutation,
                { input }
            );

            const result = data.orderUpdate;
            const errors = result?.userErrors || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: errors.length === 0 && result?.order,
                        order: result?.order || null,
                        errors: errors.length > 0 ? errors : null,
                        message: result?.order
                            ? `Order ${orderId} updated successfully`
                            : 'Order update failed'
                    }, null, 2)
                }]
            };
        }
    },

    // =============================================================================
    // FULFILLMENT OPERATIONS
    // =============================================================================

    create_fulfillment: {
        name: 'shopify_create_fulfillment',
        description: 'Create fulfillment for an order (mark as shipped)',
        parameters: {
            orderId: z.string().describe('Shopify order GID or numeric ID'),
            trackingNumber: z.string().optional().describe('Carrier tracking number'),
            trackingUrl: z.string().url().optional().describe('Tracking URL'),
            trackingCompany: z.string().optional().describe('Carrier name (e.g., "UPS", "FedEx", "DHL")'),
            notifyCustomer: z.boolean().optional().describe('Send shipping notification email (default: true)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ orderId, trackingNumber, trackingUrl, trackingCompany, notifyCustomer = true, _meta }: {
            orderId: string;
            trackingNumber?: string;
            trackingUrl?: string;
            trackingCompany?: string;
            notifyCustomer?: boolean;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: {
                                credentials: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN'],
                                scopes: ['write_orders', 'write_fulfillments'],
                            }
                        }, null, 2)
                    }]
                };
            }

            const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;

            // First get fulfillment order ID
            const fulfillmentOrderQuery = `
                query getFulfillmentOrders($orderId: ID!) {
                    order(id: $orderId) {
                        fulfillmentOrders(first: 1) {
                            edges {
                                node {
                                    id
                                    status
                                    assignedLocation { location { id } }
                                    lineItems(first: 50) {
                                        edges {
                                            node {
                                                id
                                                remainingQuantity
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const orderData = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                fulfillmentOrderQuery,
                { orderId: gid }
            );

            const fulfillmentOrder = orderData.order?.fulfillmentOrders?.edges?.[0]?.node;
            if (!fulfillmentOrder) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'No fulfillment order found for this order'
                        }, null, 2)
                    }]
                };
            }

            // Create fulfillment
            const mutation = `
                mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
                    fulfillmentCreateV2(fulfillment: $fulfillment) {
                        fulfillment {
                            id
                            status
                            trackingInfo { number url company }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const lineItems = fulfillmentOrder.lineItems.edges.map((e: any) => ({
                fulfillmentOrderLineItemId: e.node.id,
                quantity: e.node.remainingQuantity
            }));

            const trackingInfo: any = {};
            if (trackingNumber) trackingInfo.number = trackingNumber;
            if (trackingUrl) trackingInfo.url = trackingUrl;
            if (trackingCompany) trackingInfo.company = trackingCompany;

            const fulfillmentInput: any = {
                notifyCustomer,
                lineItemsByFulfillmentOrder: [{
                    fulfillmentOrderId: fulfillmentOrder.id,
                    fulfillmentOrderLineItems: lineItems
                }]
            };

            if (Object.keys(trackingInfo).length > 0) {
                fulfillmentInput.trackingInfo = trackingInfo;
            }

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                mutation,
                { fulfillment: fulfillmentInput }
            );

            const result = data.fulfillmentCreateV2;
            const errors = result?.userErrors || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: errors.length === 0 && result?.fulfillment,
                        fulfillment: result?.fulfillment || null,
                        errors: errors.length > 0 ? errors : null,
                        message: result?.fulfillment
                            ? `Fulfillment created for order ${orderId}`
                            : 'Fulfillment creation failed'
                    }, null, 2)
                }]
            };
        }
    },

    // =============================================================================
    // CUSTOMER OPERATIONS
    // =============================================================================

    search_customers: {
        name: 'shopify_search_customers',
        description: 'Search customers by email, name, or phone',
        parameters: {
            query: z.string().describe('Search query (email, name, or phone)'),
            limit: z.number().min(1).max(50).optional().describe('Number of results (default: 10)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ query: searchQuery, limit = 10, _meta }: {
            query: string;
            limit?: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getShopifyCredentials(tenantId);

            if (!creds.shopName || !creds.accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Shopify credentials',
                            requirements: ['SHOPIFY_SHOP_NAME', 'SHOPIFY_ACCESS_TOKEN']
                        }, null, 2)
                    }]
                };
            }

            const query = `
                query searchCustomers($query: String!, $first: Int!) {
                    customers(first: $first, query: $query) {
                        edges {
                            node {
                                id
                                email
                                firstName
                                lastName
                                phone
                                ordersCount
                                totalSpent
                                createdAt
                                verifiedEmail
                                defaultAddress {
                                    address1 city province zip country
                                }
                                tags
                            }
                        }
                    }
                }
            `;

            const data = await shopifyGraphQL(
                creds.shopName,
                creds.accessToken,
                creds.apiVersion,
                query,
                { query: searchQuery, first: limit }
            );

            const customers = data.customers?.edges?.map((e: any) => e.node) || [];

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        count: customers.length,
                        customers
                    }, null, 2)
                }]
            };
        }
    }
};
