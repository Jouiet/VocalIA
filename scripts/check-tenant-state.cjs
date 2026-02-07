/**
 * CHECK TENANT STATE
 */
const path = require('path');
const { GoogleSheetsDB } = require(path.join(__dirname, '..', 'core', 'GoogleSheetsDB.cjs'));

async function check() {
    const db = new GoogleSheetsDB();
    await db.init();
    const tenants = await db.findAll('tenants');

    // Check how many have friendly IDs vs UUID IDs
    const uuidPattern = /^[0-9a-f]{8}$/;
    const friendly = tenants.filter(t => !uuidPattern.test(t.id));
    const uuid = tenants.filter(t => uuidPattern.test(t.id));

    console.log('=== TENANT STATE ===');
    console.log('Total:', tenants.length);
    console.log('Friendly IDs:', friendly.length);
    console.log('UUID IDs:', uuid.length);
    console.log('');

    // Widget distribution
    const widgetDist = {};
    for (const t of tenants) {
        const wt = t.widget_type || 'unknown';
        widgetDist[wt] = (widgetDist[wt] || 0) + 1;
    }
    console.log('=== WIDGET DISTRIBUTION ===');
    console.log(JSON.stringify(widgetDist, null, 2));
    console.log('');

    // Sector distribution
    const sectorDist = {};
    for (const t of tenants) {
        const s = t.sector || 'unknown';
        sectorDist[s] = (sectorDist[s] || 0) + 1;
    }
    console.log('=== SECTOR DISTRIBUTION ===');
    console.log('Total sectors:', Object.keys(sectorDist).length);
    const sorted = Object.entries(sectorDist).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

check().catch(console.error);
