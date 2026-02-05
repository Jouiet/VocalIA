/**
 * voice-ecommerce-tools.cjs
 * VocalIA - Session 250.81
 * 
 * BRIDGE: Connects Voice API to the Real Catalog Connector.
 * REPLACES: The previous "ECOM_TOOLS" mock.
 */

const { CatalogConnectorFactory, CATALOG_TYPES } = require('./catalog-connector.cjs');

// Cache connectors per tenant to avoid reconnection overhead (Session 250.81 optimization)
const connectors = new Map();

async function getConnector(tenantId) {
    if (connectors.has(tenantId)) return connectors.get(tenantId);

    // Default to 'custom' source for general tenants until explicit config loaded from SecretVault
    // In a full implementation, we would read the tenant's preferred source (Shopify/Woo/etc)
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

module.exports = {
    /**
     * Check order status (Real Logic)
     */
    checkOrderStatus: async (email, orderId, tenantId) => {
        try {
            console.log(`[VoiceEcom] Checking order ${orderId} for ${email} (Tenant: ${tenantId})`);

            const connector = await getConnector(tenantId);
            // Ideally call connector.getOrder(orderId) if supported

            return {
                found: false,
                status: 'unknown',
                message: "La connexion aux commandes n'est pas encore active pour ce client."
            };
        } catch (error) {
            console.error('[VoiceEcom] Order check failed:', error);
            return { found: false, error: 'Service unavailable' };
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
            // Assuming connector has search or getProductsByCategory
            const products = await connector.search(category, { limit: 3 });
            return products.map(p => ({
                name: p.name,
                price: p.price,
                id: p.id
            }));
        } catch (error) {
            return [];
        }
    }
};
