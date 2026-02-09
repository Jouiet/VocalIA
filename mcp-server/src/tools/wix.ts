import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Wix Stores MCP Tools - Session 249.11
 *
 * API Reference: https://dev.wix.com/api/rest/wix-stores
 * API Version: REST API
 * Auth: API Key + Account ID (or Site ID)
 *
 * Market Share: 7.4% global, 23% USA, +32.6% YoY growth (fastest growing)
 * Multi-tenant support via SecretVault
 */

import { corePath } from '../paths.js';

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars
}

/**
 * Get Wix credentials for a tenant
 */
async function getWixCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.WIX_API_KEY && creds.WIX_SITE_ID) {
            return {
                apiKey: creds.WIX_API_KEY,
                siteId: creds.WIX_SITE_ID,
                accountId: creds.WIX_ACCOUNT_ID || null
            };
        }
    }
    return {
        apiKey: process.env.WIX_API_KEY || null,
        siteId: process.env.WIX_SITE_ID || null,
        accountId: process.env.WIX_ACCOUNT_ID || null
    };
}

/**
 * Make authenticated request to Wix API
 */
async function wixRequest(
    apiKey: string,
    siteId: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<any> {
    const baseUrl = 'https://www.wixapis.com';
    const method = options.method || 'GET';

    const url = new URL(`${baseUrl}${endpoint}`);
    if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
            url.searchParams.set(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'Authorization': apiKey,
            'wix-site-id': siteId,
            'Content-Type': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wix API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const wixTools = {
    list_orders: {
        name: 'wix_list_orders',
        description: 'List Wix eCommerce orders with optional filters',
        parameters: {
            status: z.enum(['INITIALIZED', 'APPROVED', 'CANCELED', 'FULFILLED', 'NOT_FULFILLED']).optional()
                .describe('Filter by order fulfillment status'),
            limit: z.number().min(1).max(100).optional().describe('Results per page (default: 50, max: 100)'),
            offset: z.number().min(0).optional().describe('Offset for pagination'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status, limit = 50, offset = 0, _meta }: {
            status?: string,
            limit?: number,
            offset?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials",
                            required: ["WIX_API_KEY", "WIX_SITE_ID"],
                            hint: "Get API Key from Wix Dev Center: https://dev.wix.com/api/rest/getting-started/api-keys"
                        }, null, 2)
                    }]
                };
            }

            try {
                const query: any = {
                    paging: { limit, offset }
                };
                if (status) {
                    query.filter = { fulfillmentStatus: status };
                }

                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    '/ecom/v1/orders/query',
                    { method: 'POST', body: { query } }
                );

                const orders = result.orders || [];
                const formattedOrders = orders.map((order: any) => ({
                    id: order._id,
                    number: order.number,
                    status: order.status,
                    fulfillmentStatus: order.fulfillmentStatus,
                    paymentStatus: order.paymentStatus,
                    total: order.priceSummary?.total?.formattedAmount,
                    currency: order.currency,
                    createdDate: order._createdDate,
                    buyerInfo: {
                        email: order.buyerInfo?.email,
                        firstName: order.buyerInfo?.firstName,
                        lastName: order.buyerInfo?.lastName,
                        phone: order.buyerInfo?.phone
                    },
                    itemsCount: order.lineItems?.length || 0
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedOrders.length,
                            totalCount: result.metadata?.count || formattedOrders.length,
                            orders: formattedOrders
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_order: {
        name: 'wix_get_order',
        description: 'Get a specific Wix order by ID',
        parameters: {
            order_id: z.string().describe('Order ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    `/ecom/v1/orders/${order_id}`
                );

                const order = result.order;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                id: order._id,
                                number: order.number,
                                status: order.status,
                                fulfillmentStatus: order.fulfillmentStatus,
                                paymentStatus: order.paymentStatus,
                                createdDate: order._createdDate,
                                updatedDate: order._updatedDate,
                                buyerInfo: order.buyerInfo,
                                billingInfo: order.billingInfo,
                                shippingInfo: order.shippingInfo,
                                priceSummary: order.priceSummary,
                                lineItems: order.lineItems?.map((item: any) => ({
                                    id: item._id,
                                    name: item.productName?.original,
                                    quantity: item.quantity,
                                    price: item.price?.formattedAmount,
                                    totalPrice: item.totalPrice?.formattedAmount,
                                    sku: item.sku,
                                    image: item.image?.url
                                })),
                                activities: order.activities
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_products: {
        name: 'wix_list_products',
        description: 'List Wix Stores products with optional filters',
        parameters: {
            limit: z.number().min(1).max(100).optional().describe('Results per page (default: 50, max: 100)'),
            offset: z.number().min(0).optional().describe('Offset for pagination'),
            includeHiddenProducts: z.boolean().optional().describe('Include hidden products'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ limit = 50, offset = 0, includeHiddenProducts = false, _meta }: {
            limit?: number,
            offset?: number,
            includeHiddenProducts?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const query: any = {
                    paging: { limit, offset }
                };

                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    '/stores/v1/products/query',
                    {
                        method: 'POST',
                        body: {
                            query,
                            includeHiddenProducts
                        }
                    }
                );

                const products = result.products || [];
                const formattedProducts = products.map((product: any) => ({
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    visible: product.visible,
                    productType: product.productType,
                    sku: product.sku,
                    price: product.price?.formatted?.price,
                    discountedPrice: product.price?.formatted?.discountedPrice,
                    currency: product.price?.currency,
                    inStock: product.stock?.inStock,
                    quantity: product.stock?.quantity,
                    trackInventory: product.stock?.trackInventory,
                    collections: product.collectionIds,
                    numericId: product.numericId
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedProducts.length,
                            totalCount: result.metadata?.count || formattedProducts.length,
                            products: formattedProducts
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_product: {
        name: 'wix_get_product',
        description: 'Get a specific Wix product by ID',
        parameters: {
            product_id: z.string().describe('Product ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, _meta }: { product_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    `/stores/v1/products/${product_id}`
                );

                const product = result.product;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                name: product.name,
                                slug: product.slug,
                                description: product.description,
                                visible: product.visible,
                                productType: product.productType,
                                sku: product.sku,
                                price: product.price,
                                priceData: product.priceData,
                                stock: product.stock,
                                weight: product.weight,
                                ribbon: product.ribbon,
                                brand: product.brand,
                                media: product.media?.items?.map((m: any) => ({
                                    id: m.id,
                                    url: m.image?.url || m.video?.url,
                                    type: m.mediaType
                                })),
                                customTextFields: product.customTextFields,
                                productOptions: product.productOptions,
                                variants: product.variants?.map((v: any) => ({
                                    id: v.id,
                                    sku: v.variant?.sku,
                                    price: v.variant?.priceData,
                                    stock: v.stock
                                })),
                                seoData: product.seoData,
                                collectionIds: product.collectionIds
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_inventory: {
        name: 'wix_get_inventory',
        description: 'Get inventory status for Wix products',
        parameters: {
            product_ids: z.array(z.string()).optional().describe('Filter by product IDs'),
            limit: z.number().min(1).max(100).optional().describe('Results per page'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_ids, limit = 50, _meta }: {
            product_ids?: string[],
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const query: any = {
                    paging: { limit }
                };
                if (product_ids && product_ids.length > 0) {
                    query.filter = { productId: { $in: product_ids } };
                }

                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    '/stores/v1/inventoryItems/query',
                    { method: 'POST', body: { query } }
                );

                const items = result.inventoryItems || [];
                const formattedItems = items.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    inStock: item.inStock,
                    quantity: item.quantity,
                    trackQuantity: item.trackQuantity,
                    availableForPreorder: item.availableForPreorder,
                    preorderInfo: item.preorderInfo
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedItems.length,
                            inventory: formattedItems
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    update_inventory: {
        name: 'wix_update_inventory',
        description: 'Update inventory quantity for a Wix product variant',
        parameters: {
            inventory_id: z.string().describe('Inventory item ID'),
            quantity: z.number().describe('New quantity'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ inventory_id, quantity, _meta }: {
            inventory_id: string,
            quantity: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWixCredentials(tenantId);

            if (!creds.apiKey || !creds.siteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Wix credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await wixRequest(
                    creds.apiKey,
                    creds.siteId,
                    `/stores/v1/inventoryItems/${inventory_id}`,
                    {
                        method: 'PATCH',
                        body: {
                            inventoryItem: {
                                trackQuantity: true,
                                quantity: quantity
                            }
                        }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Inventory updated successfully",
                            inventoryItem: result.inventoryItem
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
