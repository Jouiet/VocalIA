import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * PrestaShop Webservice MCP Tools - Session 249.11
 *
 * API Reference: https://devdocs.prestashop-project.org/9/webservice/
 * API Version: REST (XML/JSON)
 * Auth: API Key (Basic Auth)
 *
 * Market Share: 1.91% global, 37% clients in France, strong in Europe
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
 * Get PrestaShop credentials for a tenant
 */
async function getPrestaShopCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.PRESTASHOP_API_KEY && creds.PRESTASHOP_URL) {
            return {
                apiKey: creds.PRESTASHOP_API_KEY,
                url: creds.PRESTASHOP_URL
            };
        }
    }
    return {
        apiKey: process.env.PRESTASHOP_API_KEY || null,
        url: process.env.PRESTASHOP_URL || null
    };
}

/**
 * Make authenticated request to PrestaShop Webservice API
 * PrestaShop uses Basic Auth with API key as username and empty password
 */
async function prestashopRequest(
    apiKey: string,
    storeUrl: string,
    resource: string,
    options: { method?: string; body?: any; params?: Record<string, string>; id?: number | string } = {}
): Promise<any> {
    const baseUrl = `${storeUrl.replace(/\/$/, '')}/api`;
    const method = options.method || 'GET';

    let endpoint = `${baseUrl}/${resource}`;
    if (options.id) {
        endpoint += `/${options.id}`;
    }

    const url = new URL(endpoint);
    // Always request JSON output
    url.searchParams.set('output_format', 'JSON');

    if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
            url.searchParams.set(key, value);
        }
    }

    // Basic Auth: API key as username, empty password
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PrestaShop API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const prestashopTools = {
    list_orders: {
        name: 'prestashop_list_orders',
        description: 'List PrestaShop orders with optional filters',
        parameters: {
            limit: z.number().min(1).max(100).optional().describe('Results limit (default: 50)'),
            offset: z.number().min(0).optional().describe('Offset for pagination'),
            date_add_min: z.string().optional().describe('Filter orders created after this date (YYYY-MM-DD HH:MM:SS)'),
            date_add_max: z.string().optional().describe('Filter orders created before this date'),
            current_state: z.number().optional().describe('Filter by order state ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ limit = 50, offset = 0, date_add_min, date_add_max, current_state, _meta }: {
            limit?: number,
            offset?: number,
            date_add_min?: string,
            date_add_max?: string,
            current_state?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials",
                            required: ["PRESTASHOP_API_KEY", "PRESTASHOP_URL"],
                            hint: "Get API Key from PrestaShop Admin > Advanced Parameters > Webservice"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    display: 'full',
                    limit: `${offset},${limit}`
                };

                // Build filter string
                const filters: string[] = [];
                if (date_add_min) filters.push(`filter[date_add]=[${date_add_min},]`);
                if (date_add_max) filters.push(`filter[date_add]=[,${date_add_max}]`);
                if (current_state) params['filter[current_state]'] = current_state.toString();

                // Note: PrestaShop has quirky filter syntax
                if (date_add_min || date_add_max) {
                    const dateFilter = date_add_min && date_add_max
                        ? `[${date_add_min},${date_add_max}]`
                        : date_add_min
                            ? `[${date_add_min},]`
                            : `[,${date_add_max}]`;
                    params['filter[date_add]'] = dateFilter;
                    params['date'] = '1';
                }

                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'orders',
                    { params }
                );

                const orders = result.orders || [];
                const formattedOrders = orders.map((order: any) => ({
                    id: order.id,
                    reference: order.reference,
                    id_customer: order.id_customer,
                    id_carrier: order.id_carrier,
                    current_state: order.current_state,
                    payment: order.payment,
                    total_paid: order.total_paid,
                    total_paid_real: order.total_paid_real,
                    total_products: order.total_products,
                    total_shipping: order.total_shipping,
                    date_add: order.date_add,
                    date_upd: order.date_upd,
                    id_currency: order.id_currency,
                    id_lang: order.id_lang
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedOrders.length,
                            offset,
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
        name: 'prestashop_get_order',
        description: 'Get a specific PrestaShop order by ID',
        parameters: {
            order_id: z.number().describe('Order ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: { order_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'orders',
                    { id: order_id }
                );

                const order = result.order || result.orders?.[0];
                if (!order) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: `Order ${order_id} not found`
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order: {
                                id: order.id,
                                reference: order.reference,
                                id_customer: order.id_customer,
                                id_address_delivery: order.id_address_delivery,
                                id_address_invoice: order.id_address_invoice,
                                id_cart: order.id_cart,
                                id_currency: order.id_currency,
                                id_lang: order.id_lang,
                                id_carrier: order.id_carrier,
                                current_state: order.current_state,
                                module: order.module,
                                payment: order.payment,
                                total_discounts: order.total_discounts,
                                total_paid: order.total_paid,
                                total_paid_real: order.total_paid_real,
                                total_products: order.total_products,
                                total_products_wt: order.total_products_wt,
                                total_shipping: order.total_shipping,
                                total_wrapping: order.total_wrapping,
                                conversion_rate: order.conversion_rate,
                                date_add: order.date_add,
                                date_upd: order.date_upd,
                                valid: order.valid,
                                associations: order.associations
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
        name: 'prestashop_list_products',
        description: 'List PrestaShop products with optional filters',
        parameters: {
            limit: z.number().min(1).max(100).optional().describe('Results limit (default: 50)'),
            offset: z.number().min(0).optional().describe('Offset for pagination'),
            active: z.boolean().optional().describe('Filter by active status'),
            id_category: z.number().optional().describe('Filter by category ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ limit = 50, offset = 0, active, id_category, _meta }: {
            limit?: number,
            offset?: number,
            active?: boolean,
            id_category?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    display: 'full',
                    limit: `${offset},${limit}`
                };
                if (active !== undefined) params['filter[active]'] = active ? '1' : '0';
                if (id_category) params['filter[id_category_default]'] = id_category.toString();

                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'products',
                    { params }
                );

                const products = result.products || [];
                const formattedProducts = products.map((product: any) => ({
                    id: product.id,
                    id_manufacturer: product.id_manufacturer,
                    id_supplier: product.id_supplier,
                    id_category_default: product.id_category_default,
                    name: product.name?.[0]?.value || product.name,
                    description_short: (product.description_short?.[0]?.value || product.description_short || '').substring(0, 200),
                    price: product.price,
                    wholesale_price: product.wholesale_price,
                    reference: product.reference,
                    ean13: product.ean13,
                    quantity: product.quantity,
                    active: product.active,
                    available_for_order: product.available_for_order,
                    date_add: product.date_add,
                    date_upd: product.date_upd
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedProducts.length,
                            offset,
                            limit,
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
        name: 'prestashop_get_product',
        description: 'Get a specific PrestaShop product by ID',
        parameters: {
            product_id: z.number().describe('Product ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, _meta }: { product_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'products',
                    { id: product_id }
                );

                const product = result.product || result.products?.[0];
                if (!product) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: `Product ${product_id} not found`
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            product: {
                                id: product.id,
                                id_manufacturer: product.id_manufacturer,
                                id_supplier: product.id_supplier,
                                id_category_default: product.id_category_default,
                                id_tax_rules_group: product.id_tax_rules_group,
                                name: product.name,
                                description: product.description,
                                description_short: product.description_short,
                                price: product.price,
                                wholesale_price: product.wholesale_price,
                                unit_price: product.unit_price,
                                reference: product.reference,
                                supplier_reference: product.supplier_reference,
                                ean13: product.ean13,
                                upc: product.upc,
                                isbn: product.isbn,
                                quantity: product.quantity,
                                minimal_quantity: product.minimal_quantity,
                                low_stock_threshold: product.low_stock_threshold,
                                weight: product.weight,
                                width: product.width,
                                height: product.height,
                                depth: product.depth,
                                active: product.active,
                                available_for_order: product.available_for_order,
                                online_only: product.online_only,
                                on_sale: product.on_sale,
                                date_add: product.date_add,
                                date_upd: product.date_upd,
                                associations: product.associations
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
        name: 'prestashop_get_stock',
        description: 'Get stock available for PrestaShop products',
        parameters: {
            product_id: z.number().optional().describe('Filter by product ID'),
            limit: z.number().min(1).max(100).optional().describe('Results limit'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ product_id, limit = 50, _meta }: {
            product_id?: number,
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    display: 'full',
                    limit: limit.toString()
                };
                if (product_id) params['filter[id_product]'] = product_id.toString();

                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'stock_availables',
                    { params }
                );

                const stocks = result.stock_availables || [];
                const formattedStocks = stocks.map((stock: any) => ({
                    id: stock.id,
                    id_product: stock.id_product,
                    id_product_attribute: stock.id_product_attribute,
                    id_shop: stock.id_shop,
                    id_shop_group: stock.id_shop_group,
                    quantity: stock.quantity,
                    depends_on_stock: stock.depends_on_stock,
                    out_of_stock: stock.out_of_stock,
                    location: stock.location
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedStocks.length,
                            stocks: formattedStocks
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
        name: 'prestashop_list_customers',
        description: 'List PrestaShop customers with optional filters',
        parameters: {
            limit: z.number().min(1).max(100).optional().describe('Results limit (default: 50)'),
            offset: z.number().min(0).optional().describe('Offset for pagination'),
            active: z.boolean().optional().describe('Filter by active status'),
            email: z.string().optional().describe('Filter by email'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ limit = 50, offset = 0, active, email, _meta }: {
            limit?: number,
            offset?: number,
            active?: boolean,
            email?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    display: 'full',
                    limit: `${offset},${limit}`
                };
                if (active !== undefined) params['filter[active]'] = active ? '1' : '0';
                if (email) params['filter[email]'] = email;

                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'customers',
                    { params }
                );

                const customers = result.customers || [];
                const formattedCustomers = customers.map((customer: any) => ({
                    id: customer.id,
                    id_default_group: customer.id_default_group,
                    id_lang: customer.id_lang,
                    id_shop: customer.id_shop,
                    id_gender: customer.id_gender,
                    firstname: customer.firstname,
                    lastname: customer.lastname,
                    email: customer.email,
                    birthday: customer.birthday,
                    newsletter: customer.newsletter,
                    optin: customer.optin,
                    active: customer.active,
                    date_add: customer.date_add,
                    date_upd: customer.date_upd
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: formattedCustomers.length,
                            offset,
                            limit,
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
        name: 'prestashop_get_customer',
        description: 'Get a specific PrestaShop customer by ID',
        parameters: {
            customer_id: z.number().describe('Customer ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ customer_id, _meta }: { customer_id: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.apiKey || !creds.url) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await prestashopRequest(
                    creds.apiKey,
                    creds.url,
                    'customers',
                    { id: customer_id }
                );

                const customer = result.customer || result.customers?.[0];
                if (!customer) {
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

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            customer: {
                                id: customer.id,
                                id_default_group: customer.id_default_group,
                                id_lang: customer.id_lang,
                                id_shop: customer.id_shop,
                                id_shop_group: customer.id_shop_group,
                                id_gender: customer.id_gender,
                                firstname: customer.firstname,
                                lastname: customer.lastname,
                                email: customer.email,
                                birthday: customer.birthday,
                                newsletter: customer.newsletter,
                                optin: customer.optin,
                                website: customer.website,
                                company: customer.company,
                                siret: customer.siret,
                                ape: customer.ape,
                                outstanding_allow_amount: customer.outstanding_allow_amount,
                                max_payment_days: customer.max_payment_days,
                                active: customer.active,
                                is_guest: customer.is_guest,
                                deleted: customer.deleted,
                                date_add: customer.date_add,
                                date_upd: customer.date_upd,
                                associations: customer.associations
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

    // ==========================================================================
    // WRITE OPERATIONS - Session 249.20
    // Sources: https://github.com/latinogino/prestashop-mcp
    //          https://devdocs.prestashop-project.org/8/webservice/
    // ==========================================================================

    update_order_status: {
        name: 'prestashop_update_order_status',
        description: 'Update the status of a PrestaShop order (e.g., processing, shipped, delivered, cancelled).',
        parameters: {
            order_id: z.number().describe('PrestaShop order ID'),
            new_status_id: z.number().describe('New order state ID (1=Awaiting payment, 2=Payment accepted, 3=Processing, 4=Shipped, 5=Delivered, 6=Cancelled, 7=Refunded)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, new_status_id, _meta }: {
            order_id: number;
            new_status_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.url || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing PrestaShop credentials",
                            requirements: ["PRESTASHOP_URL", "PRESTASHOP_API_KEY"]
                        }, null, 2)
                    }]
                };
            }

            try {
                // PrestaShop requires XML for updates, but we can use JSON output_format
                // First get the order to ensure it exists
                const order = await prestashopRequest(creds.url, creds.apiKey, `/orders/${order_id}`);

                if (!order?.order) {
                    throw new Error(`Order ${order_id} not found`);
                }

                // Create order history entry to change status
                const historyXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <order_history>
        <id_order>${order_id}</id_order>
        <id_order_state>${new_status_id}</id_order_state>
    </order_history>
</prestashop>`;

                // POST to order_histories to update status
                const url = `${creds.url.replace(/\/$/, '')}/api/order_histories`;
                const auth = Buffer.from(`${creds.apiKey}:`).toString('base64');

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/xml'
                    },
                    body: historyXml
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`PrestaShop API error ${response.status}: ${errorText}`);
                }

                const statusNames: Record<number, string> = {
                    1: 'Awaiting check payment',
                    2: 'Payment accepted',
                    3: 'Processing in progress',
                    4: 'Shipped',
                    5: 'Delivered',
                    6: 'Cancelled',
                    7: 'Refunded',
                    8: 'Payment error',
                    9: 'On backorder (paid)',
                    10: 'Awaiting bank wire payment',
                    11: 'Remote payment accepted',
                    12: 'On backorder (not paid)'
                };

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            new_status_id,
                            new_status_name: statusNames[new_status_id] || `Status ${new_status_id}`,
                            message: `Order ${order_id} status updated to ${statusNames[new_status_id] || new_status_id}`
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
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    cancel_order: {
        name: 'prestashop_cancel_order',
        description: 'Cancel a PrestaShop order by setting its status to Cancelled (state 6).',
        parameters: {
            order_id: z.number().describe('PrestaShop order ID to cancel'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: {
            order_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.url || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Cancel = set status to 6
                const historyXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <order_history>
        <id_order>${order_id}</id_order>
        <id_order_state>6</id_order_state>
    </order_history>
</prestashop>`;

                const url = `${creds.url.replace(/\/$/, '')}/api/order_histories`;
                const auth = Buffer.from(`${creds.apiKey}:`).toString('base64');

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/xml'
                    },
                    body: historyXml
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`PrestaShop API error ${response.status}: ${errorText}`);
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            cancelled: true,
                            message: `Order ${order_id} has been cancelled`
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
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    refund_order: {
        name: 'prestashop_refund_order',
        description: 'Mark a PrestaShop order as refunded by setting its status to Refunded (state 7).',
        parameters: {
            order_id: z.number().describe('PrestaShop order ID to refund'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ order_id, _meta }: {
            order_id: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getPrestaShopCredentials(tenantId);

            if (!creds.url || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            error: "Missing PrestaShop credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Refunded = set status to 7
                const historyXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <order_history>
        <id_order>${order_id}</id_order>
        <id_order_state>7</id_order_state>
    </order_history>
</prestashop>`;

                const url = `${creds.url.replace(/\/$/, '')}/api/order_histories`;
                const auth = Buffer.from(`${creds.apiKey}:`).toString('base64');

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/xml'
                    },
                    body: historyXml
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`PrestaShop API error ${response.status}: ${errorText}`);
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            order_id,
                            refunded: true,
                            message: `Order ${order_id} has been marked as refunded`
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
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
