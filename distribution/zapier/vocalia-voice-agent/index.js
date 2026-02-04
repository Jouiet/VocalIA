const callLead = require('./creates/call_lead');

const addApiKeyToHeader = (request, z, bundle) => {
    request.headers['X-API-KEY'] = bundle.authData.apiKey;
    return request;
};

module.exports = {
    version: require('./package.json').version,
    platformVersion: require('zapier-platform-core').version,

    authentication: {
        type: 'custom',
        fields: [
            { key: 'apiKey', label: 'API Key', required: true, helpText: 'Your VocalIA API Key.' },
            { key: 'tenantId', label: 'Tenant ID', required: true, helpText: 'Your VocalIA Tenant ID.' }
        ],
        test: (z, bundle) => {
            // Simple auth test - usually hits a /me endpoint
            // For now, we assume if we can make a call it works, or we mock a test
            return { id: bundle.authData.tenantId, name: 'VocalIA User' };
        },
        connectionLabel: '{{bundle.authData.tenantId}}'
    },

    beforeRequest: [
        addApiKeyToHeader
    ],

    triggers: {},

    creates: {
        [callLead.key]: callLead
    }
};
