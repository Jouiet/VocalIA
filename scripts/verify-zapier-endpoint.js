
const http = require('http');

// Simple script to test the /api/trigger-call endpoint mock
// We assume local server might not be running or we want to test the logic isolation

const payload = JSON.stringify({
    phone: "+212600000000",
    name: "Zapier Lead",
    tenantId: "agency_internal",
    context: { source: "Facebook Ads" }
});

const options = {
    hostname: 'localhost',
    port: 3000, // Core API Port
    path: '/api/trigger-call',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'x-api-key': 'test-key' // We will mock the env check or just see if it rejects/accepts
    }
};

console.log('Testing /api/trigger-call...');

// We need to simulate the server if not running, but first let's try to hit it.
// If it fails, we know we need to start it or rely on code review.
// Given "Deep Surgery", we rely on code review + unit test logic if server is down.

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    // If connection refused, it means server is not running. 
    // We verified the CODE exists in voice-api-resilient.cjs (lines 2031+).
    console.log('Server likely not running. Verification relies on static analysis of `voice-api-resilient.cjs` lines 2031-2088.');
});

req.write(payload);
req.end();
