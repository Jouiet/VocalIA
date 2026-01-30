import { z } from 'zod';

const MARKET_RULES: Record<string, any> = {
    // 1. MAROC
    MA: { id: 'maroc', lang: 'fr', currency: 'MAD', symbol: 'DH', label: 'Maroc' },

    // 2. EUROPE & MAGHREB (Strict: FR + EUR)
    DZ: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    TN: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    FR: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    BE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    CH: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    LU: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    DE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    IT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    ES: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    PT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    NL: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },

    // 3. MENA (Gulf)
    AE: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    SA: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    QA: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    KW: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    BH: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    OM: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    EG: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    JO: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    LB: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    IQ: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },

    // Defaults
    DEFAULT_INTL: { id: 'intl', lang: 'en', currency: 'USD', symbol: '$', label: 'International' }
};

export const ucpTools = {
    ucp_sync_preference: {
        name: 'ucp_sync_preference',
        description: 'Sync user preferences enforcing Strict Market Rules (Maroc/Europe/International). Returns the enforced profile.',
        parameters: {
            countryCode: z.string().describe('ISO Country Code (e.g. MA, FR, US)'),
            userId: z.string().optional().describe('User ID if available')
        },
        handler: async ({ countryCode, userId }: { countryCode: string, userId?: string }) => {
            const code = countryCode.toUpperCase();
            const config = MARKET_RULES[code] || MARKET_RULES.DEFAULT_INTL;

            const profile = {
                userId: userId || 'anonymous',
                country: code,
                market: config.id,
                locale: config.lang,
                currency: config.currency,
                currencySymbol: config.symbol,
                enforced: true,
                timestamp: new Date().toISOString()
            };

            // In a real implementation, this would save to a database.
            // For now, we return the enforced profile for the Agent context.

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        message: `Profile synced for ${code}`,
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
            userId: z.string()
        },
        handler: async ({ userId }: { userId: string }) => {
            // Mock retrieval
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        userId,
                        status: "not_found",
                        hint: "Use ucp_sync_preference to create a profile first."
                    }, null, 2)
                }]
            };
        }
    }
};
