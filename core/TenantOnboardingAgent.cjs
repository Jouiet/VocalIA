/**
 * TenantOnboardingAgent.cjs
 * VocalIA - Multi-Tenant Onboarding Automation
 *
 * Orchestrates the creation of new client environments.
 */

const fs = require('fs');
const path = require('path');
const AgencyEventBus = require('./AgencyEventBus.cjs');
const HubSpotB2BCRM = require('../integrations/hubspot-b2b-crm.cjs');

class TenantOnboardingAgent {
    constructor() {
        this.baseClientsDir = path.join(process.cwd(), '..', 'clients');
    }

    /**
     * Onboard a new tenant
     */
    async onboardTenant(tenantData) {
        const { id, name, email, vertical, integrations = {} } = tenantData;

        console.log(`[Onboarding] Starting onboarding for tenant: ${name} (${id})`);

        try {
            // 1. Create directory structure
            this._createClientDirectory(id);

            // 2. Generate config.json
            const config = {
                id,
                name,
                vertical,
                status: 'onboarding',
                created_at: new Date().toISOString(),
                integrations: {
                    ...integrations,
                    vocalia_widget: { enabled: true }
                }
            };
            fs.writeFileSync(path.join(this.baseClientsDir, id, 'config.json'), JSON.stringify(config, null, 2));

            // 3. Generate initial credentials.json (placeholders)
            const credentials = {
                HUBSPOT_ACCESS_TOKEN: '',
                STRIPE_SECRET_KEY: '',
                TWILIO_ACCOUNT_SID: ''
            };
            fs.writeFileSync(path.join(this.baseClientsDir, id, 'credentials.json'), JSON.stringify(credentials, null, 2));

            // 4. Sync to HubSpot
            await HubSpotB2BCRM.upsertContact({
                email,
                firstname: name.split(' ')[0],
                lastname: name.split(' ').slice(1).join(' ') || 'Client',
                company: name,
                hs_lead_status: 'SUBSCRIBER'
            });

            // 5. Emit event
            await AgencyEventBus.publish('tenant.created', {
                tenantId: id,
                name,
                vertical
            }, { source: 'TenantOnboardingAgent' });

            console.log(`[Onboarding] Successfully onboarded tenant: ${id}`);
            return { success: true, tenantId: id };

        } catch (error) {
            console.error(`[Onboarding] Failed for ${id}: ${error.message}`);
            await AgencyEventBus.publish('system.error', {
                component: 'TenantOnboardingAgent',
                error: error.message,
                severity: 'high',
                tenantId: id
            }, { source: 'TenantOnboardingAgent' });
            return { success: false, error: error.message };
        }
    }

    _createClientDirectory(tenantId) {
        const tenantDir = path.join(this.baseClientsDir, tenantId);
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
            console.log(`[Onboarding] Created directory: ${tenantDir}`);
        }
    }
}

module.exports = new TenantOnboardingAgent();
