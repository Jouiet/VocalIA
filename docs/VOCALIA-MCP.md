# VocalIA MCP Server

> Model Context Protocol (MCP) server exposant les capacités VocalIA Voice AI Platform.
> Version: 0.1.0 | 29/01/2026

## Qu'est-ce que MCP?

**Model Context Protocol** est un protocole ouvert créé par Anthropic pour l'intégration AI-to-tool, donné à la Linux Foundation's Agentic AI Foundation.

MCP permet à Claude Desktop d'interagir directement avec des services externes via un protocole standardisé JSON-RPC sur stdio.

---

## Analyse Concurrentielle (FAITS VÉRIFIÉS)

| Plateforme | MCP Server | Tools | Source |
|:-----------|:-----------|:------|:-------|
| **Vapi** | ✅ Officiel | 8 | github.com/VapiAI/mcp-server-vapi |
| **Twilio** | ✅ Community | 5 | github.com/twilio-labs/mcp-twilio |
| **Retell** | ❌ | N/A | Pas de MCP server trouvé |
| **VocalIA** | ✅ Officiel | **11** | mcp-server/ |

**Différenciateur VocalIA:** Plus de tools (11 vs 8 Vapi), personas multi-industrie intégrés.

---

## Installation

### Prérequis

- Node.js >= 18.0.0
- Claude Desktop installé

### Build

```bash
cd mcp-server
npm install
npm run build
```

### Configuration Claude Desktop

Éditer `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "node",
      "args": ["/chemin/vers/VocalIA/mcp-server/dist/index.js"],
      "env": {
        "VOCALIA_API_URL": "http://localhost:3004",
        "VOCALIA_API_KEY": "votre-api-key"
      }
    }
  }
}
```

Redémarrer Claude Desktop après modification.

---

## Tools Disponibles (11)

### Voice Tools (3)

| Tool | Description | Paramètres |
|:-----|:------------|:-----------|
| `voice_generate_response` | Génère une réponse IA vocale avec persona | `text`, `persona?`, `language?`, `knowledgeBaseId?` |
| `voice_synthesize` | Conversion texte vers audio (TTS) | `text`, `language?`, `voice?` |
| `voice_transcribe` | Conversion audio vers texte (STT) | `audio_url`, `language?` |

### Telephony Tools (4)

| Tool | Description | Paramètres |
|:-----|:------------|:-----------|
| `telephony_initiate_call` | Lancer un appel sortant IA | `to`, `persona?`, `language?`, `webhookUrl?`, `metadata?` |
| `telephony_get_call` | Obtenir le status d'un appel | `call_id` |
| `telephony_get_transcript` | Obtenir le transcript d'un appel | `call_id` |
| `telephony_transfer_call` | Transférer vers un humain | `call_id`, `to`, `announce?` |

### Persona Tools (1)

| Tool | Description | Paramètres |
|:-----|:------------|:-----------|
| `personas_list` | Liste les 30 personas disponibles | `tier?` (core/expansion/extended/all) |

### Knowledge Base Tools (1)

| Tool | Description | Paramètres |
|:-----|:------------|:-----------|
| `knowledge_base_search` | Recherche RAG dans la base de connaissances | `query`, `persona?`, `language?`, `limit?` |

### Lead Qualification Tools (2)

| Tool | Description | Paramètres |
|:-----|:------------|:-----------|
| `qualify_lead` | Qualification BANT (Budget, Authority, Need, Timeline) | `budget`, `authority`, `need`, `timeline`, `notes?` |
| `schedule_callback` | Planifier un rappel | `phone`, `datetime`, `persona?`, `notes?` |

---

## Langues Supportées

| Code | Langue | Support |
|:-----|:-------|:--------|
| `fr` | Français | ✅ Full |
| `en` | English | ✅ Full |
| `es` | Español | ✅ Full |
| `ar` | العربية (MSA) | ✅ Full |
| `ary` | Darija (Marocain) | ✅ Full (Atlas-Chat-9B) |

---

## Personas Disponibles (30)

### Tier 1 - Core (7)

| Key | Nom | Industries |
|:----|:----|:-----------|
| AGENCY | Agency Assistant | Marketing, Publicité, PR |
| DENTAL | Dental Receptionist | Dentaire, Santé |
| PROPERTY | Property Manager | Immobilier |
| HOA | HOA Representative | Communauté, Résidentiel |
| SCHOOL | School Administrator | Éducation |
| CONTRACTOR | Contractor Dispatch | Construction, Métiers |
| FUNERAL | Funeral Services | Funéraire, Mémorial |

### Tier 2 - Expansion (11)

HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, TRAINER, CHEF, TUTOR, PHOTOGRAPHER, FLORIST, CLEANER

### Tier 3 - Extended (12)

SECURITY, ACCOUNTANT, ARCHITECT, PHARMACIST, RENTER, LAWYER, INSURANCE, BANKER, RECRUITER, LOGISTICS, + UNIVERSAL_ECOMMERCE, UNIVERSAL_SME

---

## Exemples d'Utilisation

### Générer une réponse vocale

```
"Utilise VocalIA pour répondre à un client qui demande les horaires d'ouverture, en utilisant le persona DENTAL"
```

Claude utilisera `voice_generate_response` avec:
- text: "Quels sont vos horaires d'ouverture?"
- persona: "DENTAL"
- language: "fr"

### Lancer un appel téléphonique

```
"Appelle le +212600000000 avec le persona AGENCY pour qualifier ce lead"
```

Claude utilisera `telephony_initiate_call` avec:
- to: "+212600000000"
- persona: "AGENCY"
- language: "fr"

### Qualifier un lead

```
"Ce prospect a un budget de 50K, il est le décideur, besoin urgent, timeline 1 mois"
```

Claude utilisera `qualify_lead` avec:
- budget: 80
- authority: 100
- need: 90
- timeline: 85

Résultat: Score 89 → HOT lead

---

## Architecture Technique

```
┌─────────────────┐     JSON-RPC/stdio     ┌─────────────────┐
│  Claude Desktop │ ◄───────────────────► │  VocalIA MCP    │
│                 │                        │  Server         │
└─────────────────┘                        └────────┬────────┘
                                                    │
                                                    │ HTTP/REST
                                                    ▼
                                           ┌─────────────────┐
                                           │  VocalIA API    │
                                           │  localhost:3004 │
                                           └─────────────────┘
```

### Stack Technique

| Composant | Technologie |
|:----------|:------------|
| Runtime | Node.js 18+ |
| Langage | TypeScript |
| MCP SDK | @modelcontextprotocol/sdk |
| Validation | Zod |
| Transport | StdioServerTransport |

### Fichiers

```
mcp-server/
├── src/
│   └── index.ts       # Serveur MCP (533 lignes)
├── dist/
│   └── index.js       # Build compilé
├── package.json       # @vocalia/mcp-server
├── tsconfig.json      # Config TypeScript
└── README.md          # Documentation rapide
```

---

## Développement

### Mode Watch

```bash
npm run dev
```

### MCP Inspector (Debug)

```bash
npm run inspector
```

L'inspector ouvre une interface web pour tester les tools interactivement.

---

## Règles Critiques MCP

1. **JAMAIS utiliser `console.log`** - Corrompt le transport JSON-RPC
2. Utiliser `console.error` pour tout logging
3. Toujours retourner `{ content: [{ type: "text", text: "..." }] }`
4. Les tools doivent être idempotents quand possible

---

## Dépendances API

Le MCP Server nécessite que l'API VocalIA soit en cours d'exécution:

```bash
# Démarrer l'API
node core/voice-api-resilient.cjs --server

# Vérifier
curl http://localhost:3004/health
```

**BLOQUEUR:** Sans API backend déployée (api.vocalia.ma), les tools MCP retourneront des erreurs de connexion.

---

## Roadmap

| Version | Feature | Status |
|:--------|:--------|:------:|
| 0.1.0 | 11 tools de base | ✅ DONE |
| 0.2.0 | Resources (prompts, templates) | ⏳ Planifié |
| 0.3.0 | Streaming audio en temps réel | ⏳ Planifié |
| 1.0.0 | Publication npm | ⏳ Après API deploy |

---

## Liens

- [MCP Specification](https://modelcontextprotocol.io)
- [Anthropic MCP Docs](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [VocalIA GitHub](https://github.com/Jouiet/VoicalAI)

---

*Documentation créée: 29/01/2026 - Session 227*
*Maintenu par: VocalIA Engineering*
