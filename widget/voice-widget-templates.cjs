#!/usr/bin/env node
/**
 * Voice Widget Templates - Industry Presets & Quick Deploy
 * 3A Automation - Session 116
 *
 * Purpose: Reduce Voice Widget deployment from 4h to 30min
 *
 * Usage:
 *   node voice-widget-templates.cjs --list                    # List all presets
 *   node voice-widget-templates.cjs --preset=ecommerce        # Generate e-commerce config
 *   node voice-widget-templates.cjs --preset=b2b --client="Acme" --domain="acme.com"
 *   node voice-widget-templates.cjs --validate=/path/to/config.json
 *   node voice-widget-templates.cjs --deploy --config=/path/to/config.json
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRY_PRESETS = {
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Boutiques en ligne, Shopify, WooCommerce',
    colors: {
      primary: '#4FBAF1',
      primaryDark: '#2B6685',
      accent: '#10B981'
    },
    defaultServices: [
      'Gestion de catalogue produits',
      'Automatisation commandes',
      'Emails transactionnels',
      'Récupération paniers abandonnés',
      'Segmentation clients'
    ],
    systemPromptFR: `Tu es l'assistant e-commerce de {clientName}.

EXPERTISE:
- Automatisation boutique en ligne
- Gestion des commandes et livraisons
- Marketing email et SMS
- Optimisation du parcours client

QUESTIONS FRÉQUENTES:
- Délais de livraison
- Suivi de commande
- Politique de retour
- Moyens de paiement

OBJECTIF: Guider le visiteur vers l'achat ou le support client.`,
    systemPromptEN: `You are the e-commerce assistant for {clientName}.

EXPERTISE:
- Online store automation
- Order and shipping management
- Email and SMS marketing
- Customer journey optimization

COMMON QUESTIONS:
- Shipping times
- Order tracking
- Return policy
- Payment methods

OBJECTIVE: Guide visitors towards purchase or customer support.`,
    keywords: ['commande', 'livraison', 'retour', 'paiement', 'produit', 'panier', 'order', 'shipping', 'return', 'payment']
  },

  b2b: {
    id: 'b2b',
    name: 'B2B Services',
    description: 'Services aux entreprises, consulting, SaaS',
    colors: {
      primary: '#3B82F6',
      primaryDark: '#1E40AF',
      accent: '#8B5CF6'
    },
    defaultServices: [
      'Automatisation des processus',
      'Intégration CRM/ERP',
      'Génération de leads',
      'Reporting automatisé',
      'Onboarding clients'
    ],
    systemPromptFR: `Tu es l'assistant B2B de {clientName}.

EXPERTISE:
- Automatisation des processus métier
- Intégration systèmes (CRM, ERP, API)
- Génération et qualification de leads
- Analytics et reporting

APPROCHE:
- Qualifier le besoin du prospect
- Identifier le décideur
- Proposer un appel découverte

OBJECTIF: Transformer le visiteur en lead qualifié.`,
    systemPromptEN: `You are the B2B assistant for {clientName}.

EXPERTISE:
- Business process automation
- Systems integration (CRM, ERP, API)
- Lead generation and qualification
- Analytics and reporting

APPROACH:
- Qualify prospect needs
- Identify decision maker
- Propose discovery call

OBJECTIVE: Convert visitors into qualified leads.`,
    keywords: ['automatisation', 'intégration', 'CRM', 'lead', 'processus', 'automation', 'integration', 'process']
  },

  agency: {
    id: 'agency',
    name: 'Agence Digitale',
    description: 'Agences marketing, web, communication',
    colors: {
      primary: '#4FBAF1',
      primaryDark: '#2B6685',
      accent: '#10B981'
    },
    defaultServices: [
      'Automatisation marketing',
      'Création de contenu AI',
      'Gestion réseaux sociaux',
      'Email marketing',
      'Analytics avancé'
    ],
    systemPromptFR: `Tu es l'assistant de l'agence {clientName}.

EXPERTISE:
- Automation, Analytics, AI
- Marketing digital automatisé
- Génération de contenu par IA
- Intégration multi-plateformes

SERVICES:
- Packs setup (390€ - 1399€)
- Retainers mensuels (290€ - 490€)
- Solutions sur mesure

OBJECTIF: Qualifier le prospect et proposer un audit gratuit.`,
    systemPromptEN: `You are the assistant for {clientName} agency.

EXPERTISE:
- Automation, Analytics, AI
- Automated digital marketing
- AI content generation
- Multi-platform integration

SERVICES:
- Setup packs (€390 - €1399)
- Monthly retainers (€290 - €490)
- Custom solutions

OBJECTIVE: Qualify prospects and offer a free audit.`,
    keywords: ['marketing', 'automation', 'contenu', 'social', 'email', 'content', 'digital']
  },

  restaurant: {
    id: 'restaurant',
    name: 'Restauration',
    description: 'Restaurants, traiteurs, food delivery',
    colors: {
      primary: '#EF4444',
      primaryDark: '#B91C1C',
      accent: '#F59E0B'
    },
    defaultServices: [
      'Réservation en ligne',
      'Commande click & collect',
      'Programme fidélité',
      'Gestion des avis',
      'Menu digital'
    ],
    systemPromptFR: `Tu es l'assistant du restaurant {clientName}.

INFORMATIONS:
- Horaires d'ouverture
- Menu et spécialités
- Options végétariennes/allergènes
- Réservation de table

ACTIONS:
- Réserver une table
- Commander en click & collect
- Obtenir l'adresse et itinéraire
- Voir le menu du jour

OBJECTIF: Faciliter la réservation ou la commande.`,
    systemPromptEN: `You are the assistant for {clientName} restaurant.

INFORMATION:
- Opening hours
- Menu and specialties
- Vegetarian/allergen options
- Table reservation

ACTIONS:
- Book a table
- Order click & collect
- Get address and directions
- View today's menu

OBJECTIVE: Facilitate reservation or ordering.`,
    keywords: ['réservation', 'menu', 'table', 'commande', 'horaires', 'reservation', 'order', 'booking']
  },

  retail: {
    id: 'retail',
    name: 'Commerce de détail',
    description: 'Magasins physiques, retail omnicanal',
    colors: {
      primary: '#059669',
      primaryDark: '#047857',
      accent: '#F59E0B'
    },
    defaultServices: [
      'Click & collect',
      'Gestion des stocks',
      'Programme fidélité',
      'Promotions automatisées',
      'Alertes produits'
    ],
    systemPromptFR: `Tu es l'assistant du magasin {clientName}.

INFORMATIONS:
- Disponibilité produits
- Horaires d'ouverture
- Localisation magasins
- Promotions en cours

SERVICES:
- Réserver un produit
- Vérifier la disponibilité
- Trouver le magasin le plus proche
- S'inscrire au programme fidélité

OBJECTIF: Guider le client vers l'achat en magasin ou en ligne.`,
    systemPromptEN: `You are the assistant for {clientName} store.

INFORMATION:
- Product availability
- Opening hours
- Store locations
- Current promotions

SERVICES:
- Reserve a product
- Check availability
- Find nearest store
- Join loyalty program

OBJECTIVE: Guide customers to purchase in-store or online.`,
    keywords: ['stock', 'magasin', 'promotion', 'fidélité', 'horaires', 'store', 'availability', 'loyalty']
  },

  saas: {
    id: 'saas',
    name: 'SaaS / Tech',
    description: 'Logiciels, applications, startups tech',
    colors: {
      primary: '#6366F1',
      primaryDark: '#4338CA',
      accent: '#EC4899'
    },
    defaultServices: [
      'Onboarding automatisé',
      'Support technique',
      'Intégrations API',
      'Billing & subscriptions',
      'Analytics produit'
    ],
    systemPromptFR: `Tu es l'assistant support de {clientName}.

EXPERTISE:
- Fonctionnalités du produit
- Tarification et plans
- Intégrations disponibles
- Documentation technique

SUPPORT:
- Dépannage rapide
- Escalade vers équipe technique
- Demande de démo
- FAQ produit

OBJECTIF: Répondre aux questions produit et convertir en démo.`,
    systemPromptEN: `You are the support assistant for {clientName}.

EXPERTISE:
- Product features
- Pricing and plans
- Available integrations
- Technical documentation

SUPPORT:
- Quick troubleshooting
- Escalation to tech team
- Demo requests
- Product FAQ

OBJECTIVE: Answer product questions and convert to demo.`,
    keywords: ['fonctionnalité', 'intégration', 'API', 'plan', 'tarif', 'feature', 'integration', 'pricing']
  },

  healthcare: {
    id: 'healthcare',
    name: 'Santé',
    description: 'Cliniques, cabinets, pharmacies',
    colors: {
      primary: '#06B6D4',
      primaryDark: '#0891B2',
      accent: '#10B981'
    },
    defaultServices: [
      'Prise de rendez-vous',
      'Rappels automatiques',
      'Téléconsultation',
      'Ordonnances digitales',
      'Suivi patient'
    ],
    systemPromptFR: `Tu es l'assistant du cabinet {clientName}.

SERVICES:
- Prise de rendez-vous
- Rappels automatiques
- Informations pratiques
- Préparation consultation

IMPORTANT:
- Ne JAMAIS donner de conseils médicaux
- Toujours rediriger vers un professionnel
- Respecter la confidentialité

OBJECTIF: Faciliter la prise de rendez-vous.`,
    systemPromptEN: `You are the assistant for {clientName} clinic.

SERVICES:
- Appointment booking
- Automatic reminders
- Practical information
- Consultation preparation

IMPORTANT:
- NEVER give medical advice
- Always redirect to a professional
- Respect confidentiality

OBJECTIVE: Facilitate appointment booking.`,
    keywords: ['rendez-vous', 'consultation', 'médecin', 'horaires', 'appointment', 'doctor', 'clinic']
  },

  realestate: {
    id: 'realestate',
    name: 'Immobilier',
    description: 'Agences immobilières, promoteurs',
    colors: {
      primary: '#0D9488',
      primaryDark: '#0F766E',
      accent: '#F59E0B'
    },
    defaultServices: [
      'Recherche de biens',
      'Estimation gratuite',
      'Prise de rendez-vous visites',
      'Alertes nouveaux biens',
      'Suivi dossiers'
    ],
    systemPromptFR: `Tu es l'assistant de l'agence immobilière {clientName}.

SERVICES:
- Recherche de biens (achat/location)
- Estimation gratuite
- Programmation de visites
- Suivi de dossier

QUESTIONS À POSER:
- Type de bien recherché
- Budget
- Localisation souhaitée
- Critères essentiels

OBJECTIF: Qualifier le besoin et programmer une visite.`,
    systemPromptEN: `You are the assistant for {clientName} real estate agency.

SERVICES:
- Property search (buy/rent)
- Free valuation
- Visit scheduling
- File tracking

QUESTIONS TO ASK:
- Type of property sought
- Budget
- Desired location
- Essential criteria

OBJECTIVE: Qualify needs and schedule a visit.`,
    keywords: ['appartement', 'maison', 'location', 'achat', 'visite', 'apartment', 'house', 'rent', 'buy', 'visit']
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function generateConfig(options) {
  const {
    preset = 'agency',
    clientName = 'Client',
    domain = 'client.com',
    email = `contact@${options.domain || 'client.com'}`,
    languages = ['fr'],
    services = null,
    bookingUrl = '',
    customColors = null,
    voiceEndpoint = 'https://dashboard.3a-automation.com/api/voice/respond',
    bookingEndpoint = ''
  } = options;

  const presetConfig = INDUSTRY_PRESETS[preset] || INDUSTRY_PRESETS.agency;
  const colors = customColors || presetConfig.colors;
  const finalServices = services || presetConfig.defaultServices;

  // Replace placeholders in prompts
  const promptFR = presetConfig.systemPromptFR.replace(/{clientName}/g, clientName);
  const promptEN = presetConfig.systemPromptEN.replace(/{clientName}/g, clientName);

  return {
    $schema: 'voice-widget-config-schema.json',
    $generator: '3A Automation Voice Widget Templates v1.0',
    $generatedAt: new Date().toISOString(),
    $preset: preset,

    client: {
      name: clientName,
      domain: domain,
      email: email,
      industry: preset,
      languages: languages
    },

    branding: {
      primaryColor: colors.primary,
      primaryDark: colors.primaryDark,
      accentColor: colors.accent,
      darkBg: '#191E35',
      textColor: '#FFFFFF',
      textSecondary: '#94A3B8'
    },

    messages: {
      fr: {
        welcomeMessage: `Bonjour ! Je suis l'assistant ${clientName}. Comment puis-je vous aider ?`,
        welcomeMessageTextOnly: `Bonjour ! Posez votre question par écrit.`,
        placeholder: 'Posez votre question...',
        buttonTitle: 'Assistant vocal',
        errorMessage: 'Erreur de connexion. Veuillez réessayer.',
        bookingPrompt: 'Souhaitez-vous prendre rendez-vous ?'
      },
      en: {
        welcomeMessage: `Hello! I'm the ${clientName} assistant. How can I help you?`,
        welcomeMessageTextOnly: 'Hello! Type your question below.',
        placeholder: 'Ask your question...',
        buttonTitle: 'Voice assistant',
        errorMessage: 'Connection error. Please try again.',
        bookingPrompt: 'Would you like to schedule a meeting?'
      }
    },

    prompts: {
      fr: promptFR,
      en: promptEN
    },

    api: {
      voiceEndpoint: voiceEndpoint,
      timeout: 15000,
      fallbackProviders: ['grok', 'gemini', 'claude']
    },

    booking: {
      enabled: !!bookingUrl || !!bookingEndpoint,
      url: bookingUrl || `https://${domain}/booking`,
      endpoint: bookingEndpoint,
      type: bookingEndpoint ? 'api' : 'redirect'
    },

    knowledge: {
      industry: preset,
      services: finalServices,
      keywords: presetConfig.keywords || [],
      summary: `${clientName} - ${presetConfig.description}`
    },

    settings: {
      position: 'bottom-right',
      voiceEnabled: true,
      textFallback: true,
      autoOpen: false,
      debugMode: false
    },

    realtime: {
      enabled: false,
      proxyUrl: 'wss://voice-api.3a-automation.com/realtime',
      fallbackUrl: 'ws://localhost:3007',
      voice: 'ara',
      autoUpgrade: true
    },

    analytics: {
      enabled: true,
      eventCategory: 'voice_assistant',
      trackOpen: true,
      trackMessages: true,
      trackBookings: true,
      trackErrors: true
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!config.client?.name) errors.push('client.name is required');
  if (!config.client?.domain) errors.push('client.domain is required');
  if (!config.branding?.primaryColor) errors.push('branding.primaryColor is required');
  if (!config.messages?.fr?.welcomeMessage) errors.push('messages.fr.welcomeMessage is required');
  if (!config.prompts?.fr) errors.push('prompts.fr is required');

  // Warnings
  if (!config.booking?.enabled) warnings.push('Booking is disabled');
  if (!config.analytics?.enabled) warnings.push('Analytics is disabled');
  if (config.client?.languages?.length < 2) warnings.push('Only one language configured');
  if (!config.realtime?.enabled) warnings.push('Realtime voice is disabled (will use Web Speech API)');

  // Format validations
  if (config.branding?.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.branding.primaryColor)) {
    errors.push('branding.primaryColor must be a valid hex color (#RRGGBB)');
  }

  if (config.api?.timeout && config.api.timeout < 5000) {
    warnings.push('API timeout is very short (<5s)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: Math.round(100 - (errors.length * 20) - (warnings.length * 5))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT HELPER
// ─────────────────────────────────────────────────────────────────────────────
function generateDeploymentFiles(config, outputDir) {
  const files = [];

  // 1. Main config JSON
  const configPath = path.join(outputDir, 'voice-widget-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  files.push(configPath);

  // 2. JavaScript config module for embedding
  const jsConfig = `/**
 * Voice Widget Configuration - ${config.client.name}
 * Generated: ${new Date().toISOString()}
 * Preset: ${config.$preset}
 */
window.VOICE_WIDGET_CONFIG = ${JSON.stringify(config, null, 2)};
`;
  const jsPath = path.join(outputDir, 'voice-widget-config.js');
  fs.writeFileSync(jsPath, jsConfig);
  files.push(jsPath);

  // 3. Embed snippet for client
  const embedSnippet = `<!-- 3A Automation Voice Widget - ${config.client.name} -->
<script src="https://3a-automation.com/voice-assistant/voice-widget.min.js"></script>
<script src="${config.client.domain}/voice-widget-config.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (window.VoiceWidget && window.VOICE_WIDGET_CONFIG) {
      window.VoiceWidget.init(window.VOICE_WIDGET_CONFIG);
    }
  });
</script>
`;
  const snippetPath = path.join(outputDir, 'embed-snippet.html');
  fs.writeFileSync(snippetPath, embedSnippet);
  files.push(snippetPath);

  // 4. README with deployment instructions
  const readme = `# Voice Widget Configuration - ${config.client.name}

## Generated
- Date: ${new Date().toISOString()}
- Preset: ${config.$preset} (${INDUSTRY_PRESETS[config.$preset]?.name || 'Custom'})
- Generator: 3A Automation Voice Widget Templates v1.0

## Files
- \`voice-widget-config.json\` - Main configuration (JSON)
- \`voice-widget-config.js\` - JavaScript module for embedding
- \`embed-snippet.html\` - Copy/paste snippet for client's website

## Deployment Steps

### 1. Upload Files
Upload \`voice-widget-config.js\` to client's website root.

### 2. Add Embed Snippet
Add the content of \`embed-snippet.html\` before \`</body>\` on all pages.

### 3. Configure Booking (Optional)
If using booking integration:
- Set up Google Apps Script or webhook
- Update \`booking.endpoint\` in config

### 4. Enable Realtime Voice (Optional)
For premium voice quality:
- Deploy grok-voice-realtime.cjs on 3A server
- Set \`realtime.enabled: true\`
- Update \`realtime.proxyUrl\`

## Customization
Edit \`voice-widget-config.json\` to customize:
- Colors: \`branding.*\`
- Messages: \`messages.fr.*\` / \`messages.en.*\`
- AI Prompt: \`prompts.fr\` / \`prompts.en\`
- Services: \`knowledge.services\`

## Support
Contact: support@3a-automation.com
Documentation: https://3a-automation.com/docs/voice-widget
`;
  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmePath, readme);
  files.push(readmePath);

  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--(\w+)(?:=(.+))?$/);
    if (match) {
      args[match[1]] = match[2] !== undefined ? match[2] : true;
    }
  });
  return args;
}

function main() {
  const args = parseArgs();

  // List presets
  if (args.list) {
    console.log('\n📋 Available Voice Widget Presets:\n');
    Object.entries(INDUSTRY_PRESETS).forEach(([id, preset]) => {
      console.log(`  ${id.padEnd(12)} - ${preset.name} (${preset.description})`);
    });
    console.log('\nUsage: node voice-widget-templates.cjs --preset=<id> --client="Name" --domain="domain.com"\n');
    return;
  }

  // Validate existing config
  if (args.validate) {
    console.log(`\n🔍 Validating: ${args.validate}\n`);
    try {
      const configPath = path.resolve(args.validate);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const result = validateConfig(config);

      if (result.valid) {
        console.log(`✅ Configuration is valid (score: ${result.score}/100)`);
      } else {
        console.log(`❌ Validation failed (score: ${result.score}/100)`);
        result.errors.forEach(e => console.log(`  ❌ ${e}`));
      }
      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      }
      process.exit(result.valid ? 0 : 1);
    } catch (e) {
      console.error(`❌ Failed to load config: ${e.message}`);
      process.exit(1);
    }
  }

  // Generate config from preset
  if (args.preset) {
    if (!INDUSTRY_PRESETS[args.preset]) {
      console.error(`❌ Unknown preset: ${args.preset}`);
      console.log('Use --list to see available presets');
      process.exit(1);
    }

    const config = generateConfig({
      preset: args.preset,
      clientName: args.client || 'Client',
      domain: args.domain || 'client.com',
      email: args.email,
      services: args.services ? args.services.split(',').map(s => s.trim()) : null,
      bookingUrl: args.booking,
      languages: args.lang ? args.lang.split(',') : ['fr', 'en']
    });

    // Validate
    const validation = validateConfig(config);

    if (args.deploy) {
      // Full deployment with files
      const outputDir = args.output || path.join(process.cwd(), 'voice-widget-deploy', config.client.name.toLowerCase().replace(/\s+/g, '-'));
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const files = generateDeploymentFiles(config, outputDir);
      console.log(`\n✅ Deployment package generated:`);
      files.forEach(f => console.log(`  📄 ${f}`));
      console.log(`\n📦 Output directory: ${outputDir}`);
    } else {
      // Just output JSON
      const outputPath = args.output || `./voice-widget-config-${args.preset}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
      console.log(`\n✅ Configuration generated: ${outputPath}`);
      console.log(`📊 Validation score: ${validation.score}/100`);

      if (validation.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        validation.warnings.forEach(w => console.log(`  - ${w}`));
      }
    }
    return;
  }

  // Help
  console.log(`
🎙️  Voice Widget Templates - 3A Automation

Presets for rapid Voice Widget deployment (4h → 30min)

Usage:
  List presets:
    node voice-widget-templates.cjs --list

  Generate config:
    node voice-widget-templates.cjs --preset=<id> --client="Name" --domain="domain.com"

  Options:
    --preset       Industry preset (required): ecommerce, b2b, agency, restaurant, retail, saas, healthcare, realestate
    --client       Client name
    --domain       Client domain
    --email        Contact email
    --lang         Languages (comma-separated, default: fr,en)
    --services     Custom services (comma-separated)
    --booking      Booking URL
    --output       Output file/directory path
    --deploy       Generate full deployment package (config + embed + README)

  Validate:
    node voice-widget-templates.cjs --validate=/path/to/config.json

Examples:
  node voice-widget-templates.cjs --list
  node voice-widget-templates.cjs --preset=ecommerce --client="Ma Boutique" --domain="maboutique.com"
  node voice-widget-templates.cjs --preset=b2b --client="Acme Corp" --domain="acme.com" --deploy
  node voice-widget-templates.cjs --validate=./config.json
`);
}

// Export for module use
module.exports = {
  INDUSTRY_PRESETS,
  generateConfig,
  validateConfig,
  generateDeploymentFiles
};

// Run if called directly
if (require.main === module) {
  main();
}
