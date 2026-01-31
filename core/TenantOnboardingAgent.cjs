/**
 * TenantOnboardingAgent.cjs
 * VocalIA - Multi-Tenant Onboarding Automation
 *
 * Orchestrates the creation of new client environments.
 *
 * A2A Protocol Compliance: Agent Card + Task Lifecycle (Session 250.30)
 */

const fs = require('fs');
const path = require('path');
const AgencyEventBus = require('./AgencyEventBus.cjs');
const HubSpotB2BCRM = require('../integrations/hubspot-b2b-crm.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// A2A AGENT CARD (Google A2A Protocol Spec)
// https://a2a-protocol.org/latest/specification/
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_CARD = {
    name: "TenantOnboardingAgent",
    version: "1.1.0",
    description: "Automated multi-tenant environment provisioning and CRM synchronization",
    provider: {
        organization: "VocalIA",
        url: "https://vocalia.ma"
    },
    capabilities: {
        streaming: false,
        pushNotifications: true,
        stateTransitionHistory: true
    },
    skills: [
        {
            id: "directory_provisioning",
            name: "Directory Provisioning",
            description: "Creates client directory structure with config and credentials",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        },
        {
            id: "crm_sync",
            name: "CRM Synchronization",
            description: "Syncs tenant data to HubSpot CRM",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        },
        {
            id: "integration_setup",
            name: "Integration Setup",
            description: "Configures default integrations for new tenants",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        }
    ],
    authentication: {
        schemes: ["none"]
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"]
};

// A2A Task States
const TASK_STATES = {
    SUBMITTED: 'submitted',
    WORKING: 'working',
    INPUT_REQUIRED: 'input-required',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELED: 'canceled'
};

class TenantOnboardingAgent {
    constructor() {
        this.baseClientsDir = path.join(process.cwd(), '..', 'clients');
        this.taskHistory = new Map();
        console.log(`[TenantOnboardingAgent] A2A Agent Active - ${AGENT_CARD.name} v${AGENT_CARD.version}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A2A PROTOCOL METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * A2A: Get Agent Card (metadata about this agent)
     */
    getAgentCard() {
        return AGENT_CARD;
    }

    /**
     * A2A: Get task state history for a correlation ID
     */
    getTaskHistory(correlationId) {
        return this.taskHistory.get(correlationId) || [];
    }

    /**
     * A2A: Record task state transition
     */
    recordTaskState(correlationId, state, details = {}) {
        if (!this.taskHistory.has(correlationId)) {
            this.taskHistory.set(correlationId, []);
        }
        this.taskHistory.get(correlationId).push({
            state,
            timestamp: new Date().toISOString(),
            ...details
        });
        // Cleanup old entries (keep last 500)
        if (this.taskHistory.size > 500) {
            const firstKey = this.taskHistory.keys().next().value;
            this.taskHistory.delete(firstKey);
        }
    }

    /**
     * Onboard a new tenant
     */
    async onboardTenant(tenantData) {
        const { id, name, email, vertical, integrations = {} } = tenantData;
        const correlationId = `onboard_${id}_${Date.now()}`;

        // A2A: Record task submitted
        this.recordTaskState(correlationId, TASK_STATES.SUBMITTED, { tenantId: id, name });

        console.log(`[Onboarding] Starting onboarding for tenant: ${name} (${id})`);

        try {
            // A2A: Working - directory provisioning
            this.recordTaskState(correlationId, TASK_STATES.WORKING, { skill: 'directory_provisioning' });

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

            // A2A: Working - CRM sync
            this.recordTaskState(correlationId, TASK_STATES.WORKING, { skill: 'crm_sync' });

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

            // A2A: Completed
            this.recordTaskState(correlationId, TASK_STATES.COMPLETED, {
                action: 'tenant_onboarded',
                tenantId: id
            });

            console.log(`[Onboarding] Successfully onboarded tenant: ${id}`);
            return { success: true, tenantId: id, correlationId };

        } catch (error) {
            // A2A: Failed
            this.recordTaskState(correlationId, TASK_STATES.FAILED, {
                error: error.message,
                tenantId: id
            });

            console.error(`[Onboarding] Failed for ${id}: ${error.message}`);
            await AgencyEventBus.publish('system.error', {
                component: 'TenantOnboardingAgent',
                error: error.message,
                severity: 'high',
                tenantId: id
            }, { source: 'TenantOnboardingAgent' });
            return { success: false, error: error.message, correlationId };
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
