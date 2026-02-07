/**
 * SEED 300 MULTI-TENANT CLIENTS
 * Session 250.97sexies - Production-ready diverse tenant database
 *
 * Distribution: 38 personas × ~7-8 tenants = 300 tenants
 * Coverage: B2B, B2C, ECOM across Morocco, France, Spain, UK, UAE, Belgium, Netherlands
 * Languages: FR, EN, ES, AR, ARY (Darija)
 *
 * Usage: node scripts/seed-300-tenants.cjs [--dry-run] [--clear]
 */

const path = require('path');

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
        languages: ['fr', 'ary']
    },
    france: {
        cities: [
            { name: 'Paris', quartiers: ['1er', '2e', '3e', '4e', '5e', '6e', '7e', '8e', '9e', '10e', '11e', '12e', '13e', '14e', '15e', '16e', '17e', '18e', '19e', '20e'] },
            { name: 'Lyon', quartiers: ['1er', '2e', '3e', '6e', '7e', 'Part-Dieu', 'Presqu\'île'] },
            { name: 'Marseille', quartiers: ['Vieux-Port', 'Prado', 'Castellane', 'La Joliette'] },
            { name: 'Bordeaux', quartiers: ['Centre', 'Chartrons', 'Saint-Pierre', 'Bastide'] },
            { name: 'Toulouse', quartiers: ['Capitole', 'Saint-Cyprien', 'Carmes'] },
            { name: 'Nice', quartiers: ['Vieux Nice', 'Promenade', 'Cimiez'] },
            { name: 'Nantes', quartiers: ['Centre', 'Île de Nantes', 'Graslin'] },
            { name: 'Lille', quartiers: ['Vieux Lille', 'Euralille', 'Wazemmes'] },
            { name: 'Strasbourg', quartiers: ['Grande Île', 'Krutenau', 'Orangerie'] },
            { name: 'Montpellier', quartiers: ['Ecusson', 'Antigone', 'Port Marianne'] }
        ],
        prefix: '+33',
        currency: 'EUR',
        languages: ['fr']
    },
    spain: {
        cities: [
            { name: 'Madrid', quartiers: ['Centro', 'Salamanca', 'Chamberí', 'Retiro', 'Chamartín'] },
            { name: 'Barcelona', quartiers: ['Eixample', 'Gràcia', 'Born', 'Barceloneta', 'Sant Gervasi'] },
            { name: 'Valencia', quartiers: ['Centro', 'Ruzafa', 'El Carmen'] },
            { name: 'Sevilla', quartiers: ['Centro', 'Triana', 'Nervión'] },
            { name: 'Málaga', quartiers: ['Centro', 'Malagueta', 'Soho'] },
            { name: 'Bilbao', quartiers: ['Casco Viejo', 'Abando', 'Indautxu'] }
        ],
        prefix: '+34',
        currency: 'EUR',
        languages: ['es']
    },
    uk: {
        cities: [
            { name: 'London', quartiers: ['City', 'Westminster', 'Canary Wharf', 'Shoreditch', 'Mayfair', 'Chelsea'] },
            { name: 'Manchester', quartiers: ['City Centre', 'Salford', 'Deansgate'] },
            { name: 'Birmingham', quartiers: ['City Centre', 'Jewellery Quarter', 'Digbeth'] },
            { name: 'Edinburgh', quartiers: ['Old Town', 'New Town', 'Leith'] },
            { name: 'Glasgow', quartiers: ['City Centre', 'West End', 'Merchant City'] },
            { name: 'Bristol', quartiers: ['Harbourside', 'Clifton', 'Old City'] }
        ],
        prefix: '+44',
        currency: 'EUR',
        languages: ['en']
    },
    uae: {
        cities: [
            { name: 'Dubai', quartiers: ['Downtown', 'Marina', 'DIFC', 'Business Bay', 'JLT', 'Jebel Ali'] },
            { name: 'Abu Dhabi', quartiers: ['Corniche', 'Al Reem', 'Saadiyat', 'Yas Island'] },
            { name: 'Sharjah', quartiers: ['Al Majaz', 'Al Nahda', 'Industrial Area'] }
        ],
        prefix: '+971',
        currency: 'EUR',
        languages: ['en', 'ar']
    },
    belgium: {
        cities: [
            { name: 'Brussels', quartiers: ['Centre', 'Ixelles', 'Saint-Gilles', 'Uccle'] },
            { name: 'Antwerp', quartiers: ['Centrum', 'Zuid', 'Eilandje'] },
            { name: 'Ghent', quartiers: ['Centrum', 'Patershol'] },
            { name: 'Liège', quartiers: ['Centre', 'Outremeuse'] }
        ],
        prefix: '+32',
        currency: 'EUR',
        languages: ['fr']
    },
    netherlands: {
        cities: [
            { name: 'Amsterdam', quartiers: ['Centrum', 'Zuid', 'Oost', 'West'] },
            { name: 'Rotterdam', quartiers: ['Centrum', 'Kop van Zuid', 'Kralingen'] },
            { name: 'The Hague', quartiers: ['Centrum', 'Scheveningen'] },
            { name: 'Utrecht', quartiers: ['Centrum', 'Lombok'] }
        ],
        prefix: '+31',
        currency: 'EUR',
        languages: ['en']
    }
};

// ============================================================
// PERSONA DEFINITIONS WITH WIDGET TYPE AND SERVICE DATA
// ============================================================

const PERSONAS = {
    // TIER 1 - B2B Premium (5)
    AGENCY: { widget: 'B2B', services: ['conseil_digital', 'marketing', 'strategie', 'formation'], payment: 'INVOICE' },
    DENTAL: { widget: 'B2C', services: ['detartrage', 'soins', 'protheses', 'implants', 'orthodontie', 'blanchiment'], payment: 'CARD_OR_CHECK' },
    PROPERTY: { widget: 'B2B', services: ['gestion_locative', 'syndic', 'vente', 'estimation'], payment: 'COMMISSION' },
    CONTRACTOR: { widget: 'B2B', services: ['construction', 'renovation', 'gros_oeuvre', 'amenagement', 'extension'], payment: 'MILESTONE' },

    // TIER 2 - Services & Métiers (19)
    HEALER: { widget: 'B2C', services: ['massage', 'osteopathie', 'acupuncture', 'reflexologie', 'reiki'], payment: 'CARD_OR_CASH' },
    COUNSELOR: { widget: 'B2B', services: ['droit_affaires', 'contentieux', 'propriete_intellectuelle', 'social', 'fiscal'], payment: 'HOURLY' },
    CONCIERGE: { widget: 'B2C', services: ['hebergement', 'petit_dejeuner', 'spa', 'excursions', 'transfert', 'room_service'], payment: 'CARD_OR_BOOKING' },
    STYLIST: { widget: 'B2C', services: ['maquillage', 'conseil_image', 'personal_shopping', 'mariage'], payment: 'CARD_OR_CASH' },
    RECRUITER: { widget: 'B2B', services: ['recrutement_cadres', 'chasse_tetes', 'interim', 'formation', 'assessment'], payment: 'COMMISSION' },
    DISPATCHER: { widget: 'B2B', services: ['freight_forwarding', 'customs_clearance', 'warehousing', 'last_mile', 'express'], payment: 'INVOICE' },
    COLLECTOR: { widget: 'B2B', services: ['recouvrement_amiable', 'contentieux', 'surveillance', 'conseil_credit'], payment: 'COMMISSION' },
    INSURER: { widget: 'B2B', services: ['assurance_entreprise', 'RC_pro', 'flotte_auto', 'multirisque', 'sante_collective'], payment: 'BANK_TRANSFER' },
    ACCOUNTANT: { widget: 'B2B', services: ['comptabilite', 'paie', 'fiscalite', 'audit', 'conseil'], payment: 'SUBSCRIPTION' },
    ARCHITECT: { widget: 'B2B', services: ['conception', 'plans', 'permis', 'suivi_chantier', 'renovation'], payment: 'PERCENTAGE' },
    PHARMACIST: { widget: 'B2C', services: ['medicaments', 'ordonnances', 'parapharmacie', 'conseil', 'vaccins'], payment: 'CARD_OR_CASH' },
    RENTER: { widget: 'B2C', services: ['location_voiture', 'utilitaire', 'luxe', 'longue_duree', 'chauffeur'], payment: 'CARD' },
    LOGISTICIAN: { widget: 'B2B', services: ['stockage', 'preparation', 'expedition', 'retours', 'tracking'], payment: 'INVOICE' },
    TRAINER: { widget: 'B2B', services: ['formation_pro', 'coaching', 'team_building', 'e-learning', 'certification'], payment: 'INVOICE' },
    PLANNER: { widget: 'B2B', services: ['conferences', 'seminaires', 'team_building', 'lancement_produit', 'galas'], payment: 'DEPOSIT' },
    PRODUCER: { widget: 'ECOM', services: ['produits_terroir', 'bio', 'huile_olive', 'miel', 'safran', 'argan'], payment: 'COD_OR_CARD' },
    CLEANER: { widget: 'B2C', services: ['menage', 'vitres', 'moquette', 'fin_chantier', 'debarras'], payment: 'CARD_OR_CASH' },
    GYM: { widget: 'B2C', services: ['musculation', 'cardio', 'cours_collectifs', 'coaching', 'sauna', 'piscine'], payment: 'SUBSCRIPTION' },

    // TIER 3 - Multi-Secteur (2)
    UNIVERSAL_ECOMMERCE: { widget: 'ECOM', services: ['vente_en_ligne', 'livraison', 'retours', 'SAV', 'click_collect'], payment: 'SHOPIFY_CHECKOUT' },
    UNIVERSAL_SME: { widget: 'B2B', services: ['conseil', 'service', 'vente', 'support', 'formation'], payment: 'INVOICE' },

    // TIER 4 - PME Économie Réelle (14)
    RETAILER: { widget: 'ECOM', services: ['vente', 'conseil', 'livraison', 'retours', 'fidelite'], payment: 'CARD' },
    BUILDER: { widget: 'B2B', services: ['construction_neuf', 'lotissement', 'promotion', 'renovation_lourde'], payment: 'MILESTONE' },
    RESTAURATEUR: { widget: 'B2C', services: ['dejeuner', 'diner', 'brunch', 'groupe', 'terrasse', 'traiteur'], payment: 'CARD' },
    TRAVEL_AGENT: { widget: 'B2C', services: ['vols', 'hotels', 'packages', 'croisieres', 'sur_mesure', 'visa'], payment: 'CARD_OR_TRANSFER' },
    CONSULTANT: { widget: 'B2B', services: ['strategie', 'transformation', 'organisation', 'process', 'change_management'], payment: 'INVOICE' },
    IT_SERVICES: { widget: 'B2B', services: ['managed_services', 'cloud', 'cybersecurity', 'support_247', 'dev'], payment: 'SUBSCRIPTION' },
    MANUFACTURER: { widget: 'B2B', services: ['production', 'sous_traitance', 'prototypage', 'assemblage', 'export'], payment: 'INVOICE' },
    DOCTOR: { widget: 'B2C', services: ['consultation', 'suivi_chronique', 'vaccination', 'certificats', 'teleconsultation'], payment: 'CASH_OR_CARD' },
    NOTARY: { widget: 'B2B', services: ['actes_immobiliers', 'successions', 'contrats_mariage', 'donations', 'SCI'], payment: 'BANK_TRANSFER' },
    BAKERY: { widget: 'B2C', services: ['pain', 'patisserie', 'viennoiserie', 'gateaux_commande', 'traiteur'], payment: 'CASH_OR_CARD' },
    SPECIALIST: { widget: 'B2C', services: ['consultation_specialisee', 'examens', 'suivi', 'avis_expert'], payment: 'CARD' },
    REAL_ESTATE_AGENT: { widget: 'B2B', services: ['vente', 'location', 'estimation', 'gestion', 'investissement'], payment: 'COMMISSION' },
    HAIRDRESSER: { widget: 'B2C', services: ['coupe', 'coloration', 'balayage', 'lissage', 'mariage', 'barbe'], payment: 'CARD_OR_CASH' },
    GROCERY: { widget: 'ECOM', services: ['fruits_legumes', 'boucherie', 'poissonnerie', 'epicerie', 'bio', 'livraison'], payment: 'COD_OR_CARD' }
};

// ============================================================
// BUSINESS NAME PATTERNS PER PERSONA
// ============================================================

const BUSINESS_NAMES = {
    AGENCY: ['Agence Digitale', 'Studio Digital', 'Lab Marketing', 'Growth Studio', 'Digital Factory'],
    DENTAL: ['Cabinet Dentaire', 'Centre Dentaire', 'Clinique Dentaire', 'Dental Care', 'Smile Center'],
    PROPERTY: ['Gestion Immobilière', 'Property Management', 'Syndic Pro', 'Immo Gestion', 'Patrimoine Plus'],
    CONTRACTOR: ['BTP Construction', 'Bâtiment Services', 'Travaux Pro', 'Construction Plus', 'Rénovation Expert'],
    HEALER: ['Centre Bien-être', 'Spa Harmonie', 'Espace Zen', 'Wellness Center', 'Institut Détente'],
    COUNSELOR: ['Cabinet Juridique', 'Cabinet d\'Avocats', 'Law Office', 'Legal Partners', 'Conseil Juridique'],
    CONCIERGE: ['Riad', 'Hôtel', 'Maison d\'hôtes', 'Boutique Hotel', 'Resort'],
    STYLIST: ['Studio Beauté', 'Institut de Beauté', 'Beauty Lounge', 'Esthétique Pro', 'Glam Studio'],
    RECRUITER: ['Cabinet RH', 'Talent Force', 'HR Solutions', 'Recrutement Pro', 'Executive Search'],
    DISPATCHER: ['Express Logistics', 'Transport Solutions', 'Cargo Services', 'Dispatch Pro', 'Fleet Management'],
    COLLECTOR: ['Recouvrement Pro', 'Credit Services', 'Collection Agency', 'Debt Recovery', 'Finance Recovery'],
    INSURER: ['Assurances Pro', 'Insurance Solutions', 'Courtage Assurance', 'Risk Management', 'Protection Plus'],
    ACCOUNTANT: ['Cabinet Comptable', 'Expert-Comptable', 'Fiduciaire', 'Accounting Pro', 'Finance Expert'],
    ARCHITECT: ['Cabinet d\'Architecture', 'Studio Architecture', 'Design & Build', 'Architecture Studio', 'Atelier'],
    PHARMACIST: ['Pharmacie', 'Pharmacy', 'Parapharmacie', 'Grande Pharmacie', 'Pharmacie Centrale'],
    RENTER: ['Location Voiture', 'Car Rental', 'Auto Location', 'Rent a Car', 'Fleet Rental'],
    LOGISTICIAN: ['Entrepôt Pro', 'Warehouse Solutions', 'Logistique Plus', 'Supply Chain', 'Stock Management'],
    TRAINER: ['Formation Pro', 'Training Center', 'Academy', 'Learning Hub', 'Skills Factory'],
    PLANNER: ['Events Pro', 'Event Planning', 'Agence Événementielle', 'Occasions', 'Celebrations'],
    PRODUCER: ['Terroir', 'Ferme', 'Producteur', 'Coopérative', 'Domaine'],
    CLEANER: ['Clean Pro', 'Services de Nettoyage', 'Propreté Plus', 'Hygiène Services', 'Clean Express'],
    GYM: ['FitClub', 'Gym Center', 'Fitness Plus', 'Sport Center', 'Athletic Club'],
    UNIVERSAL_ECOMMERCE: ['Boutique', 'Shop', 'Store', 'Marketplace', 'E-store'],
    UNIVERSAL_SME: ['Solutions Pro', 'Services Plus', 'Expert Center', 'Business Hub', 'Pro Services'],
    RETAILER: ['Boutique', 'Store', 'Shop', 'Magasin', 'Concept Store'],
    BUILDER: ['Construction', 'Promoteur', 'Bâtisseur', 'Development', 'Immobilier Neuf'],
    RESTAURATEUR: ['Restaurant', 'Brasserie', 'Bistrot', 'Table', 'Cuisine'],
    TRAVEL_AGENT: ['Voyages', 'Travel Agency', 'Tours', 'Escapades', 'Destinations'],
    CONSULTANT: ['Consulting', 'Advisory', 'Conseil', 'Strategy', 'Partners'],
    IT_SERVICES: ['Tech Support', 'IT Solutions', 'Digital Services', 'Cloud Pro', 'Cyber Defense'],
    MANUFACTURER: ['Industries', 'Manufacturing', 'Production', 'Usine', 'Factory'],
    DOCTOR: ['Cabinet Médical', 'Clinique', 'Medical Center', 'Centre de Santé', 'Docteur'],
    NOTARY: ['Étude Notariale', 'Office Notarial', 'Notaire', 'Notary Office', 'Étude'],
    BAKERY: ['Boulangerie', 'Pâtisserie', 'Bakery', 'Fournil', 'Artisan Boulanger'],
    SPECIALIST: ['Centre Spécialisé', 'Clinique Spécialisée', 'Specialist Center', 'Expert Médical', 'Institut'],
    REAL_ESTATE_AGENT: ['Immobilier', 'Real Estate', 'Agence Immobilière', 'Properties', 'Immo'],
    HAIRDRESSER: ['Coiffure', 'Salon', 'Hair Studio', 'Barbershop', 'Style'],
    GROCERY: ['Marché', 'Épicerie', 'Fresh Market', 'Primeur', 'Bio Market']
};

// ============================================================
// TENANT GENERATION LOGIC
// ============================================================

function generatePhone(prefix, index) {
    const base = 100000000 + (index * 1234567) % 900000000;
    return `${prefix}${base.toString().slice(0, 9)}`;
}

function generateTenants() {
    const tenants = [];
    let globalIndex = 0;

    // For each persona, generate ~7-8 tenants across different locations
    for (const [personaKey, personaConfig] of Object.entries(PERSONAS)) {
        const widgetType = personaConfig.widget;
        const services = personaConfig.services;
        const payment = personaConfig.payment;
        const namePatterns = BUSINESS_NAMES[personaKey] || ['Business'];

        // Distribute across countries
        const countries = ['morocco', 'france', 'spain', 'uk', 'uae', 'belgium', 'netherlands'];
        const tenantsPerPersona = 8; // ~8 tenants per persona = 320 total, we'll trim to 300

        for (let i = 0; i < tenantsPerPersona && globalIndex < 300; i++) {
            const countryKey = countries[i % countries.length];
            const country = LOCATIONS[countryKey];
            const city = country.cities[i % country.cities.length];
            const quartier = city.quartiers[i % city.quartiers.length];
            const namePattern = namePatterns[i % namePatterns.length];
            const lang = country.languages[i % country.languages.length];

            const tenant = {
                id: `${widgetType.toLowerCase()}_${personaKey.toLowerCase()}_${countryKey}_${String(i + 1).padStart(2, '0')}`,
                name: `${namePattern} ${city.name}`,
                business_name: `${namePattern} ${city.name} ${quartier}`,
                email: `contact@${namePattern.toLowerCase().replace(/[^a-z]/g, '')}-${city.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
                sector: personaKey,
                widget_type: widgetType,
                phone: generatePhone(country.prefix, globalIndex),
                address: `${Math.floor(Math.random() * 200) + 1} ${quartier}, ${city.name}`,
                horaires: lang === 'en' ? 'Mon-Fri 9am-6pm' :
                          lang === 'es' ? 'Lun-Vie 9h-18h' :
                          lang === 'ar' || lang === 'ary' ? 'الإثنين-الجمعة 9h-18h' :
                          'Lun-Ven 9h-18h',
                services: JSON.stringify(services),
                zones: JSON.stringify([city.name.toLowerCase(), quartier.toLowerCase()]),
                currency: country.currency,
                voice_language: lang,
                payment_method: payment,
                payment_details: getPaymentDetails(payment, lang, country.currency)
            };

            tenants.push(tenant);
            globalIndex++;
        }
    }

    return tenants.slice(0, 300); // Ensure exactly 300
}

function getPaymentDetails(method, lang, currency) {
    const details = {
        INVOICE: { fr: 'Facture 30 jours', en: 'Net 30 invoice', es: 'Factura 30 días', ar: 'فاتورة 30 يوم', ary: 'فاتورة 30 يوم' },
        CARD: { fr: 'CB acceptée', en: 'Cards accepted', es: 'Tarjeta aceptada', ar: 'البطاقة مقبولة', ary: 'كارط مقبولة' },
        CARD_OR_CASH: { fr: 'CB ou espèces', en: 'Card or cash', es: 'Tarjeta o efectivo', ar: 'بطاقة أو نقد', ary: 'كارط ولا كاش' },
        CARD_OR_CHECK: { fr: 'CB ou chèque', en: 'Card or check', es: 'Tarjeta o cheque', ar: 'بطاقة أو شيك', ary: 'كارط ولا شيك' },
        CASH_OR_CARD: { fr: 'Espèces ou CB', en: 'Cash or card', es: 'Efectivo o tarjeta', ar: 'نقد أو بطاقة', ary: 'كاش ولا كارط' },
        COMMISSION: { fr: 'Commission sur transaction', en: 'Commission-based', es: 'Comisión', ar: 'عمولة', ary: 'كوميسيون' },
        MILESTONE: { fr: 'Paiement par étapes', en: 'Milestone payments', es: 'Pagos por etapas', ar: 'دفع على مراحل', ary: 'خلاص بالمراحل' },
        SUBSCRIPTION: { fr: 'Abonnement mensuel', en: 'Monthly subscription', es: 'Suscripción mensual', ar: 'اشتراك شهري', ary: 'أبونمان شهري' },
        DEPOSIT: { fr: 'Acompte à la réservation', en: 'Deposit on booking', es: 'Depósito al reservar', ar: 'عربون عند الحجز', ary: 'عربون فالحجز' },
        HOURLY: { fr: 'Tarif horaire', en: 'Hourly rate', es: 'Tarifa por hora', ar: 'سعر الساعة', ary: 'التمن ديال الساعة' },
        PERCENTAGE: { fr: 'Pourcentage des travaux', en: 'Percentage of works', es: 'Porcentaje de obras', ar: 'نسبة من الأعمال', ary: 'النسبة ديال الخدمة' },
        BANK_TRANSFER: { fr: 'Virement bancaire', en: 'Bank transfer', es: 'Transferencia bancaria', ar: 'تحويل بنكي', ary: 'تحويل بنكي' },
        COD_OR_CARD: { fr: 'Paiement à livraison ou CB', en: 'COD or card', es: 'Contrareembolso o tarjeta', ar: 'الدفع عند التوصيل أو بطاقة', ary: 'خلاص فالتوصيل ولا كارط' },
        SHOPIFY_CHECKOUT: { fr: 'Checkout Shopify sécurisé', en: 'Secure Shopify checkout', es: 'Pago seguro Shopify', ar: 'دفع آمن', ary: 'خلاص آمن' },
        CARD_OR_BOOKING: { fr: 'CB ou via Booking', en: 'Card or via Booking', es: 'Tarjeta o Booking', ar: 'بطاقة أو Booking', ary: 'كارط ولا Booking' },
        CARD_OR_TRANSFER: { fr: 'CB ou virement', en: 'Card or transfer', es: 'Tarjeta o transferencia', ar: 'بطاقة أو تحويل', ary: 'كارط ولا تحويل' }
    };
    return details[method]?.[lang] || details[method]?.fr || 'Paiement accepté';
}

// ============================================================
// SEED FUNCTION
// ============================================================

async function seed300Tenants(options = {}) {
    const { dryRun = false, clear = false } = options;

    console.log('\n' + '█'.repeat(70));
    console.log('  300 MULTI-TENANT SEEDER');
    console.log('  Session 250.97sexies - 40 Personas × ~8 Tenants');
    console.log('█'.repeat(70));
    console.log(`\n  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`  Target: 300 tenants × 5 languages = 1,500 KB files`);

    // Load DB
    let db;
    try {
        const { getDB } = require('../core/GoogleSheetsDB.cjs');
        db = getDB();
        console.log('  Database: Connected ✅\n');
    } catch (err) {
        console.error('  Database: FAILED ❌', err.message);
        process.exit(1);
    }

    // Clear existing if requested
    if (clear && !dryRun) {
        console.log('  Clearing existing tenants (keeping client_demo)...');
        const existing = await db.find('tenants', {});
        let cleared = 0;
        for (const t of existing) {
            if (t.id !== 'client_demo' && t.id !== 'agency_internal') {
                await db.delete('tenants', t.id);
                cleared++;
            }
        }
        console.log(`  Cleared ${cleared} tenants\n`);
    }

    // Generate tenants
    const tenants = generateTenants();
    console.log(`  Generated ${tenants.length} tenant definitions\n`);

    // Distribution summary
    const byWidget = { B2B: 0, B2C: 0, ECOM: 0 };
    const byPersona = {};
    const byCountry = {};

    for (const t of tenants) {
        byWidget[t.widget_type] = (byWidget[t.widget_type] || 0) + 1;
        byPersona[t.sector] = (byPersona[t.sector] || 0) + 1;
        const country = t.id.split('_')[2];
        byCountry[country] = (byCountry[country] || 0) + 1;
    }

    console.log('  ─── DISTRIBUTION ───');
    console.log(`  Widget Types: B2B=${byWidget.B2B}, B2C=${byWidget.B2C}, ECOM=${byWidget.ECOM}`);
    console.log(`  Personas: ${Object.keys(byPersona).length} covered`);
    console.log(`  Countries: ${Object.entries(byCountry).map(([k,v]) => `${k}=${v}`).join(', ')}`);

    // Seed to DB
    const results = { created: 0, skipped: 0, errors: [] };

    console.log('\n  ─── SEEDING ───');
    for (const tenant of tenants) {
        try {
            const existing = await db.findOne('tenants', { id: tenant.id });
            if (existing) {
                results.skipped++;
                continue;
            }

            if (!dryRun) {
                await db.create('tenants', {
                    ...tenant,
                    plan: 'trial',
                    status: 'active',
                    mrr: 0,
                    nps_score: 0,
                    conversion_rate: 0,
                    qualified_leads: 0
                });
            }
            results.created++;

            if (results.created % 50 === 0) {
                console.log(`    Progress: ${results.created}/${tenants.length}`);
            }
        } catch (err) {
            results.errors.push({ id: tenant.id, error: err.message });
        }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  SEED COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n  Created: ${results.created}`);
    console.log(`  Skipped: ${results.skipped}`);
    console.log(`  Errors: ${results.errors.length}`);

    if (results.errors.length > 0 && results.errors.length < 10) {
        console.log('\n  ERRORS:');
        results.errors.forEach(e => console.log(`    - ${e.id}: ${e.error}`));
    }

    console.log('\n  NEXT: Run KB provisioning for all tenants:');
    console.log('    node -e "require(\'./core/kb-provisioner.cjs\').provisionAllTenants()"');

    return results;
}

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const clear = args.includes('--clear');

    seed300Tenants({ dryRun, clear })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Fatal:', err);
            process.exit(1);
        });
}

module.exports = { seed300Tenants, generateTenants, PERSONAS, LOCATIONS };
