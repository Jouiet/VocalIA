#!/usr/bin/env node
/**
 * Lead Velocity Situational Receptor (Sensor)
 * 
 * Role: Non-agentic data fetcher. Monitors lead arrival rate.
 * Purpose: Decouples "Observation" from "Outreach/Sourcing".
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LEADS_PATH = path.join(__dirname, '../../../leads-scored.json');
const GPM_PATH = path.join(__dirname, '../../../landing-page-hostinger/data/pressure-matrix.json');

function calculatePressure(leads) {
    if (!leads || leads.length === 0) return 90; // High pressure if no leads exist

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Count leads arrived in last 24h
    const recentLeads = leads.filter(l => {
        const arrival = new Date(l.timestamp || now);
        return arrival >= twentyFourHoursAgo;
    });

    const leadCount = recentLeads.length;

    // Pressure Logic: 
    // < 2 leads/day = CRITICAL PRESSURE (90)
    // < 5 leads/day = HIGH PRESSURE (75)
    // > 10 leads/day = LOW PRESSURE (10)
    if (leadCount < 2) return 90;
    if (leadCount < 5) return 75;
    if (leadCount >= 10) return 10;
    return 40; // Neutral
}

function updateGPM(pressure, count) {
    if (!fs.existsSync(GPM_PATH)) return;

    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));

    gpm.sectors.sales = gpm.sectors.sales || {};
    gpm.sectors.sales.lead_velocity = {
        pressure: pressure,
        trend: pressure > (gpm.sectors.sales.lead_velocity ? gpm.sectors.sales.lead_velocity.pressure : 0) ? "UP" : "DOWN",
        last_check: new Date().toISOString(),
        sensor_data: { leads_last_24h: count }
    };

    gpm.last_updated = new Date().toISOString();
    fs.writeFileSync(GPM_PATH, JSON.stringify(gpm, null, 2));
    console.log(`📡 GPM Updated: Sales Pressure (Lead Velocity) is ${pressure} (Leads: ${count})`);
}

async function main() {
    // Handle --health check - REAL DATA TEST (added Session 168quaterdecies)
    if (process.argv.includes('--health')) {
        const health = {
            status: 'checking',
            sensor: 'lead-velocity-sensor',
            version: '1.1.0',
            leads_path: LEADS_PATH,
            leads_exists: fs.existsSync(LEADS_PATH),
            gpm_path: GPM_PATH,
            gpm_exists: fs.existsSync(GPM_PATH),
            metrics: ['leads_24h', 'total_leads', 'velocity'],
            timestamp: new Date().toISOString()
        };

        if (!fs.existsSync(LEADS_PATH)) {
            health.status = 'warning';
            health.data_test = 'no_data';
            health.note = 'No leads file - sensor will report high pressure';
        } else {
            try {
                const data = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
                const leads = Array.isArray(data) ? data : (data.scores || []);
                health.status = 'ok';
                health.data_test = 'passed';
                health.total_leads = leads.length;
            } catch (e) {
                health.status = 'error';
                health.data_test = 'failed';
                health.error = e.message;
            }
        }

        console.log(JSON.stringify(health, null, 2));
        process.exit(health.status === 'error' ? 1 : 0);
        return;
    }

    try {
        let leads = [];
        if (fs.existsSync(LEADS_PATH)) {
            const data = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
            // Handle both formats: direct array OR {scores: [...]}
            leads = Array.isArray(data) ? data : (data.scores || []);
        }

        const pressure = calculatePressure(leads);
        updateGPM(pressure, leads.length);
    } catch (e) {
        console.error("Sensor Failure:", e.message);
    }
}

main();
