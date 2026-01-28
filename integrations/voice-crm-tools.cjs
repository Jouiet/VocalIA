#!/usr/bin/env node
/**
 * Voice CRM Tools - 3A Automation
 * 
 * Purpose: Bridge between Voice API and HubSpot CRM for real-time history RAG.
 * Features:
 * - Get customer context (name, last deal, active tickets)
 * - Format context for Voice AI prompt injection
 * - Handle returning customer recognition
 */

const fs = require('fs');
const path = require('path');
const { HubSpotB2BCRM } = require('./hubspot-b2b-crm.cjs');

class VoiceCRMTools {
    constructor() {
        this.crm = new HubSpotB2BCRM();
    }

    /**
     * Get consolidated context for a customer by email
     * @param {string} email 
     */
    async getCustomerContext(email) {
        if (!email) return { found: false };

        try {
            // 1. Search for contact
            const contacts = await this.crm.searchContacts({ email });
            if (!contacts || contacts.length === 0) {
                return { found: false, email };
            }

            const contact = contacts[0];
            const contactId = contact.id;
            const props = contact.properties;

            // 2. Format basic info
            const context = {
                found: true,
                id: contactId,
                firstName: props.firstname || 'Client',
                lastName: props.lastname || '',
                fullName: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
                company: props.company || 'Unknown',
                leadStatus: props.hs_lead_status || 'New',
                score: props.lead_score || 0
            };

            // 3. Try to find recent deals (Simulated call or fetch if supported by basic crm)
            // For now, we use the default properties returned by search
            if (props.recent_deal_amount) {
                context.lastDeal = {
                    amount: props.recent_deal_amount,
                    date: props.recent_deal_close_date
                };
            }

            return context;
        } catch (error) {
            console.error(`[CRM Tools] Error fetching context for ${email}:`, error.message);
            return { found: false, error: error.message };
        }
    }

    /**
     * Format context for Voice AI injection
     */
    formatForVoice(context) {
        if (!context || !context.found) return "";

        let summary = `\nCRM_CUSTOMER_HISTORY (Verified):\n`;
        summary += `- Name: ${context.fullName}\n`;
        if (context.company) summary += `- Company: ${context.company}\n`;
        summary += `- Status: ${context.leadStatus} (Score: ${context.score})\n`;

        if (context.lastDeal) {
            summary += `- Recent Interaction: Closed a deal of ${context.lastDeal.amount}€ on ${context.lastDeal.date}.\n`;
        }

        summary += `- Note: This is a returning customer. Acknowledge them warmly but maintain professional boundaries.\n`;

        return summary;
    }
}

module.exports = new VoiceCRMTools();

// CLI Test
if (require.main === module) {
    const email = process.argv[2];
    if (!email) {
        console.log("Usage: node voice-crm-tools.cjs <email>");
        process.exit(1);
    }

    const tools = new VoiceCRMTools();
    (async () => {
        const ctx = await tools.getCustomerContext(email);
        console.log("Context Collected:", JSON.stringify(ctx, null, 2));
        console.log("Formatted Prompt Chunk:", tools.formatForVoice(ctx));
    })();
}
