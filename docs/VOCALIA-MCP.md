# VocalIA MCP Server

> Model Context Protocol (MCP) server exposant les capacités VocalIA Voice AI Platform.
> Version: 1.0.0 | 09/02/2026 | Session 250.171c | **203 tools** (22 inline + 181 modules) | **32 .ts files** | **19,173 lines**
>
> **MCP Compliance Score: 5.5/10** — Phase 0+1 DONE (250.171c): version unified, API migrated, descriptions+annotations on ALL 203 tools
>
> **Status**: Code exists. **0 tools connected to real external APIs.** All tools require per-tenant API key configuration.
> **Transport**: stdio uniquement (local) — **PAS de transport remote (HTTP/SSE)** → incompatible ChatGPT/Gemini SDK/remote
> **SDK**: `@modelcontextprotocol/sdk@1.25.3` — utilise `server.registerTool()` (modern API) + `registerModuleTool()` helper
> **Primitives MCP utilisées**: 1/3 (Tools only — **ZERO Resources, ZERO Prompts**)
>
> **Protocol Status:**
> - **MCP (Tools)**: ✅ 203 tools registered — ALL via modern `registerTool()` API, descriptions on ALL, annotations (readOnly/destructive/idempotent) on ALL, isError flags on error returns
> - **A2A (Event Bus)**: ✅ coded (widget events → AgencyEventBus) — not connected to real traffic
> - **AG-UI (Dynamic UI)**: ✅ coded (Widget Orchestrator, 7 widgets) — 0 real users
> - **UCP (ContextBox)**: ✅ coded (LTV tiers bronze→diamond) — 0 real profiles
>
> **iPaaS:** Zapier, Make, n8n — code exists, 0 webhooks configured
> **Payments:** Stripe 19 tools — code exists, 0 Stripe keys configured

---

## Qu'est-ce que MCP?

**Model Context Protocol** est un protocole ouvert créé par Anthropic pour l'intégration AI-to-tool, donné à la Linux Foundation's Agentic AI Foundation.

MCP définit **3 primitives serveur** (spec 2025-11-25) :

| Primitive | Contrôle | Description | VocalIA |
|:----------|:---------|:------------|:-------:|
| **Tools** | Model-controlled | Fonctions que le LLM peut invoquer | ⚠️ 203 (deprecated API, 0 descriptions) |
| **Resources** | Application-controlled | Données contextuelles (fichiers, configs) | ❌ ZERO |
| **Prompts** | User-controlled | Templates de prompts réutilisables | ❌ ZERO |

**Sources:** [MCP Spec](https://modelcontextprotocol.io/docs/learn/server-concepts) | [Anthropic Announcement](https://www.anthropic.com/news/model-context-protocol)

---

## MCP Compliance Audit — 250.171b (18 bugs)

### Score: 5.5/10 (was 2.5 — Phase 0+1 completed 250.171c)

| Catégorie | Score | Détail |
|:----------|:-----:|:-------|
| Tools (quantité) | 10/10 | 203 tools — massif, bien structuré |
| Tools (qualité) | 7/10 | ✅ Modern API (registerTool), ✅ descriptions on ALL 203, ✅ annotations on ALL, ⬚ outputSchema (Phase 1.3) |
| Resources | 0/10 | ZERO implémenté (Phase 2) |
| Prompts | 0/10 | ZERO implémenté (Phase 2) |
| Transport | 2/10 | stdio only — pas de remote (SSE/HTTP) (Phase 4) |
| Error handling | 5/10 | ✅ isError flags on inline tool errors, ⬚ module tools (delegated to module handler) |
| Logging | 0/10 | 0 sendLoggingMessage() (Phase 3) |
| Progress | 0/10 | 0 progress reporting (Phase 3) |
| Metadata | 10/10 | ✅ Version unified 1.0.0 (package.json, api_status, startup log, server constructor) |
| Distribution | 0/10 | Pas npm, pas registry, pas server.json (Phase 5) |

### Bugs Détaillés

#### CRITICAL (5)

| ID | Bug | Fichier | Ligne |
|:--:|:----|:--------|:-----:|
| C1 | **203 tools sans description** — `server.tool(name, schema, handler)` ne passe JAMAIS le `description` field malgré que les modules l'exportent | `index.ts` | 1195-1520 |
| C2 | **API deprecated** — `server.tool()` marqué `@deprecated` dans SDK 1.25.3, remplacé par `server.registerTool()` avec support `title`, `description`, `annotations`, `outputSchema` | `index.ts` | ALL |
| C3 | **ZERO Resources** — Pas de `server.registerResource()` malgré données riches (personas, KB 119 services, market rules, client registry) | `index.ts` | N/A |
| C4 | **ZERO Prompts** — Pas de `server.registerPrompt()` malgré 190 system prompts multilingues existants | `index.ts` | N/A |
| C5 | **Transport stdio only** — Incompatible avec ChatGPT (requiert SSE/Streamable HTTP + OAuth 2.1), Gemini SDK (expérimental SSE), et tout accès remote | `index.ts` | 1526-1545 |

#### HIGH (5)

| ID | Bug | Fichier | Ligne |
|:--:|:----|:--------|:-----:|
| H1 | **ZERO tool annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint` non utilisés. Le LLM ne sait pas quels tools sont safe vs destructifs | `index.ts` | ALL |
| H2 | **ZERO outputSchema** — Aucun tool ne déclare sa structure de réponse. Le LLM doit deviner le format | `index.ts` | ALL |
| H3 | **ZERO isError flags** — Les erreurs retournent du texte normal, pas `isError: true`. Le LLM ne distingue pas succès/échec | `index.ts` | ALL |
| H4 | **ZERO logging** — `sendLoggingMessage()` jamais utilisé. Pas de visibilité côté client MCP | `index.ts` | N/A |
| H5 | **ZERO progress reporting** — Les opérations longues (export PDF, API calls) ne reportent pas leur progression | `index.ts` | N/A |

#### MEDIUM (5)

| ID | Bug | Fichier | Ligne |
|:--:|:----|:--------|:-----:|
| M1 | **Version chaos** — `package.json` = "0.8.0", `api_status` tool = "0.5.0", startup log = "v0.9.0" | multiple | — |
| M2 | **`api_status` reports `tools_count: 75`** — Devrait être 203 | `index.ts` | 1106 |
| M3 | **`personas_list` hardcodes `total: 30`** — Devrait être 38 | `index.ts` | 434 |
| M4 | **PERSONAS_DATA incomplet** — 30 entrées au lieu de 38. 8 personas manquants dans le MCP | `index.ts` | 186-233 |
| M5 | **SYSTEM_PROMPTS incomplet** — Seulement 3 personas (AGENCY, DENTAL, UNIVERSAL_ECOMMERCE) au lieu de 38 | `index.ts` | 236-281 |

#### LOW (3)

| ID | Bug | Fichier | Ligne |
|:--:|:----|:--------|:-----:|
| L1 | **`translation_qa_check` executes Python** via `execAsync` — risque injection commande | `index.ts` | 288-310 |
| L2 | **Pas de `sendToolListChanged()`** — Si tools changent dynamiquement, les clients ne sont pas notifiés | `index.ts` | N/A |
| L3 | **Pas de `_meta` support** — Aucun outil ne retourne/consomme `_meta` pour metadata additionnelle | `index.ts` | N/A |

### Preuve SDK — Capacités Disponibles mais Non Utilisées

Vérifié dans `mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` (v1.25.3) :

```typescript
// DISPONIBLE — NON UTILISÉ par VocalIA
server.registerTool(name, { title?, description?, inputSchema?, outputSchema?, annotations? }, handler)
server.registerResource(name, uriOrTemplate, config, readCallback)
server.registerPrompt(name, { title?, description?, argsSchema? }, handler)
server.sendLoggingMessage(params, sessionId?)
server.sendToolListChanged()
server.sendResourceListChanged()
server.sendPromptListChanged()
// ToolAnnotations: { readOnlyHint?, destructiveHint?, idempotentHint?, openWorldHint? }
```

---

## Plan Actionnable SOTA — VocalIA-MCP 1.0.0

### Phase 0 — Fondations ✅ DONE (250.171c)

| # | Tâche | Status | Notes |
|:-:|:------|:------:|:------|
| 0.1 | **Unifier version** → `1.0.0` | ✅ | package.json, api_status, startup log, server constructor |
| 0.2 | **Corriger `api_status`** → `tools_count: 203` | ✅ | Was 75 |
| 0.3 | **Corriger `personas_list`** → `total: 38` | ✅ | Already computed dynamically (4+8+12+14=38) |
| 0.4 | **Compléter SYSTEM_PROMPTS** → 38 personas | ✅ | Dynamic loading from voice-persona-injector.cjs already exists (L100-114). 3 inline = fallback only |
| 0.5 | **Sécuriser `translation_qa_check`** | ✅ | FALSE ALARM: tool takes `{}` (no params), no user input reaches execAsync |

### Phase 1 — Migration API Moderne ✅ DONE (250.171c)

| # | Tâche | Status | Notes |
|:-:|:------|:------:|:------|
| 1.1 | **Migrer 22 inline tools** → `server.registerTool()` | ✅ | All 22 with description + annotations |
| 1.2 | **Migrer 181 module tools** → `registerModuleTool()` | ✅ | Helper infers annotations from name pattern |
| 1.3 | **Ajouter `outputSchema`** aux 15 tools "always available" | ⬚ | P1 — deferred to next session |
| 1.4 | **Ajouter `isError: true`** à tous les catch blocks (inline) | ✅ | 6 error returns flagged |

**Classification des annotations par catégorie :**

| Catégorie | readOnly | destructive | idempotent | Tools |
|:----------|:--------:|:-----------:|:----------:|:------|
| GET/List/Search | ✅ | ❌ | ✅ | personas_list, *_list_*, *_get_*, *_search_* (~120) |
| Create | ❌ | ❌ | ❌ | *_create_*, booking_create (~30) |
| Update | ❌ | ❌ | ✅ | *_update_*, *_reply_* (~25) |
| Delete/Cancel | ❌ | ✅ | ✅ | *_cancel_*, *_delete_*, *_deactivate_* (~15) |
| Export/Generate | ✅ | ❌ | ✅ | export_*, voice_generate_response (~8) |
| System | ✅ | ❌ | ✅ | api_status, system_languages (~5) |

### Phase 2 — Resources & Prompts (~6h)

| # | Tâche | Priorité | Effort |
|:-:|:------|:--------:|:------:|
| 2.1 | **Ajouter Resources** (6 resources) | P1 | 3h |
| 2.2 | **Ajouter Prompts** (8 prompts) | P1 | 3h |

**Resources à implémenter :**

| Resource URI | Description | Source |
|:-------------|:------------|:-------|
| `vocalia://personas` | Liste 38 personas avec metadata | `voice-persona-injector.cjs` |
| `vocalia://personas/{key}` | Template — détails persona par clé | `voice-persona-injector.cjs` |
| `vocalia://knowledge-base` | 119 services indexés | `data/vocalia-knowledge-base.json` |
| `vocalia://market-rules` | Règles marché (MA→FR/MAD, EU→FR/EUR, etc.) | `client-registry.cjs` |
| `vocalia://pricing` | Plans et tarifs (Starter 49€, Pro 99€, etc.) | `core/pricing-engine.cjs` |
| `vocalia://languages` | 5 langues + voix supportées | statique |

**Prompts à implémenter :**

| Prompt | Args | Description |
|:-------|:-----|:------------|
| `voice-response` | `message`, `language?`, `personaKey?` | Générer réponse vocale IA |
| `qualify-lead` | `budget`, `authority`, `need`, `timeline` | Qualification BANT complète |
| `book-appointment` | `email`, `preferredTime`, `notes?` | Workflow booking discovery call |
| `check-order` | `orderId`, `platform` | Status commande multi-plateforme |
| `create-invoice` | `customerEmail`, `amount`, `currency` | Créer et envoyer facture Stripe |
| `export-report` | `data`, `format`, `title` | Générer export CSV/XLSX/PDF |
| `onboard-tenant` | `tenantId`, `industry` | Configuration nouveau client |
| `troubleshoot` | `symptom` | Diagnostic système VocalIA |

### Phase 3 — Logging & Progress (~3h)

| # | Tâche | Priorité | Effort |
|:-:|:------|:--------:|:------:|
| 3.1 | **Ajouter `sendLoggingMessage()`** — log tool calls, errors, performance | P2 | 1.5h |
| 3.2 | **Ajouter progress reporting** aux tools longs (exports, API calls batch) | P2 | 1.5h |

### Phase 4 — Transport Remote + Auth (~12h)

| # | Tâche | Priorité | Effort |
|:-:|:------|:--------:|:------:|
| 4.1 | **Ajouter Streamable HTTP transport** — en plus de stdio (dual transport) | P1 | 4h |
| 4.2 | **Implémenter OAuth 2.1** — `/authorize`, `/token`, `/revoke` endpoints | P1 | 4h |
| 4.3 | **HTTPS via Traefik** — route `mcp.vocalia.ma` → container MCP | P1 | 2h |
| 4.4 | **CORS + rate limiting** pour accès remote | P1 | 2h |

**Pourquoi c'est CRITIQUE :**
- ChatGPT requiert **SSE/Streamable HTTP + OAuth 2.1 + HTTPS** → impossible sans Phase 4
- Gemini SDK requiert **SSE transport** pour intégration programmatique
- n8n/Make requièrent **HTTP endpoint** accessible
- Seuls Claude Desktop, Cursor, VS Code supportent stdio local

### Phase 5 — Publication & Distribution (~8h)

| # | Tâche | Priorité | Effort |
|:-:|:------|:--------:|:------:|
| 5.1 | **Publier sur npm** — `@vocalia/mcp-server` package public | P1 | 2h |
| 5.2 | **Créer `server.json`** pour MCP Registry | P1 | 30min |
| 5.3 | **Soumettre au MCP Registry** via `mcp-publisher` CLI | P1 | 1h |
| 5.4 | **Docker image** — `vocalia/mcp-server` sur Docker Hub | P2 | 2h |
| 5.5 | **GitHub Release** — tags, changelog, binaires | P1 | 1h |
| 5.6 | **Hugging Face** — publier comme Space/repo | P2 | 1.5h |

---

## Stratégie de Distribution — 14 Plateformes

### Tier 1 — Natif stdio (local, déjà compatible)

| Plateforme | Transport | Config | Status | Action |
|:-----------|:---------|:-------|:------:|:-------|
| **Claude Desktop** | stdio | `claude_desktop_config.json` | ✅ Compatible | Documenter install via npx |
| **Claude Code** | stdio | `.claude/settings.json` | ✅ Compatible | Documenter config |
| **VS Code (Copilot)** | stdio | `.vscode/mcp.json` ou settings | ✅ Compatible (v1.102+) | Installer depuis MCP Registry |
| **Cursor** | stdio | `.cursor/mcp.json` | ✅ Compatible | Documenter config |
| **Gemini CLI** | stdio | `~/.gemini/settings.json` | ✅ Compatible | Documenter config |

**Effort total Tier 1 : ~2h** (documentation + tests)

### Tier 2 — Natif avec HTTP transport requis (Phase 4 obligatoire)

| Plateforme | Transport | Auth | Status | Blocage |
|:-----------|:---------|:-----|:------:|:--------|
| **ChatGPT** | Streamable HTTP/SSE | OAuth 2.1 | ❌ Bloqué | Requiert Phase 4 (transport + OAuth + HTTPS) |
| **Gemini SDK** | SSE (expérimental) | OAuth 2.0 | ❌ Bloqué | Requiert Phase 4 |
| **n8n** | HTTP (MCP Server Trigger) | API Key/OAuth | ❌ Bloqué | Requiert Phase 4 |
| **Make.com** | HTTP (webhook/module custom) | API Key | ❌ Bloqué | Requiert Phase 4 |

**Effort total Tier 2 : ~12h** (Phase 4) + ~4h (config par plateforme)

**Détail ChatGPT :**
- Settings → Connectors → Advanced → Developer Mode → Create
- URL: `https://mcp.vocalia.ma` (via Traefik)
- Auth: OAuth 2.1 flow — ChatGPT échange auth code → access token
- Disponible: Pro, Plus, Business, Enterprise, Education plans

**Sources:** [OpenAI MCP Docs](https://platform.openai.com/docs/guides/tools-connectors-mcp) | [ChatGPT Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)

**Détail n8n :**
- MCP Server Trigger node expose workflows comme tools
- MCP Client Tool node permet à n8n d'appeler VocalIA-MCP
- Requiert URL HTTP publique accessible

**Sources:** [n8n MCP Docs](https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/)

### Tier 3 — Via MCP SuperAssistant (workaround, pas natif)

| Plateforme | Méthode | Status |
|:-----------|:--------|:------:|
| **Grok** | MCP SuperAssistant proxy | ⚠️ Workaround |
| **Perplexity** | MCP SuperAssistant proxy | ⚠️ Workaround |
| **Google AI Studio** | MCP SuperAssistant proxy | ⚠️ Workaround |

**Source:** [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant)

### Tier 4 — App builders (config file)

| Plateforme | Transport | Config | Status |
|:-----------|:---------|:-------|:------:|
| **Lovable** | stdio/HTTP | Settings → MCP servers | ✅ Compatible (stdio) / Requiert Phase 4 (remote) |
| **Bolt.new** | stdio/HTTP | MCP config | ✅ Compatible (stdio) / Requiert Phase 4 (remote) |

**Sources:** [Lovable MCP Docs](https://docs.lovable.dev/integrations/mcp-servers) | [Bolt MCP Guide](https://mcp.harishgarg.com/use/mcp-so/mcp-server/with/bolt-new)

### Tier 5 — Registries & Marketplaces

| Plateforme | Type | Prérequis | Action |
|:-----------|:-----|:----------|:-------|
| **MCP Registry** | Registry officiel | npm package + server.json + `mcp-publisher` CLI | Phase 5.1-5.3 |
| **npm** | Package registry | `@vocalia/mcp-server` package publique | Phase 5.1 |
| **GitHub** | Source + Releases | Repo public + tags + changelog | Phase 5.5 |
| **Hugging Face** | Model/Space hub | Repo ou Space + README MCP | Phase 5.6 |
| **Docker Hub** | Container registry | `vocalia/mcp-server` image | Phase 5.4 |
| **Smithery** | MCP marketplace | Listing + config | À évaluer |
| **PulseMCP** | MCP directory | Listing | À évaluer |
| **Glama** | MCP directory | Listing | À évaluer |

**MCP Registry — Prérequis concrets :**

```json
// server.json (à créer)
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.jouiet/vocalia",
  "description": "Voice AI SaaS platform with 203 tools — CRM, e-commerce, telephony, personas, lead qualification, 38 industry personas in 5 languages",
  "repository": {
    "url": "https://github.com/Jouiet/VocalIA",
    "source": "github"
  },
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@vocalia/mcp-server",
      "version": "1.0.0",
      "transport": { "type": "stdio" }
    }
  ]
}
```

```json
// package.json additions
{
  "name": "@vocalia/mcp-server",
  "version": "1.0.0",
  "mcpName": "io.github.jouiet/vocalia",
  "bin": { "vocalia-mcp": "./dist/index.js" }
}
```

```bash
# Publishing workflow
npm publish --access public
mcp-publisher login github  # → io.github.jouiet/* namespace
mcp-publisher init           # → génère server.json
mcp-publisher publish        # → soumet au registry
```

**Sources:** [MCP Registry](https://github.com/modelcontextprotocol/registry) | [Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx) | [Registry API](https://registry.modelcontextprotocol.io/docs)

---

## Status des Tools (Session 250.171b — VÉRIFIÉ)

### Vue d'ensemble

| Catégorie | Tools | Toujours Dispo | Nécessite Service |
|:----------|:-----:|:--------------:|:-----------------:|
| Voice | 2 | 0 | 2 |
| Persona | 3 | **3** | 0 |
| Lead Qualification | 2 | **2** | 0 |
| Knowledge Base | 2 | **1** | 1 |
| Telephony | 3 | 0 | 3 |
| Messaging | 1 | 0 | 1 |
| CRM (inline) | 2 | 0 | 2 |
| E-commerce (inline) | 3 | 0 | 3 |
| Booking | 2 | **2** | 0 |
| System | 3 | **3** | 0 |
| Calendar | 2 | 0 | 2 |
| Slack | 1 | 0 | 1 |
| UCP/CDP | 7 | 0 | 7 |
| Translation QA | 1 | **1** | 0 |
| Sheets | 5 | 0 | 5 |
| Drive | 6 | 0 | 6 |
| Docs | 4 | 0 | 4 |
| Gmail | 7 | 0 | 7 |
| Calendly | 6 | 0 | 6 |
| Freshdesk | 6 | 0 | 6 |
| Zendesk | 6 | 0 | 6 |
| Pipedrive | 7 | 0 | 7 |
| WooCommerce | 7 | 0 | 7 |
| Zoho CRM | 6 | 0 | 6 |
| Magento | 10 | 0 | 10 |
| Wix Stores | 6 | 0 | 6 |
| Squarespace | 7 | 0 | 7 |
| BigCommerce | 9 | 0 | 9 |
| PrestaShop | 10 | 0 | 10 |
| Export | 5 | **5** | 0 |
| Email | 3 | 0 | 3 |
| Zapier | 3 | 0 | 3 |
| Make | 5 | 0 | 5 |
| n8n | 5 | 0 | 5 |
| Stripe | 19 | 0 | 19 |
| Recommendations | 3 | 0 | 3 |
| HubSpot | 7 | 0 | 7 |
| Klaviyo | 5 | 0 | 5 |
| Twilio | 5 | 0 | 5 |
| Shopify | 8 | 0 | 8 |
| **TOTAL** | **203** | **17** | **186** |

### E-commerce Market Coverage (~64%)

| Platform | Tools | Market Share | API |
|:---------|:-----:|:------------:|:----|
| WooCommerce | 7 | 33-39% | REST v3 |
| Shopify | 8 | 10.32% | GraphQL Admin API 2026-01 |
| Magento | 10 | 8% | REST v1 (FULL CRUD) |
| Wix Stores | 6 | 7.4% (+32.6% YoY) | REST |
| Squarespace | 7 | 2.6% | REST v1/v2 |
| PrestaShop | 10 | 1.91% | Webservice (FULL CRUD) |
| BigCommerce | 9 | 1% | REST v2/v3 (FULL CRUD) |

---

## Analyse Concurrentielle (FAITS VÉRIFIÉS)

| Plateforme | MCP Server | Tools | MCP Compliance | Source |
|:-----------|:-----------|:------|:---------------|:-------|
| **Vapi** | ✅ Officiel | 8 | Non évalué | [github.com/VapiAI/mcp-server-vapi](https://github.com/VapiAI/mcp-server-vapi) |
| **Twilio** | ✅ Community | 5 | Non évalué | [github.com/twilio-labs/mcp-twilio](https://github.com/twilio-labs/mcp-twilio) |
| **Vonage** | ✅ Officiel | 2 | Non évalué | [github.com/Vonage-Community/telephony-mcp-server](https://github.com/Vonage-Community/telephony-mcp-server) |
| **Retell** | ❌ | N/A | N/A | Pas de MCP server trouvé |
| **VocalIA** | ⚠️ | **203** | **2.5/10** | `mcp-server/` |

**Avantage quantitatif VocalIA :**
- **203 tools** — 25x plus que Vapi (8 tools)
- 38 personas × 5 langues
- 7 plateformes e-commerce, 3 CRM, 2 support
- iPaaS complet (Zapier, Make, n8n)
- Google Workspace (Sheets, Drive, Docs, Gmail, Calendar)

**Handicap qualitatif VocalIA :**
- 0/203 tools avec description (le LLM ne sait pas ce que font les tools)
- 0 Resources, 0 Prompts (utilise 1/3 des primitives MCP)
- API deprecated, pas de transport remote
- Pas publié (npm, registry, GitHub releases)

---

## Architecture Technique

```
┌─────────────────┐     JSON-RPC/stdio     ┌─────────────────┐
│  Claude Desktop │ ◄───────────────────► │  VocalIA MCP    │
│  Cursor         │                        │  Server v0.8.0  │
│  VS Code        │                        │  203 tools      │
│  Gemini CLI     │                        │  @sdk 1.25.3    │
└─────────────────┘                        └────────┬────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          │              │          │          │              │
                          ▼              ▼          ▼          ▼              ▼
                  ┌──────────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐
                  │  Voice API   │ │Telephony │ │  DB  │ │ 29 tool  │ │ Local    │
                  │  :3004       │ │  :3009   │ │:3013 │ │ modules  │ │ data/    │
                  │  Grok/Gemini │ │  Twilio  │ │Sheets│ │ (181 ts) │ │ exports  │
                  └──────────────┘ └──────────┘ └──────┘ └──────────┘ └──────────┘
```

**FUTUR (après Phase 4) :**

```
┌─────────────────┐                        ┌─────────────────┐
│  ChatGPT        │  Streamable HTTP/SSE   │  VocalIA MCP    │
│  Gemini SDK     │ ◄──── HTTPS ────────► │  Server v1.0.0  │
│  n8n / Make     │   + OAuth 2.1          │  203 tools      │
│  Remote clients │                        │  + Resources    │
└─────────────────┘                        │  + Prompts      │
                                           └────────┬────────┘
                                                    │
                                           mcp.vocalia.ma
                                           (Traefik → container)
```

### Stack Technique

| Composant | Technologie |
|:----------|:------------|
| Runtime | Node.js 18+ |
| Langage | TypeScript (ESM) |
| MCP SDK | @modelcontextprotocol/sdk@1.25.3 |
| Validation | Zod |
| Transport | StdioServerTransport (actuel) → + StreamableHTTPTransport (Phase 4) |
| Auth | Aucun (actuel) → OAuth 2.1 (Phase 4) |

### Fichiers

```
mcp-server/
├── src/
│   ├── index.ts              # Serveur MCP principal (1,545 lignes, 203 tools)
│   ├── middleware/
│   │   └── tenant.ts         # Multi-tenant resolution (54 lignes)
│   └── tools/                # 29 tool modules (16,030 lignes)
│       ├── shopify.ts        # 8 tools, GraphQL Admin API
│       ├── stripe.ts         # 19 tools, API 2024-12-18.acacia
│       ├── hubspot.ts        # 7 tools, REST v3
│       ├── woocommerce.ts    # 7 tools, REST v3
│       ├── magento.ts        # 10 tools, REST v1
│       ├── calendly.ts       # 6 tools, REST v2
│       ├── freshdesk.ts      # 6 tools, REST v2
│       ├── zendesk.ts        # 6 tools, REST v2
│       ├── pipedrive.ts      # 7 tools, REST v1
│       ├── zoho.ts           # 6 tools, REST v2
│       ├── sheets.ts         # 5 tools, Google Sheets API v4
│       ├── drive.ts          # 6 tools, Google Drive API v3
│       ├── docs.ts           # 4 tools, Google Docs API v1
│       ├── gmail.ts          # 7 tools, Gmail API v1
│       ├── calendar.ts       # 2 tools, Google Calendar API v3
│       ├── slack.ts          # 1 tool, Slack Web API
│       ├── ucp.ts            # 7 tools, file-based CDP
│       ├── email.ts          # 3 tools, SMTP
│       ├── export.ts         # 5 tools, CSV/XLSX/PDF
│       ├── zapier.ts         # 3 tools, webhooks
│       ├── make.ts           # 5 tools, API
│       ├── n8n.ts            # 5 tools, API
│       ├── recommendations.ts # 3 tools, ML
│       ├── klaviyo.ts        # 5 tools, REST v3
│       ├── twilio.ts         # 5 tools, REST
│       ├── wix.ts            # 6 tools, REST
│       ├── squarespace.ts    # 7 tools, REST v1/v2
│       ├── bigcommerce.ts    # 9 tools, REST v2/v3
│       └── prestashop.ts     # 10 tools, Webservice
├── dist/                     # Build compilé
├── package.json              # v0.8.0 → à migrer v1.0.0
├── tsconfig.json
└── server.json               # À CRÉER (Phase 5.2)
```

---

## Installation

### Prérequis

- Node.js >= 18.0.0
- Un client MCP compatible (Claude Desktop, Cursor, VS Code, Gemini CLI)

### Build

```bash
cd mcp-server
npm install
npm run build
```

### Configuration par plateforme

#### Claude Desktop

Éditer `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "node",
      "args": ["/chemin/vers/VocalIA/mcp-server/dist/index.js"],
      "env": {
        "VOCALIA_API_URL": "http://localhost:3004",
        "VOCALIA_TELEPHONY_URL": "http://localhost:3009"
      }
    }
  }
}
```

#### VS Code (GitHub Copilot)

Éditer `.vscode/mcp.json` :

```json
{
  "servers": {
    "vocalia": {
      "command": "node",
      "args": ["/chemin/vers/VocalIA/mcp-server/dist/index.js"],
      "env": {
        "VOCALIA_API_URL": "http://localhost:3004"
      }
    }
  }
}
```

#### Cursor

Éditer `.cursor/mcp.json` (même format que VS Code).

#### Gemini CLI

Éditer `~/.gemini/settings.json` :

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "node",
      "args": ["/chemin/vers/VocalIA/mcp-server/dist/index.js"]
    }
  }
}
```

#### Après npm publish (Phase 5.1)

```bash
# Installation globale
npm install -g @vocalia/mcp-server

# Ou via npx (sans installation)
npx @vocalia/mcp-server
```

#### ChatGPT (après Phase 4)

1. Settings → Connectors → Advanced → Developer Mode
2. Create new connector
3. URL: `https://mcp.vocalia.ma`
4. Auth: OAuth 2.1 (auto-configuré)

**Source:** [VS Code MCP](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) | [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/)

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

Liste les 38 personas par tier.

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `tier` | enum | ❌ | core, expansion, extended, all (défaut: all) |

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

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `to` | string | ✅ | Numéro E.164 (+33612345678) |
| `personaKey` | enum | ❌ | Persona pour l'appel |
| `language` | enum | ❌ | Langue (défaut: fr) |
| `context` | string | ❌ | Contexte pour l'agent |

**Prérequis:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### `telephony_get_status` / `telephony_transfer_call`

Status système et transfert appel vers agent humain.

---

### Booking Tools (2)

#### `booking_schedule_callback`

| Paramètre | Type | Requis | Description |
|:----------|:-----|:------:|:------------|
| `email` | string | ✅ | Email contact |
| `phone` | string | ❌ | Téléphone |
| `preferredTime` | string | ✅ | Créneau souhaité |
| `notes` | string | ❌ | Notes contextuelles |

#### `booking_create`

Créer un RDV discovery call. Persistence: `data/booking-queue.json`.

---

### UCP/CDP Tools (7)

#### Core UCP (3): `ucp_sync_preference`, `ucp_get_profile`, `ucp_list_profiles`

Synchronisation préférences avec Règles de Marché : MA→FR/MAD, EU→FR/EUR, US→EN/USD.

#### CDP Enhanced (4): `ucp_record_interaction`, `ucp_track_event`, `ucp_get_insights`, `ucp_update_ltv`

Interactions, événements comportementaux, scoring engagement, LTV tiers (bronze→diamond).

---

### Stripe Tools (19) — Payment Processing

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

---

### Export Tools (5) — Document Generation

| Tool | Output | Description |
|:-----|:-------|:------------|
| `export_generate_csv` | `data/exports/*.csv` | CSV depuis tableau d'objets |
| `export_generate_xlsx` | `data/exports/*.xlsx` | Excel avec formatage VocalIA |
| `export_generate_pdf` | `data/exports/*.pdf` | PDF avec branding |
| `export_generate_pdf_table` | `data/exports/*.pdf` | PDF avec tableau formaté |
| `export_list_files` | — | Liste exports disponibles |

---

### Email Tools (3)

| Tool | Prérequis | Description |
|:-----|:----------|:------------|
| `email_send` | SMTP_* | Email SMTP libre |
| `email_send_template` | SMTP_* | Templates: lead_confirmation, booking_confirmation, follow_up, invoice |
| `email_verify_smtp` | SMTP_* | Vérification connexion SMTP |

---

### Module Tools (181) — 29 modules externes

| Module | Tools | API | Prérequis |
|:-------|:-----:|:----|:----------|
| Shopify | 8 | GraphQL Admin 2026-01 | SHOPIFY_ACCESS_TOKEN |
| WooCommerce | 7 | REST v3 | WOOCOMMERCE_* |
| Magento | 10 | REST v1 | MAGENTO_* |
| Wix | 6 | REST | WIX_* |
| Squarespace | 7 | REST v1/v2 | SQUARESPACE_* |
| BigCommerce | 9 | REST v2/v3 | BIGCOMMERCE_* |
| PrestaShop | 10 | Webservice | PRESTASHOP_* |
| HubSpot | 7 | REST v3 | HUBSPOT_* |
| Pipedrive | 7 | REST v1 | PIPEDRIVE_* |
| Zoho CRM | 6 | REST v2 | ZOHO_* |
| Freshdesk | 6 | REST v2 | FRESHDESK_* |
| Zendesk | 6 | REST v2 | ZENDESK_* |
| Calendly | 6 | REST v2 | CALENDLY_* |
| Sheets | 5 | Google Sheets v4 | GOOGLE_* |
| Drive | 6 | Google Drive v3 | GOOGLE_* |
| Docs | 4 | Google Docs v1 | GOOGLE_* |
| Gmail | 7 | Gmail v1 | GOOGLE_* |
| Calendar | 2 | Google Calendar v3 | GOOGLE_* |
| Slack | 1 | Web API | SLACK_* |
| Stripe | 19 | API 2024-12-18 | STRIPE_* |
| Klaviyo | 5 | REST v3 | KLAVIYO_* |
| Twilio | 5 | REST | TWILIO_* |
| Zapier | 3 | Webhooks/NLA | ZAPIER_* |
| Make | 5 | API | MAKE_* |
| n8n | 5 | API | N8N_* |
| Recommendations | 3 | Internal ML | — |
| UCP | 7 | File-based | — |
| Export | 5 | Local | — |
| Email | 3 | SMTP | SMTP_* |

---

## Architecture Multi-Client (SaaS)

### Identification du Tenant

Le serveur MCP résout le client selon la priorité suivante :

1. `args._meta.tenantId` (Injection Zod)
2. `request.params._meta.tenantId` (JSON-RPC Raw)
3. `x-tenant-id` Header (Transport HTTP)
4. **Fallback**: `agency_internal`

### Client Registry (`core/client-registry.cjs`)

22 clients enregistrés, 553 dossiers test data. Source de vérité pour les configurations tenant.

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

## Protocol Ecosystem

### MCP vs A2A vs AG-UI vs A2UI vs AP2

| Protocol | Standard | VocalIA | Fonction |
|:---------|:---------|:-------:|:---------|
| **MCP** | Model Context Protocol | ⚠️ 203 tools (2.5/10 compliance) | AI Agent → Tools |
| **A2A** | Agent-to-Agent | ✅ coded | Agent → Agent (Agent Card + Task Lifecycle) |
| **AG-UI** | Agent-User Interaction | ✅ coded | Agent → Frontend (17 events, SSE) |
| **A2UI** | Agent-to-UI | ✅ coded | Agent → Interface dynamique |
| **AP2** | Agent Payments | ❌ | Agent → Paiement |

---

## SOTA Comparison — Audit Honnête (250.171b)

### vs MCP Spec 2025-11-25

| Requirement | Spec | VocalIA | Status | Phase Fix |
|:------------|:-----|:--------|:------:|:---------:|
| **registerTool()** | Current API | `server.tool()` (deprecated) | ❌ | Phase 1 |
| **Tool descriptions** | Required for LLM | 0/203 tools | ❌ | Phase 1 |
| **Tool annotations** | readOnly/destructive hints | 0/203 tools | ❌ | Phase 1 |
| **outputSchema** | Structured output | 0/203 tools | ❌ | Phase 1 |
| **isError flag** | Error signaling | 0 usages | ❌ | Phase 1 |
| **Resources** | Application data | 0 resources | ❌ | Phase 2 |
| **Prompts** | User templates | 0 prompts | ❌ | Phase 2 |
| **Logging** | sendLoggingMessage() | 0 usages | ❌ | Phase 3 |
| **Progress** | Long operations | 0 usages | ❌ | Phase 3 |
| **Remote transport** | SSE/Streamable HTTP | stdio only | ❌ | Phase 4 |
| **OAuth 2.1** | Remote auth | None | ❌ | Phase 4 |
| **Zod validation** | Input validation | ✅ All inputs | ✅ | — |
| **Error handling** | try/catch | ✅ All tools | ✅ | — |
| **Multi-tenant** | Tenant isolation | ✅ Via _meta | ✅ | — |
| **Content type** | text/image/resource | text only | ⚠️ | P3 |

**Score: 3/15 (20%)** — Seuls validation, error handling et multi-tenant sont conformes.

### vs Best Practices 2026

| Practice | Standard | VocalIA | Status |
|:---------|:---------|:--------|:------:|
| Single Responsibility | 1 domaine par server | ✅ Voice AI | ✅ |
| Tool descriptions | Human + LLM readable | ❌ 0/203 | ❌ |
| Bounded toolsets | < 50 tools ideally | ⚠️ 203 tools (risque confusion LLM) | ⚠️ |
| Published on registry | npm + MCP Registry | ❌ Non publié | ❌ |
| README + examples | Install + usage | ⚠️ Partiel | ⚠️ |
| CI/CD | Automated build+publish | ❌ Manuel | ❌ |
| Monitoring | Logging/metrics | ❌ Aucun | ❌ |
| Versioned | SemVer | ⚠️ Chaos (3 versions) | ⚠️ |

**Score: 2/8 (25%)**

---

## Roadmap vers SOTA 1.0.0

| Phase | Feature | Effort | Dépendances | Status |
|:------|:--------|:------:|:------------|:------:|
| **0** | Fondations (version, counts, data) | 4h | — | ❌ TODO |
| **1** | Migration registerTool() + descriptions + annotations | 8h | Phase 0 | ❌ TODO |
| **2** | Resources (6) + Prompts (8) | 6h | Phase 1 | ❌ TODO |
| **3** | Logging + Progress reporting | 3h | Phase 1 | ❌ TODO |
| **4** | Transport HTTP + OAuth 2.1 + HTTPS | 12h | Phase 1 | ❌ TODO |
| **5** | Publication npm + Registry + Docker + GitHub + HF | 8h | Phase 1 | ❌ TODO |
| — | **TOTAL** | **~41h** | — | — |

### Versions prévues

| Version | Contenu | Score prévu |
|:--------|:--------|:----------:|
| 0.8.0 | État actuel | 2.5/10 |
| 0.9.0 | Phase 0+1 (descriptions, annotations, modern API) | 5.5/10 |
| 0.10.0 | Phase 2 (Resources + Prompts) | 7.0/10 |
| 0.11.0 | Phase 3 (Logging + Progress) | 7.5/10 |
| 1.0.0-rc | Phase 4 (HTTP transport + OAuth) | 9.0/10 |
| **1.0.0** | Phase 5 (Published: npm + Registry + Docker) | **9.5/10** |

---

## Variables d'Environnement

| Variable | Service | Requis |
|:---------|:--------|:------:|
| `VOCALIA_API_URL` | Voice API | ❌ (défaut: localhost:3004) |
| `VOCALIA_TELEPHONY_URL` | Telephony | ❌ (défaut: localhost:3009) |
| `TWILIO_ACCOUNT_SID` | Telephony | Pour téléphonie |
| `TWILIO_AUTH_TOKEN` | Telephony | Pour téléphonie |
| `TWILIO_PHONE_NUMBER` | Telephony | Pour téléphonie |
| `HUBSPOT_API_KEY` | CRM | Pour HubSpot |
| `SHOPIFY_ACCESS_TOKEN` | E-commerce | Pour Shopify |
| `SHOPIFY_SHOP_NAME` | E-commerce | Pour Shopify |
| `KLAVIYO_API_KEY` | Marketing | Pour Klaviyo |
| `STRIPE_SECRET_KEY` | Payments | Pour Stripe |
| `GOOGLE_*` | Google Workspace | Pour Sheets/Drive/Docs/Gmail/Calendar |
| `SMTP_*` | Email | Pour envoi email |
| `CALENDLY_ACCESS_TOKEN` | Booking | Pour Calendly |
| `FRESHDESK_*` | Support | Pour Freshdesk |
| `ZENDESK_*` | Support | Pour Zendesk |
| `PIPEDRIVE_*` | CRM | Pour Pipedrive |

---

## Développement

### Mode Watch

```bash
cd mcp-server && npm run dev
```

### MCP Inspector (Debug)

```bash
cd mcp-server && npm run inspector
```

### Build & Test

```bash
cd mcp-server && npm run build
node dist/index.js  # Vérifier startup
```

---

## Règles Critiques MCP

1. **JAMAIS utiliser `console.log`** — Corrompt le transport JSON-RPC stdio
2. Utiliser `console.error` pour tout logging debug
3. Toujours retourner `{ content: [{ type: "text", text: "..." }] }`
4. Les tools doivent être idempotents quand possible
5. **Après Phase 1** : Toujours passer `description` et `annotations` à `registerTool()`
6. **Après Phase 1** : Retourner `isError: true` pour les erreurs

---

## Dépendances API

```bash
# Démarrer Voice API
node core/voice-api-resilient.cjs --server

# Démarrer Telephony (optionnel)
node telephony/voice-telephony-bridge.cjs

# Démarrer DB API (optionnel)
node core/db-api.cjs

# Vérifier
curl http://localhost:3004/health
curl http://localhost:3009/health
curl http://localhost:3013/api/db/health
```

---

## Liens

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP Registry GitHub](https://github.com/modelcontextprotocol/registry)
- [Anthropic MCP Docs](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenAI MCP Connectors](https://platform.openai.com/docs/guides/tools-connectors-mcp)
- [VS Code MCP](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/)
- [n8n MCP Docs](https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/)
- [Lovable MCP](https://docs.lovable.dev/integrations/mcp-servers)
- [VocalIA GitHub](https://github.com/Jouiet/VocalIA)

---

*Documentation créée: 29/01/2026 - Session 227*
*Audit MCP complet: 09/02/2026 - Session 250.171b (18 bugs, score 2.5/10)*
*Plan actionnable: 5 phases, ~41h, target 9.5/10*
*Plateformes cibles: 14 (5 Tier 1 stdio + 4 Tier 2 HTTP + 3 Tier 3 proxy + 2 Tier 4 builders)*

*Maintenu par: VocalIA Engineering*
