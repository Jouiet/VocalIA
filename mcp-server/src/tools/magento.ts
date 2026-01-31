import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Magento MCP Tools - Session 249.20
 *
 * API Reference: https://developer.adobe.com/commerce/webapi/rest/
 * API Version: REST API v1
 * Auth: Bearer Token (Integration Access Token)
 *
 * Multi-tenant support via SecretVault
 *
 * WRITE Operations Added (Session 249.20):
 * - magento_cancel_order: POST /V1/order/{orderId}/cancel
 * - magento_create_refund: POST /V1/order/{orderId}/refund
 * - magento_hold_order: POST /V1/orders/{orderId}/hold
 * - magento_unhold_order: POST /V1/orders/{orderId}/unhold
 *
 * Sources:
 * - https://github.com/boldcommerce/magento2-mcp
 * - https://developer.adobe.com/commerce/webapi/rest/use-rest/performing-searches/
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
 * Get Magento credentials for a tenant
 */
async function getMagentoCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.MAGENTO_URL && creds.MAGENTO_ACCESS_TOKEN) {
            return {
                url: creds.MAGENTO_URL,
                accessToken: creds.MAGENTO_ACCESS_TOKEN
            };
        }
    }
    return {
        url: process.env.MAGENTO_URL || null,
        accessToken: process.env.MAGENTO_ACCESS_TOKEN || null
    };
}

/**
 * Make authenticated request to Magento API
 */
async function magentoRequest(
    baseUrl: string,
    accessToken: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<any> {
    let url = `${baseUrl.replace(/\/$/, '')}/rest/V1${endpoint}`;
    if (options.params) {
        const searchParams = new URLSearchParams(options.params);
        url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Magento API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const magentoTools = {
    list_orders: {
        name: 'magento_list_orders',
        description: 'List Magento orders with optional filters',
        parameters: {
            page_size: z.number().min(1).max(100).optional().describe('Results per page (default: 20, max: 100)'),
            current_page: z.number().min(1).optional().describe('Page number'),
            status: z.string().optional().describe('Filter by order status (pending, processing, complete, etc.)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ page_size = 20, current_page = 1, status, _meta }: {
            page_size?: number,
            current_page?: number,
            status?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials",
                            required: ["MAGENTO_URL", "MAGENTO_ACCESS_TOKEN"],
                            hint: "Create Integration at System > Integrations in Magento Admin"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Build search criteria
                let filterIdx = 0;
                const params: Record<string, string> = {
                    'searchCriteria[pageSize]': page_size.toString(),
                    'searchCriteria[currentPage]': current_page.toString()
                };

                if (status) {
                    params[`searchCriteria[filterGroups][${filterIdx}][filters][0][field]`] = 'status';
                    params[`searchCriteria[filterGroups][${filterIdx}][filters][0][value]`] = status;
                    params[`searchCriteria[filterGroups][${filterIdx}][filters][0][conditionType]`] = 'eq';
                }

                const data = await magentoRequest(creds.url, creds.accessToken, '/orders', { params });

                const orders = data.items?.map((order: any) => ({
                    entity_id: order.entity_id,
                    increment_id: order.increment_id,
                    status: order.status,
                    state: order.state,
                    grand_total: order.grand_total,
                    base_currency_code: order.base_currency_code,
                    created_at: order.created_at,
                    updated_at: order.updated_at,
                    customer_email: order.customer_email,
                    customer_firstname: order.customer_firstname,
                    customer_lastname: order.customer_lastname,
                    total_item_count: order.total_item_count,
                    shipping_description: order.shipping_description
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: orders.length,
                            total_count: data.total_count,
                            current_page,
                            page_size,
                            orders
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
        name: 'magento_get_order',
        description: 'Get a specific Magento order by ID',
        parameters: {
            order_id: z.number().describe('Order entity ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const order = await magentoRequest(creds.url, creds.accessToken, `/orders/${order_id}`);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                entity_id: order.entity_id,
                                increment_id: order.increment_id,
                                status: order.status,
                                state: order.state,
                                grand_total: order.grand_total,
                                subtotal: order.subtotal,
                                tax_amount: order.tax_amount,
                                shipping_amount: order.shipping_amount,
                                discount_amount: order.discount_amount,
                                base_currency_code: order.base_currency_code,
                                created_at: order.created_at,
                                updated_at: order.updated_at,
                                customer_id: order.customer_id,
                                customer_email: order.customer_email,
                                customer_firstname: order.customer_firstname,
                                customer_lastname: order.customer_lastname,
                                billing_address: order.billing_address,
                                shipping_description: order.shipping_description,
                                payment: {
                                    method: order.payment?.method,
                                    additional_information: order.payment?.additional_information
                                },
                                items: order.items?.map((item: any) => ({
                                    item_id: item.item_id,
                                    sku: item.sku,
                                    name: item.name,
                                    qty_ordered: item.qty_ordered,
                                    price: item.price,
                                    row_total: item.row_total,
                                    product_type: item.product_type
                                })),
                                status_histories: order.status_histories?.slice(0, 5)
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
        name: 'magento_list_products',
        description: 'List Magento products with optional filters',
        parameters: {
            page_size: z.number().min(1).max(100).optional().describe('Results per page (default: 20, max: 100)'),
            current_page: z.number().min(1).optional().describe('Page number'),
            type_id: z.string().optional().describe('Filter by product type (simple, configurable, virtual, etc.)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ page_size = 20, current_page = 1, type_id, _meta }: {
            page_size?: number,
            current_page?: number,
            type_id?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    'searchCriteria[pageSize]': page_size.toString(),
                    'searchCriteria[currentPage]': current_page.toString()
                };

                if (type_id) {
                    params['searchCriteria[filterGroups][0][filters][0][field]'] = 'type_id';
                    params['searchCriteria[filterGroups][0][filters][0][value]'] = type_id;
                    params['searchCriteria[filterGroups][0][filters][0][conditionType]'] = 'eq';
                }

                const data = await magentoRequest(creds.url, creds.accessToken, '/products', { params });

                const products = data.items?.map((product: any) => ({
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    price: product.price,
                    status: product.status,
                    visibility: product.visibility,
                    type_id: product.type_id,
                    created_at: product.created_at,
                    updated_at: product.updated_at,
                    weight: product.weight
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: products.length,
                            total_count: data.total_count,
                            current_page,
                            page_size,
                            products
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
        name: 'magento_get_product',
        description: 'Get a specific Magento product by SKU',
        parameters: {
            sku: z.string().describe('Product SKU'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ sku, _meta }: { sku: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const product = await magentoRequest(creds.url, creds.accessToken, `/products/${encodeURIComponent(sku)}`);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                sku: product.sku,
                                name: product.name,
                                price: product.price,
                                status: product.status,
                                visibility: product.visibility,
                                type_id: product.type_id,
                                created_at: product.created_at,
                                updated_at: product.updated_at,
                                weight: product.weight,
                                attribute_set_id: product.attribute_set_id,
                                extension_attributes: {
                                    stock_item: product.extension_attributes?.stock_item ? {
                                        qty: product.extension_attributes.stock_item.qty,
                                        is_in_stock: product.extension_attributes.stock_item.is_in_stock,
                                        min_qty: product.extension_attributes.stock_item.min_qty
                                    } : null,
                                    category_links: product.extension_attributes?.category_links
                                },
                                media_gallery_entries: product.media_gallery_entries?.map((img: any) => ({
                                    id: img.id,
                                    media_type: img.media_type,
                                    label: img.label,
                                    file: img.file,
                                    types: img.types
                                })),
                                custom_attributes: product.custom_attributes?.slice(0, 10)
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

    get_stock: {
        name: 'magento_get_stock',
        description: 'Get stock information for a product by SKU',
        parameters: {
            sku: z.string().describe('Product SKU'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ sku, _meta }: { sku: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const stock = await magentoRequest(creds.url, creds.accessToken, `/stockItems/${encodeURIComponent(sku)}`);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            sku,
                            stock: {
                                item_id: stock.item_id,
                                product_id: stock.product_id,
                                qty: stock.qty,
                                is_in_stock: stock.is_in_stock,
                                is_qty_decimal: stock.is_qty_decimal,
                                min_qty: stock.min_qty,
                                min_sale_qty: stock.min_sale_qty,
                                max_sale_qty: stock.max_sale_qty,
                                backorders: stock.backorders,
                                manage_stock: stock.manage_stock
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

    list_customers: {
        name: 'magento_list_customers',
        description: 'List Magento customers',
        parameters: {
            page_size: z.number().min(1).max(100).optional().describe('Results per page (default: 20, max: 100)'),
            current_page: z.number().min(1).optional().describe('Page number'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ page_size = 20, current_page = 1, _meta }: {
            page_size?: number,
            current_page?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    'searchCriteria[pageSize]': page_size.toString(),
                    'searchCriteria[currentPage]': current_page.toString()
                };

                const data = await magentoRequest(creds.url, creds.accessToken, '/customers/search', { params });

                const customers = data.items?.map((customer: any) => ({
                    id: customer.id,
                    email: customer.email,
                    firstname: customer.firstname,
                    lastname: customer.lastname,
                    group_id: customer.group_id,
                    store_id: customer.store_id,
                    website_id: customer.website_id,
                    created_at: customer.created_at,
                    updated_at: customer.updated_at,
                    addresses_count: customer.addresses?.length || 0
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: customers.length,
                            total_count: data.total_count,
                            current_page,
                            page_size,
                            customers
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

    // ==========================================================================
    // WRITE OPERATIONS - Session 249.20
    // ==========================================================================

    cancel_order: {
        name: 'magento_cancel_order',
        description: 'Cancel a Magento order. Only works for orders that have not been invoiced.',
        parameters: {
            order_id: z.number().describe('Magento order entity ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: {
            order_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing Magento credentials",
                            requirements: ["MAGENTO_URL", "MAGENTO_ACCESS_TOKEN"]
                        }, null, 2)
                    }]
                };
            }

            try {
                // POST /V1/orders/{id}/cancel
                const result = await magentoRequest(
                    creds.url,
                    creds.accessToken,
                    `/orders/${order_id}/cancel`,
                    { method: 'POST' }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            cancelled: result === true,
                            message: result === true ? `Order ${order_id} cancelled successfully` : 'Cancellation may have failed'
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            order_id,
                            message: error.message,
                            hint: "Order may already be invoiced or shipped. Only pending orders can be cancelled."
                        }, null, 2)
                    }]
                };
            }
        }
    },

    create_refund: {
        name: 'magento_create_refund',
        description: 'Create a refund (credit memo) for an invoiced Magento order.',
        parameters: {
            order_id: z.number().describe('Magento order entity ID'),
            items: z.array(z.object({
                order_item_id: z.number().describe('Order item ID to refund'),
                qty: z.number().describe('Quantity to refund')
            })).optional().describe('Specific items to refund (omit for full refund)'),
            notify_customer: z.boolean().optional().describe('Send refund email to customer (default: true)'),
            adjustment_positive: z.number().optional().describe('Adjustment refund amount (add to refund)'),
            adjustment_negative: z.number().optional().describe('Adjustment fee (subtract from refund)'),
            comment: z.string().optional().describe('Comment for the credit memo'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, items, notify_customer = true, adjustment_positive, adjustment_negative, comment, _meta }: {
            order_id: number;
            items?: Array<{ order_item_id: number; qty: number }>;
            notify_customer?: boolean;
            adjustment_positive?: number;
            adjustment_negative?: number;
            comment?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing Magento credentials",
                            requirements: ["MAGENTO_URL", "MAGENTO_ACCESS_TOKEN"]
                        }, null, 2)
                    }]
                };
            }

            try {
                // Build refund request body
                const refundBody: any = {
                    notify: notify_customer
                };

                if (items && items.length > 0) {
                    refundBody.items = items;
                }

                if (adjustment_positive !== undefined) {
                    refundBody.adjustmentPositive = adjustment_positive;
                }

                if (adjustment_negative !== undefined) {
                    refundBody.adjustmentNegative = adjustment_negative;
                }

                if (comment) {
                    refundBody.comment = {
                        comment: comment,
                        is_visible_on_front: 1
                    };
                }

                // POST /V1/order/{orderId}/refund
                const result = await magentoRequest(
                    creds.url,
                    creds.accessToken,
                    `/order/${order_id}/refund`,
                    { method: 'POST', body: refundBody }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            creditmemo_id: result,
                            message: `Credit memo ${result} created for order ${order_id}`
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            order_id,
                            message: error.message,
                            hint: "Order must be invoiced before creating a refund."
                        }, null, 2)
                    }]
                };
            }
        }
    },

    hold_order: {
        name: 'magento_hold_order',
        description: 'Place a Magento order on hold.',
        parameters: {
            order_id: z.number().describe('Magento order entity ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: {
            order_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await magentoRequest(
                    creds.url,
                    creds.accessToken,
                    `/orders/${order_id}/hold`,
                    { method: 'POST' }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            on_hold: result === true,
                            message: `Order ${order_id} placed on hold`
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

    unhold_order: {
        name: 'magento_unhold_order',
        description: 'Release a Magento order from hold status.',
        parameters: {
            order_id: z.number().describe('Magento order entity ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: {
            order_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMagentoCredentials(tenantId);

            if (!creds.url || !creds.accessToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing Magento credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await magentoRequest(
                    creds.url,
                    creds.accessToken,
                    `/orders/${order_id}/unhold`,
                    { method: 'POST' }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            released: result === true,
                            message: `Order ${order_id} released from hold`
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
