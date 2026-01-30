# VocalIA MCP Server

> Model Context Protocol (MCP) server exposant les capacités VocalIA Voice AI Platform.
> Version: 0.3.3 | 30/01/2026 | Session 241.2 | BM25 RAG SOTA

## Qu'est-ce que MCP?

**Model Context Protocol** est un protocole ouvert créé par Anthropic pour l'intégration AI-to-tool, donné à la Linux Foundation's Agentic AI Foundation.

MCP permet à Claude Desktop d'interagir directement avec des services externes via un protocole standardisé JSON-RPC sur stdio.

---

## Status des Tools (Session 231.2)

### Vue d'ensemble

| Catégorie | Tools | Toujours Dispo | Nécessite Service |
|:----------|:-----:|:--------------:|:-----------------:|
| Voice | 2 | 0 | 2 |
| Persona | 3 | **3** | 0 |
| Lead Qualification | 2 | **2** | 0 |
| Knowledge Base | 2 | **1** | 1 |
| Telephony | 3 | 0 | 3 |
| CRM | 2 | 0 | 2 |
| E-commerce | 3 | 0 | 3 |
| Booking | 2 | **2** | 0 |
| System | 2 | **2** | 0 |
| **TOTAL** | **21** | **10** | **11** |

### Tools Toujours Disponibles (10)

Ces tools fonctionnent sans aucun service externe:

| Tool | Description | Persistence |
|:-----|:------------|:------------|
| `personas_list` | Liste les 30 personas par tier | Local |
| `personas_get` | Détails d'un persona spécifique | Local |
| `personas_get_system_prompt` | System prompt dans une langue | Local |
| `qualify_lead` | Calcul BANT avec scoring avancé | Local |
| `lead_score_explain` | Documentation méthodologie BANT | Local |
| `knowledge_base_status` | Info sur la KB (119+ services) | Local |
| `api_status` | Health check complet | Local |
| `system_languages` | 5 langues + 7 voix | Local |
| `booking_schedule_callback` | Planifier un rappel | **File: data/booking-queue.json** |
| `booking_create` | Créer un RDV | **File: data/booking-queue.json** |

### Tools Nécessitant Services (11)

| Tool | Dépendance | Port/Credential |
|:-----|:-----------|:----------------|
| `voice_generate_response` | voice-api-resilient.cjs | :3004 |
| `voice_providers_status` | voice-api-resilient.cjs | :3004 |
| `knowledge_search` | voice-api-resilient.cjs | :3004 |
| `telephony_initiate_call` | voice-telephony-bridge.cjs | :3009 + TWILIO_* |
| `telephony_get_status` | voice-telephony-bridge.cjs | :3009 |
| `telephony_transfer_call` | Active call session | :3009 |
| `crm_get_customer` | HubSpot | HUBSPOT_API_KEY |
| `crm_create_contact` | HubSpot | HUBSPOT_API_KEY |
| `ecommerce_order_status` | Shopify | SHOPIFY_ACCESS_TOKEN |
| `ecommerce_product_stock` | Shopify | SHOPIFY_ACCESS_TOKEN |
| `ecommerce_customer_profile` | Klaviyo | KLAVIYO_API_KEY |

---

## Analyse Concurrentielle (FAITS VÉRIFIÉS)

| Plateforme | MCP Server | Tools | Source |
|:-----------|:-----------|:------|:-------|
| **Vapi** | ✅ Officiel | 8 | [github.com/VapiAI/mcp-server-vapi](https://github.com/VapiAI/mcp-server-vapi) |
| **Twilio** | ✅ Community | 5 | [github.com/twilio-labs/mcp-twilio](https://github.com/twilio-labs/mcp-twilio) |
| **Vonage** | ✅ Officiel | 2 | [github.com/Vonage-Community/telephony-mcp-server](https://github.com/Vonage-Community/telephony-mcp-server) |
| **Retell** | ❌ | N/A | Pas de MCP server trouvé |
| **VocalIA** | ✅ Officiel | **21** | `mcp-server/` |

**Différenciateurs VocalIA:**
- 30 personas multi-industrie intégrés
- Qualification BANT automatique avec scoring avancé
- Support Darija (Atlas-Chat-9B)
- 5 langues natives
- Intégrations CRM/E-commerce pré-connectées

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
        "VOCALIA_TELEPHONY_URL": "http://localhost:3009",
        "VOCALIA_API_KEY": "votre-api-key"
      }
    }
  }
}
```

Redémarrer Claude Desktop après modification.

---

## Documentation des Tools

### Voice Tools (2)

#### `voice_generate_response`
Génère une réponse IA avec lead scoring intégré.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `message` | string | ✅ | Message utilisateur |
| `language` | enum | ❌ | fr, en, es, ar, ary (défaut: fr) |
| `sessionId` | string | ❌ | ID session pour continuité |
| `personaKey` | enum | ❌ | Persona à utiliser (défaut: AGENCY) |

#### `voice_providers_status`
Vérifie le status des providers AI (Grok, Gemini, Claude, Atlas-Chat).

---

### Persona Tools (3)

#### `personas_list`
Liste les 30 personas par tier.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `tier` | enum | ❌ | core, expansion, extended, all (défaut: all) |

**Réponse:**
```json
{
  "core": [7 personas],
  "expansion": [11 personas],
  "extended": [12 personas],
  "total": 30,
  "tiers": { "core": 7, "expansion": 11, "extended": 12 }
}
```

#### `personas_get`
Détails d'un persona avec preview du system prompt.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `personaKey` | enum | ✅ | AGENCY, DENTAL, PROPERTY, etc. |

#### `personas_get_system_prompt`
Obtenir le system prompt complet dans une langue.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `personaKey` | enum | ✅ | Clé du persona |
| `language` | enum | ❌ | Langue (défaut: fr) |

---

### Lead Qualification Tools (2)

#### `qualify_lead`
Qualification BANT avec scoring avancé.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `budget` | number | ✅ | Score 0-100 |
| `authority` | number | ✅ | Score 0-100 |
| `need` | number | ✅ | Score 0-100 |
| `timeline` | number | ✅ | Score 0-100 |
| `industry` | string | ❌ | Industrie (bonus +5 si high-value) |
| `notes` | string | ❌ | Notes additionnelles |

**Réponse:**
```json
{
  "bant_scores": { "budget": 80, "authority": 100, "need": 90, "timeline": 75 },
  "raw_score": 86,
  "industry_bonus": 5,
  "final_score": 91,
  "qualification": "HOT",
  "recommendation": "Immediate follow-up required...",
  "next_actions": ["create_booking", "send_calendar_invite", "notify_sales_team"]
}
```

#### `lead_score_explain`
Documentation complète de la méthodologie BANT.

---

### Knowledge Base Tools (2)

#### `knowledge_search`
Recherche TF-IDF dans la base de connaissances (119+ services).

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `query` | string | ✅ | Requête de recherche |
| `category` | string | ❌ | Catégorie (lead-gen, seo, email, etc.) |
| `limit` | number | ❌ | Nombre de résultats (1-10, défaut: 5) |

#### `knowledge_base_status`
Information sur la KB: 119+ services, 15 catégories, métadonnées stratégiques.

---

### Telephony Tools (3)

#### `telephony_initiate_call`
Déclencher un appel sortant via Twilio.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `to` | string | ✅ | Numéro E.164 (+33612345678) |
| `personaKey` | enum | ❌ | Persona pour l'appel |
| `language` | enum | ❌ | Langue (défaut: fr) |
| `context` | string | ❌ | Contexte pour l'agent |

**Prérequis:**
- `voice-telephony-bridge.cjs` en cours sur port 3009
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### `telephony_get_status`
Status du système téléphonie.

#### `telephony_transfer_call`
Transférer un appel actif vers un agent humain.

---

### CRM Tools (2)

#### `crm_get_customer`
Obtenir le contexte client depuis HubSpot.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `email` | string | ✅ | Email du client |

**Prérequis:** `HUBSPOT_API_KEY` ou `HUBSPOT_ACCESS_TOKEN`

#### `crm_create_contact`
Créer un nouveau contact dans HubSpot.

---

### E-commerce Tools (3)

#### `ecommerce_order_status`
Statut commande depuis Shopify.

**Prérequis:** `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_SHOP_NAME`

#### `ecommerce_product_stock`
Vérifier disponibilité produit.

#### `ecommerce_customer_profile`
Profil client depuis Klaviyo.

**Prérequis:** `KLAVIYO_API_KEY`

---

### Booking Tools (2)

#### `booking_schedule_callback`
Planifier un rappel avec contexte.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `email` | string | ✅ | Email contact |
| `phone` | string | ❌ | Téléphone |
| `preferredTime` | string | ✅ | Créneau souhaité |
| `notes` | string | ❌ | Notes contextuelles |
| `nextAction` | enum | ❌ | call_back, send_email, send_sms_booking_link, send_info_pack |

#### `booking_create`
Créer un RDV discovery call.

---

### System Tools (2)

#### `api_status`
Health check complet de tous les services.

**Réponse:**
```json
{
  "mcp_server": { "name": "vocalia", "version": "0.3.0", "tools_count": 21 },
  "services": {
    "voice_api": { "url": "http://localhost:3004", "status": "healthy", "latency_ms": 45 },
    "telephony": { "url": "http://localhost:3009", "status": "offline" }
  },
  "tools_availability": {
    "always_available": ["personas_list", "qualify_lead", ...],
    "requires_voice_api": ["voice_generate_response", ...],
    "requires_telephony": ["telephony_initiate_call", ...],
    "requires_hubspot": ["crm_get_customer", ...],
    "requires_shopify": ["ecommerce_order_status", ...]
  }
}
```

#### `system_languages`
Liste des 5 langues et 7 voix supportées.

---

## 30 Personas Disponibles

### Tier 1 - Core (7)

| Key | Nom | Industries | Voix | Sensibilité |
|:----|:----|:-----------|:-----|:------------|
| AGENCY | VocalIA Architect | marketing, consulting | ara | normal |
| DENTAL | Cabinet Dentaire | dental, healthcare | eve | high |
| PROPERTY | Property Management | real-estate | leo | normal |
| HOA | HOA Support | community, residential | sal | normal |
| SCHOOL | School Attendance | education | mika | high |
| CONTRACTOR | Contractor Leads | construction, trades | rex | normal |
| FUNERAL | Funeral Services | funeral, memorial | valentin | high |

### Tier 2 - Expansion (11)

HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, RECRUITER, DISPATCHER, COLLECTOR, SURVEYOR, GOVERNOR, INSURER

### Tier 3 - Extended (12)

ACCOUNTANT, ARCHITECT, PHARMACIST, RENTER, LOGISTICIAN, TRAINER, PLANNER, PRODUCER, CLEANER, GYM, UNIVERSAL_ECOMMERCE, UNIVERSAL_SME

---

## Langues Supportées

| Code | Langue | Support | Modèle |
|:-----|:-------|:--------|:-------|
| `fr` | Français | ✅ Full (default) | Grok/Gemini/Claude |
| `en` | English | ✅ Full | Grok/Gemini/Claude |
| `es` | Español | ✅ Full | Grok/Gemini/Claude |
| `ar` | العربية (MSA) | ✅ Full | Grok/Gemini/Claude |
| `ary` | Darija (Marocain) | ✅ Full | Atlas-Chat-9B |

---

## Architecture Technique

```
┌─────────────────┐     JSON-RPC/stdio     ┌─────────────────┐
│  Claude Desktop │ ◄───────────────────► │  VocalIA MCP    │
│                 │                        │  Server v0.3.0  │
└─────────────────┘                        └────────┬────────┘
                                                    │
                                   ┌────────────────┼────────────────┐
                                   │                │                │
                                   ▼                ▼                ▼
                          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                          │  Voice API   │ │  Telephony   │ │   HubSpot    │
                          │  :3004       │ │  :3009       │ │   Shopify    │
                          └──────────────┘ └──────────────┘ │   Klaviyo    │
                                                            └──────────────┘
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
│   └── index.ts       # Serveur MCP (950 lignes, 21 tools)
├── dist/
│   └── index.js       # Build compilé
├── package.json       # @vocalia/mcp-server v0.3.0
├── tsconfig.json      # Config TypeScript
└── README.md          # Quick start
```

---

## Exemples d'Utilisation

### Générer une réponse vocale

```
"Utilise VocalIA pour répondre à un client qui demande les horaires d'ouverture, en utilisant le persona DENTAL"
```

Claude utilisera `voice_generate_response` avec:
- message: "Quels sont vos horaires d'ouverture?"
- personaKey: "DENTAL"
- language: "fr"

### Qualifier un lead

```
"Ce prospect a un budget de 50K, il est le décideur, besoin urgent, timeline 1 mois, secteur e-commerce"
```

Claude utilisera `qualify_lead` avec:
- budget: 80
- authority: 100
- need: 90
- timeline: 85
- industry: "ecommerce"

Résultat: Score 91 → HOT lead (avec +5 bonus industrie)

### Lancer un appel téléphonique

```
"Appelle le +212600000000 avec le persona AGENCY pour qualifier ce lead"
```

Claude utilisera `telephony_initiate_call` avec:
- to: "+212600000000"
- personaKey: "AGENCY"
- language: "fr"

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
5. Documenter clairement les dépendances de chaque tool

---

## Dépendances API

Le MCP Server nécessite que les APIs VocalIA soient en cours d'exécution:

```bash
# Démarrer Voice API
node core/voice-api-resilient.cjs --server

# Démarrer Telephony (optionnel)
node telephony/voice-telephony-bridge.cjs

# Vérifier
curl http://localhost:3004/health
curl http://localhost:3009/health
```

---

## Variables d'Environnement

| Variable | Service | Requis |
|:---------|:--------|:------:|
| `VOCALIA_API_URL` | Voice API | ❌ (défaut: localhost:3004) |
| `VOCALIA_TELEPHONY_URL` | Telephony | ❌ (défaut: localhost:3009) |
| `VOCALIA_API_KEY` | Authentication | ❌ |
| `TWILIO_ACCOUNT_SID` | Telephony | Pour téléphonie |
| `TWILIO_AUTH_TOKEN` | Telephony | Pour téléphonie |
| `TWILIO_PHONE_NUMBER` | Telephony | Pour téléphonie |
| `HUBSPOT_API_KEY` | CRM | Pour CRM |
| `SHOPIFY_ACCESS_TOKEN` | E-commerce | Pour Shopify |
| `SHOPIFY_SHOP_NAME` | E-commerce | Pour Shopify |
| `KLAVIYO_API_KEY` | E-commerce | Pour Klaviyo |

---

## SOTA Comparison (Session 241 Audit)

Comparaison vs [MCP Best Practices 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026):

| Best Practice | Standard 2026 | VocalIA | Status |
|:--------------|:--------------|:--------|:------:|
| **Single Responsibility** | 1 domaine par server | 1 domaine (Voice AI) | ✅ |
| **Bounded Toolsets** | Focused, specific contracts | 21 tools, well-documented | ✅ |
| **Auth (HTTP)** | OAuth 2.1 | N/A (stdio transport) | ✅ |
| **Auth (stdio)** | API Keys acceptable | API Keys | ✅ |
| **Zod Validation** | Schema validation | All inputs validated | ✅ |
| **Error Handling** | Structured errors | try/catch, JSON response | ✅ |
| **Monitoring** | Prometheus/Grafana | ❌ Not implemented | P3 |
| **Streaming** | For long operations | ❌ Not implemented | P3 |
| **Session State** | Per-conversation cache | File persistence | ✅ |

**Score: 7/9 (78%)** - Missing only production monitoring features.

---

## Roadmap

| Version | Feature | Status |
|:--------|:--------|:------:|
| 0.1.0 | 4 tools de base | ✅ DONE |
| 0.2.0 | Refactoring factuel | ✅ DONE |
| 0.3.0 | 21 tools SOTA | ✅ DONE |
| 0.3.3 | SOTA Audit compliance | ✅ Session 241 |
| 0.4.0 | Resources (prompts, templates) | ⏳ Planifié |
| 0.5.0 | Streaming audio en temps réel | ⏳ Planifié |
| 0.6.0 | Prometheus metrics | ⏳ P3 |
| 1.0.0 | Publication npm | ⏳ Après API deploy |

---

## Liens

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/)
- [Anthropic MCP Docs](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [VocalIA GitHub](https://github.com/Jouiet/VoicalAI)
- [Vonage Telephony MCP](https://github.com/Vonage-Community/telephony-mcp-server)

---

*Documentation créée: 29/01/2026 - Session 227*
*Mise à jour: 30/01/2026 - Session 241 (SOTA Audit: 78% compliant)*
*Maintenu par: VocalIA Engineering*
