import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * BigCommerce MCP Tools - Session 249.11
 *
 * API Reference: https://developer.bigcommerce.com/docs/api
 * API Version: v3 (REST)
 * Auth: Access Token + Store Hash
 *
 * Market Share: 1% global, 3% USA, mid-market/enterprise focus (75% ARR = enterprise)
 * Multi-tenant support via SecretVault
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
 * Get BigCommerce credentials for a tenant
 */
async function getBigCommerceCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.BIGCOMMERCE_ACCESS_TOKEN && creds.BIGCOMMERCE_STORE_HASH) {
            return {
                accessToken: creds.BIGCOMMERCE_ACCESS_TOKEN,
                storeHash: creds.BIGCOMMERCE_STORE_HASH
            };
        }
    }
    return {
        accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN || null,
        storeHash: process.env.BIGCOMMERCE_STORE_HASH || null
    };
}

/**
 * Make authenticated request to BigCommerce API
 */
async function bigcommerceRequest(
    accessToken: string,
    storeHash: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string>; apiVersion?: string } = {}
): Promise<any> {
    const apiVersion = options.apiVersion || 'v3';
    const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/${apiVersion}`;
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
            'X-Auth-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BigCommerce API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const bigcommerceTools = {
    list_orders: {
        name: 'bigcommerce_list_orders',
        description: 'List BigCommerce orders with optional filters',
        parameters: {
            status_id: z.number().optional().describe('Filter by order status ID'),
            min_date_created: z.string().optional().describe('Filter orders created after this date (RFC 2822 or ISO 8601)'),
            max_date_created: z.string().optional().describe('Filter orders created before this date'),
            customer_id: z.number().optional().describe('Filter by customer ID'),
            limit: z.number().min(1).max(250).optional().describe('Results per page (default: 50, max: 250)'),
            page: z.number().min(1).optional().describe('Page number'),
            sort: z.enum(['id', 'date_created', 'date_modified', 'status_id']).optional().describe('Sort field'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status_id, min_date_created, max_date_created, customer_id, limit = 50, page = 1, sort, _meta }: {
            status_id?: number,
            min_date_created?: string,
            max_date_created?: string,
            customer_id?: number,
            limit?: number,
            page?: number,
            sort?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials",
                            required: ["BIGCOMMERCE_ACCESS_TOKEN", "BIGCOMMERCE_STORE_HASH"],
                            hint: "Get credentials from BigCommerce Store > Settings > API Accounts"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: limit.toString(),
                    page: page.toString()
                };
                if (status_id) params.status_id = status_id.toString();
                if (min_date_created) params.min_date_created = min_date_created;
                if (max_date_created) params.max_date_created = max_date_created;
                if (customer_id) params.customer_id = customer_id.toString();
                if (sort) params.sort = sort;

                // Orders V2 API (V3 doesn't have full orders endpoint)
                const result = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    '/orders',
                    { params, apiVersion: 'v2' }
                );

                const orders = Array.isArray(result) ? result : [];
                const formattedOrders = orders.map((order: any) => ({
                    id: order.id,
                    status: order.status,
                    status_id: order.status_id,
                    date_created: order.date_created,
                    date_modified: order.date_modified,
                    subtotal_inc_tax: order.subtotal_inc_tax,
                    total_inc_tax: order.total_inc_tax,
                    currency_code: order.currency_code,
                    items_total: order.items_total,
                    customer_id: order.customer_id,
                    billing_address: {
                        first_name: order.billing_address?.first_name,
                        last_name: order.billing_address?.last_name,
                        email: order.billing_address?.email,
                        phone: order.billing_address?.phone
                    },
                    payment_method: order.payment_method,
                    shipping_cost_inc_tax: order.shipping_cost_inc_tax
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedOrders.length,
                            page,
                            limit,
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
        name: 'bigcommerce_get_order',
        description: 'Get a specific BigCommerce order by ID',
        parameters: {
            order_id: z.number().describe('Order ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const order = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    `/orders/${order_id}`,
                    { apiVersion: 'v2' }
                );

                // Get order products
                const products = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    `/orders/${order_id}/products`,
                    { apiVersion: 'v2' }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                id: order.id,
                                status: order.status,
                                status_id: order.status_id,
                                date_created: order.date_created,
                                date_modified: order.date_modified,
                                date_shipped: order.date_shipped,
                                customer_id: order.customer_id,
                                customer_message: order.customer_message,
                                staff_notes: order.staff_notes,
                                subtotal_ex_tax: order.subtotal_ex_tax,
                                subtotal_inc_tax: order.subtotal_inc_tax,
                                shipping_cost_ex_tax: order.shipping_cost_ex_tax,
                                shipping_cost_inc_tax: order.shipping_cost_inc_tax,
                                total_ex_tax: order.total_ex_tax,
                                total_inc_tax: order.total_inc_tax,
                                currency_code: order.currency_code,
                                payment_method: order.payment_method,
                                payment_status: order.payment_status,
                                billing_address: order.billing_address,
                                shipping_addresses: order.shipping_addresses,
                                products: products?.map((p: any) => ({
                                    id: p.id,
                                    product_id: p.product_id,
                                    name: p.name,
                                    sku: p.sku,
                                    quantity: p.quantity,
                                    base_price: p.base_price,
                                    price_inc_tax: p.price_inc_tax,
                                    total_inc_tax: p.total_inc_tax
                                })),
                                coupons: order.coupons
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

    update_order_status: {
        name: 'bigcommerce_update_order_status',
        description: 'Update a BigCommerce order status',
        parameters: {
            order_id: z.number().describe('Order ID'),
            status_id: z.number().describe('New status ID (0=Incomplete, 1=Pending, 2=Shipped, 3=Partially Shipped, 5=Cancelled, 10=Completed, 11=Awaiting Payment, 12=Awaiting Shipment, etc.)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, status_id, _meta }: {
            order_id: number,
            status_id: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const order = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    `/orders/${order_id}`,
                    {
                        method: 'PUT',
                        body: { status_id },
                        apiVersion: 'v2'
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Order status updated successfully",
                            order: {
                                id: order.id,
                                status: order.status,
                                status_id: order.status_id,
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
        name: 'bigcommerce_list_products',
        description: 'List BigCommerce products with optional filters',
        parameters: {
            name: z.string().optional().describe('Filter by product name (partial match)'),
            sku: z.string().optional().describe('Filter by SKU'),
            availability: z.enum(['available', 'disabled', 'preorder']).optional().describe('Filter by availability'),
            is_visible: z.boolean().optional().describe('Filter by visibility'),
            limit: z.number().min(1).max(250).optional().describe('Results per page (default: 50, max: 250)'),
            page: z.number().min(1).optional().describe('Page number'),
            include: z.string().optional().describe('Sub-resources to include (variants, images, custom_fields, bulk_pricing_rules, options, modifiers)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ name, sku, availability, is_visible, limit = 50, page = 1, include, _meta }: {
            name?: string,
            sku?: string,
            availability?: string,
            is_visible?: boolean,
            limit?: number,
            page?: number,
            include?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: limit.toString(),
                    page: page.toString()
                };
                if (name) params['name:like'] = name;
                if (sku) params.sku = sku;
                if (availability) params.availability = availability;
                if (is_visible !== undefined) params.is_visible = is_visible.toString();
                if (include) params.include = include;

                const result = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    '/catalog/products',
                    { params }
                );

                const products = result.data || [];
                const formattedProducts = products.map((product: any) => ({
                    id: product.id,
                    name: product.name,
                    type: product.type,
                    sku: product.sku,
                    description: product.description?.substring(0, 200),
                    price: product.price,
                    sale_price: product.sale_price,
                    retail_price: product.retail_price,
                    cost_price: product.cost_price,
                    availability: product.availability,
                    is_visible: product.is_visible,
                    inventory_level: product.inventory_level,
                    inventory_tracking: product.inventory_tracking,
                    total_sold: product.total_sold,
                    categories: product.categories,
                    brand_id: product.brand_id
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedProducts.length,
                            pagination: result.meta?.pagination,
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
        name: 'bigcommerce_get_product',
        description: 'Get a specific BigCommerce product by ID',
        parameters: {
            product_id: z.number().describe('Product ID'),
            include: z.string().optional().describe('Sub-resources to include (variants, images, custom_fields, bulk_pricing_rules, options, modifiers)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, include, _meta }: { product_id: number, include?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {};
                if (include) params.include = include;

                const result = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    `/catalog/products/${product_id}`,
                    { params }
                );

                const product = result.data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                name: product.name,
                                type: product.type,
                                sku: product.sku,
                                description: product.description,
                                weight: product.weight,
                                width: product.width,
                                depth: product.depth,
                                height: product.height,
                                price: product.price,
                                cost_price: product.cost_price,
                                retail_price: product.retail_price,
                                sale_price: product.sale_price,
                                calculated_price: product.calculated_price,
                                availability: product.availability,
                                availability_description: product.availability_description,
                                is_visible: product.is_visible,
                                is_featured: product.is_featured,
                                inventory_level: product.inventory_level,
                                inventory_warning_level: product.inventory_warning_level,
                                inventory_tracking: product.inventory_tracking,
                                total_sold: product.total_sold,
                                date_created: product.date_created,
                                date_modified: product.date_modified,
                                categories: product.categories,
                                brand_id: product.brand_id,
                                images: product.images,
                                variants: product.variants,
                                custom_fields: product.custom_fields,
                                custom_url: product.custom_url
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
        name: 'bigcommerce_list_customers',
        description: 'List BigCommerce customers with optional filters',
        parameters: {
            email: z.string().optional().describe('Filter by email (exact match)'),
            name: z.string().optional().describe('Filter by name (partial match)'),
            company: z.string().optional().describe('Filter by company name'),
            customer_group_id: z.number().optional().describe('Filter by customer group ID'),
            limit: z.number().min(1).max(250).optional().describe('Results per page (default: 50, max: 250)'),
            page: z.number().min(1).optional().describe('Page number'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ email, name, company, customer_group_id, limit = 50, page = 1, _meta }: {
            email?: string,
            name?: string,
            company?: string,
            customer_group_id?: number,
            limit?: number,
            page?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: limit.toString(),
                    page: page.toString()
                };
                if (email) params['email:in'] = email;
                if (name) params['name:like'] = name;
                if (company) params['company:like'] = company;
                if (customer_group_id) params.customer_group_id = customer_group_id.toString();

                const result = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    '/customers',
                    { params }
                );

                const customers = result.data || [];
                const formattedCustomers = customers.map((customer: any) => ({
                    id: customer.id,
                    email: customer.email,
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    company: customer.company,
                    phone: customer.phone,
                    customer_group_id: customer.customer_group_id,
                    date_created: customer.date_created,
                    date_modified: customer.date_modified,
                    registration_ip_address: customer.registration_ip_address,
                    notes: customer.notes,
                    accepts_product_review_abandoned_cart_emails: customer.accepts_product_review_abandoned_cart_emails
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedCustomers.length,
                            pagination: result.meta?.pagination,
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
        name: 'bigcommerce_get_customer',
        description: 'Get a specific BigCommerce customer by ID',
        parameters: {
            customer_id: z.number().describe('Customer ID'),
            include: z.string().optional().describe('Sub-resources to include (addresses, storecredit, attributes, formfields)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ customer_id, include, _meta }: { customer_id: number, include?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getBigCommerceCredentials(tenantId);

            if (!creds.accessToken || !creds.storeHash) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing BigCommerce credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    'id:in': customer_id.toString()
                };
                if (include) params.include = include;

                const result = await bigcommerceRequest(
                    creds.accessToken,
                    creds.storeHash,
                    '/customers',
                    { params }
                );

                const customers = result.data || [];
                if (customers.length === 0) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: `Customer ${customer_id} not found`
                            }, null, 2)
                        }]
                    };
                }

                const customer = customers[0];
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
                                company: customer.company,
                                phone: customer.phone,
                                customer_group_id: customer.customer_group_id,
                                notes: customer.notes,
                                tax_exempt_category: customer.tax_exempt_category,
                                date_created: customer.date_created,
                                date_modified: customer.date_modified,
                                accepts_product_review_abandoned_cart_emails: customer.accepts_product_review_abandoned_cart_emails,
                                store_credit_amounts: customer.store_credit_amounts,
                                origin_channel_id: customer.origin_channel_id,
                                channel_ids: customer.channel_ids,
                                addresses: customer.addresses,
                                attributes: customer.attributes,
                                form_fields: customer.form_fields
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
