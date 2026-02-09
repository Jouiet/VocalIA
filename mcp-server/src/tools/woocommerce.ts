import { z } from 'zod';
import { createRequire } from 'module';

/**
 * WooCommerce MCP Tools - Session 249.5
 *
 * API Reference: https://woocommerce.github.io/woocommerce-rest-api-docs/
 * API Version: v3
 * Auth: OAuth 1.0a (Consumer Key + Consumer Secret)
 *
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
 * Get WooCommerce credentials for a tenant
 */
async function getWooCommerceCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.WOOCOMMERCE_URL && creds.WOOCOMMERCE_CONSUMER_KEY && creds.WOOCOMMERCE_CONSUMER_SECRET) {
            return {
                url: creds.WOOCOMMERCE_URL,
                consumerKey: creds.WOOCOMMERCE_CONSUMER_KEY,
                consumerSecret: creds.WOOCOMMERCE_CONSUMER_SECRET
            };
        }
    }
    return {
        url: process.env.WOOCOMMERCE_URL || null,
        consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || null,
        consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || null
    };
}

/**
 * Make authenticated request to WooCommerce API
 */
async function woocommerceRequest(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<any> {
    const apiUrl = `${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3${endpoint}`;
    const method = options.method || 'GET';

    // For HTTPS, we can use query string authentication (simpler)
    const url = new URL(apiUrl);
    url.searchParams.set('consumer_key', consumerKey);
    url.searchParams.set('consumer_secret', consumerSecret);

    // Add any additional params
    if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
            url.searchParams.set(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const woocommerceTools = {
    list_orders: {
        name: 'woocommerce_list_orders',
        description: 'List WooCommerce orders with optional filters',
        parameters: {
            status: z.enum(['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'trash']).optional()
                .describe('Filter by order status'),
            per_page: z.number().min(1).max(100).optional().describe('Results per page (default: 10, max: 100)'),
            page: z.number().min(1).optional().describe('Page number'),
            search: z.string().optional().describe('Search orders by keyword'),
            customer: z.number().optional().describe('Filter by customer ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status, per_page = 10, page = 1, search, customer, _meta }: {
            status?: string,
            per_page?: number,
            page?: number,
            search?: string,
            customer?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials",
                            required: ["WOOCOMMERCE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"],
                            hint: "Get credentials from WooCommerce > Settings > Advanced > REST API"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };
                if (status && status !== 'any') params.status = status;
                if (search) params.search = search;
                if (customer) params.customer = customer.toString();

                const orders = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    '/orders',
                    { params }
                );

                const formattedOrders = orders.map((order: any) => ({
                    id: order.id,
                    number: order.number,
                    status: order.status,
                    total: order.total,
                    currency: order.currency,
                    date_created: order.date_created,
                    customer_id: order.customer_id,
                    billing: {
                        first_name: order.billing?.first_name,
                        last_name: order.billing?.last_name,
                        email: order.billing?.email,
                        phone: order.billing?.phone
                    },
                    items_count: order.line_items?.length || 0
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedOrders.length,
                            page,
                            per_page,
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
        name: 'woocommerce_get_order',
        description: 'Get a specific WooCommerce order by ID',
        parameters: {
            order_id: z.number().describe('Order ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const order = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    `/orders/${order_id}`
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                id: order.id,
                                number: order.number,
                                status: order.status,
                                total: order.total,
                                subtotal: order.subtotal,
                                total_tax: order.total_tax,
                                shipping_total: order.shipping_total,
                                currency: order.currency,
                                date_created: order.date_created,
                                date_modified: order.date_modified,
                                date_paid: order.date_paid,
                                date_completed: order.date_completed,
                                customer_id: order.customer_id,
                                customer_note: order.customer_note,
                                billing: order.billing,
                                shipping: order.shipping,
                                payment_method: order.payment_method,
                                payment_method_title: order.payment_method_title,
                                line_items: order.line_items?.map((item: any) => ({
                                    id: item.id,
                                    name: item.name,
                                    quantity: item.quantity,
                                    price: item.price,
                                    total: item.total,
                                    sku: item.sku,
                                    product_id: item.product_id
                                })),
                                shipping_lines: order.shipping_lines,
                                coupon_lines: order.coupon_lines
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

    update_order: {
        name: 'woocommerce_update_order',
        description: 'Update a WooCommerce order status or details',
        parameters: {
            order_id: z.number().describe('Order ID'),
            status: z.enum(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']).optional()
                .describe('New order status'),
            customer_note: z.string().optional().describe('Add a customer note'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, status, customer_note, _meta }: {
            order_id: number,
            status?: string,
            customer_note?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const updateData: any = {};
                if (status) updateData.status = status;
                if (customer_note) updateData.customer_note = customer_note;

                const order = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    `/orders/${order_id}`,
                    { method: 'PUT', body: updateData }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Order updated successfully",
                            order: {
                                id: order.id,
                                number: order.number,
                                status: order.status,
                                date_modified: order.date_modified
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
        name: 'woocommerce_list_products',
        description: 'List WooCommerce products with optional filters',
        parameters: {
            per_page: z.number().min(1).max(100).optional().describe('Results per page (default: 10, max: 100)'),
            page: z.number().min(1).optional().describe('Page number'),
            search: z.string().optional().describe('Search products by keyword'),
            category: z.number().optional().describe('Filter by category ID'),
            status: z.enum(['any', 'draft', 'pending', 'private', 'publish']).optional().describe('Product status'),
            stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional().describe('Stock status filter'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 10, page = 1, search, category, status, stock_status, _meta }: {
            per_page?: number,
            page?: number,
            search?: string,
            category?: number,
            status?: string,
            stock_status?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };
                if (search) params.search = search;
                if (category) params.category = category.toString();
                if (status && status !== 'any') params.status = status;
                if (stock_status) params.stock_status = stock_status;

                const products = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    '/products',
                    { params }
                );

                const formattedProducts = products.map((product: any) => ({
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    type: product.type,
                    status: product.status,
                    sku: product.sku,
                    price: product.price,
                    regular_price: product.regular_price,
                    sale_price: product.sale_price,
                    on_sale: product.on_sale,
                    stock_status: product.stock_status,
                    stock_quantity: product.stock_quantity,
                    categories: product.categories?.map((c: any) => c.name),
                    images: product.images?.length || 0
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedProducts.length,
                            page,
                            per_page,
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
        name: 'woocommerce_get_product',
        description: 'Get a specific WooCommerce product by ID',
        parameters: {
            product_id: z.number().describe('Product ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, _meta }: { product_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const product = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    `/products/${product_id}`
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                name: product.name,
                                slug: product.slug,
                                type: product.type,
                                status: product.status,
                                description: product.description?.substring(0, 500),
                                short_description: product.short_description,
                                sku: product.sku,
                                price: product.price,
                                regular_price: product.regular_price,
                                sale_price: product.sale_price,
                                on_sale: product.on_sale,
                                purchasable: product.purchasable,
                                total_sales: product.total_sales,
                                virtual: product.virtual,
                                downloadable: product.downloadable,
                                tax_status: product.tax_status,
                                stock_status: product.stock_status,
                                stock_quantity: product.stock_quantity,
                                manage_stock: product.manage_stock,
                                backorders: product.backorders,
                                weight: product.weight,
                                dimensions: product.dimensions,
                                categories: product.categories,
                                tags: product.tags,
                                images: product.images?.map((img: any) => ({
                                    id: img.id,
                                    src: img.src,
                                    alt: img.alt
                                })),
                                attributes: product.attributes,
                                variations: product.variations
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
        name: 'woocommerce_list_customers',
        description: 'List WooCommerce customers with optional filters',
        parameters: {
            per_page: z.number().min(1).max(100).optional().describe('Results per page (default: 10, max: 100)'),
            page: z.number().min(1).optional().describe('Page number'),
            search: z.string().optional().describe('Search customers by email'),
            role: z.enum(['all', 'administrator', 'editor', 'author', 'contributor', 'subscriber', 'customer']).optional()
                .describe('Filter by role'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 10, page = 1, search, role, _meta }: {
            per_page?: number,
            page?: number,
            search?: string,
            role?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };
                if (search) params.search = search;
                if (role && role !== 'all') params.role = role;

                const customers = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    '/customers',
                    { params }
                );

                const formattedCustomers = customers.map((customer: any) => ({
                    id: customer.id,
                    email: customer.email,
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    username: customer.username,
                    role: customer.role,
                    date_created: customer.date_created,
                    orders_count: customer.orders_count,
                    total_spent: customer.total_spent,
                    avatar_url: customer.avatar_url,
                    billing: {
                        phone: customer.billing?.phone,
                        city: customer.billing?.city,
                        country: customer.billing?.country
                    }
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedCustomers.length,
                            page,
                            per_page,
                            customers: formattedCustomers
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

    get_customer: {
        name: 'woocommerce_get_customer',
        description: 'Get a specific WooCommerce customer by ID',
        parameters: {
            customer_id: z.number().describe('Customer ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ customer_id, _meta }: { customer_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getWooCommerceCredentials(tenantId);

            if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing WooCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const customer = await woocommerceRequest(
                    creds.url,
                    creds.consumerKey,
                    creds.consumerSecret,
                    `/customers/${customer_id}`
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            customer: {
                                id: customer.id,
                                email: customer.email,
                                first_name: customer.first_name,
                                last_name: customer.last_name,
                                username: customer.username,
                                role: customer.role,
                                date_created: customer.date_created,
                                date_modified: customer.date_modified,
                                orders_count: customer.orders_count,
                                total_spent: customer.total_spent,
                                billing: customer.billing,
                                shipping: customer.shipping,
                                is_paying_customer: customer.is_paying_customer,
                                avatar_url: customer.avatar_url
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
    }
};
