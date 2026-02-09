/**
 * VocalIA - Klaviyo Integration v1.0.0
 * 
 * Marketing Automation & Email triggers.
 * Implements "Sovereign" fetch-based wrapper to avoid heavy dependencies.
 * 
 * Supports:
 * - List Subscription (Newsletters)
 * - Event Tracking (Custom Events)
 * - Profile Creation/Update
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

const { SecretVault } = require('../core/SecretVault.cjs');

class KlaviyoIntegration {
    constructor(apiKey = null, tenantId = 'agency_internal') {
        this.apiKey = apiKey;
        this.tenantId = tenantId;
        this.baseUrl = 'https://a.klaviyo.com/api';
        this.revision = '2024-02-15'; // Specific revision to ensure stability
    }

    /**
     * Initialize and load credentials if not provided
     */
    async init() {
        if (!this.apiKey) {
            const creds = await SecretVault.loadCredentials(this.tenantId);
            this.apiKey = creds.KLAVIYO_API_KEY || process.env.KLAVIYO_API_KEY;
        }

        if (!this.apiKey) {
            console.warn(`[Klaviyo] No API Key found for tenant ${this.tenantId}`);
            return false;
        }
        return true;
    }

    /**
     * Universal fetch wrapper with Authorization
     */
    async _request(method, endpoint, body = null) {
        if (!this.apiKey) await this.init();
        if (!this.apiKey) throw new Error('Klaviyo API Key missing');

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
            'accept': 'application/json',
            'content-type': 'application/json',
            'revision': this.revision
        };

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Klaviyo API Error ${response.status}: ${errorText}`);
        }

        // Some endpoints return 204 No Content
        if (response.status === 204) return true;

        return response.json();
    }

    /**
     * Create or Update a Profile
     * @param {Object} attributes - Profile attributes (email, phone_number, properties)
     */
    async createProfile(attributes) {
        const payload = {
            data: {
                type: 'profile',
                attributes: {
                    email: attributes.email,
                    phone_number: attributes.phone_number,
                    first_name: attributes.first_name,
                    last_name: attributes.last_name,
                    organization: attributes.organization,
                    title: attributes.title,
                    image: attributes.image,
                    location: attributes.location,
                    properties: attributes.properties || {}
                }
            }
        };

        console.log(`[Klaviyo] Creating profile for ${attributes.email}`);
        return this._request('POST', '/profiles', payload);
    }

    /**
     * Track an Event (Metric)
     * @param {string} metricName - Name of the event (e.g. "Voice Call Completed")
     * @param {Object} profile - Profile identifiers (email or phone)
     * @param {Object} properties - Event data
     */
    async trackEvent(metricName, profile, properties = {}) {
        const payload = {
            data: {
                type: 'event',
                attributes: {
                    properties: properties,
                    metric: {
                        data: {
                            type: 'metric',
                            attributes: {
                                name: metricName
                            }
                        }
                    },
                    profile: {
                        data: {
                            type: 'profile',
                            attributes: profile
                            // { email: '...' } or { phone_number: '...' }
                        }
                    }
                }
            }
        };

        console.log(`[Klaviyo] Tracking event: ${metricName}`);
        return this._request('POST', '/events', payload);
    }

    /**
     * Subscribe Profile to List
     * @param {string} listId - Klaviyo List ID
     * @param {Object} profile - Profile attributes (must include email)
     */
    async subscribeToList(listId, profile) {
        const payload = {
            data: {
                type: 'profile-subscription-bulk-create-job',
                attributes: {
                    profiles: {
                        data: [
                            {
                                type: 'profile',
                                attributes: {
                                    email: profile.email,
                                    phone_number: profile.phone_number,
                                    first_name: profile.first_name,
                                    last_name: profile.last_name
                                }
                            }
                        ]
                    }
                },
                relationships: {
                    list: {
                        data: {
                            type: 'list',
                            id: listId
                        }
                    }
                }
            }
        };

        console.log(`[Klaviyo] Subscribing ${profile.email} to list ${listId}`);
        return this._request('POST', '/profile-subscription-bulk-create-jobs', payload);
    }
}

// Singleton Factory
async function createForTenant(tenantId) {
    const instance = new KlaviyoIntegration(null, tenantId);
    await instance.init();
    return instance;
}

module.exports = {
    KlaviyoIntegration,
    createForTenant
};
