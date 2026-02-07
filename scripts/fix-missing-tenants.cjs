/**
 * FIX MISSING TENANTS
 * Session 250.97septies - Add the 3 tenants that failed due to rate limiting
 *
 * Missing: CONCIERGE (7→8), PHARMACIST (7→8), IT_SERVICES (7→8)
 */

const path = require('path');
const fs = require('fs');

// Add GoogleSheetsDB path
const { GoogleSheetsDB } = require(path.join(__dirname, '..', 'core', 'GoogleSheetsDB.cjs'));

const MISSING_TENANTS = [
    {
        client_id: 'b2c_concierge_morocco_08',
        name: 'Concierge Prestige Casablanca',
        email: 'contact@concierge-prestige-casa.ma',
        phone: '+212522889900',
        persona: 'CONCIERGE',
        widget_type: 'B2C',
        business_category: 'hospitality',
        services: JSON.stringify(['reservations', 'luxury_travel', 'event_planning', 'personal_shopping', 'vip_access']),
        supported_languages: JSON.stringify(['fr', 'en', 'ar', 'ary']),
        payment_methods: JSON.stringify(['card', 'wire_transfer']),
        active: 'true',
        country: 'Morocco',
        city: 'Casablanca',
        address: 'Quartier Anfa, Casablanca',
        currency: 'MAD'
    },
    {
        client_id: 'b2c_pharmacist_morocco_08',
        name: 'Pharmacie Centrale Rabat',
        email: 'contact@pharmacie-centrale-rabat.ma',
        phone: '+212537667788',
        persona: 'PHARMACIST',
        widget_type: 'B2C',
        business_category: 'healthcare',
        services: JSON.stringify(['medicaments', 'ordonnances', 'conseils_sante', 'parapharmacie', 'livraison']),
        supported_languages: JSON.stringify(['fr', 'ar', 'ary']),
        payment_methods: JSON.stringify(['card', 'cash']),
        active: 'true',
        country: 'Morocco',
        city: 'Rabat',
        address: 'Avenue Hassan II, Agdal, Rabat',
        currency: 'MAD'
    },
    {
        client_id: 'b2b_it_services_morocco_08',
        name: 'TechSolutions Maroc',
        email: 'contact@techsolutions.ma',
        phone: '+212522998877',
        persona: 'IT_SERVICES',
        widget_type: 'B2B',
        business_category: 'technology',
        services: JSON.stringify(['infra_cloud', 'cybersecurity', 'dev_custom', 'support_24_7', 'consulting_it']),
        supported_languages: JSON.stringify(['fr', 'en', 'ar']),
        payment_methods: JSON.stringify(['invoice', 'wire_transfer']),
        active: 'true',
        country: 'Morocco',
        city: 'Casablanca',
        address: 'Technopark, Casablanca',
        currency: 'MAD'
    }
];

async function fixMissingTenants() {
    console.log('🔧 Adding 3 missing tenants (rate-limit recovery)...\n');

    const db = new GoogleSheetsDB();
    await db.init();

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of MISSING_TENANTS) {
        try {
            // Check if exists
            const existing = await db.findOne('tenants', { client_id: tenant.client_id });
            if (existing) {
                console.log(`⏭️  SKIP: ${tenant.client_id} (exists)`);
                skipped++;
                continue;
            }

            // Create tenant
            await db.create('tenants', tenant);
            console.log(`✅ CREATED: ${tenant.client_id} (${tenant.persona})`);
            created++;

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error(`❌ ERROR: ${tenant.client_id} - ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 RESULTS: Created=${created}, Skipped=${skipped}, Errors=${errors}`);
    console.log('═'.repeat(50));

    if (created > 0) {
        console.log('\n🔄 Now run KB provisioning:');
        console.log('   node core/kb-provisioner.cjs');
    }
}

fixMissingTenants().catch(console.error);
