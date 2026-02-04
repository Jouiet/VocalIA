// Zapier Action: Call Lead
const perform = async (z, bundle) => {
    const response = await z.request({
        method: 'POST',
        url: 'https://api.vocalia.ma/api/trigger-call',
        body: {
            phone: bundle.inputData.phone,
            name: bundle.inputData.name,
            tenantId: bundle.authData.tenantId, // From Auth
            context: {
                source: 'Zapier',
                campaign: bundle.inputData.campaign,
                notes: bundle.inputData.notes
            }
        }
    });

    return response.data;
};

module.exports = {
    key: 'call_lead',
    noun: 'Call',
    display: {
        label: 'Call Lead',
        description: 'Triggers an immediate AI Voice call to a new lead.'
    },
    operation: {
        inputFields: [
            { key: 'phone', label: 'Phone Number', required: true, helpText: 'The number to call (E.164 format).' },
            { key: 'name', label: 'Lead Name', required: true },
            { key: 'campaign', label: 'Campaign Name', required: false },
            { key: 'notes', label: 'Context Notes', required: false, helpText: 'Context for the AI Agent (e.g. "Interested in Pricing")' }
        ],
        perform: perform,
        sample: {
            success: true,
            callSid: 'CA1234567890abcdef',
            status: 'queued'
        }
    }
};
