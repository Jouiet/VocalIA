import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

// Import RecommendationService via createRequire (CommonJS module)
const require = createRequire(import.meta.url);
let RecommendationService: any = null;

try {
    const servicePath = path.join(process.cwd(), '..', 'core', 'recommendation-service.cjs');
    RecommendationService = require(servicePath);
} catch (e) {
    console.error("Failed to load RecommendationService:", e);
}

export const recommendationTools = {
    get_similar_products: {
        name: 'recommendation_get_similar',
        description: 'Get similar items based on vector embeddings (Content-Based Filtering)',
        parameters: {
            productId: z.string().describe('Source item ID'),
            limit: z.number().optional().describe('Number of recommendations (default: 5)'),
            _meta: z.object({ tenantId: z.string().optional(), persona: z.string().optional() }).optional().describe('Tenant and Persona context')
        },
        handler: async ({ productId, limit = 5, _meta }: { productId: string, limit?: number, _meta?: { tenantId?: string, persona?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const persona = _meta?.persona || 'UNIVERSAL_ECOMMERCE';
            try {
                if (!RecommendationService) {
                    throw new Error("RecommendationService not loaded");
                }

                const recommendations = await RecommendationService.getSimilarProducts(tenantId, productId, { topK: limit });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            source_product: productId,
                            count: recommendations.length,
                            recommendations
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

    get_frequently_bought_together: {
        name: 'recommendation_get_frequently_bought_together',
        description: 'Get items frequently selected together (Association Rules)',
        parameters: {
            productId: z.string().describe('Source item ID'),
            limit: z.number().optional().describe('Number of recommendations (default: 5)'),
            _meta: z.object({ tenantId: z.string().optional(), persona: z.string().optional() }).optional().describe('Tenant and Persona context')
        },
        handler: async ({ productId, limit = 5, _meta }: { productId: string, limit?: number, _meta?: { tenantId?: string, persona?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const persona = _meta?.persona || 'UNIVERSAL_ECOMMERCE';
            try {
                if (!RecommendationService) {
                    throw new Error("RecommendationService not loaded");
                }

                const recommendations = await RecommendationService.getFrequentlyBoughtTogether(tenantId, productId, limit);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            source_product: productId,
                            count: recommendations.length,
                            recommendations
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

    get_personalized: {
        name: 'recommendation_get_personalized',
        description: 'Get personalized recommendations for a user based on history and profile',
        parameters: {
            userId: z.string().describe('User ID'),
            recentlyViewed: z.array(z.string()).optional().describe('List of recently viewed item IDs'),
            recentlyPurchased: z.array(z.string()).optional().describe('List of recently purchased/booked item IDs'),
            limit: z.number().optional().describe('Number of recommendations (default: 10)'),
            _meta: z.object({ tenantId: z.string().optional(), persona: z.string().optional() }).optional().describe('Tenant and Persona context')
        },
        handler: async ({ userId, recentlyViewed, recentlyPurchased, limit = 10, _meta }: { userId: string, recentlyViewed?: string[], recentlyPurchased?: string[], limit?: number, _meta?: { tenantId?: string, persona?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const persona = _meta?.persona || 'UNIVERSAL_ECOMMERCE';
            try {
                if (!RecommendationService) {
                    throw new Error("RecommendationService not loaded");
                }

                // In a real scenario, we might fetch UCP profile here if not passed.
                // For now we assume the service handles fetching or works with minimal context.
                // The MCP tool doesn't easily accept the full UCP object, so we pass IDs.
                // Using a mock UCP profile or fetching it from UCP service would be better.
                // We'll rely on what's passed.

                const ucpProfile = {
                    // Minimal stub if needed, but the service handles missing profile gracefully
                };

                const recommendations = await RecommendationService.getPersonalizedRecommendations(
                    tenantId,
                    userId,
                    ucpProfile,
                    {
                        topK: limit,
                        recentlyViewed: recentlyViewed || [],
                        recentlyPurchased: recentlyPurchased || []
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            user_id: userId,
                            count: recommendations.length,
                            recommendations
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

    learn_from_orders: {
        name: 'recommendation_learn_from_orders',
        description: 'Trigger learning of association rules from order history',
        parameters: {
            orders: z.array(z.object({
                items: z.array(z.object({
                    product_id: z.string()
                })).optional(),
                line_items: z.array(z.object({
                    productId: z.string()
                })).optional()
            })).describe('List of orders with items'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context')
        },
        handler: async ({ orders, _meta }: { orders: any[], _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                if (!RecommendationService) {
                    throw new Error("RecommendationService not loaded");
                }

                const result = await RecommendationService.learnFromOrders(tenantId, orders);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            ...result
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
