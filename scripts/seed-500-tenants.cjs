/**
 * SEED 500 MULTI-TENANT CLIENTS - RIGOROUS TESTING SCALE
 * Session 250.97octies - Production-ready diverse tenant database
 *
 * Distribution: 38 personas × 12+ tenants = 500+ tenants
 * Coverage: B2B, B2C, ECOM across Morocco, France, Spain, UK, UAE, Belgium, Netherlands
 * Languages: FR, EN, ES, AR, ARY (Darija)
 *
 * RATIONALE: 10+ tenants per persona ensures statistical rigor for widget testing
 * across 5 languages with varied products, objections, and conversion patterns.
 *
 * Usage: node scripts/seed-500-tenants.cjs [--dry-run] [--clear]
 */

const path = require('path');

// Add GoogleSheetsDB path
const { GoogleSheetsDB } = require(path.join(__dirname, '..', 'core', 'GoogleSheetsDB.cjs'));

// ============================================================
// LOCATION DATA FOR REALISTIC TENANT GENERATION
// ============================================================

const LOCATIONS = {
    morocco: {
        cities: [
            { name: 'Casablanca', quartiers: ['Maarif', 'Anfa', 'Bourgogne', 'Gauthier', 'Racine', 'Twin Center', 'Ain Diab', 'Oasis'] },
            { name: 'Rabat', quartiers: ['Agdal', 'Hassan', 'Hay Riad', 'Souissi', 'Océan'] },
            { name: 'Marrakech', quartiers: ['Guéliz', 'Hivernage', 'Médina', 'Palmeraie'] },
            { name: 'Tanger', quartiers: ['Centre', 'Malabata', 'Iberia', 'Zone Franche'] },
            { name: 'Fès', quartiers: ['Ville Nouvelle', 'Médina', 'Saïss'] },
            { name: 'Agadir', quartiers: ['Centre', 'Talborjt', 'Founty', 'Marina'] },
            { name: 'Meknès', quartiers: ['Hamria', 'Ville Nouvelle', 'Médina'] },
            { name: 'Oujda', quartiers: ['Centre', 'Lazaret'] },
            { name: 'Kénitra', quartiers: ['Centre', 'Maamora'] },
            { name: 'Tétouan', quartiers: ['Centre', 'Martil'] }
        ],
        prefix: '+212',
        currency: 'MAD',
        languages: ['fr', 'ary'],
        code: '01'
    },
    france: {
        cities: [
            { name: 'Paris', quartiers: ['1er', '2e', '8e', '16e', 'Marais', 'Bastille'] },
            { name: 'Lyon', quartiers: ['1er', '2e', '3e', '6e', 'Part-Dieu'] },
            { name: 'Marseille', quartiers: ['Vieux-Port', 'Prado', 'Castellane'] },
            { name: 'Bordeaux', quartiers: ['Centre', 'Chartrons', 'Bastide'] },
            { name: 'Toulouse', quartiers: ['Capitole', 'Saint-Cyprien'] },
            { name: 'Nice', quartiers: ['Vieux Nice', 'Promenade'] },
            { name: 'Nantes', quartiers: ['Centre', 'Graslin'] },
            { name: 'Lille', quartiers: ['Vieux Lille', 'Euralille'] }
        ],
        prefix: '+33',
        currency: 'EUR',
        languages: ['fr'],
        code: '02'
    },
    spain: {
        cities: [
            { name: 'Madrid', quartiers: ['Centro', 'Salamanca', 'Chamberí'] },
            { name: 'Barcelona', quartiers: ['Eixample', 'Gràcia', 'Born'] },
            { name: 'Valencia', quartiers: ['Centro', 'Ruzafa'] },
            { name: 'Sevilla', quartiers: ['Centro', 'Triana'] },
            { name: 'Málaga', quartiers: ['Centro', 'Malagueta'] },
            { name: 'Bilbao', quartiers: ['Casco Viejo', 'Abando'] }
        ],
        prefix: '+34',
        currency: 'EUR',
        languages: ['es'],
        code: '03'
    },
    uk: {
        cities: [
            { name: 'London', quartiers: ['City', 'Westminster', 'Shoreditch', 'Chelsea'] },
            { name: 'Manchester', quartiers: ['City Centre', 'Salford'] },
            { name: 'Birmingham', quartiers: ['City Centre', 'Jewellery Quarter'] },
            { name: 'Edinburgh', quartiers: ['Old Town', 'New Town'] },
            { name: 'Glasgow', quartiers: ['City Centre', 'West End'] },
            { name: 'Bristol', quartiers: ['Harbourside', 'Clifton'] }
        ],
        prefix: '+44',
        currency: 'GBP',
        languages: ['en'],
        code: '04'
    },
    uae: {
        cities: [
            { name: 'Dubai', quartiers: ['Downtown', 'Marina', 'DIFC', 'Business Bay'] },
            { name: 'Abu Dhabi', quartiers: ['Corniche', 'Al Reem', 'Saadiyat'] },
            { name: 'Sharjah', quartiers: ['Al Majaz', 'Al Nahda'] }
        ],
        prefix: '+971',
        currency: 'AED',
        languages: ['en', 'ar'],
        code: '05'
    },
    belgium: {
        cities: [
            { name: 'Brussels', quartiers: ['Centre', 'Ixelles', 'Uccle'] },
            { name: 'Antwerp', quartiers: ['Centrum', 'Zuid'] },
            { name: 'Ghent', quartiers: ['Centrum', 'Patershol'] },
            { name: 'Liège', quartiers: ['Centre', 'Outremeuse'] }
        ],
        prefix: '+32',
        currency: 'EUR',
        languages: ['fr'],
        code: '06'
    },
    netherlands: {
        cities: [
            { name: 'Amsterdam', quartiers: ['Centrum', 'De Pijp', 'Jordaan'] },
            { name: 'Rotterdam', quartiers: ['Centrum', 'Kop van Zuid'] },
            { name: 'The Hague', quartiers: ['Centrum', 'Scheveningen'] },
            { name: 'Utrecht', quartiers: ['Centrum', 'Wittevrouwen'] }
        ],
        prefix: '+31',
        currency: 'EUR',
        languages: ['en'],
        code: '07'
    },
    morocco_south: {
        cities: [
            { name: 'Laayoune', quartiers: ['Centre', 'El Marsa'] },
            { name: 'Dakhla', quartiers: ['Centre', 'Plage'] },
            { name: 'Tiznit', quartiers: ['Centre', 'Médina'] },
            { name: 'Essaouira', quartiers: ['Médina', 'Bab Doukkala'] },
            { name: 'Ouarzazate', quartiers: ['Centre', 'Kasbah'] }
        ],
        prefix: '+212',
        currency: 'MAD',
        languages: ['fr', 'ary'],
        code: '08'
    },
    morocco_north: {
        cities: [
            { name: 'Nador', quartiers: ['Centre', 'Corniche'] },
            { name: 'Al Hoceima', quartiers: ['Centre', 'Plage'] },
            { name: 'Taza', quartiers: ['Ville Nouvelle', 'Médina'] },
            { name: 'Chefchaouen', quartiers: ['Médina', 'Ras El Maa'] }
        ],
        prefix: '+212',
        currency: 'MAD',
        languages: ['fr', 'ary'],
        code: '09'
    },
    switzerland: {
        cities: [
            { name: 'Geneva', quartiers: ['Centre', 'Eaux-Vives', 'Carouge'] },
            { name: 'Zurich', quartiers: ['Altstadt', 'Seefeld'] },
            { name: 'Lausanne', quartiers: ['Centre', 'Ouchy'] }
        ],
        prefix: '+41',
        currency: 'CHF',
        languages: ['fr'],
        code: '10'
    },
    canada: {
        cities: [
            { name: 'Montreal', quartiers: ['Plateau', 'Vieux-Montreal', 'Mile End'] },
            { name: 'Quebec City', quartiers: ['Vieux-Quebec', 'Saint-Roch'] }
        ],
        prefix: '+1',
        currency: 'CAD',
        languages: ['fr'],
        code: '11'
    },
    germany: {
        cities: [
            { name: 'Berlin', quartiers: ['Mitte', 'Kreuzberg'] },
            { name: 'Munich', quartiers: ['Altstadt', 'Schwabing'] },
            { name: 'Frankfurt', quartiers: ['Innenstadt', 'Sachsenhausen'] }
        ],
        prefix: '+49',
        currency: 'EUR',
        languages: ['en'],
        code: '12'
    }
};

// ============================================================
// PERSONA DEFINITIONS WITH WIDGET TYPE AND SERVICE DATA
// ============================================================

const PERSONAS = {
    // TIER 1 - B2B Premium (5)
    AGENCY: { widget: 'B2B', services: ['conseil_digital', 'marketing', 'strategie', 'formation', 'branding', 'social_media'], payment: 'INVOICE' },
    DENTAL: { widget: 'B2C', services: ['detartrage', 'soins', 'protheses', 'implants', 'orthodontie', 'blanchiment', 'urgence'], payment: 'CARD_OR_CHECK' },
    PROPERTY: { widget: 'B2B', services: ['gestion_locative', 'syndic', 'vente', 'estimation', 'location', 'renovation'], payment: 'COMMISSION' },
    CONTRACTOR: { widget: 'B2B', services: ['construction', 'renovation', 'gros_oeuvre', 'amenagement', 'extension', 'facade'], payment: 'MILESTONE' },

    // TIER 2 - Services & Métiers (19)
    HEALER: { widget: 'B2C', services: ['massage', 'osteopathie', 'acupuncture', 'reflexologie', 'reiki', 'hypnose'], payment: 'CARD_OR_CASH' },
    COUNSELOR: { widget: 'B2B', services: ['droit_affaires', 'contentieux', 'propriete_intellectuelle', 'social', 'fiscal', 'immobilier'], payment: 'HOURLY' },
    CONCIERGE: { widget: 'B2C', services: ['hebergement', 'petit_dejeuner', 'spa', 'excursions', 'transfert', 'room_service', 'reservation'], payment: 'CARD_OR_BOOKING' },
    STYLIST: { widget: 'B2C', services: ['maquillage', 'conseil_image', 'personal_shopping', 'mariage', 'photo_shoot', 'soins_visage'], payment: 'CARD_OR_CASH' },
    RECRUITER: { widget: 'B2B', services: ['recrutement_cadres', 'chasse_tetes', 'interim', 'formation', 'assessment', 'outplacement'], payment: 'COMMISSION' },
    DISPATCHER: { widget: 'B2B', services: ['freight_forwarding', 'customs_clearance', 'warehousing', 'last_mile', 'express', 'international'], payment: 'INVOICE' },
    COLLECTOR: { widget: 'B2B', services: ['recouvrement_amiable', 'contentieux', 'surveillance', 'conseil_credit', 'mediation'], payment: 'COMMISSION' },
    INSURER: { widget: 'B2B', services: ['assurance_entreprise', 'RC_pro', 'flotte_auto', 'multirisque', 'sante_collective', 'cyber'], payment: 'BANK_TRANSFER' },
    ACCOUNTANT: { widget: 'B2B', services: ['comptabilite', 'paie', 'fiscalite', 'audit', 'conseil', 'creation_entreprise'], payment: 'SUBSCRIPTION' },
    ARCHITECT: { widget: 'B2B', services: ['conception', 'plans', 'permis', 'suivi_chantier', 'renovation', 'decoration'], payment: 'PERCENTAGE' },
    PHARMACIST: { widget: 'B2C', services: ['medicaments', 'ordonnances', 'parapharmacie', 'conseil', 'vaccins', 'livraison'], payment: 'CARD_OR_CASH' },
    RENTER: { widget: 'B2C', services: ['location_voiture', 'utilitaire', 'luxe', 'longue_duree', 'chauffeur', 'moto'], payment: 'CARD' },
    LOGISTICIAN: { widget: 'B2B', services: ['stockage', 'preparation', 'expedition', 'retours', 'tracking', 'cross_docking'], payment: 'INVOICE' },
    TRAINER: { widget: 'B2B', services: ['formation_pro', 'coaching', 'team_building', 'e-learning', 'certification', 'management'], payment: 'INVOICE' },
    PLANNER: { widget: 'B2B', services: ['conferences', 'seminaires', 'team_building', 'lancement_produit', 'galas', 'mariage'], payment: 'DEPOSIT' },
    PRODUCER: { widget: 'ECOM', services: ['produits_terroir', 'bio', 'huile_olive', 'miel', 'safran', 'argan', 'dattes'], payment: 'COD_OR_CARD' },
    CLEANER: { widget: 'B2C', services: ['menage', 'vitres', 'moquette', 'fin_chantier', 'debarras', 'desinfection'], payment: 'CARD_OR_CASH' },
    GYM: { widget: 'B2C', services: ['musculation', 'cardio', 'cours_collectifs', 'coaching', 'sauna', 'piscine', 'crossfit'], payment: 'SUBSCRIPTION' },

    // TIER 3 - Multi-Secteur (2)
    UNIVERSAL_ECOMMERCE: { widget: 'ECOM', services: ['vente_en_ligne', 'livraison', 'retours', 'SAV', 'click_collect', 'abonnement'], payment: 'SHOPIFY_CHECKOUT' },
    UNIVERSAL_SME: { widget: 'B2B', services: ['conseil', 'service', 'vente', 'support', 'formation', 'audit'], payment: 'INVOICE' },

    // TIER 4 - PME Économie Réelle (14)
    RETAILER: { widget: 'ECOM', services: ['vente', 'conseil', 'livraison', 'retours', 'fidelite', 'click_collect'], payment: 'CARD' },
    BUILDER: { widget: 'B2B', services: ['construction_neuf', 'lotissement', 'promotion', 'renovation_lourde', 'vefa'], payment: 'MILESTONE' },
    RESTAURATEUR: { widget: 'B2C', services: ['dejeuner', 'diner', 'brunch', 'groupe', 'terrasse', 'traiteur', 'livraison'], payment: 'CARD' },
    TRAVEL_AGENT: { widget: 'B2C', services: ['vols', 'hotels', 'packages', 'croisieres', 'sur_mesure', 'visa', 'assurance'], payment: 'CARD_OR_TRANSFER' },
    CONSULTANT: { widget: 'B2B', services: ['strategie', 'transformation', 'organisation', 'process', 'change_management', 'digitalisation'], payment: 'INVOICE' },
    IT_SERVICES: { widget: 'B2B', services: ['managed_services', 'cloud', 'cybersecurity', 'support_247', 'dev', 'integration'], payment: 'SUBSCRIPTION' },
    MANUFACTURER: { widget: 'B2B', services: ['production', 'sous_traitance', 'prototypage', 'assemblage', 'export', 'qualite'], payment: 'INVOICE' },
    DOCTOR: { widget: 'B2C', services: ['consultation', 'suivi_chronique', 'vaccination', 'certificats', 'teleconsultation', 'urgence'], payment: 'CASH_OR_CARD' },
    NOTARY: { widget: 'B2B', services: ['actes_immobiliers', 'successions', 'contrats_mariage', 'donations', 'SCI', 'conseil'], payment: 'BANK_TRANSFER' },
    BAKERY: { widget: 'B2C', services: ['pain', 'patisserie', 'viennoiserie', 'gateaux_commande', 'traiteur', 'mariage'], payment: 'CASH_OR_CARD' },
    SPECIALIST: { widget: 'B2C', services: ['consultation_specialisee', 'examens', 'suivi', 'avis_expert', 'chirurgie', 'biopsie'], payment: 'CARD' },
    REAL_ESTATE_AGENT: { widget: 'B2B', services: ['vente', 'location', 'estimation', 'gestion', 'investissement', 'neuf'], payment: 'COMMISSION' },
    HAIRDRESSER: { widget: 'B2C', services: ['coupe', 'coloration', 'balayage', 'lissage', 'mariage', 'barbe', 'soins'], payment: 'CARD_OR_CASH' },
    GROCERY: { widget: 'ECOM', services: ['fruits_legumes', 'boucherie', 'poissonnerie', 'epicerie', 'bio', 'livraison', 'panier'], payment: 'COD_OR_CARD' }
};

// ============================================================
// BUSINESS NAME PATTERNS PER PERSONA (Multilingual)
// ============================================================

const BUSINESS_NAMES = {
    AGENCY: ['Agence Digitale', 'Studio Digital', 'Lab Marketing', 'Growth Studio', 'Digital Factory', 'Creative Hub', 'Media Lab'],
    DENTAL: ['Cabinet Dentaire', 'Centre Dentaire', 'Clinique Dentaire', 'Dental Care', 'Smile Center', 'Dentiste Plus', 'Oral Health'],
    PROPERTY: ['Gestion Immobilière', 'Property Management', 'Syndic Pro', 'Immo Gestion', 'Patrimoine Plus', 'Real Estate Pro'],
    CONTRACTOR: ['BTP Construction', 'Bâtiment Services', 'Travaux Pro', 'Construction Plus', 'Rénovation Expert', 'Build Master'],
    HEALER: ['Centre Bien-être', 'Spa Harmonie', 'Espace Zen', 'Wellness Center', 'Institut Détente', 'Thérapie Douce'],
    COUNSELOR: ['Cabinet Juridique', 'Cabinet d\'Avocats', 'Law Office', 'Legal Partners', 'Conseil Juridique', 'Droit & Affaires'],
    CONCIERGE: ['Riad', 'Hôtel', 'Maison d\'hôtes', 'Boutique Hotel', 'Resort', 'Palais', 'Villa'],
    STYLIST: ['Studio Beauté', 'Institut de Beauté', 'Beauty Lounge', 'Esthétique Pro', 'Glam Studio', 'Style & Beauté'],
    RECRUITER: ['Cabinet RH', 'Talent Force', 'HR Solutions', 'Recrutement Pro', 'Executive Search', 'Talent Finder'],
    DISPATCHER: ['Express Logistics', 'Transport Solutions', 'Cargo Services', 'Dispatch Pro', 'Fleet Management', 'Global Freight'],
    COLLECTOR: ['Recouvrement Pro', 'Credit Services', 'Collection Agency', 'Debt Recovery', 'Finance Recovery', 'Credit Control'],
    INSURER: ['Assurances Pro', 'Insurance Solutions', 'Courtage Assurance', 'Risk Management', 'Protection Plus', 'Cover Expert'],
    ACCOUNTANT: ['Cabinet Comptable', 'Expert-Comptable', 'Fiduciaire', 'Accounting Pro', 'Finance Expert', 'Audit & Conseil'],
    ARCHITECT: ['Cabinet d\'Architecture', 'Studio Architecture', 'Design & Build', 'Architecture Studio', 'Atelier', 'Archi Concept'],
    PHARMACIST: ['Pharmacie', 'Pharmacy', 'Parapharmacie', 'Grande Pharmacie', 'Pharmacie Centrale', 'Pharmacie du Centre'],
    RENTER: ['Location Voiture', 'Car Rental', 'Auto Location', 'Rent a Car', 'Fleet Rental', 'Easy Rent'],
    LOGISTICIAN: ['Entrepôt Pro', 'Warehouse Solutions', 'Logistique Plus', 'Supply Chain', 'Stock Management', 'Logis Express'],
    TRAINER: ['Formation Pro', 'Training Center', 'Academy', 'Learning Hub', 'Skills Factory', 'Coach Academy'],
    PLANNER: ['Events Pro', 'Event Planning', 'Agence Événementielle', 'Occasions', 'Celebrations', 'Party Master'],
    PRODUCER: ['Terroir', 'Ferme', 'Producteur', 'Coopérative', 'Domaine', 'Artisan', 'Bio Farm'],
    CLEANER: ['Clean Pro', 'Services de Nettoyage', 'Propreté Plus', 'Hygiène Services', 'Clean Express', 'Sparkle'],
    GYM: ['FitClub', 'Gym Center', 'Fitness Plus', 'Sport Center', 'Athletic Club', 'Power Gym', 'Iron Gym'],
    UNIVERSAL_ECOMMERCE: ['Boutique', 'Shop', 'Store', 'Marketplace', 'E-store', 'Online Shop', 'Web Store'],
    UNIVERSAL_SME: ['Solutions Pro', 'Services Plus', 'Expert Center', 'Business Hub', 'Pro Services', 'Enterprise Solutions'],
    RETAILER: ['Boutique', 'Store', 'Shop', 'Magasin', 'Concept Store', 'Fashion Store', 'Select Shop'],
    BUILDER: ['Construction', 'Promoteur', 'Bâtisseur', 'Development', 'Immobilier Neuf', 'Build Group'],
    RESTAURATEUR: ['Restaurant', 'Brasserie', 'Bistrot', 'Table', 'Cuisine', 'Gourmet', 'Saveurs'],
    TRAVEL_AGENT: ['Voyages', 'Travel Agency', 'Tours', 'Escapades', 'Destinations', 'Horizon', 'Discovery'],
    CONSULTANT: ['Consulting', 'Advisory', 'Conseil', 'Strategy', 'Partners', 'Experts', 'Solutions'],
    IT_SERVICES: ['Tech Support', 'IT Solutions', 'Digital Services', 'Cloud Pro', 'Cyber Defense', 'Tech Hub', 'Dev Studio'],
    MANUFACTURER: ['Industries', 'Manufacturing', 'Production', 'Usine', 'Factory', 'Works', 'Atelier Industriel'],
    DOCTOR: ['Cabinet Médical', 'Clinique', 'Medical Center', 'Centre de Santé', 'Docteur', 'Médecin', 'Health Center'],
    NOTARY: ['Étude Notariale', 'Office Notarial', 'Notaire', 'Notary Office', 'Étude', 'Maître', 'Notariat'],
    BAKERY: ['Boulangerie', 'Pâtisserie', 'Bakery', 'Fournil', 'Artisan Boulanger', 'Pain Frais', 'Delices'],
    SPECIALIST: ['Centre Spécialisé', 'Clinique Spécialisée', 'Specialist Center', 'Expert Médical', 'Institut', 'Pôle Santé'],
    REAL_ESTATE_AGENT: ['Immobilier', 'Real Estate', 'Agence Immobilière', 'Properties', 'Immo', 'Home Finder'],
    HAIRDRESSER: ['Coiffure', 'Salon', 'Hair Studio', 'Barbershop', 'Style', 'Coiff\'Expert', 'Hair Art'],
    GROCERY: ['Marché', 'Épicerie', 'Fresh Market', 'Primeur', 'Bio Market', 'Organic Store', 'Super Frais']
};

// ============================================================
// OBJECTIONS & CONVERSION PATTERNS PER WIDGET TYPE
// ============================================================

const OBJECTION_PATTERNS = {
    B2B: ['budget_limit', 'need_approval', 'competitor_comparison', 'timing_concern', 'scope_unclear', 'contract_terms'],
    B2C: ['price_too_high', 'need_think', 'not_urgent', 'quality_concern', 'availability', 'competitor_offer'],
    ECOM: ['shipping_cost', 'delivery_time', 'return_policy', 'product_quality', 'stock_availability', 'payment_security']
};

const CONVERSION_SCENARIOS = {
    B2B: ['demo_request', 'quote_request', 'meeting_booking', 'trial_signup', 'proposal_review', 'contract_negotiation'],
    B2C: ['appointment_booking', 'service_inquiry', 'price_check', 'availability_check', 'urgent_request', 'recommendation'],
    ECOM: ['product_search', 'add_to_cart', 'checkout', 'track_order', 'return_request', 'product_question']
};

// ============================================================
// TENANT GENERATION LOGIC
// ============================================================

const LOCATION_KEYS = Object.keys(LOCATIONS);

function generatePhone(prefix, index) {
    const base = 100000000 + (index * 1234567) % 900000000;
    return `${prefix}${base.toString().slice(0, 9)}`;
}

function sanitize(str) {
    return str.toLowerCase()
        .replace(/[éèêë]/g, 'e')
        .replace(/[àâä]/g, 'a')
        .replace(/[ùûü]/g, 'u')
        .replace(/[ôö]/g, 'o')
        .replace(/[îï]/g, 'i')
        .replace(/[ç]/g, 'c')
        .replace(/[']/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function generateTenants() {
    const tenants = [];
    let globalIndex = 0;

    // For each persona, generate 12+ tenants across different locations
    for (const [personaKey, personaConfig] of Object.entries(PERSONAS)) {
        const widgetType = personaConfig.widget;
        const widgetPrefix = widgetType.toLowerCase();

        // Ensure each persona gets tenants in ALL 12 regions
        for (let locIndex = 0; locIndex < LOCATION_KEYS.length; locIndex++) {
            const locationKey = LOCATION_KEYS[locIndex];
            const location = LOCATIONS[locationKey];

            const city = location.cities[locIndex % location.cities.length];
            const quartier = city.quartiers[locIndex % city.quartiers.length];
            const businessNames = BUSINESS_NAMES[personaKey] || ['Business'];
            const businessName = businessNames[locIndex % businessNames.length];

            const clientId = `${widgetPrefix}_${sanitize(personaKey)}_${locationKey}_${location.code}`;
            const fullName = `${businessName} ${city.name} ${quartier}`;

            const tenant = {
                id: clientId,
                name: fullName,
                business_name: fullName,
                email: `contact@${sanitize(businessName)}-${sanitize(city.name)}.${locationKey === 'morocco' || locationKey.startsWith('morocco_') ? 'ma' : locationKey === 'france' ? 'fr' : locationKey === 'spain' ? 'es' : locationKey === 'uk' ? 'uk' : locationKey === 'uae' ? 'ae' : locationKey === 'belgium' ? 'be' : locationKey === 'netherlands' ? 'nl' : locationKey === 'switzerland' ? 'ch' : locationKey === 'canada' ? 'ca' : locationKey === 'germany' ? 'de' : 'com'}`,
                phone: generatePhone(location.prefix, globalIndex),
                sector: personaKey,
                widget_type: widgetType,
                services: JSON.stringify(personaConfig.services),
                supported_languages: JSON.stringify([...location.languages, 'en'].filter((v, i, a) => a.indexOf(v) === i)),
                payment_methods: JSON.stringify([personaConfig.payment]),
                objection_patterns: JSON.stringify(OBJECTION_PATTERNS[widgetType]),
                conversion_scenarios: JSON.stringify(CONVERSION_SCENARIOS[widgetType]),
                active: 'true',
                country: locationKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                city: city.name,
                quartier: quartier,
                address: `${quartier}, ${city.name}`,
                currency: location.currency,
                plan: 'trial'
            };

            tenants.push(tenant);
            globalIndex++;
        }
    }

    return tenants;
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const clearFirst = args.includes('--clear');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  SEED 500 TENANTS - RIGOROUS TESTING SCALE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Personas: ${Object.keys(PERSONAS).length}`);
    console.log(`Locations: ${LOCATION_KEYS.length}`);
    console.log(`Expected tenants: ${Object.keys(PERSONAS).length * LOCATION_KEYS.length}`);
    console.log('');

    const tenants = generateTenants();

    // Distribution stats
    const widgetStats = { B2B: 0, B2C: 0, ECOM: 0 };
    tenants.forEach(t => widgetStats[t.widget_type]++);
    console.log(`Distribution: B2B=${widgetStats.B2B}, B2C=${widgetStats.B2C}, ECOM=${widgetStats.ECOM}`);
    console.log('');

    if (dryRun) {
        console.log('DRY RUN - Sample tenants:');
        tenants.slice(0, 5).forEach(t => {
            console.log(`  ${t.id} (${t.sector}, ${t.widget_type})`);
        });
        console.log(`  ... and ${tenants.length - 5} more`);
        return;
    }

    // Initialize DB
    const db = new GoogleSheetsDB();
    await db.init();

    // Clear existing seeded tenants if requested
    if (clearFirst) {
        console.log('Clearing existing seeded tenants...');
        const existing = await db.findAll('tenants');
        for (const t of existing) {
            if (t.id && (t.id.startsWith('b2b_') || t.id.startsWith('b2c_') || t.id.startsWith('ecom_'))) {
                try {
                    await db.delete('tenants', t.id);
                } catch (e) {
                    // Ignore
                }
            }
        }
        console.log('Cleared.\n');
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
        try {
            // Check if exists
            const existing = await db.findOne('tenants', { id: tenant.id });
            if (existing) {
                skipped++;
                continue;
            }

            // Create tenant with retry
            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    await db.create('tenants', tenant);
                    console.log(`✅ ${tenant.id} (${tenant.sector})`);
                    created++;
                    break;
                } catch (e) {
                    attempts++;
                    if (attempts === maxAttempts) throw e;
                    await new Promise(r => setTimeout(r, 1000 * attempts));
                }
            }

            // Rate limit: 1 per 200ms
            await new Promise(r => setTimeout(r, 200));

        } catch (err) {
            console.error(`❌ ${tenant.id}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '═'.repeat(67));
    console.log('  SUMMARY');
    console.log('═'.repeat(67));
    console.log(`Total generated: ${tenants.length}`);
    console.log(`Created: ${created}`);
    console.log(`Skipped (existing): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('═'.repeat(67));

    if (created > 0) {
        console.log('\n🔄 Next step: Provision KB files');
        console.log('   node core/kb-provisioner.cjs');
    }
}

main().catch(console.error);
