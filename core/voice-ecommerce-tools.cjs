/**
 * voice-ecommerce-tools.cjs
 * VocalIA - Session 250.94
 *
 * PRODUCTION BRIDGE: Connects Voice API to Real E-commerce Logic.
 * REPLACES: The previous skeleton "connexion aux commandes n'est pas encore active" mock.
 *
 * Supports: Shopify, WooCommerce (via SecretVault credentials)
 */

const { CatalogConnectorFactory, CATALOG_TYPES } = require('./catalog-connector.cjs');
const SecretVault = require('./SecretVault.cjs');
const https = require('https');

// Cache connectors per tenant to avoid reconnection overhead
const connectors = new Map();
const MAX_CONNECTORS = 50;

async function getConnector(tenantId) {
  if (connectors.has(tenantId)) return connectors.get(tenantId);

  // Evict oldest if cache full
  if (connectors.size >= MAX_CONNECTORS) {
    const oldestKey = connectors.keys().next().value;
    connectors.delete(oldestKey);
  }

  try {
    const connector = CatalogConnectorFactory.create(tenantId, {
      source: 'custom',
      catalogType: CATALOG_TYPES.PRODUCTS
    });

    await connector.connect();
    connectors.set(tenantId, connector);
    return connector;
  } catch (e) {
    console.warn(`[VoiceEcom] Failed to create connector for ${tenantId}:`, e.message);
    throw e;
  }
}

/**
 * Shopify GraphQL Admin API request
 */
async function shopifyGraphQL(store, token, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const options = {
      hostname: `${store}.myshopify.com`,
      port: 443,
      path: '/admin/api/2026-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(parsed.errors[0]?.message || 'Shopify API Error'));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error('Invalid Shopify response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Shopify API timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * WooCommerce REST API request
 */
async function woocommerceRequest(siteUrl, key, secret, endpoint) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const url = new URL(endpoint, siteUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `WooCommerce Error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid WooCommerce response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('WooCommerce API timeout'));
    });
    req.end();
  });
}

/**
 * Map fulfillment/order status to voice-friendly message
 */
function getVoiceFriendlyStatus(status, fulfillmentStatus, platform, lang = 'fr') {
  const statusMaps = {
    fr: {
      'FULFILLED': 'expédiée et en route vers vous', 'UNFULFILLED': 'confirmée et en cours de préparation',
      'PARTIALLY_FULFILLED': 'partiellement expédiée', 'PENDING': 'en attente de paiement',
      'PAID': 'payée et en cours de traitement', 'REFUNDED': 'remboursée', 'CANCELLED': 'annulée',
      'completed': 'livrée', 'processing': 'en cours de préparation', 'on-hold': 'en attente',
      'pending': 'en attente de paiement', 'cancelled': 'annulée', 'refunded': 'remboursée', 'failed': 'échouée'
    },
    en: {
      'FULFILLED': 'shipped and on its way', 'UNFULFILLED': 'confirmed and being prepared',
      'PARTIALLY_FULFILLED': 'partially shipped', 'PENDING': 'pending payment',
      'PAID': 'paid and being processed', 'REFUNDED': 'refunded', 'CANCELLED': 'cancelled',
      'completed': 'delivered', 'processing': 'being prepared', 'on-hold': 'on hold',
      'pending': 'pending payment', 'cancelled': 'cancelled', 'refunded': 'refunded', 'failed': 'failed'
    },
    es: {
      'FULFILLED': 'enviada y en camino', 'UNFULFILLED': 'confirmada y en preparación',
      'PARTIALLY_FULFILLED': 'parcialmente enviada', 'PENDING': 'pendiente de pago',
      'PAID': 'pagada y en proceso', 'REFUNDED': 'reembolsada', 'CANCELLED': 'cancelada',
      'completed': 'entregada', 'processing': 'en preparación', 'on-hold': 'en espera',
      'pending': 'pendiente de pago', 'cancelled': 'cancelada', 'refunded': 'reembolsada', 'failed': 'fallida'
    },
    ar: {
      'FULFILLED': 'تم شحنها وفي الطريق', 'UNFULFILLED': 'مؤكدة وقيد التحضير',
      'PARTIALLY_FULFILLED': 'شحنت جزئيا', 'PENDING': 'في انتظار الدفع',
      'PAID': 'مدفوعة وقيد المعالجة', 'REFUNDED': 'مستردة', 'CANCELLED': 'ملغاة',
      'completed': 'تم التسليم', 'processing': 'قيد التحضير', 'on-hold': 'في الانتظار',
      'pending': 'في انتظار الدفع', 'cancelled': 'ملغاة', 'refunded': 'مستردة', 'failed': 'فشلت'
    }
  };
  statusMaps.ary = statusMaps.ar; // Darija uses same status terms

  const map = statusMaps[lang] || statusMaps.fr;
  const fallbackMap = statusMaps.fr;

  const key = fulfillmentStatus || status;
  return map[key] || map[key?.toUpperCase()] || fallbackMap[key] || fallbackMap[key?.toUpperCase()] || `en statut ${status}`;
}

module.exports = {
  // Pure utility (exported for testing)
  getVoiceFriendlyStatus,

  /**
   * Check order status - PRODUCTION IMPLEMENTATION
   * Supports Shopify (GraphQL) and WooCommerce (REST)
   *
   * @param {string} email - Customer email (for verification)
   * @param {string} orderId - Order ID or order number
   * @param {string} tenantId - Tenant identifier
   * @param {string} lang - Language code (fr/en/es/ar/ary)
   */
  checkOrderStatus: async (email, orderId, tenantId, lang = 'fr') => {
    try {
      console.log(`[VoiceEcom] Checking order ${orderId} for ${email} (Tenant: ${tenantId})`);

      const msgs = {
        fr: { email_required: 'Veuillez fournir votre email pour vérifier la commande.', email_mismatch: 'Cette commande ne correspond pas à votre email.', order_status: (id, s) => `Votre commande ${id} est ${s}.`, not_found: 'Commande introuvable dans notre système.', no_creds: "Le suivi de commande n'est pas encore configuré pour ce marchand.", check_number: 'Commande introuvable. Veuillez vérifier le numéro de commande.' },
        en: { email_required: 'Please provide your email to verify the order.', email_mismatch: 'This order does not match your email.', order_status: (id, s) => `Your order ${id} is ${s}.`, not_found: 'Order not found in our system.', no_creds: 'Order tracking is not yet configured for this merchant.', check_number: 'Order not found. Please check the order number.' },
        es: { email_required: 'Por favor proporcione su email para verificar el pedido.', email_mismatch: 'Este pedido no corresponde a su email.', order_status: (id, s) => `Su pedido ${id} está ${s}.`, not_found: 'Pedido no encontrado en nuestro sistema.', no_creds: 'El seguimiento de pedidos no está configurado para este comerciante.', check_number: 'Pedido no encontrado. Verifique el número de pedido.' },
        ar: { email_required: 'يرجى تقديم بريدك الإلكتروني للتحقق من الطلب.', email_mismatch: 'هذا الطلب لا يتطابق مع بريدك الإلكتروني.', order_status: (id, s) => `طلبك ${id} حالته ${s}.`, not_found: 'الطلب غير موجود في نظامنا.', no_creds: 'تتبع الطلبات غير مفعل لهذا التاجر.', check_number: 'الطلب غير موجود. يرجى التحقق من رقم الطلب.' },
        ary: { email_required: 'عافاك دخل الإيميل ديالك باش نتأكدو من الطلبية.', email_mismatch: 'هاد الطلبية ما كتوافقش مع الإيميل ديالك.', order_status: (id, s) => `الطلبية ديالك ${id} ${s}.`, not_found: 'الطلبية ما لقيناهاش فالسيستيم.', no_creds: 'تتبع الطلبيات مازال ما تفعلش عند هاد التاجر.', check_number: 'الطلبية ما لقيناهاش. تأكد من رقم الطلبية.' }
      };
      const m = msgs[lang] || msgs.fr;

      const creds = await SecretVault.loadCredentials(tenantId);

      // Shopify (Primary E-commerce)
      const shopifyStore = creds.SHOPIFY_STORE || creds.SHOPIFY_SHOP_NAME;
      const shopifyToken = creds.SHOPIFY_ACCESS_TOKEN || creds.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (shopifyStore && shopifyToken) {
        try {
          // Clean store name (remove .myshopify.com if present)
          const store = shopifyStore.replace('.myshopify.com', '');

          // Query by order number (e.g., #1001) or ID
          const query = `
            query getOrderByNumber($query: String!) {
              orders(first: 1, query: $query) {
                edges {
                  node {
                    id
                    name
                    email
                    displayFinancialStatus
                    displayFulfillmentStatus
                    createdAt
                    totalPriceSet { shopMoney { amount currencyCode } }
                    fulfillments(first: 1) {
                      trackingInfo { number url company }
                      status
                    }
                  }
                }
              }
            }
          `;

          // Try order number format first, then raw ID
          const searchQuery = orderId.startsWith('#') ? `name:${orderId}` : `name:#${orderId}`;
          const response = await shopifyGraphQL(store, shopifyToken, query, { query: searchQuery });

          const orderEdge = response?.orders?.edges?.[0];
          if (orderEdge) {
            const order = orderEdge.node;

            // Verify email matches (security) — email REQUIRED to prevent order enumeration
            if (!email) {
              return { found: false, message: m.email_required };
            }
            if (order.email && order.email.toLowerCase() !== email.toLowerCase()) {
              console.warn(`[VoiceEcom] Email mismatch for order ${orderId}`);
              return { found: false, message: m.email_mismatch };
            }

            const tracking = order.fulfillments?.[0]?.trackingInfo?.[0];
            const statusMessage = getVoiceFriendlyStatus(order.displayFinancialStatus, order.displayFulfillmentStatus, 'shopify', lang);

            return {
              found: true,
              source: 'shopify',
              orderId: order.name,
              status: order.displayFulfillmentStatus || order.displayFinancialStatus,
              statusMessage: m.order_status(order.name, statusMessage),
              total: `${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`,
              createdAt: order.createdAt,
              tracking: tracking ? {
                number: tracking.number,
                url: tracking.url,
                carrier: tracking.company
              } : null
            };
          }

          return { found: false, source: 'shopify', message: m.not_found };
        } catch (shopifyError) {
          console.warn(`[VoiceEcom] Shopify lookup failed: ${shopifyError.message}`);
          // Fall through to WooCommerce
        }
      }

      // WooCommerce (Secondary E-commerce)
      const wooUrl = creds.WOOCOMMERCE_URL || creds.WOO_STORE_URL;
      const wooKey = creds.WOOCOMMERCE_KEY || creds.WOO_CONSUMER_KEY;
      const wooSecret = creds.WOOCOMMERCE_SECRET || creds.WOO_CONSUMER_SECRET;

      if (wooUrl && wooKey && wooSecret) {
        try {
          // Clean order ID (remove # if present)
          const cleanOrderId = orderId.replace('#', '');

          const order = await woocommerceRequest(wooUrl, wooKey, wooSecret, `/wp-json/wc/v3/orders/${cleanOrderId}`);

          // BL7 fix: Email REQUIRED for WooCommerce too (prevents order enumeration)
          if (!email) {
            return { found: false, message: m.email_required };
          }
          if (order.billing?.email && order.billing.email.toLowerCase() !== email.toLowerCase()) {
            console.warn(`[VoiceEcom] Email mismatch for WooCommerce order ${orderId}`);
            return { found: false, message: m.email_mismatch };
          }

          const statusMessage = getVoiceFriendlyStatus(order.status, null, 'woocommerce', lang);

          return {
            found: true,
            source: 'woocommerce',
            orderId: `#${order.id}`,
            status: order.status,
            statusMessage: m.order_status(`#${order.id}`, statusMessage),
            total: `${order.total} ${order.currency}`,
            createdAt: order.date_created,
            tracking: null // WooCommerce tracking depends on plugins
          };
        } catch (wooError) {
          console.warn(`[VoiceEcom] WooCommerce lookup failed: ${wooError.message}`);
        }
      }

      // No e-commerce credentials configured
      if (!shopifyStore && !wooUrl) {
        return {
          found: false,
          reason: 'no_credentials',
          message: m.no_creds
        };
      }

      return { found: false, message: m.check_number };

    } catch (error) {
      console.error('[VoiceEcom] Order check failed:', error);
      return { found: false, error: error.message };
    }
  },

  /**
   * Check product availability (Real Logic via CatalogConnector)
   */
  checkStock: async (productName, tenantId) => {
    try {
      console.log(`[VoiceEcom] Searching stock for: ${productName}`);

      const connector = await getConnector(tenantId);
      const products = await connector.search(productName, { limit: 1 });

      if (products && products.length > 0) {
        const product = products[0];
        return {
          found: true,
          name: product.name,
          price: product.price,
          inStock: product.in_stock !== false,
          stockLevel: product.stock || 'unknown',
          description: product.voice_description || product.description
        };
      }

      return { found: false };
    } catch (error) {
      console.error('[VoiceEcom] Stock check failed:', error);
      return { found: false, error: error.message };
    }
  },

  /**
   * Recommend products based on context
   */
  recommendProducts: async (category, tenantId) => {
    try {
      const connector = await getConnector(tenantId);
      const products = await connector.search(category, { limit: 3 });
      return products.map(p => ({
        name: p.name,
        price: p.price,
        id: p.id
      }));
    } catch (error) {
      return [];
    }
  },

  /**
   * Get order history for customer (last 5 orders)
   */
  getOrderHistory: async (email, tenantId) => {
    try {
      const creds = await SecretVault.loadCredentials(tenantId);

      // Shopify
      const shopifyStore = creds.SHOPIFY_STORE || creds.SHOPIFY_SHOP_NAME;
      const shopifyToken = creds.SHOPIFY_ACCESS_TOKEN || creds.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (shopifyStore && shopifyToken) {
        try {
          const store = shopifyStore.replace('.myshopify.com', '');
          const query = `
            query getCustomerOrders($query: String!) {
              orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    name
                    displayFulfillmentStatus
                    totalPriceSet { shopMoney { amount currencyCode } }
                    createdAt
                  }
                }
              }
            }
          `;

          const response = await shopifyGraphQL(store, shopifyToken, query, { query: `email:${email}` });
          const orders = response?.orders?.edges?.map(e => ({
            orderId: e.node.name,
            status: e.node.displayFulfillmentStatus,
            total: `${e.node.totalPriceSet.shopMoney.amount} ${e.node.totalPriceSet.shopMoney.currencyCode}`,
            date: e.node.createdAt
          })) || [];

          return { found: orders.length > 0, source: 'shopify', orders };
        } catch (e) {
          console.warn(`[VoiceEcom] Shopify order history failed: ${e.message}`);
        }
      }

      return { found: false, orders: [] };
    } catch (error) {
      console.error('[VoiceEcom] Order history failed:', error);
      return { found: false, orders: [], error: error.message };
    }
  },

  /**
   * Search products and return RAG-compatible snippets (Session 250.246: T7)
   *
   * Uses the REAL Shopify/WooCommerce connector when API credentials exist,
   * falls back to local catalog JSON when no credentials are available.
   * The source field in results indicates the actual data origin:
   *   - 'shopify_live' / 'woocommerce_live' = real API call
   *   - 'catalog_local' = local JSON file (data/catalogs/{tenantId}/products.json)
   *
   * @param {string} query - User's search query
   * @param {string} tenantId - Tenant identifier
   * @param {object} [options] - Search options
   * @param {number} [options.limit=3] - Max results
   * @param {object} [options.credentials] - Tenant API credentials (from SecretVault)
   * @returns {Promise<Array<{id: string, text: string, rrfScore: number, source: string}>>}
   */
  searchProductsForRAG: async (query, tenantId, options = {}) => {
    const limit = options.limit || 3;
    const creds = options.credentials || {};
    try {
      let connector;
      let source = 'catalog_local';

      // Use REAL API connector when credentials exist
      const shopifyStore = creds.SHOPIFY_STORE || creds.SHOPIFY_SHOP_NAME;
      const shopifyToken = creds.SHOPIFY_ACCESS_TOKEN || creds.SHOPIFY_ADMIN_ACCESS_TOKEN;
      const wooUrl = creds.WOOCOMMERCE_URL || creds.WOOCOMMERCE_STORE_URL;
      const wooKey = creds.WOOCOMMERCE_CONSUMER_KEY;
      const wooSecret = creds.WOOCOMMERCE_CONSUMER_SECRET;

      if (shopifyStore && shopifyToken) {
        connector = CatalogConnectorFactory.create(tenantId, {
          source: 'shopify',
          shop: shopifyStore.replace('.myshopify.com', ''),
          accessToken: shopifyToken,
        });
        source = 'shopify_live';
      } else if (wooUrl && wooKey && wooSecret) {
        connector = CatalogConnectorFactory.create(tenantId, {
          source: 'woocommerce',
          storeUrl: wooUrl,
          consumerKey: wooKey,
          consumerSecret: wooSecret,
        });
        source = 'woocommerce_live';
      } else {
        // Fallback: local catalog JSON (no live API)
        connector = await getConnector(tenantId);
        source = 'catalog_local';
      }

      if (source !== 'catalog_local') {
        const connected = await connector.connect();
        if (!connected) {
          // API connection failed — fallback to local
          console.warn(`[VoiceEcom] ${source} connection failed for ${tenantId}, falling back to local catalog`);
          connector = await getConnector(tenantId);
          source = 'catalog_local';
        }
      }

      const products = await connector.search(query, { limit });
      if (!products || products.length === 0) return [];

      return products.map(p => {
        const price = p.price ? `${p.price}${p.currency || '€'}` : '';
        const stock = p.in_stock !== false ? 'En stock' : 'Rupture';
        const desc = (p.voice_description || p.description || '').slice(0, 200);
        const text = [
          p.name,
          price ? `Prix: ${price}` : '',
          `Stock: ${stock}`,
          desc,
        ].filter(Boolean).join(' — ');

        return {
          id: `product_${source}_${p.id || p.name?.replace(/\s+/g, '_').slice(0, 30)}`,
          text,
          rrfScore: 0.5,
          source,
        };
      });
    } catch (e) {
      console.warn(`[VoiceEcom] RAG product search failed for ${tenantId}:`, e.message);
      return [];
    }
  }
};
