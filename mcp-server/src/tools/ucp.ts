import { z } from 'zod';
import { tenantMiddleware } from '../middleware/tenant.js';

export const ucpTools = {
    ucp_sync_preference: {
        name: 'ucp_sync_preference',
        description: 'Sync user preferences enforcing Tenant Market Rules (Maroc/Europe/International). Returns the enforced profile.',
        parameters: {
            countryCode: z.string().describe('ISO Country Code (e.g. MA, FR, US)'),
            userId: z.string().optional().describe('User ID if available'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Meta context for tenancy')
        },
        handler: async (args: any) => {
            // 1. Resolve Tenant Context
            const tenant = await tenantMiddleware(args);
            const config = tenant.config;

            const countryCode = args.countryCode || 'US';
            const code = countryCode.toUpperCase();

            // 2. Apply Tenant-Specific Market Rules
            // If agency_internal, it uses Strict Rules.
            // If client_demo, it uses its own rules.

            let rule;

            if (config.marketRules.strict) {
                // Use exact match or default
                rule = config.marketRules.markets[code] || config.marketRules.default;
            } else {
                // Lax rules (default to main market)
                rule = config.marketRules.default;
            }

            const profile = {
                userId: args.userId || 'anonymous',
                tenantId: tenant.id,
                country: code,
                market: rule.id,
                locale: rule.lang,
                currency: rule.currency,
                currencySymbol: rule.symbol,
                enforced: true,
                timestamp: new Date().toISOString()
            };

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        message: `Profile synced for ${code} on tenant ${tenant.name}`,
                        profile
                    }, null, 2)
                }]
            };
        }
    },

    ucp_get_profile: {
        name: 'ucp_get_profile',
        description: 'Get current UCP profile',
        parameters: {
            userId: z.string(),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        userId: args.userId,
                        tenant: tenant.name,
                        status: "not_found",
                        hint: "Use ucp_sync_preference to create a profile first."
                    }, null, 2)
                }]
            };
        }
    }
};
