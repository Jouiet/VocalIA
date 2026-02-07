/**
 * FIX TENANT SECTOR MAPPING
 * Session 250.97octies - Correct sector field for all tenants
 */

const path = require('path');
const { GoogleSheetsDB } = require(path.join(__dirname, '..', 'core', 'GoogleSheetsDB.cjs'));

// Mapping from client_id prefix to sector
const SECTOR_MAP = {
    'agency': 'AGENCY', 'dental': 'DENTAL', 'property': 'PROPERTY',
    'contractor': 'CONTRACTOR', 'healer': 'HEALER',
    'counselor': 'COUNSELOR', 'concierge': 'CONCIERGE',
    'stylist': 'STYLIST', 'recruiter': 'RECRUITER', 'dispatcher': 'DISPATCHER',
    'collector': 'COLLECTOR', 'insurer': 'INSURER', 'accountant': 'ACCOUNTANT',
    'architect': 'ARCHITECT', 'pharmacist': 'PHARMACIST', 'renter': 'RENTER',
    'logistician': 'LOGISTICIAN', 'trainer': 'TRAINER', 'planner': 'PLANNER',
    'producer': 'PRODUCER', 'cleaner': 'CLEANER', 'gym': 'GYM',
    'universal_ecommerce': 'UNIVERSAL_ECOMMERCE', 'universal_sme': 'UNIVERSAL_SME',
    'retailer': 'RETAILER', 'builder': 'BUILDER', 'restaurateur': 'RESTAURATEUR',
    'travel_agent': 'TRAVEL_AGENT', 'consultant': 'CONSULTANT', 'it_services': 'IT_SERVICES',
    'manufacturer': 'MANUFACTURER', 'doctor': 'DOCTOR', 'notary': 'NOTARY',
    'bakery': 'BAKERY', 'specialist': 'SPECIALIST', 'real_estate_agent': 'REAL_ESTATE_AGENT',
    'hairdresser': 'HAIRDRESSER', 'grocery': 'GROCERY',
    // Legacy mappings
    'immo': 'PROPERTY', 'event': 'PLANNER', 'insurance': 'INSURER',
    'legal': 'COUNSELOR', 'logistics': 'LOGISTICIAN', 'notaire': 'NOTARY',
    'dentist': 'DENTAL', 'hotel': 'CONCIERGE', 'restaurant': 'RESTAURATEUR',
    'salon': 'HAIRDRESSER', 'spa': 'HEALER', 'travel': 'TRAVEL_AGENT',
    'sports': 'RETAILER', 'organic': 'PRODUCER', 'kids': 'RETAILER',
    'furniture': 'RETAILER', 'fashion': 'RETAILER', 'electronics': 'RETAILER',
    'darija': 'UNIVERSAL_ECOMMERCE', 'beauty': 'STYLIST', 'artisan': 'PRODUCER'
};

function extractSectorFromId(clientId) {
    if (!clientId) return null;

    // Remove prefix (b2b_, b2c_, ecom_)
    let key = clientId.replace(/^(b2b_|b2c_|ecom_)/, '');

    // Try direct match
    for (const [pattern, sector] of Object.entries(SECTOR_MAP)) {
        if (key.startsWith(pattern)) {
            return sector;
        }
    }

    // Try extracting from first part
    const parts = key.split('_');
    for (const part of parts) {
        if (SECTOR_MAP[part]) {
            return SECTOR_MAP[part];
        }
    }

    return null;
}

async function fixSectors() {
    console.log('🔧 Fixing tenant sector mappings...\n');

    const db = new GoogleSheetsDB();
    await db.init();

    const tenants = await db.findAll('tenants');
    console.log(`Found ${tenants.length} tenants\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
        // Skip if sector already correctly set (not UNIVERSAL_SME for non-SME businesses)
        if (tenant.sector && tenant.sector !== 'UNIVERSAL_SME') {
            const expectedSector = extractSectorFromId(tenant.id || tenant.client_id);
            if (tenant.sector === expectedSector) {
                skipped++;
                continue;
            }
        }

        // Extract sector from client_id
        const newSector = extractSectorFromId(tenant.id || tenant.client_id);
        if (!newSector) {
            console.log(`⚠️ Cannot determine sector for: ${tenant.id}`);
            errors++;
            continue;
        }

        // Update if different
        if (tenant.sector !== newSector) {
            try {
                await db.update('tenants', tenant.id, { sector: newSector });
                console.log(`✅ ${tenant.id}: ${tenant.sector || 'null'} → ${newSector}`);
                fixed++;
                await new Promise(r => setTimeout(r, 100)); // Rate limit
            } catch (err) {
                console.error(`❌ ${tenant.id}: ${err.message}`);
                errors++;
            }
        } else {
            skipped++;
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 RESULTS: Fixed=${fixed}, Skipped=${skipped}, Errors=${errors}`);
    console.log('═'.repeat(50));
}

fixSectors().catch(console.error);
