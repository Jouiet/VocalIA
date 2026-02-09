/**
 * Stripe MCP Tools - VocalIA
 *
 * Payment processing tools for voice commerce:
 * - Payment Links (one-click checkout)
 * - Customers management
 * - Products & Prices
 * - Invoices
 * - Checkout Sessions
 *
 * Rate Limits: 100 read/s, 100 write/s (standard)
 * API Version: 2024-12-18.acacia
 */

import { z } from 'zod';

// ============================================================================
// CREDENTIALS HELPER
// ============================================================================

interface StripeCredentials {
  secretKey: string;
  webhookSecret?: string;
}

function getStripeCredentials(tenantId?: string): StripeCredentials {
  // Multi-tenant: check tenant-specific first
  if (tenantId) {
    const tenantKey = process.env[`STRIPE_SECRET_KEY_${tenantId.toUpperCase()}`];
    if (tenantKey) {
      return {
        secretKey: tenantKey,
        webhookSecret: process.env[`STRIPE_WEBHOOK_SECRET_${tenantId.toUpperCase()}`]
      };
    }
  }

  // Fallback to default
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }

  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  };
}

// ============================================================================
// STRIPE API REQUEST
// ============================================================================

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2026-01-28.clover';

interface StripeResponse {
  id?: string;
  object?: string;
  error?: {
    type: string;
    code?: string;
    message: string;
    param?: string;
  };
  data?: Array<Record<string, unknown>>;
  has_more?: boolean;
  url?: string;
  [key: string]: unknown;
}

async function stripeRequest(
  secretKey: string,
  method: 'GET' | 'POST' | 'DELETE',
  endpoint: string,
  params?: Record<string, unknown>
): Promise<StripeResponse> {
  const url = new URL(`${STRIPE_API_BASE}${endpoint}`);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };

  let body: string | undefined;

  if (method === 'GET' && params) {
    // Add query params for GET
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v, i) => url.searchParams.append(`${key}[${i}]`, String(v)));
        } else if (typeof value === 'object') {
          Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
            url.searchParams.append(`${key}[${k}]`, String(v));
          });
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });
  } else if (method === 'POST' && params) {
    // URL-encoded form data for POST
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = buildFormData(params);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '1';
    throw new Error(`Stripe rate limit exceeded. Retry after ${retryAfter} seconds.`);
  }

  const result = await response.json() as StripeResponse;

  if (result.error) {
    throw new Error(`Stripe API Error: ${result.error.message} (${result.error.type})`);
  }

  return result;
}

// Build URL-encoded form data (Stripe uses form encoding, not JSON)
function buildFormData(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object' && v !== null) {
          parts.push(buildFormData(v as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else if (typeof value === 'object') {
      parts.push(buildFormData(value as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(p => p).join('&');
}

// ============================================================================
// HELPER: Create error response for missing credentials
// ============================================================================

function missingCredentialsResponse() {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: false,
        error: 'Missing Stripe credentials',
        requirements: {
          credentials: ['STRIPE_SECRET_KEY'],
          optional: ['STRIPE_WEBHOOK_SECRET'],
          setup: 'https://dashboard.stripe.com/apikeys'
        }
      }, null, 2)
    }]
  };
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const stripeTools = {
  // ==========================================================================
  // PAYMENT LINKS (Primary for Voice Commerce)
  // ==========================================================================

  create_payment_link: {
    name: 'stripe_create_payment_link',
    description: 'Create a Stripe Payment Link for one-click checkout. Perfect for voice commerce - caller says "I want to pay" and receives SMS/email with payment link.',
    parameters: {
      price_id: z.string().optional().describe('Existing price ID (price_xxx) for simple products'),
      product_name: z.string().optional().describe('Product name for inline price creation'),
      amount: z.number().optional().describe('Amount in cents (e.g., 1000 for €10.00) - required with product_name'),
      currency: z.string().default('eur').describe('Currency code (eur, usd, mad)'),
      quantity: z.number().default(1).describe('Quantity of items'),
      allow_promotion_codes: z.boolean().optional().describe('Allow promo codes'),
      collect_phone: z.boolean().optional().describe('Collect phone number'),
      metadata: z.record(z.string()).optional().describe('Custom metadata (call_id, lead_id)'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      price_id?: string;
      product_name?: string;
      amount?: number;
      currency?: string;
      quantity?: number;
      allow_promotion_codes?: boolean;
      collect_phone?: boolean;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);

        // Build line_items
        const line_items: Record<string, unknown>[] = [];

        if (args.price_id) {
          line_items.push({ price: args.price_id, quantity: args.quantity || 1 });
        } else if (args.product_name && args.amount) {
          line_items.push({
            price_data: {
              currency: args.currency || 'eur',
              product_data: { name: args.product_name },
              unit_amount: args.amount
            },
            quantity: args.quantity || 1
          });
        } else {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: 'Either price_id OR (product_name + amount) is required'
              }, null, 2)
            }]
          };
        }

        const params: Record<string, unknown> = { line_items };
        if (args.allow_promotion_codes) params.allow_promotion_codes = true;
        if (args.collect_phone) params.phone_number_collection = { enabled: true };
        if (args.metadata) params.metadata = args.metadata;

        const result = await stripeRequest(creds.secretKey, 'POST', '/payment_links', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              payment_link: {
                id: result.id,
                url: result.url,
                active: result.active
              },
              message: `Payment link created: ${result.url}`
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }]
        };
      }
    }
  },

  list_payment_links: {
    name: 'stripe_list_payment_links',
    description: 'List all payment links',
    parameters: {
      active: z.boolean().optional().describe('Filter by active status'),
      limit: z.number().min(1).max(100).default(10),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { active?: boolean; limit?: number; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const params: Record<string, unknown> = { limit: args.limit || 10 };
        if (args.active !== undefined) params.active = args.active;

        const result = await stripeRequest(creds.secretKey, 'GET', '/payment_links', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              payment_links: result.data,
              has_more: result.has_more
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  deactivate_payment_link: {
    name: 'stripe_deactivate_payment_link',
    description: 'Deactivate a payment link',
    parameters: {
      payment_link_id: z.string().describe('Payment link ID (plink_xxx)'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { payment_link_id: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'POST', `/payment_links/${args.payment_link_id}`, { active: false });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: 'Payment link deactivated',
              payment_link: { id: result.id, active: result.active }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // CUSTOMERS
  // ==========================================================================

  create_customer: {
    name: 'stripe_create_customer',
    description: 'Create a new Stripe customer',
    parameters: {
      email: z.string().email().optional(),
      name: z.string().optional(),
      phone: z.string().optional(),
      description: z.string().optional(),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      email?: string;
      name?: string;
      phone?: string;
      description?: string;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const { _meta, ...params } = args;

        const result = await stripeRequest(creds.secretKey, 'POST', '/customers', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              customer: { id: result.id, email: result.email, name: result.name }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  get_customer: {
    name: 'stripe_get_customer',
    description: 'Get customer by ID or search by email',
    parameters: {
      customer_id: z.string().optional().describe('Customer ID (cus_xxx)'),
      email: z.string().email().optional().describe('Search by email'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { customer_id?: string; email?: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);

        if (args.customer_id) {
          const result = await stripeRequest(creds.secretKey, 'GET', `/customers/${args.customer_id}`);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true, customer: result }, null, 2) }]
          };
        }

        if (args.email) {
          const result = await stripeRequest(creds.secretKey, 'GET', '/customers', { email: args.email, limit: 1 });
          const customers = result.data || [];
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: true, found: customers.length > 0, customer: customers[0] || null }, null, 2)
            }]
          };
        }

        throw new Error('Either customer_id or email is required');
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  list_customers: {
    name: 'stripe_list_customers',
    description: 'List customers',
    parameters: {
      email: z.string().optional(),
      limit: z.number().min(1).max(100).default(10),
      starting_after: z.string().optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { email?: string; limit?: number; starting_after?: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const { _meta, ...params } = args;

        const result = await stripeRequest(creds.secretKey, 'GET', '/customers', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, customers: result.data, has_more: result.has_more }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // PRODUCTS & PRICES
  // ==========================================================================

  create_product: {
    name: 'stripe_create_product',
    description: 'Create a product in the Stripe catalog',
    parameters: {
      name: z.string(),
      description: z.string().optional(),
      images: z.array(z.string()).optional(),
      metadata: z.record(z.string()).optional(),
      default_price_amount: z.number().optional().describe('Default price in cents'),
      default_price_currency: z.string().default('eur'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      name: string;
      description?: string;
      images?: string[];
      metadata?: Record<string, string>;
      default_price_amount?: number;
      default_price_currency?: string;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const params: Record<string, unknown> = { name: args.name };
        if (args.description) params.description = args.description;
        if (args.images) params.images = args.images;
        if (args.metadata) params.metadata = args.metadata;
        if (args.default_price_amount) {
          params.default_price_data = {
            currency: args.default_price_currency || 'eur',
            unit_amount: args.default_price_amount
          };
        }

        const result = await stripeRequest(creds.secretKey, 'POST', '/products', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              product: { id: result.id, name: result.name, default_price: result.default_price }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  list_products: {
    name: 'stripe_list_products',
    description: 'List products in the catalog',
    parameters: {
      active: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(10),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { active?: boolean; limit?: number; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const params: Record<string, unknown> = { limit: args.limit || 10 };
        if (args.active !== undefined) params.active = args.active;

        const result = await stripeRequest(creds.secretKey, 'GET', '/products', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, products: result.data, has_more: result.has_more }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  create_price: {
    name: 'stripe_create_price',
    description: 'Create a price for a product',
    parameters: {
      product: z.string().describe('Product ID (prod_xxx)'),
      unit_amount: z.number().describe('Amount in cents'),
      currency: z.string().default('eur'),
      recurring_interval: z.enum(['day', 'week', 'month', 'year']).optional().describe('For subscriptions'),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      product: string;
      unit_amount: number;
      currency?: string;
      recurring_interval?: string;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const params: Record<string, unknown> = {
          product: args.product,
          unit_amount: args.unit_amount,
          currency: args.currency || 'eur'
        };
        if (args.recurring_interval) params.recurring = { interval: args.recurring_interval };
        if (args.metadata) params.metadata = args.metadata;

        const result = await stripeRequest(creds.secretKey, 'POST', '/prices', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              price: { id: result.id, product: result.product, unit_amount: result.unit_amount, currency: result.currency }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // CHECKOUT SESSIONS
  // ==========================================================================

  create_checkout_session: {
    name: 'stripe_create_checkout_session',
    description: 'Create a hosted checkout session',
    parameters: {
      mode: z.enum(['payment', 'subscription', 'setup']).default('payment'),
      price_id: z.string().optional().describe('Existing price ID'),
      product_name: z.string().optional().describe('Product name for inline creation'),
      amount: z.number().optional().describe('Amount in cents'),
      currency: z.string().default('eur'),
      quantity: z.number().default(1),
      success_url: z.string().describe('Redirect URL after success'),
      cancel_url: z.string().optional(),
      customer_email: z.string().optional(),
      locale: z.string().optional().describe('e.g., "fr", "ar", "en"'),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      mode?: string;
      price_id?: string;
      product_name?: string;
      amount?: number;
      currency?: string;
      quantity?: number;
      success_url: string;
      cancel_url?: string;
      customer_email?: string;
      locale?: string;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);

        const line_items: Record<string, unknown>[] = [];
        if (args.price_id) {
          line_items.push({ price: args.price_id, quantity: args.quantity || 1 });
        } else if (args.product_name && args.amount) {
          line_items.push({
            price_data: {
              currency: args.currency || 'eur',
              product_data: { name: args.product_name },
              unit_amount: args.amount
            },
            quantity: args.quantity || 1
          });
        }

        const params: Record<string, unknown> = {
          mode: args.mode || 'payment',
          success_url: args.success_url
        };
        if (line_items.length > 0) params.line_items = line_items;
        if (args.cancel_url) params.cancel_url = args.cancel_url;
        if (args.customer_email) params.customer_email = args.customer_email;
        if (args.locale) params.locale = args.locale;
        if (args.metadata) params.metadata = args.metadata;

        const result = await stripeRequest(creds.secretKey, 'POST', '/checkout/sessions', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              checkout_session: { id: result.id, url: result.url, status: result.status }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  get_checkout_session: {
    name: 'stripe_get_checkout_session',
    description: 'Get checkout session status',
    parameters: {
      session_id: z.string().describe('Checkout session ID (cs_xxx)'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { session_id: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'GET', `/checkout/sessions/${args.session_id}`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              checkout_session: {
                id: result.id,
                status: result.status,
                payment_status: result.payment_status,
                amount_total: result.amount_total,
                currency: result.currency
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // INVOICES
  // ==========================================================================

  create_invoice: {
    name: 'stripe_create_invoice',
    description: 'Create an invoice for a customer',
    parameters: {
      customer: z.string().describe('Customer ID (cus_xxx)'),
      collection_method: z.enum(['charge_automatically', 'send_invoice']).default('send_invoice'),
      days_until_due: z.number().optional(),
      description: z.string().optional(),
      auto_advance: z.boolean().optional(),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      customer: string;
      collection_method?: string;
      days_until_due?: number;
      description?: string;
      auto_advance?: boolean;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const { _meta, ...params } = args;

        const result = await stripeRequest(creds.secretKey, 'POST', '/invoices', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              invoice: {
                id: result.id,
                status: result.status,
                hosted_invoice_url: result.hosted_invoice_url,
                invoice_pdf: result.invoice_pdf
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  add_invoice_item: {
    name: 'stripe_add_invoice_item',
    description: 'Add a line item to a draft invoice',
    parameters: {
      customer: z.string().describe('Customer ID'),
      invoice: z.string().optional().describe('Invoice ID (in_xxx)'),
      price: z.string().optional().describe('Price ID'),
      amount: z.number().optional().describe('Amount in cents'),
      currency: z.string().optional(),
      description: z.string().optional(),
      quantity: z.number().optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      customer: string;
      invoice?: string;
      price?: string;
      amount?: number;
      currency?: string;
      description?: string;
      quantity?: number;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const { _meta, ...params } = args;

        const result = await stripeRequest(creds.secretKey, 'POST', '/invoiceitems', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              invoice_item: { id: result.id, amount: result.amount, description: result.description }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  finalize_invoice: {
    name: 'stripe_finalize_invoice',
    description: 'Finalize a draft invoice',
    parameters: {
      invoice_id: z.string().describe('Invoice ID (in_xxx)'),
      auto_advance: z.boolean().optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { invoice_id: string; auto_advance?: boolean; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'POST', `/invoices/${args.invoice_id}/finalize`, {
          auto_advance: args.auto_advance
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              invoice: { id: result.id, status: result.status, hosted_invoice_url: result.hosted_invoice_url }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  send_invoice: {
    name: 'stripe_send_invoice',
    description: 'Send a finalized invoice to customer',
    parameters: {
      invoice_id: z.string().describe('Invoice ID (in_xxx)'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { invoice_id: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'POST', `/invoices/${args.invoice_id}/send`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: 'Invoice sent to customer',
              invoice: { id: result.id, status: result.status }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // PAYMENT INTENTS
  // ==========================================================================

  create_payment_intent: {
    name: 'stripe_create_payment_intent',
    description: 'Create a payment intent for custom flows',
    parameters: {
      amount: z.number().describe('Amount in cents'),
      currency: z.string().default('eur'),
      customer: z.string().optional(),
      description: z.string().optional(),
      receipt_email: z.string().optional(),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      amount: number;
      currency?: string;
      customer?: string;
      description?: string;
      receipt_email?: string;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const params: Record<string, unknown> = {
          amount: args.amount,
          currency: args.currency || 'eur',
          automatic_payment_methods: { enabled: true }
        };
        if (args.customer) params.customer = args.customer;
        if (args.description) params.description = args.description;
        if (args.receipt_email) params.receipt_email = args.receipt_email;
        if (args.metadata) params.metadata = args.metadata;

        const result = await stripeRequest(creds.secretKey, 'POST', '/payment_intents', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              payment_intent: {
                id: result.id,
                client_secret: result.client_secret,
                status: result.status,
                amount: result.amount,
                currency: result.currency
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  get_payment_intent: {
    name: 'stripe_get_payment_intent',
    description: 'Get payment intent status',
    parameters: {
      payment_intent_id: z.string().describe('Payment intent ID (pi_xxx)'),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { payment_intent_id: string; _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'GET', `/payment_intents/${args.payment_intent_id}`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              payment_intent: {
                id: result.id,
                status: result.status,
                amount: result.amount,
                currency: result.currency,
                customer: result.customer
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // REFUNDS
  // ==========================================================================

  create_refund: {
    name: 'stripe_create_refund',
    description: 'Create a refund for a payment',
    parameters: {
      payment_intent: z.string().optional().describe('Payment intent ID'),
      charge: z.string().optional().describe('Charge ID'),
      amount: z.number().optional().describe('Amount in cents for partial refund'),
      reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
      metadata: z.record(z.string()).optional(),
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: {
      payment_intent?: string;
      charge?: string;
      amount?: number;
      reason?: string;
      metadata?: Record<string, string>;
      _meta?: { tenantId?: string };
    }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);

        if (!args.payment_intent && !args.charge) {
          throw new Error('Either payment_intent or charge is required');
        }

        const params: Record<string, unknown> = {};
        if (args.payment_intent) params.payment_intent = args.payment_intent;
        if (args.charge) params.charge = args.charge;
        if (args.amount) params.amount = args.amount;
        if (args.reason) params.reason = args.reason;
        if (args.metadata) params.metadata = args.metadata;

        const result = await stripeRequest(creds.secretKey, 'POST', '/refunds', params);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              refund: { id: result.id, status: result.status, amount: result.amount, reason: result.reason }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  },

  // ==========================================================================
  // BALANCE
  // ==========================================================================

  get_balance: {
    name: 'stripe_get_balance',
    description: 'Get current Stripe account balance',
    parameters: {
      _meta: z.object({ tenantId: z.string().optional() }).optional()
    },
    handler: async (args: { _meta?: { tenantId?: string } }) => {
      try {
        const creds = getStripeCredentials(args._meta?.tenantId);
        const result = await stripeRequest(creds.secretKey, 'GET', '/balance');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              balance: { available: result.available, pending: result.pending, livemode: result.livemode }
            }, null, 2)
          }]
        };
      } catch (error) {
        if ((error as Error).message.includes('not configured')) {
          return missingCredentialsResponse();
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2) }]
        };
      }
    }
  }
};

export default stripeTools;
