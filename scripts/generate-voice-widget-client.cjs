#!/usr/bin/env node
/**
 * Voice Widget Client Generator
 * Génère un widget vocal personnalisé pour chaque client
 *
 * Usage: node scripts/generate-voice-widget-client.cjs --config path/to/config.json
 *
 * Date: 2025-12-28
 * Version: 1.0
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const configPath = args.includes('--config')
  ? args[args.indexOf('--config') + 1]
  : null;

if (!configPath) {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║           VOICE WIDGET CLIENT GENERATOR - VocalIA               ║
╚════════════════════════════════════════════════════════════════════════╝

Usage:
  node scripts/generate-voice-widget-client.cjs --config <path-to-config.json>

Config file template:
  templates/voice-widget-client-config.json

Example:
  node scripts/generate-voice-widget-client.cjs --config clients/acme/config.json

This will generate:
  - clients/acme/voice-widget.js (customized)
  - clients/acme/voice-widget.min.js (minified)
  - clients/acme/knowledge.json (custom knowledge base)
  - clients/acme/DEPLOY.md (deployment instructions)
`);
  process.exit(0);
}

// Load config
if (!fs.existsSync(configPath)) {
  console.error(`❌ Config file not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const outputDir = path.dirname(configPath);

console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║           VOICE WIDGET CLIENT GENERATOR                                ║
╚════════════════════════════════════════════════════════════════════════╝

Client: ${config.client?.name || 'Unknown'}
Domain: ${config.client?.domain || 'Unknown'}
Output: ${outputDir}
`);

// Validate required fields
const requiredFields = ['client.name', 'branding.primaryColor'];
for (const field of requiredFields) {
  const parts = field.split('.');
  let value = config;
  for (const part of parts) {
    value = value?.[part];
  }
  if (!value) {
    console.error(`❌ Missing required field: ${field}`);
    process.exit(1);
  }
}

// Load base voice widget
const baseWidgetPath = path.join(__dirname, '../widget/voice-widget-v3.js');
if (!fs.existsSync(baseWidgetPath)) {
  console.error('❌ Base voice-widget.js not found');
  process.exit(1);
}

let widgetCode = fs.readFileSync(baseWidgetPath, 'utf8');

// 1. Replace CONFIG values
const branding = config.branding || {};
const messages = config.messages || {};
const client = config.client || {};

// Replace colors
if (branding.primaryColor) {
  widgetCode = widgetCode.replace(
    /primaryColor:\s*['"]#[A-Fa-f0-9]{6}['"]/,
    `primaryColor: '${branding.primaryColor}'`
  );
}
if (branding.primaryDark) {
  widgetCode = widgetCode.replace(
    /primaryDark:\s*['"]#[A-Fa-f0-9]{6}['"]/,
    `primaryDark: '${branding.primaryDark}'`
  );
}
if (branding.accentColor) {
  widgetCode = widgetCode.replace(
    /accentColor:\s*['"]#[A-Fa-f0-9]{6}['"]/,
    `accentColor: '${branding.accentColor}'`
  );
}
if (branding.darkBg) {
  widgetCode = widgetCode.replace(
    /darkBg:\s*['"]#[A-Fa-f0-9]{6}['"]/,
    `darkBg: '${branding.darkBg}'`
  );
}

// Replace messages
if (messages.welcomeMessage) {
  widgetCode = widgetCode.replace(
    /welcomeMessage:\s*['"].*?['"]/,
    `welcomeMessage: '${messages.welcomeMessage.replace(/'/g, "\\'")}'`
  );
}
if (messages.welcomeMessageTextOnly) {
  widgetCode = widgetCode.replace(
    /welcomeMessageTextOnly:\s*['"].*?['"]/,
    `welcomeMessageTextOnly: '${messages.welcomeMessageTextOnly.replace(/'/g, "\\'")}'`
  );
}
if (messages.placeholder) {
  widgetCode = widgetCode.replace(
    /placeholder:\s*['"].*?['"]/,
    `placeholder: '${messages.placeholder}'`
  );
}

// Replace API endpoint if provided
if (config.api?.voiceEndpoint) {
  widgetCode = widgetCode.replace(
    /const VOICE_API_ENDPOINT = ['"].*?['"]/,
    `const VOICE_API_ENDPOINT = '${config.api.voiceEndpoint}'`
  );
}

// Replace booking endpoint if provided
if (config.booking?.endpoint) {
  widgetCode = widgetCode.replace(
    /BOOKING_API_ENDPOINT\s*=\s*['"].*?['"]/g,
    `BOOKING_API_ENDPOINT = '${config.booking.endpoint}'`
  );
}

// Replace VocalIA references with client name
widgetCode = widgetCode.replace(/VocalIA/g, client.name);
widgetCode = widgetCode.replace(/vocalia\.ma/g, client.domain);

// 2. Generate customized widget file
const widgetOutputPath = path.join(outputDir, 'voice-widget.js');
fs.writeFileSync(widgetOutputPath, widgetCode);
console.log(`✅ Generated: ${widgetOutputPath}`);

// 3. Generate minified version (basic minification)
let minifiedCode = widgetCode
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
  .replace(/\/\/.*$/gm, '') // Remove line comments
  .replace(/\s+/g, ' ') // Collapse whitespace
  .replace(/\s*([{};,:=+\-*/<>!&|()[\]])\s*/g, '$1') // Remove spaces around operators
  .trim();

const minifiedOutputPath = path.join(outputDir, 'voice-widget.min.js');
fs.writeFileSync(minifiedOutputPath, minifiedCode);
console.log(`✅ Generated: ${minifiedOutputPath}`);

// 4. Generate knowledge.json
const knowledge = {
  version: new Date().toISOString().split('T')[0],
  generated: new Date().toISOString(),
  summary: config.knowledge?.summary || `${client.name} - Assistant vocal intelligent`,
  categories: config.knowledge?.categories || [
    "Services",
    "Produits",
    "Support",
    "Contact"
  ],
  services: config.knowledge?.services || {
    consultation: {
      description: "Consultation personnalisée",
      deliverable: "Recommandations sur mesure",
      delay: "24-48h"
    }
  },
  sectors: config.knowledge?.sectors || [
    "Général"
  ],
  contact: {
    email: config.client?.email || `contact@${client.domain}`,
    website: client.domain,
    pricing: config.knowledge?.pricingUrl || "/pricing.html",
    booking: config.knowledge?.bookingUrl || "/booking"
  }
};

const knowledgePath = path.join(outputDir, 'knowledge.json');
fs.writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));
console.log(`✅ Generated: ${knowledgePath}`);

// 5. Generate deployment instructions
const deployInstructions = `# Déploiement Voice Widget - ${client.name}

## Fichiers générés

| Fichier | Description | Taille |
|---------|-------------|--------|
| voice-widget.js | Widget source | ${Math.round(widgetCode.length / 1024)}KB |
| voice-widget.min.js | Widget minifié | ${Math.round(minifiedCode.length / 1024)}KB |
| knowledge.json | Base de connaissances | ${Math.round(JSON.stringify(knowledge).length / 1024)}KB |

## Installation

### 1. Uploader les fichiers

Placer dans le répertoire \`/voice-assistant/\` du site:
\`\`\`
${client.domain}/
└── voice-assistant/
    ├── voice-widget.min.js
    └── knowledge.json
\`\`\`

### 2. Ajouter le script

Dans le \`<head>\` ou avant \`</body>\`:
\`\`\`html
<script src="/voice-assistant/voice-widget.js" defer></script>
\`\`\`

### 3. Configurer le booking (si applicable)

${config.booking?.endpoint ? `
Endpoint configuré: \`${config.booking.endpoint}\`

Pour créer votre propre endpoint Google Apps Script:
1. Créer un script sur script.google.com
2. Connecter à Google Calendar client
3. Déployer en tant que Web App
4. Mettre à jour l'endpoint dans la config
` : `
Endpoint non configuré. Utiliser le formulaire de contact par défaut.
`}

### 4. Tester

1. Ouvrir le site dans Chrome ou Edge
2. Cliquer sur le bouton vocal en bas à droite
3. Tester les interactions vocales et texte
4. Vérifier le booking si configuré

## Personnalisation

### Couleurs
- Primary: ${branding.primaryColor || '#5E6AD2'}
- Primary Dark: ${branding.primaryDark || '#2B6685'}
- Accent: ${branding.accentColor || '#10B981'}
- Dark BG: ${branding.darkBg || '#191E35'}

### Messages
- Welcome: "${messages.welcomeMessage || 'Message par défaut'}"
- Placeholder: "${messages.placeholder || 'Posez votre question...'}"

## Support

Contact: contact@vocalia.ma

---
*Généré le ${new Date().toLocaleDateString('fr-FR')}*
*Voice Widget Generator v1.0*
`;

const deployPath = path.join(outputDir, 'DEPLOY.md');
fs.writeFileSync(deployPath, deployInstructions);
console.log(`✅ Generated: ${deployPath}`);

// Summary
console.log(`
════════════════════════════════════════════════════════════════════════
✅ GÉNÉRATION TERMINÉE

Fichiers créés:
  📄 ${widgetOutputPath}
  📄 ${minifiedOutputPath}
  📄 ${knowledgePath}
  📄 ${deployPath}

Prochaines étapes:
  1. Vérifier les fichiers générés
  2. Uploader sur le serveur client
  3. Ajouter le <script> dans les pages
  4. Tester sur Chrome/Edge

Temps estimé déploiement: 15-30 minutes
════════════════════════════════════════════════════════════════════════
`);
