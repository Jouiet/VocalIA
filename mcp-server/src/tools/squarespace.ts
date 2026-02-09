import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Squarespace Commerce MCP Tools - Session 249.11
 *
 * API Reference: https://developers.squarespace.com/commerce-apis
 * API Version: v1.0 / v2 (Products)
 * Auth: API Key
 *
 * Market Share: 2.6% global, 16% USA, design-focused merchants
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
 * Get Squarespace credentials for a tenant
 */
async function getSquarespaceCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.SQUARESPACE_API_KEY) {
            return {
                apiKey: creds.SQUARESPACE_API_KEY
            };
        }
    }
    return {
        apiKey: process.env.SQUARESPACE_API_KEY || null
    };
}

/**
 * Make authenticated request to Squarespace API
 */
async function squarespaceRequest(
    apiKey: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string>; apiVersion?: string } = {}
): Promise<any> {
    const apiVersion = options.apiVersion || '1.0';
    const baseUrl = `https://api.squarespace.com/${apiVersion}`;
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
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Squarespace API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const squarespaceTools = {
    list_orders: {
        name: 'squarespace_list_orders',
        description: 'List Squarespace orders with optional filters',
        parameters: {
            fulfillmentStatus: z.enum(['PENDING', 'FULFILLED', 'CANCELED']).optional()
                .describe('Filter by fulfillment status'),
            modifiedAfter: z.string().optional().describe('Filter orders modified after this ISO 8601 date'),
            modifiedBefore: z.string().optional().describe('Filter orders modified before this ISO 8601 date'),
            cursor: z.string().optional().describe('Pagination cursor'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ fulfillmentStatus, modifiedAfter, modifiedBefore, cursor, _meta }: {
            fulfillmentStatus?: string,
            modifiedAfter?: string,
            modifiedBefore?: string,
            cursor?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials",
                            required: ["SQUARESPACE_API_KEY"],
                            hint: "Get API Key from Squarespace Settings > Advanced > Developer API Keys"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {};
                if (fulfillmentStatus) params.fulfillmentStatus = fulfillmentStatus;
                if (modifiedAfter) params.modifiedAfter = modifiedAfter;
                if (modifiedBefore) params.modifiedBefore = modifiedBefore;
                if (cursor) params.cursor = cursor;

                const result = await squarespaceRequest(
                    creds.apiKey,
                    '/commerce/orders',
                    { params }
                );

                const orders = result.result || [];
                const formattedOrders = orders.map((order: any) => ({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    createdOn: order.createdOn,
                    modifiedOn: order.modifiedOn,
                    fulfillmentStatus: order.fulfillmentStatus,
                    grandTotal: order.grandTotal?.value,
                    currency: order.grandTotal?.currency,
                    customerEmail: order.customerEmail,
                    billingAddress: {
                        firstName: order.billingAddress?.firstName,
                        lastName: order.billingAddress?.lastName,
                        phone: order.billingAddress?.phone
                    },
                    lineItemsCount: order.lineItems?.length || 0
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedOrders.length,
                            pagination: result.pagination,
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
        name: 'squarespace_get_order',
        description: 'Get a specific Squarespace order by ID',
        parameters: {
            order_id: z.string().describe('Order ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await squarespaceRequest(
                    creds.apiKey,
                    `/commerce/orders/${order_id}`
                );

                const order = result;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                id: order.id,
                                orderNumber: order.orderNumber,
                                createdOn: order.createdOn,
                                modifiedOn: order.modifiedOn,
                                channel: order.channel,
                                testmode: order.testmode,
                                customerEmail: order.customerEmail,
                                fulfillmentStatus: order.fulfillmentStatus,
                                billingAddress: order.billingAddress,
                                shippingAddress: order.shippingAddress,
                                lineItems: order.lineItems?.map((item: any) => ({
                                    id: item.id,
                                    sku: item.sku,
                                    productName: item.productName,
                                    quantity: item.quantity,
                                    unitPricePaid: item.unitPricePaid,
                                    variantOptions: item.variantOptions,
                                    imageUrl: item.imageUrl
                                })),
                                subtotal: order.subtotal,
                                shippingTotal: order.shippingTotal,
                                discountTotal: order.discountTotal,
                                taxTotal: order.taxTotal,
                                grandTotal: order.grandTotal,
                                shippingLines: order.shippingLines,
                                discountLines: order.discountLines
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

    fulfill_order: {
        name: 'squarespace_fulfill_order',
        description: 'Mark a Squarespace order as fulfilled with tracking info',
        parameters: {
            order_id: z.string().describe('Order ID'),
            shipments: z.array(z.object({
                trackingNumber: z.string().optional(),
                trackingUrl: z.string().optional(),
                carrierName: z.string().optional(),
                shipDate: z.string().optional()
            })).describe('Shipment tracking information'),
            shouldSendNotification: z.boolean().optional().describe('Send notification email to customer'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, shipments, shouldSendNotification = true, _meta }: {
            order_id: string,
            shipments: any[],
            shouldSendNotification?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await squarespaceRequest(
                    creds.apiKey,
                    `/commerce/orders/${order_id}/fulfillments`,
                    {
                        method: 'POST',
                        body: {
                            shouldSendNotification,
                            shipments
                        }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Order fulfilled successfully",
                            fulfillment: result
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
        name: 'squarespace_list_products',
        description: 'List Squarespace products',
        parameters: {
            type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'GIFT_CARD']).optional()
                .describe('Filter by product type'),
            cursor: z.string().optional().describe('Pagination cursor'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ type, cursor, _meta }: {
            type?: string,
            cursor?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {};
                if (type) params.type = type;
                if (cursor) params.cursor = cursor;

                const result = await squarespaceRequest(
                    creds.apiKey,
                    '/commerce/products',
                    { params }
                );

                const products = result.products || [];
                const formattedProducts = products.map((product: any) => ({
                    id: product.id,
                    name: product.name,
                    description: product.description?.substring(0, 200),
                    type: product.type,
                    storePageId: product.storePageId,
                    url: product.url,
                    isVisible: product.isVisible,
                    variantsCount: product.variants?.length || 0,
                    tags: product.tags
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedProducts.length,
                            pagination: result.pagination,
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
        name: 'squarespace_get_product',
        description: 'Get a specific Squarespace product by ID',
        parameters: {
            product_id: z.string().describe('Product ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, _meta }: { product_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await squarespaceRequest(
                    creds.apiKey,
                    `/commerce/products/${product_id}`
                );

                const product = result;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                name: product.name,
                                description: product.description,
                                type: product.type,
                                url: product.url,
                                urlSlug: product.urlSlug,
                                isVisible: product.isVisible,
                                seoOptions: product.seoOptions,
                                variants: product.variants?.map((v: any) => ({
                                    id: v.id,
                                    sku: v.sku,
                                    pricing: v.pricing,
                                    stock: v.stock,
                                    attributes: v.attributes,
                                    shippingMeasurements: v.shippingMeasurements
                                })),
                                images: product.images?.map((img: any) => ({
                                    id: img.id,
                                    url: img.url,
                                    altText: img.altText
                                })),
                                tags: product.tags,
                                createdOn: product.createdOn,
                                modifiedOn: product.modifiedOn
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

    list_inventory: {
        name: 'squarespace_list_inventory',
        description: 'List Squarespace inventory for all product variants',
        parameters: {
            cursor: z.string().optional().describe('Pagination cursor'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ cursor, _meta }: {
            cursor?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {};
                if (cursor) params.cursor = cursor;

                const result = await squarespaceRequest(
                    creds.apiKey,
                    '/commerce/inventory',
                    { params }
                );

                const inventory = result.inventory || [];
                const formattedInventory = inventory.map((item: any) => ({
                    variantId: item.variantId,
                    sku: item.sku,
                    quantity: item.quantity,
                    isUnlimited: item.isUnlimited,
                    productId: item.productId
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedInventory.length,
                            pagination: result.pagination,
                            inventory: formattedInventory
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
        name: 'squarespace_update_inventory',
        description: 'Update inventory quantity for a Squarespace product variant',
        parameters: {
            variant_id: z.string().describe('Variant ID'),
            quantity: z.number().describe('New quantity (use very large number for unlimited)'),
            isUnlimited: z.boolean().optional().describe('Set to true for unlimited stock'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ variant_id, quantity, isUnlimited = false, _meta }: {
            variant_id: string,
            quantity: number,
            isUnlimited?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getSquarespaceCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Squarespace credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await squarespaceRequest(
                    creds.apiKey,
                    `/commerce/inventory/${variant_id}`,
                    {
                        method: 'POST',
                        body: {
                            quantity,
                            isUnlimited
                        }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Inventory updated successfully",
                            inventory: result
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
