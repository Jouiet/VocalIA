#!/usr/bin/env node
/**
 * VocalIA - Sync GPM to 3A Central
 *
 * Role: Syncs local GPM to 3A central pressure matrix (Twin Sovereignty)
 * Architecture: VocalIA → 3A Central GPM (subsidiaries.vocalia)
 *
 * Version: 1.0.0 | Phase 23 | 23/02/2026
 */

const fs = require('fs');
const path = require('path');

const STORE_ID = 'vocalia';
const STORE_NAME = 'VocalIA';
const LOCAL_GPM_PATH = path.join(__dirname, '../data/pressure-matrix.json');
const CENTRAL_GPM_PATH = process.env.CENTRAL_GPM_PATH ||
    '/Users/mac/Desktop/JO-AAA/landing-page-hostinger/data/pressure-matrix.json';

function syncToCentral() {
    console.log(`Syncing ${STORE_NAME} GPM to 3A Central...`);

    if (!fs.existsSync(LOCAL_GPM_PATH)) {
        console.log('Local GPM not found. Run sensors first.');
        return { success: false, error: 'Local GPM not found' };
    }

    let localGPM;
    try {
        localGPM = JSON.parse(fs.readFileSync(LOCAL_GPM_PATH, 'utf8'));
    } catch (e) {
        console.error(`Failed to read local GPM: ${e.message}`);
        return { success: false, error: e.message };
    }

    if (!fs.existsSync(CENTRAL_GPM_PATH)) {
        console.log('Central GPM not found at:', CENTRAL_GPM_PATH);
        return { success: false, error: 'Central GPM not found' };
    }

    let centralGPM;
    try {
        centralGPM = JSON.parse(fs.readFileSync(CENTRAL_GPM_PATH, 'utf8'));
    } catch (e) {
        console.error(`Failed to read central GPM: ${e.message}`);
        return { success: false, error: e.message };
    }

    centralGPM.subsidiaries = centralGPM.subsidiaries || {};
    centralGPM.subsidiaries[STORE_ID] = {
        name: STORE_NAME,
        overall_pressure: localGPM.overall_pressure,
        sectors: localGPM.sectors || {},
        last_sync: new Date().toISOString(),
        source: 'sensors/sync-to-3a.cjs'
    };

    // Recalculate central overall pressure
    const allPressures = [];
    if (centralGPM.sectors) {
        for (const sector of Object.values(centralGPM.sectors)) {
            for (const metric of Object.values(sector)) {
                if (metric && typeof metric.pressure === 'number') {
                    allPressures.push(metric.pressure);
                }
            }
        }
    }
    if (centralGPM.subsidiaries) {
        for (const sub of Object.values(centralGPM.subsidiaries)) {
            if (sub && typeof sub.overall_pressure === 'number') {
                allPressures.push(sub.overall_pressure);
            }
        }
    }

    if (allPressures.length > 0) {
        centralGPM.overall_pressure = Math.round(
            allPressures.reduce((a, b) => a + b, 0) / allPressures.length
        );
    }

    centralGPM.last_updated = new Date().toISOString();

    try {
        fs.writeFileSync(CENTRAL_GPM_PATH, JSON.stringify(centralGPM, null, 2));
        console.log(`[OK] ${STORE_NAME} synced to 3A Central GPM`);
        console.log(`   Local pressure: ${localGPM.overall_pressure}`);
        console.log(`   Sectors synced: ${Object.keys(localGPM.sectors || {}).length}`);
        console.log(`   Central overall: ${centralGPM.overall_pressure}`);
        return { success: true, centralPressure: centralGPM.overall_pressure };
    } catch (e) {
        console.error(`Failed to write central GPM: ${e.message}`);
        return { success: false, error: e.message };
    }
}

if (require.main === module) {
  if (process.argv.includes('--health')) {
    console.log('Sync-to-3A: OK');
    console.log(`   Local GPM: ${fs.existsSync(LOCAL_GPM_PATH) ? 'Found' : 'Missing'}`);
    console.log(`   Central GPM: ${fs.existsSync(CENTRAL_GPM_PATH) ? 'Found' : 'Missing'}`);
    console.log(`   Store ID: ${STORE_ID}`);
    process.exit(0);
  }

  const result = syncToCentral();
  process.exit(result.success ? 0 : 1);
}

module.exports = { syncToCentral };
