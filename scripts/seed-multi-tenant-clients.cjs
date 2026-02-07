/**
 * Seed Multi-Tenant Test Clients
 * Populates Google Sheets DB with realistic test clients for B2B, B2C, ECOM widgets
 * Session 250.97quater - Production-ready multi-tenant testing
 *
 * Usage: node scripts/seed-multi-tenant-clients.cjs [--dry-run] [--clear]
 */

const path = require('path');

// Test client definitions covering all widget types and personas
const TEST_CLIENTS = {
    // ============================================================
    // B2B WIDGET TEST CLIENTS (10 clients)
    // ============================================================
    B2B: [
        {
            id: 'b2b_notaire_paris_01',
            name: 'Étude Notariale Dupont',
            business_name: 'Étude Notariale Dupont & Associés',
            email: 'contact@notaire-dupont.fr',
            sector: 'NOTARY',
            widget_type: 'B2B',
            phone: '+33145678901',
            address: '15 Avenue des Champs-Élysées, 75008 Paris',
            horaires: 'Lun-Ven 9h-18h sur RDV',
            services: JSON.stringify(['actes_immobiliers', 'successions', 'contrats_mariage', 'donations']),
            zones: JSON.stringify(['paris', 'ile_de_france']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'BANK_TRANSFER',
            payment_details: 'Virement bancaire - Provision sur acte requise'
        },
        {
            id: 'b2b_immo_lyon_01',
            name: 'Lyon Immobilier Pro',
            business_name: 'Lyon Immobilier Pro',
            email: 'contact@lyon-immo-pro.fr',
            sector: 'REAL_ESTATE_AGENT',
            widget_type: 'B2B',
            phone: '+33472345678',
            address: '45 Rue de la République, 69002 Lyon',
            horaires: 'Lun-Sam 9h-19h',
            services: JSON.stringify(['vente_commerciale', 'location_bureaux', 'estimation', 'gestion_patrimoine']),
            zones: JSON.stringify(['lyon', 'villeurbanne', 'rhone']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'COMMISSION',
            payment_details: 'Commission 3% HT sur transaction'
        },
        {
            id: 'b2b_recruiter_casa_01',
            name: 'Talent Force Maroc',
            business_name: 'Talent Force Maroc',
            email: 'rh@talentforce.ma',
            sector: 'RECRUITER',
            widget_type: 'B2B',
            phone: '+212522778899',
            address: 'Twin Center, Tour Ouest, Casablanca',
            horaires: 'Lun-Ven 8h30-18h30',
            services: JSON.stringify(['recrutement_cadres', 'chasse_tetes', 'interim', 'formation']),
            zones: JSON.stringify(['casablanca', 'rabat', 'tanger', 'marrakech']),
            currency: 'MAD',
            voice_language: 'fr',
            payment_method: 'COMMISSION',
            payment_details: 'Commission 15-20% du salaire annuel brut'
        },
        {
            id: 'b2b_consultant_madrid_01',
            name: 'Consultoría Digital Madrid',
            business_name: 'Consultoría Digital Madrid SL',
            email: 'info@consultoria-digital.es',
            sector: 'CONSULTANT',
            widget_type: 'B2B',
            phone: '+34912345678',
            address: 'Calle Serrano 50, 28001 Madrid',
            horaires: 'Lun-Vie 9h-18h',
            services: JSON.stringify(['transformacion_digital', 'estrategia_IT', 'gestion_proyectos', 'formacion']),
            zones: JSON.stringify(['madrid', 'barcelona', 'valencia']),
            currency: 'EUR',
            voice_language: 'es',
            payment_method: 'INVOICE',
            payment_details: 'Factura a 30 días - Tarifa horaria desde 150€/h'
        },
        {
            id: 'b2b_insurance_rabat_01',
            name: 'Atlas Assurances Pro',
            business_name: 'Atlas Assurances Professionnelles',
            email: 'pro@atlas-assurances.ma',
            sector: 'INSURER',
            widget_type: 'B2B',
            phone: '+212537667788',
            address: 'Avenue Hassan II, Rabat',
            horaires: 'Lun-Ven 8h-17h',
            services: JSON.stringify(['assurance_entreprise', 'RC_pro', 'flotte_auto', 'multirisque']),
            zones: JSON.stringify(['rabat', 'sale', 'kenitra', 'temara']),
            currency: 'MAD',
            voice_language: 'fr',
            payment_method: 'BANK_TRANSFER',
            payment_details: 'Paiement annuel ou trimestriel - Prélèvement possible'
        },
        {
            id: 'b2b_it_services_london_01',
            name: 'TechSupport UK',
            business_name: 'TechSupport UK Ltd',
            email: 'support@techsupport.co.uk',
            sector: 'IT_SERVICES',
            widget_type: 'B2B',
            phone: '+442071234567',
            address: '100 Liverpool Street, London EC2M 2RH',
            horaires: 'Mon-Fri 8am-8pm, Sat 9am-5pm',
            services: JSON.stringify(['managed_services', 'cloud_migration', 'cybersecurity', '24x7_support']),
            zones: JSON.stringify(['london', 'manchester', 'birmingham']),
            currency: 'EUR',
            voice_language: 'en',
            payment_method: 'SUBSCRIPTION',
            payment_details: 'Monthly subscription from £500/month'
        },
        {
            id: 'b2b_logistics_dubai_01',
            name: 'Gulf Express Logistics',
            business_name: 'Gulf Express Logistics LLC',
            email: 'business@gulfexpress.ae',
            sector: 'DISPATCHER',
            widget_type: 'B2B',
            phone: '+97142345678',
            address: 'Jebel Ali Free Zone, Dubai',
            horaires: 'Sun-Thu 8am-6pm',
            services: JSON.stringify(['freight_forwarding', 'customs_clearance', 'warehousing', 'last_mile']),
            zones: JSON.stringify(['dubai', 'abu_dhabi', 'sharjah', 'gcc']),
            currency: 'EUR',
            voice_language: 'en',
            payment_method: 'INVOICE',
            payment_details: 'Net 30 - Volume discounts available'
        },
        {
            id: 'b2b_contractor_marseille_01',
            name: 'BTP Méditerranée',
            business_name: 'BTP Méditerranée SARL',
            email: 'devis@btp-mediterranee.fr',
            sector: 'CONTRACTOR',
            widget_type: 'B2B',
            phone: '+33491234567',
            address: '25 Quai de Rive Neuve, 13007 Marseille',
            horaires: 'Lun-Ven 7h-17h',
            services: JSON.stringify(['construction', 'renovation', 'gros_oeuvre', 'amenagement']),
            zones: JSON.stringify(['marseille', 'aix', 'toulon', 'paca']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'MILESTONE',
            payment_details: '30% acompte, 40% à mi-travaux, 30% à réception'
        },
        {
            id: 'b2b_event_marrakech_01',
            name: 'Marrakech Events Pro',
            business_name: 'Marrakech Events & Conferences',
            email: 'events@marrakech-events.ma',
            sector: 'PLANNER',
            widget_type: 'B2B',
            phone: '+212524445566',
            address: 'Hivernage, Marrakech',
            horaires: 'Lun-Sam 9h-20h',
            services: JSON.stringify(['conferences', 'seminaires', 'team_building', 'lancement_produit']),
            zones: JSON.stringify(['marrakech', 'agadir', 'essaouira']),
            currency: 'MAD',
            voice_language: 'fr',
            payment_method: 'DEPOSIT',
            payment_details: '50% acompte à la réservation, solde J-7'
        },
        {
            id: 'b2b_legal_paris_01',
            name: 'Cabinet Juridique Voltaire',
            business_name: 'Cabinet Voltaire Avocats',
            email: 'contact@voltaire-avocats.fr',
            sector: 'COUNSELOR',
            widget_type: 'B2B',
            phone: '+33144556677',
            address: '88 Boulevard Voltaire, 75011 Paris',
            horaires: 'Lun-Ven 9h-19h sur RDV',
            services: JSON.stringify(['droit_affaires', 'contentieux', 'propriete_intellectuelle', 'social']),
            zones: JSON.stringify(['paris', 'ile_de_france']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'HOURLY',
            payment_details: 'Honoraires: consultation 150€, dossier sur devis'
        }
    ],

    // ============================================================
    // B2C WIDGET TEST CLIENTS (10 clients)
    // ============================================================
    B2C: [
        {
            id: 'b2c_dentist_bordeaux_01',
            name: 'Cabinet Dentaire Aquitaine',
            business_name: 'Cabinet Dentaire Aquitaine',
            email: 'rdv@dentaire-aquitaine.fr',
            sector: 'DENTAL',
            widget_type: 'B2C',
            phone: '+33556789012',
            address: '12 Place Gambetta, 33000 Bordeaux',
            horaires: 'Lun-Ven 8h30-19h, Sam 9h-13h',
            services: JSON.stringify(['detartrage', 'soins', 'protheses', 'implants', 'orthodontie']),
            zones: JSON.stringify(['bordeaux', 'merignac', 'pessac']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'CARD_OR_CHECK',
            payment_details: 'CB acceptée, tiers payant, facilités de paiement'
        },
        {
            id: 'b2c_doctor_casa_01',
            name: 'Cabinet Dr. El Amrani',
            business_name: 'Cabinet Médical Dr. El Amrani',
            email: 'secretariat@dr-elamrani.ma',
            sector: 'DOCTOR',
            widget_type: 'B2C',
            phone: '+212522334455',
            address: 'Rue Ibnou Sina, Maarif, Casablanca',
            horaires: 'Lun-Ven 9h-13h et 15h-19h',
            services: JSON.stringify(['consultation', 'suivi_chronique', 'vaccination', 'certificats']),
            zones: JSON.stringify(['casablanca', 'maarif', 'anfa']),
            currency: 'MAD',
            voice_language: 'ary',
            payment_method: 'CASH_OR_CARD',
            payment_details: 'Consultation 300 DH - CNSS/CNOPS accepté'
        },
        {
            id: 'b2c_gym_paris_01',
            name: 'FitClub Paris 15',
            business_name: 'FitClub Paris 15ème',
            email: 'paris15@fitclub.fr',
            sector: 'GYM',
            widget_type: 'B2C',
            phone: '+33145678901',
            address: '100 Rue de la Convention, 75015 Paris',
            horaires: 'Lun-Ven 6h-23h, Sam-Dim 8h-20h',
            services: JSON.stringify(['musculation', 'cardio', 'cours_collectifs', 'coaching', 'sauna']),
            zones: JSON.stringify(['paris_15', 'issy', 'vanves']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'SUBSCRIPTION',
            payment_details: 'Abonnement mensuel 49€, annuel 39€/mois'
        },
        {
            id: 'b2c_spa_agadir_01',
            name: 'Spa Océan Bleu',
            business_name: 'Spa Océan Bleu Agadir',
            email: 'reservation@spa-oceanbleu.ma',
            sector: 'HEALER',
            widget_type: 'B2C',
            phone: '+212528334455',
            address: 'Boulevard du 20 Août, Agadir',
            horaires: '7j/7 10h-22h',
            services: JSON.stringify(['hammam', 'massage', 'soins_visage', 'gommage', 'jacuzzi']),
            zones: JSON.stringify(['agadir', 'taghazout']),
            currency: 'MAD',
            voice_language: 'ary',
            payment_method: 'CARD_OR_CASH',
            payment_details: 'Forfaits disponibles - Réservation conseillée'
        },
        {
            id: 'b2c_salon_nantes_01',
            name: 'Coiffure Élégance',
            business_name: 'Salon Coiffure Élégance',
            email: 'rdv@elegance-coiffure.fr',
            sector: 'HAIRDRESSER',
            widget_type: 'B2C',
            phone: '+33240556677',
            address: '8 Rue Crébillon, 44000 Nantes',
            horaires: 'Mar-Sam 9h-19h',
            services: JSON.stringify(['coupe', 'coloration', 'balayage', 'lissage', 'mariage']),
            zones: JSON.stringify(['nantes_centre']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'CARD_OR_CASH',
            payment_details: 'CB acceptée - Forfaits mariée sur devis'
        },
        {
            id: 'b2c_hotel_fes_01',
            name: 'Riad Perle de Fès',
            business_name: 'Riad Perle de Fès',
            email: 'reservation@riad-perle-fes.ma',
            sector: 'CONCIERGE',
            widget_type: 'B2C',
            phone: '+212535667788',
            address: 'Derb Bensouda, Médina de Fès',
            horaires: 'Réception 24h/24',
            services: JSON.stringify(['hebergement', 'petit_dejeuner', 'hammam', 'excursions', 'transfert']),
            zones: JSON.stringify(['fes_medina']),
            currency: 'MAD',
            voice_language: 'fr',
            payment_method: 'CARD_OR_BOOKING',
            payment_details: 'Réservation Booking ou direct -15%'
        },
        {
            id: 'b2c_restaurant_lyon_01',
            name: 'Brasserie du Parc',
            business_name: 'Brasserie du Parc Lyon',
            email: 'reservation@brasserie-parc-lyon.fr',
            sector: 'RESTAURATEUR',
            widget_type: 'B2C',
            phone: '+33478112233',
            address: '25 Parc de la Tête d\'Or, 69006 Lyon',
            horaires: 'Mar-Dim 12h-14h30 et 19h-22h30',
            services: JSON.stringify(['dejeuner', 'diner', 'brunch_dimanche', 'groupe', 'terrasse']),
            zones: JSON.stringify(['lyon_6']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'CARD',
            payment_details: 'Réservation conseillée - Menus 25-45€'
        },
        {
            id: 'b2c_bakery_rabat_01',
            name: 'Pâtisserie Royale',
            business_name: 'Pâtisserie Royale Rabat',
            email: 'commandes@patisserie-royale.ma',
            sector: 'BAKERY',
            widget_type: 'B2C',
            phone: '+212537889900',
            address: 'Avenue Mohammed V, Rabat',
            horaires: '7j/7 6h-21h',
            services: JSON.stringify(['patisserie', 'viennoiserie', 'gateaux_commande', 'traiteur', 'livraison']),
            zones: JSON.stringify(['rabat', 'sale', 'temara']),
            currency: 'MAD',
            voice_language: 'ary',
            payment_method: 'CASH_OR_CARD',
            payment_details: 'Commande 48h à l\'avance pour gâteaux'
        },
        {
            id: 'b2c_travel_barcelona_01',
            name: 'Viajes Sol y Mar',
            business_name: 'Viajes Sol y Mar Barcelona',
            email: 'info@solymar-viajes.es',
            sector: 'TRAVEL_AGENT',
            widget_type: 'B2C',
            phone: '+34933445566',
            address: 'Passeig de Gràcia 50, Barcelona',
            horaires: 'Lun-Vie 10h-19h, Sab 10h-14h',
            services: JSON.stringify(['vuelos', 'hoteles', 'paquetes', 'cruceros', 'viajes_medida']),
            zones: JSON.stringify(['barcelona', 'cataluna']),
            currency: 'EUR',
            voice_language: 'es',
            payment_method: 'CARD_OR_TRANSFER',
            payment_details: '30% reserva, resto 15 días antes del viaje'
        }
    ],

    // ============================================================
    // ECOM WIDGET TEST CLIENTS (10 clients)
    // ============================================================
    ECOM: [
        {
            id: 'ecom_fashion_paris_01',
            name: 'Mode Parisienne',
            business_name: 'Mode Parisienne - Boutique en ligne',
            email: 'contact@mode-parisienne.fr',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+33145112233',
            address: 'Entrepôt: 15 Rue de Rivoli, Paris',
            horaires: 'Service client: Lun-Ven 9h-18h',
            services: JSON.stringify(['vetements', 'accessoires', 'chaussures', 'livraison_express']),
            zones: JSON.stringify(['france', 'belgique', 'suisse']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'SHOPIFY_CHECKOUT',
            payment_details: 'CB, PayPal, Klarna 3x sans frais - Livraison gratuite dès 50€'
        },
        {
            id: 'ecom_electronics_madrid_01',
            name: 'TechStore España',
            business_name: 'TechStore España Online',
            email: 'soporte@techstore.es',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+34911223344',
            address: 'Almacén: Polígono Industrial Vallecas, Madrid',
            horaires: 'Atención al cliente: Lun-Sab 9h-21h',
            services: JSON.stringify(['smartphones', 'ordenadores', 'gaming', 'accesorios', 'reparacion']),
            zones: JSON.stringify(['espana', 'portugal']),
            currency: 'EUR',
            voice_language: 'es',
            payment_method: 'WOOCOMMERCE_CHECKOUT',
            payment_details: 'Tarjeta, Bizum, financiación 12 meses - Envío 24-48h'
        },
        {
            id: 'ecom_darija_casa_01',
            name: 'سوق البيت',
            business_name: 'سوق البيت - التسوق عبر الإنترنت',
            email: 'contact@soukelbit.ma',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+212522556677',
            address: 'Entrepôt: Zone Industrielle, Casablanca',
            horaires: 'خدمة الزبناء: من الإثنين للسبت 9h-20h',
            services: JSON.stringify(['electromenager', 'decoration', 'cuisine', 'livraison_domicile']),
            zones: JSON.stringify(['casablanca', 'rabat', 'marrakech', 'tanger', 'fes']),
            currency: 'MAD',
            voice_language: 'ary',
            payment_method: 'COD_OR_CARD',
            payment_details: 'الدفع عند التوصيل أو بالكارط - توصيل مجاني من 500 درهم'
        },
        {
            id: 'ecom_beauty_london_01',
            name: 'GlowBeauty UK',
            business_name: 'GlowBeauty UK Online Store',
            email: 'hello@glowbeauty.co.uk',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+442078889900',
            address: 'Warehouse: Birmingham Distribution Centre',
            horaires: 'Customer Service: Mon-Fri 9am-6pm',
            services: JSON.stringify(['skincare', 'makeup', 'haircare', 'fragrances', 'gift_sets']),
            zones: JSON.stringify(['uk', 'ireland']),
            currency: 'EUR',
            voice_language: 'en',
            payment_method: 'SHOPIFY_CHECKOUT',
            payment_details: 'Card, PayPal, Apple Pay - Free delivery over £30'
        },
        {
            id: 'ecom_sports_lyon_01',
            name: 'SportZone France',
            business_name: 'SportZone France E-commerce',
            email: 'service@sportzone.fr',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+33472334455',
            address: 'Entrepôt: Saint-Priest, Lyon',
            horaires: 'SAV: Lun-Sam 8h-20h',
            services: JSON.stringify(['running', 'fitness', 'natation', 'velos', 'nutrition']),
            zones: JSON.stringify(['france', 'dom_tom']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'MAGENTO_CHECKOUT',
            payment_details: 'CB, Alma 3x, virement - Retours gratuits 30j'
        },
        {
            id: 'ecom_grocery_rabat_01',
            name: 'FreshMarket Rabat',
            business_name: 'FreshMarket - Courses en ligne Rabat',
            email: 'commandes@freshmarket.ma',
            sector: 'GROCERY',
            widget_type: 'ECOM',
            phone: '+212537445566',
            address: 'Centrale: Hay Riad, Rabat',
            horaires: 'Livraison: 7j/7 8h-22h',
            services: JSON.stringify(['fruits_legumes', 'boucherie', 'poissonnerie', 'epicerie', 'bio']),
            zones: JSON.stringify(['rabat', 'sale', 'temara']),
            currency: 'MAD',
            voice_language: 'ary',
            payment_method: 'COD_OR_CARD',
            payment_details: 'Paiement à la livraison ou en ligne - Créneaux 2h'
        },
        {
            id: 'ecom_furniture_amsterdam_01',
            name: 'HomeStyle NL',
            business_name: 'HomeStyle Netherlands',
            email: 'klantenservice@homestyle.nl',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+31206778899',
            address: 'Magazijn: Schiphol-Rijk',
            horaires: 'Klantenservice: Ma-Vr 9-18u',
            services: JSON.stringify(['meubels', 'verlichting', 'decoratie', 'tuinmeubelen']),
            zones: JSON.stringify(['nederland', 'belgie']),
            currency: 'EUR',
            voice_language: 'en',
            payment_method: 'SHOPIFY_CHECKOUT',
            payment_details: 'iDEAL, Card, PayPal - Gratis bezorging vanaf €150'
        },
        {
            id: 'ecom_kids_brussels_01',
            name: 'KidsPlanet BE',
            business_name: 'KidsPlanet Belgique',
            email: 'info@kidsplanet.be',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+3225667788',
            address: 'Entrepôt: Zaventem',
            horaires: 'Service client: Lun-Ven 9h-17h',
            services: JSON.stringify(['jouets', 'vetements_enfants', 'puericulture', 'livres']),
            zones: JSON.stringify(['belgique', 'luxembourg']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'WOOCOMMERCE_CHECKOUT',
            payment_details: 'Bancontact, CB, PayPal - Livraison Bpost 2-3j'
        },
        {
            id: 'ecom_organic_marseille_01',
            name: 'BioProvence Shop',
            business_name: 'BioProvence - Produits Bio en ligne',
            email: 'contact@bioprovence.fr',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+33491667788',
            address: 'Ferme: Aix-en-Provence',
            horaires: 'Service client: Lun-Ven 9h-17h',
            services: JSON.stringify(['alimentation_bio', 'cosmetiques_naturels', 'complements', 'vrac']),
            zones: JSON.stringify(['france']),
            currency: 'EUR',
            voice_language: 'fr',
            payment_method: 'SHOPIFY_CHECKOUT',
            payment_details: 'CB, virement - Point relais ou domicile'
        },
        {
            id: 'ecom_artisan_fes_01',
            name: 'Artisanat de Fès',
            business_name: 'Artisanat de Fès - Boutique en ligne',
            email: 'contact@artisanat-fes.ma',
            sector: 'UNIVERSAL_ECOMMERCE',
            widget_type: 'ECOM',
            phone: '+212535778899',
            address: 'Atelier: Médina de Fès',
            horaires: 'Service client: Lun-Sam 9h-19h',
            services: JSON.stringify(['poterie', 'zellige', 'cuir', 'tapis', 'dinanderie']),
            zones: JSON.stringify(['maroc', 'france', 'europe']),
            currency: 'MAD',
            voice_language: 'fr',
            payment_method: 'CARD_OR_TRANSFER',
            payment_details: 'CB, virement international - Livraison monde entier'
        }
    ]
};

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedClients(options = {}) {
    const { dryRun = false, clear = false, widgetTypes = ['B2B', 'B2C', 'ECOM'] } = options;

    console.log('\n' + '█'.repeat(70));
    console.log('  MULTI-TENANT CLIENT SEEDER');
    console.log('  Session 250.97quater - Production Test Data');
    console.log('█'.repeat(70));
    console.log(`\n  Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log(`  Widget Types: ${widgetTypes.join(', ')}`);

    // Load GoogleSheetsDB
    let db;
    try {
        const { getDB } = require('../core/GoogleSheetsDB.cjs');
        db = getDB();
        console.log('  Database: Connected ✅\n');
    } catch (err) {
        console.error('  Database: FAILED ❌', err.message);
        process.exit(1);
    }

    // Clear existing test clients if requested
    if (clear && !dryRun) {
        console.log('  Clearing existing test clients...');
        const existing = await db.find('tenants', {});
        const testClientIds = existing
            .filter(t => t.id?.startsWith('b2b_') || t.id?.startsWith('b2c_') || t.id?.startsWith('ecom_'))
            .map(t => t.id);

        for (const id of testClientIds) {
            await db.delete('tenants', id);
            console.log(`    Deleted: ${id}`);
        }
        console.log(`  Cleared ${testClientIds.length} test clients\n`);
    }

    // Seed clients by widget type
    const results = { created: 0, skipped: 0, errors: [] };

    for (const widgetType of widgetTypes) {
        const clients = TEST_CLIENTS[widgetType] || [];
        console.log(`\n  ─── ${widgetType} CLIENTS (${clients.length}) ───`);

        for (const client of clients) {
            try {
                // Check if exists
                const existing = await db.findOne('tenants', { id: client.id });
                if (existing) {
                    console.log(`    ⏭️  ${client.id} (exists)`);
                    results.skipped++;
                    continue;
                }

                // Create client
                if (!dryRun) {
                    const created = await db.create('tenants', {
                        ...client,
                        plan: 'trial',
                        status: 'active',
                        mrr: 0,
                        nps_score: 0,
                        conversion_rate: 0,
                        qualified_leads: 0
                    });
                    console.log(`    ✅ ${client.id} → ${client.business_name}`);
                } else {
                    console.log(`    🔍 ${client.id} → ${client.business_name} (dry run)`);
                }
                results.created++;
            } catch (err) {
                console.error(`    ❌ ${client.id}: ${err.message}`);
                results.errors.push({ id: client.id, error: err.message });
            }
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('  SEED SUMMARY');
    console.log('═'.repeat(70));
    console.log(`\n  Created: ${results.created}`);
    console.log(`  Skipped: ${results.skipped}`);
    console.log(`  Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
        console.log('\n  ERRORS:');
        results.errors.forEach(e => console.log(`    - ${e.id}: ${e.error}`));
    }

    console.log('\n' + '█'.repeat(70));

    return results;
}

// ============================================================
// CLI EXECUTION
// ============================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const clear = args.includes('--clear');

    seedClients({ dryRun, clear })
        .then(results => {
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedClients, TEST_CLIENTS };
