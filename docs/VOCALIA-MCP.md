# VocalIA MCP Server

> Model Context Protocol (MCP) server exposant les capacités VocalIA Voice AI Platform.
> Version: 0.9.2 | 06/02/2026 | Session 250.98-FORENSIC | BM25 RAG SOTA | **203 tools** (22 inline + 181 modules) | **29 tool files**
> **Session 250.101**: ✅ **DOCS UPDATE** - 557 dossiers = test data. Score 6.5/10. CORS+XSS+pricing all FIXED (250.99-250.100)
> **Session 250.98**: ~~🔴 **FORENSIC**~~ - 203 tools confirmé (22 inline index.ts + 181 via 29 catégories). 29 fichiers tools/ (pas 28).
> **Session 250.89-EXHAUSTIF**: ✅ AGENCY WIDGET TENANT - 243/243 tests (100%), prompt engineering × 5 langues
> **Session 250.97octies**: ✅ MULTI-TENANT SCALE - 537 tenants × 40 sectors × 12 regions = 2,890 KB files
> **Session 250.91**: ✅ ALL BLOCKERS RESOLVED - 306/309 tests pass, Widget B2B v2.2.0 deployed
> **Session 250.90**: ✅ I18N 100% COMPLETE - All 5 languages, Spanish decontamination done
> **Session 250.87bis**: ✅ MCP GAPS FILLED - hubspot.ts (7), klaviyo.ts (5), twilio.ts (5 incl. WhatsApp) = +17 tools
> **Session 250.91 FORENSIC AUDIT**: Deleted orphan `whatsapp-voice-bridge.cjs` (contained PLACEHOLDERS)
> **Protocol Status:**
>
> - **A2A (Event Bus)**: ✅ Widget events via voice-api-resilient.cjs → AgencyEventBus
> - **AG-UI (Dynamic UI)**: ✅ Widget Orchestrator (8 widgets)
> - **UCP (ContextBox)**: ✅ ACTIVE - LTV tiers (bronze→diamond)
> - **MCP (Tools)**: ✅ 203 tools verified
> **iPaaS:** Zapier ✅ | Make ✅ | n8n ✅ → **+7000 apps connectables**
> **Payments:** Stripe ✅ → Payment Links, Checkout, Invoices, Refunds (19 tools)
> **Widget Products:** B2B (659 LOC) | B2C (3,135 LOC) | Ecom (5,650 LOC) | Telephony (170KB)
> **Personas:** 40 total | ✅ `widget_types` filtering IMPLEMENTED

## Qu'est-ce que MCP?

**Model Context Protocol** est un protocole ouvert créé par Anthropic pour l'intégration AI-to-tool, donné à la Linux Foundation's Agentic AI Foundation.

MCP permet à Claude Desktop d'interagir directement avec des services externes via un protocole standardisé JSON-RPC sur stdio.

---

## Status des Tools (Session 249.11)

### Vue d'ensemble

| Catégorie | Tools | Toujours Dispo | Nécessite Service |
|:----------|:-----:|:--------------:|:-----------------:|
| Voice | 2 | 0 | 2 |
| Persona | 3 | **3** | 0 |
| Lead Qualification | 2 | **2** | 0 |
| Knowledge Base | 2 | **1** | 1 |
| Telephony | 3 | 0 | 3 |
| **Messaging** | **1** | 0 | **1** |
| CRM | 2 | 0 | 2 |
| E-commerce (inline) | 3 | 0 | 3 |
| Booking | 2 | **2** | 0 |
| System | 3 | **3** | 0 |
| Calendar | 2 | 0 | 2 |
| Slack | 1 | 0 | 1 |
| UCP/CDP | 7 | 0 | 7 |
| **Sheets** | **5** | 0 | **5** |
| **Drive** | **6** | 0 | **6** |
| **Docs** | **4** | 0 | **4** |
| **Gmail** | **7** | 0 | **7** |
| **Calendly** | **6** | 0 | **6** |
| **Freshdesk** | **6** | 0 | **6** |
| **Zendesk** | **6** | 0 | **6** |
| **Pipedrive** | **7** | 0 | **7** |
| **WooCommerce** | **7** | 0 | **7** |
| **Zoho CRM** | **6** | 0 | **6** |
| **Magento** | **10** | 0 | **10** |
| **Wix Stores** | **6** | 0 | **6** |
| **Squarespace** | **7** | 0 | **7** |
| **BigCommerce** | **9** | 0 | **9** |
| **PrestaShop** | **10** | 0 | **10** |
| **Export** | **5** | **5** | 0 |
| **Email** | **3** | 0 | **3** |
| **Zapier** | **3** | 0 | **3** |
| **Make** | **5** | 0 | **5** |
| **n8n** | **5** | 0 | **5** |
| **Stripe** | **19** | 0 | **19** |
| **Recommendations** | **3** | 0 | **3** |
| **HubSpot** | **7** | 0 | **7** |
| **Klaviyo** | **5** | 0 | **5** |
| **Twilio** | **5** | 0 | **5** |
| **TOTAL** | **203** | **16** | **187** |

### E-commerce Market Coverage (~64%)

| Platform | Tools | Market Share | API Docs |
|:---------|:-----:|:------------:|:---------|
| WooCommerce | 7 | 33-39% | REST v3 |
| Shopify | 8 | 10.32% | GraphQL Admin API 2026-01 |
| Magento | 10 | 8% | REST v1 (FULL CRUD) |
| **Wix Stores** | 6 | 7.4% (+32.6% YoY) | REST |
| **Squarespace** | 7 | 2.6% | REST v1/v2 |
| **PrestaShop** | 10 | 1.91% | Webservice (FULL CRUD) |
| **BigCommerce** | 9 | 1% | REST v2/v3 (FULL CRUD) |

### WordPress/WooCommerce Architecture (Session 250.94 - VÉRIFIÉ)

**VocalIA a une couverture WordPress/WooCommerce COMPLÈTE via 3 composants:**

| Composant | Fichier | Lignes | Fonction |
|:----------|:--------|:------:|:---------|
| **MCP WooCommerce Tools** | `mcp-server/src/tools/woocommerce.ts` | **687** | 7 tools REST API v3 |
| **WordPress Plugin B2B** | `plugins/wordpress/vocalia-voice-widget.php` | **514** | Widget injection (40 personas, 5 langues) |
| **WordPress Plugin Ecom** | `distribution/wordpress/vocalia-voice-agent/vocalia-voice-agent.php` | **161** | WooCommerce widget (B2B/B2C/Ecom modes) |
| **Catalog Connector** | `core/catalog-connector.cjs` (WooCommerceCatalogConnector) | **~200** | Sync produits REST v3 |
| **Voice Ecom Tools** | `core/voice-ecommerce-tools.cjs` | **389** | checkOrderStatus(), getOrderHistory() |

**WooCommerce MCP Tools (7):**

| Tool | Fonction | Credential |
|:-----|:---------|:-----------|
| `woocommerce_list_orders` | Liste commandes avec filtres | WOOCOMMERCE_* |
| `woocommerce_get_order` | Détails commande par ID | WOOCOMMERCE_* |
| `woocommerce_update_order` | Màj statut commande | WOOCOMMERCE_* |
| `woocommerce_list_products` | Liste produits catalogue | WOOCOMMERCE_* |
| `woocommerce_get_product` | Détails produit par ID | WOOCOMMERCE_* |
| `woocommerce_list_customers` | Liste clients | WOOCOMMERCE_* |
| `woocommerce_get_customer` | Détails client par ID | WOOCOMMERCE_* |

**Credentials requis:**
```bash
WOOCOMMERCE_URL=https://store.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxx
```

**Pourquoi `wordpress.ts` N'EST PAS nécessaire:**
- Les WordPress MCP génériques (mcp-adapter, InstaWP) gèrent posts/pages/users/plugins
- VocalIA n'a **PAS besoin** de gérer le contenu WordPress
- VocalIA a besoin de **données e-commerce** → `woocommerce.ts` (7 tools) ✅
- VocalIA a besoin d'**injection widget** → `vocalia-voice-widget.php` ✅

**Status:** ✅ **COMPLETE** - Market share WordPress e-commerce = 33-39% (WooCommerce) = COUVERT

### Tools Toujours Disponibles (15)

Ces tools fonctionnent sans aucun service externe:

| Tool | Description | Persistence |
|:-----|:------------|:------------|
| `personas_list` | Liste les 40 personas par tier | Local |
| `personas_get` | Détails d'un persona spécifique | Local |
| `personas_get_system_prompt` | System prompt dans une langue | Local |
| `qualify_lead` | Calcul BANT avec scoring avancé | Local |
| `lead_score_explain` | Documentation méthodologie BANT | Local |
| `knowledge_base_status` | Info sur la KB (119+ services) | Local |
| `api_status` | Health check complet | Local |
| `system_languages` | 5 langues + 7 voix | Local |
| `booking_schedule_callback` | Planifier un rappel | **File: data/booking-queue.json** |
| `booking_create` | Créer un RDV | **File: data/booking-queue.json** |
| `export_generate_csv` | Générer fichier CSV | **File: data/exports/** |
| `export_generate_xlsx` | Générer fichier Excel | **File: data/exports/** |
| `export_generate_pdf` | Générer PDF document | **File: data/exports/** |
| `export_generate_pdf_table` | Générer PDF avec table | **File: data/exports/** |
| `export_list_files` | Lister exports disponibles | **File: data/exports/** |

### Tools Nécessitant Services (11)

| Tool | Dépendance | Port/Credential |
|:-----|:-----------|:----------------|
| `voice_generate_response` | voice-api-resilient.cjs | :3004 |
| `voice_providers_status` | voice-api-resilient.cjs | :3004 |
| `knowledge_search` | voice-api-resilient.cjs | :3004 |
| `telephony_initiate_call` | voice-telephony-bridge.cjs | TWILIO_* (Managed or BYOK) |
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
| **VocalIA** | ✅ Officiel | **186** | `mcp-server/` |

**Différenciateurs VocalIA (SOTA):**

- **186 tools** - 23x plus que Vapi (8 tools)
- **iPaaS complet** (Zapier, Make, n8n) → +7000 apps connectables
- 40 personas multi-industrie intégrés
- Qualification BANT automatique avec scoring avancé
- Support Darija (Atlas-Chat-9B)
- 5 langues natives (FR, EN, ES, AR, ARY)
- 19 intégrations pré-connectées (95%)
- Google Workspace complet (Calendar, Sheets, Drive, Docs)
- 3 CRM (HubSpot 7 tools, Pipedrive 7 tools, Zoho 6 tools) ✅ COMPLETE
- 7 E-commerce (Shopify 8, WooCommerce 7, Magento 10, Wix 6, Squarespace 7, BigCommerce 9, PrestaShop 10) ✅
- 2 Support (Freshdesk 6, Zendesk 6) ✅ COMPLETE
- 2 Calendriers (Google Calendar, Calendly 6 tools) ✅ COMPLETE
- **WordPress/WooCommerce:** ✅ COMPLETE - Voir section dédiée ci-dessous

---

## 6. Marketing Science & Conversion Engineering (The "Ultrathink" Upgrade)

- **State**: **SOTA (Actively Optimized)**
- **Capabilities**:
  - **Multilingual Copy Engine**: Native support for FR, EN, ES, AR, ARY with "Ultrathink" copy standards.
  - **Conversion Optimization**: Benefit-first messaging ("Automate 100% of calls" vs "Voice AI").
  - **Sovereign Positioning**: "First Native Infrastructure" branding enforced globally.
  - **Zero Debt Commercialization**: Removal of all "Free Tier" remnants; enforcement of "Business" ($49/mo) baseline.

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

Liste les 40 personas par tier.

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

### UCP/CDP Tools (6) - Session 250.28

**Architecture:** File-based persistence (`data/ucp-profiles.json`)

#### Core UCP Tools (3)

##### `ucp_sync_preference`

Synchronise les préférences utilisateur avec les Règles de Marché Strictes.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `countryCode` | string | ✅ | Code ISO (ex: MA, FR, US) |
| `userId` | string | ❌ | ID utilisateur optionnel |

**Règles Appliquées:**

- `MA` -> `market: maroc`, `lang: fr`, `currency: MAD`
- `FR/ES/DZ` -> `market: europe`, `lang: fr`, `currency: EUR`
- `US/AE` -> `market: intr`, `lang: en`, `currency: USD`

##### `ucp_get_profile`

Récupère le profil unifié depuis le stockage persistant.

##### `ucp_list_profiles`

Liste tous les profils UCP pour un tenant.

#### CDP Enhanced Tools (3) - NEW Session 250.28

##### `ucp_record_interaction`

Enregistre une interaction client pour construire l'historique.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `userId` | string | ✅ | ID utilisateur |
| `interactionType` | enum | ✅ | voice_call, widget_chat, api_request, booking, purchase |
| `channel` | string | ✅ | Canal (telephony, web_widget, api) |
| `duration` | number | ❌ | Durée en secondes |
| `outcome` | string | ❌ | Résultat (resolved, escalated, converted) |
| `metadata` | object | ❌ | Métadonnées additionnelles |

##### `ucp_track_event`

Suit un événement comportemental pour analytics et personnalisation.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `userId` | string | ✅ | ID utilisateur |
| `event` | string | ✅ | Nom événement (pricing_viewed, demo_requested, feature_explored) |
| `source` | enum | ✅ | voice, widget, web, api |
| `value` | any | ❌ | Valeur de l'événement |

##### `ucp_get_insights`

Retourne les insights client et analytics depuis le profil UCP.

| Retour | Description |
|:-------|:------------|
| `engagementScore` | Score 0-100 basé sur recency + frequency |
| `totalInteractions` | Nombre total d'interactions |
| `preferredChannel` | Canal le plus utilisé |
| `channelBreakdown` | Répartition par canal |
| `topEvents` | Top 5 événements comportementaux |
| `recencyDays` | Jours depuis dernière interaction |

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
  "mcp_server": { "name": "vocalia", "version": "0.5.0", "tools_count": 59 },
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

### Calendly Tools (6) - Multi-Tenant

#### `calendly_get_user`

Obtenir les informations de l'utilisateur Calendly authentifié.

**Prérequis:** `CALENDLY_ACCESS_TOKEN`

#### `calendly_list_event_types`

Lister tous les types d'événements (réunions) de l'utilisateur.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `active` | boolean | ❌ | Filtrer par statut actif |

#### `calendly_get_available_times`

Obtenir les créneaux disponibles pour un type d'événement.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `eventTypeUri` | string | ✅ | URI du type d'événement |
| `startTime` | string | ✅ | Début de la plage (ISO format) |
| `endTime` | string | ✅ | Fin de la plage (ISO format) |

#### `calendly_list_events`

Lister les événements planifiés de l'utilisateur.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `minStartTime` | string | ❌ | Filtrer après cette date |
| `maxStartTime` | string | ❌ | Filtrer avant cette date |
| `status` | enum | ❌ | active, canceled |
| `count` | number | ❌ | Nombre d'événements (défaut: 20) |

#### `calendly_cancel_event`

Annuler un événement Calendly planifié.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `eventUuid` | string | ✅ | UUID de l'événement |
| `reason` | string | ❌ | Motif d'annulation |

#### `calendly_get_busy_times`

Obtenir les créneaux occupés de l'utilisateur.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `startTime` | string | ✅ | Début de la plage |
| `endTime` | string | ✅ | Fin de la plage |

---

### Freshdesk Tools (6) - Multi-Tenant

#### `freshdesk_list_tickets`

Lister les tickets de support depuis Freshdesk.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `filter` | enum | ❌ | new_and_my_open, watching, spam, deleted, all |
| `status` | number | ❌ | 2=Open, 3=Pending, 4=Resolved, 5=Closed |
| `priority` | number | ❌ | 1=Low, 2=Medium, 3=High, 4=Urgent |
| `perPage` | number | ❌ | Tickets par page (max: 100) |

**Prérequis:** `FRESHDESK_API_KEY`, `FRESHDESK_DOMAIN`

#### `freshdesk_get_ticket`

Obtenir les détails d'un ticket avec ses conversations.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `ticketId` | number | ✅ | ID du ticket |

#### `freshdesk_create_ticket`

Créer un nouveau ticket de support.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `subject` | string | ✅ | Sujet du ticket |
| `description` | string | ✅ | Description (HTML supporté) |
| `email` | string | ✅ | Email du demandeur |
| `priority` | number | ❌ | 1=Low, 2=Medium, 3=High, 4=Urgent |
| `status` | number | ❌ | 2=Open, 3=Pending, 4=Resolved, 5=Closed |
| `type` | string | ❌ | Type de ticket |
| `tags` | array | ❌ | Tags à ajouter |

#### `freshdesk_reply_ticket`

Répondre à un ticket existant.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `ticketId` | number | ✅ | ID du ticket |
| `body` | string | ✅ | Contenu de la réponse (HTML supporté) |

#### `freshdesk_update_ticket`

Mettre à jour un ticket existant.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `ticketId` | number | ✅ | ID du ticket |
| `status` | number | ❌ | Nouveau statut |
| `priority` | number | ❌ | Nouvelle priorité |
| `type` | string | ❌ | Nouveau type |
| `tags` | array | ❌ | Nouveaux tags (remplace existants) |

#### `freshdesk_search_contacts`

Rechercher des contacts par email ou nom.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `query` | string | ✅ | Email ou nom à rechercher |

---

### Pipedrive Tools (7) - Multi-Tenant

#### `pipedrive_list_deals`

Lister les deals avec filtres optionnels.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `status` | enum | ❌ | open, won, lost, deleted, all_not_deleted |
| `limit` | number | ❌ | Nombre de résultats (défaut: 50) |

**Prérequis:** `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_DOMAIN`

#### `pipedrive_create_deal`

Créer un nouveau deal dans Pipedrive.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `title` | string | ✅ | Titre du deal |
| `value` | number | ❌ | Valeur du deal |
| `currency` | string | ❌ | Code devise (défaut: EUR) |
| `person_id` | number | ❌ | ID de la personne associée |
| `org_id` | number | ❌ | ID de l'organisation associée |
| `status` | enum | ❌ | open, won, lost |

#### `pipedrive_update_deal`

Mettre à jour un deal existant.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `dealId` | number | ✅ | ID du deal |
| `title` | string | ❌ | Nouveau titre |
| `value` | number | ❌ | Nouvelle valeur |
| `status` | enum | ❌ | Nouveau statut |
| `stage_id` | number | ❌ | ID de l'étape |

#### `pipedrive_list_persons`

Lister les personnes (contacts) dans Pipedrive.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `limit` | number | ❌ | Nombre de résultats (défaut: 50) |

#### `pipedrive_create_person`

Créer un nouveau contact.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `name` | string | ✅ | Nom complet |
| `email` | string | ❌ | Adresse email |
| `phone` | string | ❌ | Numéro de téléphone |
| `org_id` | number | ❌ | ID de l'organisation |

#### `pipedrive_search`

Recherche globale dans Pipedrive.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `term` | string | ✅ | Terme de recherche |
| `item_types` | enum | ❌ | deal, person, organization, product, lead |
| `limit` | number | ❌ | Nombre de résultats (défaut: 10) |

#### `pipedrive_list_activities`

Lister les activités (appels, réunions, tâches).

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `done` | boolean | ❌ | Filtrer par statut terminé |
| `type` | string | ❌ | Type d'activité (call, meeting, task...) |
| `limit` | number | ❌ | Nombre de résultats (défaut: 50) |

---

### Export Tools (5) - Document Generation

#### `export_generate_csv`

Génère un fichier CSV à partir d'un tableau de données.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `data` | array | ✅ | Tableau d'objets à convertir |
| `filename` | string | ✅ | Nom du fichier (sans extension) |
| `headers` | array | ❌ | En-têtes colonnes (auto-détectés si omis) |

**Output:** `data/exports/{filename}.csv`

#### `export_generate_xlsx`

Génère un fichier Excel XLSX avec formatage VocalIA.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `data` | array | ✅ | Tableau d'objets à convertir |
| `filename` | string | ✅ | Nom du fichier (sans extension) |
| `sheetName` | string | ❌ | Nom de la feuille (défaut: "Data") |
| `headers` | array | ❌ | En-têtes colonnes (auto-détectés si omis) |

**Output:** `data/exports/{filename}.xlsx`

#### `export_generate_pdf`

Génère un document PDF avec branding VocalIA.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `content` | string | ✅ | Contenu texte du PDF |
| `filename` | string | ✅ | Nom du fichier (sans extension) |
| `title` | string | ❌ | Titre du document |
| `includeDate` | boolean | ❌ | Inclure date de génération (défaut: true) |

**Output:** `data/exports/{filename}.pdf`

#### `export_generate_pdf_table`

Génère un PDF avec tableau de données formaté.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `data` | array | ✅ | Tableau d'objets pour la table |
| `filename` | string | ✅ | Nom du fichier (sans extension) |
| `title` | string | ✅ | Titre du document |
| `headers` | array | ❌ | En-têtes colonnes (auto-détectés si omis) |

**Output:** `data/exports/{filename}.pdf`

#### `export_list_files`

Liste tous les fichiers exportés dans le répertoire exports.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| - | - | - | Aucun paramètre requis |

**Réponse:**

```json
{
  "status": "success",
  "export_directory": "/path/to/data/exports",
  "file_count": 5,
  "files": [
    { "filename": "leads.csv", "size_bytes": 2048, "type": "CSV", ... }
  ]
}
```

---

### Stripe Tools (19) - Payment Processing

> Session 249.21: Complete transactional cycle for voice commerce
> API Version: 2024-12-18.acacia | Rate Limits: 100 req/s

| Tool | Description |
|:-----|:------------|
| `stripe_create_payment_link` | Create Payment Link (one-click checkout) |
| `stripe_list_payment_links` | List payment links |
| `stripe_deactivate_payment_link` | Deactivate a payment link |
| `stripe_create_customer` | Create Stripe customer |
| `stripe_get_customer` | Get customer by ID or email |
| `stripe_list_customers` | List customers |
| `stripe_create_product` | Create product in catalog |
| `stripe_list_products` | List products |
| `stripe_create_price` | Create price for product |
| `stripe_create_checkout_session` | Hosted checkout session |
| `stripe_get_checkout_session` | Get session status |
| `stripe_create_invoice` | Create invoice for customer |
| `stripe_add_invoice_item` | Add line item to invoice |
| `stripe_finalize_invoice` | Finalize draft invoice |
| `stripe_send_invoice` | Send invoice to customer |
| `stripe_create_payment_intent` | Custom payment flow |
| `stripe_get_payment_intent` | Get payment intent status |
| `stripe_create_refund` | Create full/partial refund |
| `stripe_get_balance` | Get account balance |

**Prérequis:** `STRIPE_SECRET_KEY` (Multi-tenant: `STRIPE_SECRET_KEY_<TENANT>`)

**Voice Commerce Flow:**

```
Caller: "Je veux payer"
→ stripe_create_payment_link (product_name: "Consultation", amount: 5000)
→ messaging_send (to: +33612345678, message: "Votre lien de paiement: https://buy.stripe.com/xxx")
→ Client paie sur son téléphone
→ stripe_get_checkout_session → payment_status: "paid"
```

---

### Email Tools (3) - SMTP Integration

#### `email_send`

Envoie un email via SMTP.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `to` | string | ✅ | Destinataire email |
| `subject` | string | ✅ | Sujet de l'email |
| `body` | string | ✅ | Contenu texte |
| `html` | string | ❌ | Contenu HTML |
| `from` | string | ❌ | Expéditeur (défaut: VocalIA) |
| `replyTo` | string | ❌ | Adresse de réponse |

**Prérequis:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

#### `email_send_template`

Envoie un email avec template prédéfini.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `to` | string | ✅ | Destinataire email |
| `template` | enum | ✅ | lead_confirmation, booking_confirmation, follow_up, invoice |
| `variables` | object | ✅ | Variables du template (name, date, etc.) |
| `from` | string | ❌ | Expéditeur (défaut: VocalIA) |

**Templates disponibles:**

| Template | Variables requises | Usage |
|:---------|:-------------------|:------|
| `lead_confirmation` | name | Confirmation lead capturé |
| `booking_confirmation` | name, date, time | Confirmation RDV |
| `follow_up` | name | Relance après intérêt |
| `invoice` | name, invoiceNumber, amount, currency | Envoi facture |

#### `email_verify_smtp`

Vérifie la connexion au serveur SMTP.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| - | - | - | Aucun paramètre requis |

**Réponse:**

```json
{
  "status": "success",
  "smtp": { "host": "smtp.example.com", "port": 587, "secure": true },
  "message": "SMTP connection verified successfully"
}
```

---

---

## 4. Architecture Multi-Client (SaaS)

> **Status:** ✅ Active (Session 246)

L'architecture MCP est désormais **Multi-Tenant**. Chaque requête peut spécifier un contexte client.

### 4.1 Identification du Tenant

Le serveur MCP résout le client selon la priorité suivante :

1. `args._meta.tenantId` (Injection Zod)
2. `request.params._meta.tenantId` (JSON-RPC Raw)
3. `x-tenant-id` Header (Transport HTTP)
4. **Fallback**: `agency_internal` (Règles strictes Agence)

### 4.2 Client Registry (`core/client-registry.cjs`)

Source de vérité pour les configurations :

- **agency_internal**: Règles Strictes (Maroc=FR/MAD, Europe=FR/EUR).
- **client_demo**: Configuration SaaS standard (ex: USD partout).

---

## 40 Personas Disponibles

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
                                                            │   Klaviyo    │
                                                            └──────────────┘
```

#### `a2a_dispatch`

Dispatch une tâche à un autre agent via l'Agency Event Bus.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `targetAgent` | enum | ✅ | Agent cible (supervisor, scheduler, billing) |
| `taskType` | string | ✅ | Type de tâche |
| `payload` | string | ✅ | Charge utile JSON de la tâche |

---

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
│   ├── index.ts       # Serveur MCP principal (1200+ lignes)
│   └── tools/         # Tool modules (59 tools total)
│       ├── calendar.ts, slack.ts, ucp.ts
│       ├── sheets.ts, drive.ts
│       └── calendly.ts, freshdesk.ts, pipedrive.ts
├── dist/
│   └── index.js       # Build compilé
├── package.json       # @vocalia/mcp-server v0.5.0
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

## Protocol Ecosystem (Session 242 Analysis)

### MCP vs A2A vs AG-UI vs A2UI vs AP2 - Position VocalIA

VocalIA possède **MCP**, **A2A**, **AG-UI**, et **A2UI** pour l'Agentic Commerce 2026.

| Protocol | Standard | VocalIA | Fonction |
|:---------|:---------|:-------:|:---------|
| **MCP** | Model Context Protocol | ✅ 181 tools | AI Agent → Tools (équiper l'agent) |
| **A2A** | Agent-to-Agent | ✅ Session 250.28 | Agent → Agent (Agent Card + Task Lifecycle) |
| **AG-UI** | Agent-User Interaction | ✅ Session 250.29 | Agent → Frontend (17 events, SSE) |
| **A2UI** | Agent-to-UI | ✅ 100% | Agent → Interface dynamique (génération UI) |
| **AP2** | Agent Payments | ❌ | Agent → Paiement (transactions vocales) |

### Complémentarité des Protocoles

```
User → VocalIA Agent (MCP: tools internes)
              ↓
         A2A: délègue à Shopify Agent, HubSpot Agent
              ↓
         A2UI: génère formulaire RDV dynamique
              ↓
         AP2: exécute paiement avec Mandate signé
```

### Use Cases A2A pour VocalIA

| Scénario | Actuel | Avec A2A |
|:---------|:-------|:---------|
| Stock check | REST direct Shopify | Demande à Shopify Agent (contexte enrichi) |
| CRM update | REST direct HubSpot | Délègue à HubSpot Agent |
| Multi-step | Code custom | Chaîne d'agents standardisée |

**Source:** [IBM A2A](https://www.ibm.com/think/topics/agent2agent-protocol), [Google A2A Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)

### Use Cases AP2 pour VocalIA

| Scénario | Actuel | Avec AP2 |
|:---------|:-------|:---------|
| Paiement téléphonique | ❌ Impossible | ✅ Mandate signé pendant appel |
| Upsell vocal | Redirige vers web | ✅ "Ajoutez X" → paiement instant |
| Abonnement | Checkout web | ✅ Souscription vocale |

**Impact estimé:** +200% conversion e-commerce (pas d'abandon checkout)

**Source:** [Google AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol), [AP2 Spec](https://ap2-protocol.org/)

### Use Cases A2UI pour VocalIA Widget

| Scénario | Actuel | Avec A2UI |
|:---------|:-------|:---------|
| Prise RDV | 4 échanges vocaux | 1 clic (DatePicker généré) |
| Lead form | Questions successives | Formulaire BANT contextuel |
| Panier | Liste vocale | UI panier avec images |

**Impact estimé:** +40% complétion actions

**Source:** [Google A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/), [AG-UI Docs](https://docs.ag-ui.com/)

### AG-UI Implementation (Session 250.29)

VocalIA implémente le protocole [AG-UI](https://docs.ag-ui.com/) (CopilotKit Open Standard) dans le Voice Widget.

**Fichier:** `website/voice-assistant/voice-widget.js`

| Composant | Status | Description |
|:----------|:------:|:------------|
| EventType Enum | ✅ | 17 event types standard |
| RUN_STARTED/FINISHED/ERROR | ✅ | Lifecycle run |
| TEXT_MESSAGE_* | ✅ | Message streaming pattern |
| TOOL_CALL_* | ✅ | Tool call events (booking) |
| STATE_SNAPSHOT/DELTA | ✅ | State synchronization |
| CUSTOM events | ✅ | A2UI updates |
| DOM event dispatch | ✅ | `vocalia:agui` custom event |
| Global exposure | ✅ | `window.VocaliaAGUI` |

**Usage externe:**

```javascript
// Subscribe to AG-UI events
window.VocaliaAGUI.on('*', (event) => {
  console.log('AG-UI Event:', event.type, event);
});

// Or via DOM
window.addEventListener('vocalia:agui', (e) => {
  console.log('AG-UI DOM Event:', e.detail);
});
```

**Source:** [AG-UI Protocol](https://docs.ag-ui.com/), [AG-UI GitHub](https://github.com/ag-ui-protocol/ag-ui)

### Roadmap Protocoles

| Protocol | Priorité | Effort | Status |
|:---------|:--------:|:------:|:------:|
| **A2A** | P1 | 40h | ✅ DONE (Session 250.28) |
| **AG-UI** | P1 | 8h | ✅ DONE (Session 250.29) |
| **A2UI** | P1 | 24h | ✅ 100% DONE (Session 250.39) |
| **AP2** | P2 | 80h | ❌ Pending PSP support |

---

## Roadmap

| Version | Feature | Status |
|:--------|:--------|:------:|
| 0.1.0 | 4 tools de base | ✅ DONE |
| 0.2.0 | Refactoring factuel | ✅ DONE |
| 0.3.0 | 21 tools SOTA | ✅ DONE |
| 0.3.3 | SOTA Audit compliance | ✅ Session 241 |
| 0.4.0 | Multi-Tenant + Google Apps (Sheets, Drive) | ✅ Session 249.2 |
| 0.5.0 | Phase 1 COMPLETE (59 tools) - Calendly, Freshdesk, Pipedrive | ✅ Session 249.3 |
| 0.6.0 | Phase 2 - Communication (WhatsApp, Gmail, Docs) | ⏳ Planifié |
| 0.7.0 | Streaming audio en temps réel | ⏳ P3 |
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
*Mise à jour: 30/01/2026 - Session 249.6 (ALL PHASES COMPLETE - 114 tools)*
*SOTA: MCP 100% | A2A 100% | AG-UI 100% | A2UI 100% (Session 250.39) | AP2 0%*
*Integrations: 19/20 (95%) | All Phases: 100% | Blocked: 4 (Salesforce, Teams, WhatsApp, Outlook)*
*Export: CSV, XLSX, PDF | Email: SMTP templates*

*Maintenu par: VocalIA Engineering*

---

## Prompt Optimization with Feedback (Session 244.3)

### Context: RLHF n'est PAS applicable pour VocalIA

**Raison:** VocalIA utilise des APIs externes (Grok, Gemini, Claude) - pas de modèle propriétaire.

**Alternative:** Utiliser les principes RLHF pour optimiser les PROMPTS (pas les weights).

### Primitives Existantes dans VocalIA

| Composant | Location | Usage |
|:----------|:---------|:------|
| `qualify_lead` | telephony/voice-telephony-bridge.cjs:624 | Reward signal (BANT score) |
| `track_conversion_event` | telephony/voice-telephony-bridge.cjs:775 | Outcome tracking |
| `PERSONAS` (30) | personas/voice-persona-injector.cjs:98 | A/B test candidates |
| `industry` param | telephony:649 | Segmentation |
| `_v2` versioning | persona IDs | Prompt iteration |

### Architecture Recommandée

```
┌─────────────────────────────────────────────────────────┐
│                    CALL HAPPENS                         │
│  Persona X + User Query → LLM API → Response            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 OUTCOME TRACKING                        │
│  • BANT score (qualify_lead result)                     │
│  • Conversion (booking made? transfer completed?)       │
│  • Call duration                                        │
│  • User sentiment (if detectable)                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              PERSONA PERFORMANCE TABLE                  │
│  persona_id | industry | calls | conversions | avg_bant │
│  dental_v2  | health   | 150   | 45 (30%)    | 72       │
│  property_v2| realestate| 200  | 80 (40%)    | 78       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│            PROMPT IMPROVEMENT LOOP                      │
│  1. Identify low-performing personas                    │
│  2. Analyze winning patterns                            │
│  3. Update prompt templates                             │
│  4. Deploy new version (v2 → v3)                        │
└─────────────────────────────────────────────────────────┘
```

### Ce que VocalIA DOIT faire

1. **Tracker outcomes par persona** (qualify_lead, track_conversion_event existent)
2. **Comparer performances personas par industrie**
3. **Itérer prompts basé sur données réelles**
4. **Versionner personas** (déjà implémenté: `_v2` dans IDs)

### Différence RLHF vs Prompt Optimization

| Aspect | RLHF | VocalIA Prompt Optimization |
|:-------|:-----|:----------------------------|
| **Ce qui change** | Model weights (θ) | Prompt text |
| **Compute** | GPUs for training | CPU (text editing) |
| **Feedback loop** | RM → PPO → weights | Metrics → Human → prompts |
| **Scale needed** | 100K+ examples | 100s of calls |
| **Cost** | $100K+ | ~$0 (time only) |

### Plan Actionnable

| Task | Priority | Effort | Status |
|:-----|:--------:|:------:|:------:|
| Persona performance dashboard | P2 | 8h | ❌ |
| A/B test framework personas | P2 | 16h | ❌ |
| Prompt version comparison | P2 | 8h | ❌ |

---

*Màj: 30/01/2026 - Session 244.3 (Prompt Optimization avec RLHF principles)*
