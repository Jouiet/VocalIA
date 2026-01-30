# VocalIA Integrations Roadmap - Forensic Analysis

> **Version**: 2.3.0 | **Date**: 30/01/2026 | **Session**: 249.2
> **Methodology**: Bottom-up forensic audit | **Status**: ✅ PHASE 0 COMPLETE (100%)

---

## ✅ Phase 0: Multi-Tenant Architecture (COMPLETE)

**Session 249.2: Tous les composants implémentés. Architecture multi-tenant prête.**

| Composant | État | Vérification |
|:----------|:----:|:-------------|
| SecretVault.cjs | ✅ DONE | `node core/SecretVault.cjs --health` → OK |
| clients/ directory | ✅ DONE | 2 tenants: agency_internal, client_demo |
| client-registry.cjs | ✅ DONE | Charge configs depuis clients/ |
| Refactor HubSpot | ✅ DONE | getForTenant(), createForTenant() |
| Refactor Calendar/Slack | ✅ DONE | _meta.tenantId support |
| OAuth Gateway | ✅ DONE | `core/OAuthGateway.cjs` (401 lines) - port 3010 |
| Webhook handlers | ✅ DONE | `core/WebhookRouter.cjs` (394 lines) - port 3011 |

**Progression Phase 0**: 7/7 (100%) | **Status**: Ready for Phase 1

---

## Executive Summary

| Metric | Value |
|:-------|:------|
| **Integrations affichées sur site** | 20 |
| **Integrations implémentées** | **11** (55%) |
| **Gap à combler** | 9 |
| **Google Apps (Sheets + Drive)** | ✅ COMPLETE (Session 249.2) |
| **Phase 0 (Multi-Tenant)** | ✅ 100% COMPLETE |
| **Phase 1 Progress** | ✅ 100% (5/5) COMPLETE |
| **Effort total restant** | 40-70 jours-homme |

---

## 1. ÉTAT ACTUEL (Vérifié le 30/01/2026)

### 1.1 Intégrations IMPLÉMENTÉES (6/20)

| # | Intégration | Fichier | Lignes | Fonctionnalités | Status |
|:-:|:------------|:--------|:------:|:----------------|:------:|
| 1 | **HubSpot** | `integrations/hubspot-b2b-crm.cjs` | 1,169 | Contacts, Companies, Deals, Batch, HITL, Associations | ✅ FULL |
| 2 | **Shopify** | `integrations/voice-ecommerce-tools.cjs` | 150 | Order status, Product stock | ⚠️ PARTIAL |
| 3 | **Klaviyo** | `integrations/voice-ecommerce-tools.cjs` | 150 | Customer profile lookup | ⚠️ PARTIAL |
| 4 | **Téléphonie PSTN** | `telephony/voice-telephony-bridge.cjs` | 1,200+ | Twilio inbound/outbound, Grok WebSocket | ✅ FULL |
| 5 | **Slack** | `mcp-server/src/tools/slack.ts` | 66 | Webhook notifications | ⚠️ PARTIAL |
| 6 | **Google Calendar** | `mcp-server/src/tools/calendar.ts` | 112 | Check availability, Create event | ⚠️ PARTIAL |

**Vérification empirique:**
```bash
# HubSpot
wc -l integrations/hubspot-b2b-crm.cjs  # 1169
node integrations/hubspot-b2b-crm.cjs --health  # TEST MODE OK

# E-commerce
wc -l integrations/voice-ecommerce-tools.cjs  # 150

# MCP Tools
ls mcp-server/src/tools/  # calendar.ts, slack.ts, ucp.ts
```

### 1.2 Intégrations NON IMPLÉMENTÉES (14/20)

| # | Intégration | Catégorie | Affiché Site | Code | Verdict |
|:-:|:------------|:----------|:------------:|:----:|:-------:|
| 1 | Salesforce | CRM | ✅ | ❌ | MANQUANT |
| 2 | Pipedrive | CRM | ✅ | ✅ | DONE (Session 249.3) |
| 3 | Zoho CRM | CRM | ✅ | ❌ | MANQUANT |
| 4 | WooCommerce | E-commerce | ✅ | ❌ | MANQUANT |
| 5 | Magento | E-commerce | ✅ | ❌ | MANQUANT |
| 6 | Microsoft Teams | Communication | ✅ | ❌ | MANQUANT |
| 7 | WhatsApp Business | Communication | ✅ | ❌ | MANQUANT |
| 8 | Outlook Calendar | Calendrier | ✅ | ❌ | MANQUANT |
| 9 | Calendly | Calendrier | ✅ | ✅ | DONE (Session 249.3) |
| 10 | Cal.com | Calendrier | ✅ | ❌ | MANQUANT |
| 11 | Zendesk | Support | ✅ | ❌ | MANQUANT |
| 12 | Freshdesk | Support | ✅ | ✅ | DONE (Session 249.3) |
| 13 | Intercom | Support | ✅ | ❌ | MANQUANT |
| 14 | Crisp | Support | ✅ | ❌ | MANQUANT |

---

## 2. GOOGLE APPS - Analyse de Faisabilité

### 2.1 SDK Disponible

```json
// mcp-server/package.json
"googleapis": "^171.0.0"  // ✅ DÉJÀ INSTALLÉ - Inclut TOUS les APIs Google
```

**APIs disponibles dans node_modules:**
```
googleapis/build/src/apis/
├── calendar/  ✅ (déjà utilisé)
├── docs/      ✅ disponible
├── drive/     ✅ disponible
├── gmail/     ✅ disponible
└── sheets/    ✅ disponible
```

### 2.2 OAuth Scopes Requis

| API | Scope Recommandé | Sensibilité | Vérification Google |
|:----|:-----------------|:------------|:--------------------|
| Gmail | `gmail.readonly` / `gmail.send` | 🔴 RESTRICTED | App Review Requis |
| Drive | `drive.file` | 🟢 Non-sensitive | Streamlined |
| Sheets | `spreadsheets` | 🟡 Sensitive | Review possible |
| Docs | `documents` | 🟡 Sensitive | Review possible |
| Calendar | `calendar.events` | 🟡 Sensitive | Review possible |

**Source**: [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)

### 2.3 Fonctionnalités Pertinentes pour Voice AI

| API | Use Case Voice AI | Priorité | Complexité |
|:----|:------------------|:--------:|:----------:|
| **Gmail** | Lire emails client, envoyer confirmations | P1 | Haute |
| **Drive** | Accès documents client, upload fichiers | P2 | Moyenne |
| **Sheets** | Lire données CRM custom, rapports | P2 | Basse |
| **Docs** | Générer contrats, propositions | P3 | Moyenne |

---

## 3. MATRICE D'EFFORT - Estimation Réaliste

### 3.1 Méthodologie

```
Effort = (Complexité API × Scope fonctionnel × Tests) + Documentation
- Complexité API: 1-5 (1=simple REST, 5=OAuth complexe)
- Scope: 1-5 (1=1 endpoint, 5=10+ endpoints)
- Tests: +20% pour tests unitaires/intégration
- Documentation: +10%
```

### 3.2 Estimations Détaillées

#### CRM & Sales (3 manquantes)

| Intégration | API Type | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:---------|:---------:|:----:|:----------:|:----------:|:----------|
| **Salesforce** | REST + SOQL | 8-10 | OAuth 2.0 JWT | 5j | 8j | SF Sandbox requis |
| **Pipedrive** | REST | 6-8 | API Key | 3j | 5j | - |
| **Zoho CRM** | REST | 6-8 | OAuth 2.0 | 4j | 6j | Multi-datacenter |

**Détail Salesforce:**
- `Contact.create/read/update`
- `Lead.convert`
- `Opportunity.create/update`
- `Account.lookup`
- SOQL queries custom
- Bulk API pour sync

#### E-commerce (2 manquantes + 2 à compléter)

| Intégration | API Type | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:---------|:---------:|:----:|:----------:|:----------:|:----------|
| **WooCommerce** | REST v3 | 6-8 | Consumer Key/Secret | 3j | 4j | WP hosting varié |
| **Magento** | GraphQL | 8-10 | Bearer Token | 4j | 6j | Magento 2.4+ requis |
| **Shopify** (compléter) | REST/GraphQL | +4 | existant | 1j | 2j | - |
| **Klaviyo** (compléter) | REST v3 | +3 | existant | 1j | 1.5j | - |

**Détail WooCommerce:**
- `orders.list/get`
- `products.search`
- `customers.get`
- `inventory.check`
- Webhooks pour events

#### Communication (2 manquantes)

| Intégration | API Type | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:---------|:---------:|:----:|:----------:|:----------:|:----------|
| **Microsoft Teams** | Graph API | 5-7 | OAuth 2.0 Azure AD | 4j | 7j | Azure tenant config |
| **WhatsApp Business** | Cloud API | 4-6 | Bearer Token | 3j | 5j | Meta Business verification |

**Détail Microsoft Teams:**
- `chat.create`
- `message.send`
- `channel.post`
- Adaptive Cards
- Presence API

**Détail WhatsApp:**
- `messages.send` (text, template)
- `media.upload`
- Webhook handlers
- Template management

#### Calendriers (3 manquantes)

| Intégration | API Type | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:---------|:---------:|:----:|:----------:|:----------:|:----------|
| **Outlook Calendar** | Graph API | 4-5 | OAuth 2.0 Azure AD | 2j | 4j | Azure tenant |
| **Calendly** | REST v2 | 4-5 | OAuth 2.0 | 2j | 3j | - |
| **Cal.com** | REST | 4-5 | API Key | 1.5j | 2.5j | Self-hosted variant |

#### Support & Helpdesk (4 manquantes)

| Intégration | API Type | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:---------|:---------:|:----:|:----------:|:----------:|:----------|
| **Zendesk** | REST | 6-8 | OAuth 2.0 / API Token | 3j | 5j | - |
| **Freshdesk** | REST v2 | 5-7 | API Key | 2j | 3j | - |
| **Intercom** | REST | 5-7 | OAuth 2.0 | 2.5j | 4j | - |
| **Crisp** | REST + WebSocket | 4-6 | Plugin Auth | 2j | 3j | - |

**Fonctionnalités Support communes:**
- `ticket.create/update/get`
- `conversation.reply`
- `contact.lookup`
- Webhook pour nouveaux tickets

#### Google Apps (4 nouvelles)

| Intégration | API Version | Endpoints | Auth | Effort Min | Effort Max | Bloqueurs |
|:------------|:------------|:---------:|:----:|:----------:|:----------:|:----------|
| **Gmail** | v1 | 5-7 | OAuth 2.0 (existant) | 2j | 4j | 🔴 App Review |
| **Drive** | v3 | 5-6 | OAuth 2.0 (existant) | 1.5j | 3j | - |
| **Sheets** | v4 | 4-5 | OAuth 2.0 (existant) | 1.5j | 2.5j | - |
| **Docs** | v1 | 3-4 | OAuth 2.0 (existant) | 1j | 2j | - |

**Avantage Google Apps:** OAuth déjà configuré pour Calendar → réutilisable.

---

## 4. PRIORISATION STRATÉGIQUE

### 4.1 Critères de Priorisation

| Critère | Poids | Description |
|:--------|:-----:|:------------|
| ROI Client | 30% | Demandes clients fréquentes |
| Effort | 25% | Temps d'implémentation |
| Dépendances | 20% | Bloqueurs techniques |
| Différenciation | 15% | Avantage concurrentiel |
| Synergie | 10% | Réutilisation code existant |

### 4.2 Classement Final

| Priorité | Intégration | Score | Effort | Justification |
|:--------:|:------------|:-----:|:------:|:--------------|
| **P0** | Google Sheets | 92 | 1.5-2.5j | SDK installé, OAuth ready, use case CRM |
| **P0** | Google Drive | 90 | 1.5-3j | SDK installé, OAuth ready |
| **P1** | Calendly | 85 | 2-3j | API simple, forte demande |
| **P1** | Pipedrive | 83 | 3-5j | CRM populaire PME |
| **P1** | Freshdesk | 82 | 2-3j | Support simple, API clean |
| **P1** | WhatsApp Business | 80 | 3-5j | Canal critique MENA |
| **P2** | Gmail | 78 | 2-4j | Utile mais App Review |
| **P2** | Google Docs | 77 | 1-2j | Nice-to-have |
| **P2** | Zendesk | 75 | 3-5j | Enterprise |
| **P2** | WooCommerce | 73 | 3-4j | E-commerce alternatif |
| **P2** | Outlook Calendar | 72 | 2-4j | Azure setup complexe |
| **P2** | Cal.com | 70 | 1.5-2.5j | Alternative Calendly |
| **P3** | Salesforce | 65 | 5-8j | Complexe mais Enterprise |
| **P3** | Microsoft Teams | 63 | 4-7j | Azure setup complexe |
| **P3** | Intercom | 60 | 2.5-4j | Niche |
| **P3** | Zoho CRM | 58 | 4-6j | Multi-datacenter |
| **P3** | Magento | 55 | 4-6j | E-commerce legacy |
| **P3** | Crisp | 52 | 2-3j | Niche |

---

## 5. PLANNING DÉTAILLÉ

### 5.0 Phase 0: Fondations Multi-Tenant (BLOQUANT) ⚠️

**Objectif**: Permettre isolation credentials par client (interne + externe)

| Jour | Composant | Tâches | Livrables |
|:----:|:----------|:-------|:----------|
| J1 | clients/ structure | Créer répertoire, templates config.json | `clients/_template/config.json` |
| J2-J3 | SecretVault.cjs | Per-tenant credential storage, encryption | `core/SecretVault.cjs` |
| J4-J5 | OAuth Gateway | Flow pour connecter comptes clients | `core/OAuthGateway.cjs` |
| J6-J8 | Refactor existants | HubSpot, Calendar, Slack → TenantContext | Mise à jour fichiers existants |
| J9-J10 | Webhook handlers | Recevoir data inbound des systèmes | `core/WebhookRouter.cjs` |

**Effort Phase 0**: 10-15 jours
**Status**: ✅ COMPLETE (Session 249.2)

**Progression Phase 0:**
| Composant | Status | Vérification |
|:----------|:------:|:-------------|
| clients/ structure | ✅ DONE | `ls clients/` → 2 tenants |
| SecretVault.cjs | ✅ DONE | `node core/SecretVault.cjs --health` OK |
| client-registry.cjs updated | ✅ DONE | Charge depuis clients/ |
| Refactor HubSpot | ✅ DONE | getForTenant(), createForTenant() |
| Refactor Calendar/Slack | ✅ DONE | _meta.tenantId, getGoogleCredentials() |
| OAuth Gateway | ✅ DONE | `core/OAuthGateway.cjs` (401 lines, port 3010) |
| Webhook handlers | ✅ DONE | `core/WebhookRouter.cjs` (394 lines, port 3011) |

**Vérification empirique (30/01/2026):**
```bash
ls core/SecretVault.cjs           # ✅ EXISTS (347 lines)
ls core/OAuthGateway.cjs          # ✅ EXISTS (401 lines)
ls core/WebhookRouter.cjs         # ✅ EXISTS (394 lines)
ls clients/                       # ✅ EXISTS (2 tenants)
node core/SecretVault.cjs --health  # ✅ OK
```

---

### 5.1 Phase 1: Quick Wins (Semaine 3-4) - APRÈS Phase 0

**Objectif**: 6 intégrations avec le meilleur ROI/effort

| Jour | Intégration | Tâches | Livrables | Status |
|:----:|:------------|:-------|:----------|:------:|
| J1-J2 | Google Sheets | OAuth scope ajout, CRUD cells, read range | `mcp-server/src/tools/sheets.ts` | ✅ DONE |
| J3-J4 | Google Drive | List files, upload, download, share | `mcp-server/src/tools/drive.ts` | ✅ DONE |
| J5-J6 | Calendly | Availability, book event, cancel | `mcp-server/src/tools/calendly.ts` | ✅ DONE |
| J7-J8 | Freshdesk | Create ticket, get ticket, reply | `mcp-server/src/tools/freshdesk.ts` | ✅ DONE |
| J9-J10 | Pipedrive | Contacts, deals, activities | `mcp-server/src/tools/pipedrive.ts` | ✅ DONE |

**Effort Phase 1**: 10-15 jours
**Progress Phase 1**: 5/5 (100%) - COMPLETE (Session 249.3)
- Google Sheets ✅
- Google Drive ✅
- Calendly ✅ (6 tools)
- Freshdesk ✅ (6 tools)
- Pipedrive ✅ (7 tools)

### 5.2 Phase 2: Communication (Semaine 3-4)

| Jour | Intégration | Tâches | Livrables |
|:----:|:------------|:-------|:----------|
| J11-J13 | WhatsApp Business | Send message, templates, media | `mcp-server/src/tools/whatsapp.ts` |
| J14-J16 | Gmail | Read inbox, send email, search | `mcp-server/src/tools/gmail.ts` |
| J17-J18 | Google Docs | Create doc, read doc, update | `mcp-server/src/tools/docs.ts` |

**Effort Phase 2**: 6-10 jours

### 5.3 Phase 3: Enterprise (Semaine 5-7)

| Jour | Intégration | Tâches | Livrables |
|:----:|:------------|:-------|:----------|
| J19-J21 | Zendesk | Tickets, users, organizations | `mcp-server/src/tools/zendesk.ts` |
| J22-J25 | Salesforce | Contacts, leads, opportunities | `integrations/salesforce-crm.cjs` |
| J26-J28 | Microsoft Teams | Messages, channels, cards | `mcp-server/src/tools/teams.ts` |
| J29-J30 | Outlook Calendar | Events, availability | `mcp-server/src/tools/outlook.ts` |

**Effort Phase 3**: 12-18 jours

### 5.4 Phase 4: Long Tail (Semaine 8-10)

| Jour | Intégration | Tâches | Livrables |
|:----:|:------------|:-------|:----------|
| J31-J33 | WooCommerce | Orders, products, customers | `integrations/woocommerce.cjs` |
| J34-J36 | Intercom | Conversations, contacts | `mcp-server/src/tools/intercom.ts` |
| J37-J39 | Zoho CRM | Leads, contacts, deals | `integrations/zoho-crm.cjs` |
| J40-J42 | Magento | Orders, products, inventory | `integrations/magento.cjs` |
| J43-J44 | Cal.com | Bookings, availability | `mcp-server/src/tools/calcom.ts` |
| J45-J46 | Crisp | Conversations, contacts | `mcp-server/src/tools/crisp.ts` |
| J47 | Compléter Shopify | +4 endpoints | update `voice-ecommerce-tools.cjs` |
| J47 | Compléter Klaviyo | +3 endpoints | update `voice-ecommerce-tools.cjs` |

**Effort Phase 4**: 15-20 jours

---

## 6. DÉPENDANCES & BLOQUEURS

### 6.1 Credentials Requis (User Action)

| Intégration | Credentials | Source | Status |
|:------------|:------------|:-------|:------:|
| Google Apps | CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN | [Google Cloud Console](https://console.cloud.google.com/) | ⚠️ Partiel |
| Salesforce | CLIENT_ID, CLIENT_SECRET, INSTANCE_URL | [Salesforce Developer](https://developer.salesforce.com/) | ❌ Manquant |
| Pipedrive | API_TOKEN | [Pipedrive Settings](https://app.pipedrive.com/settings/api) | ❌ Manquant |
| WhatsApp | PHONE_NUMBER_ID, ACCESS_TOKEN | [Meta Business](https://business.facebook.com/) | ❌ Manquant |
| Microsoft | AZURE_CLIENT_ID, AZURE_SECRET, TENANT_ID | [Azure Portal](https://portal.azure.com/) | ❌ Manquant |
| Calendly | API_KEY | [Calendly Integrations](https://calendly.com/integrations) | ❌ Manquant |
| Zendesk | SUBDOMAIN, API_TOKEN | Zendesk Admin | ❌ Manquant |
| Freshdesk | DOMAIN, API_KEY | Freshdesk Admin | ❌ Manquant |
| Intercom | ACCESS_TOKEN | [Intercom Developer](https://developers.intercom.com/) | ❌ Manquant |
| WooCommerce | CONSUMER_KEY, CONSUMER_SECRET, STORE_URL | WooCommerce Settings | ❌ Manquant |
| Zoho | CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN | [Zoho API Console](https://api-console.zoho.com/) | ❌ Manquant |
| Magento | ACCESS_TOKEN, STORE_URL | Magento Admin | ❌ Manquant |
| Cal.com | API_KEY | Cal.com Settings | ❌ Manquant |
| Crisp | WEBSITE_ID, TOKEN_SECRET | Crisp Settings | ❌ Manquant |

### 6.2 Vérifications Externes Requises

| Service | Type | Délai Estimé | Impact |
|:--------|:-----|:------------:|:-------|
| Gmail | Google App Review | 2-4 semaines | Bloque scope `gmail.send` |
| WhatsApp | Meta Business Verification | 1-2 semaines | Bloque production |
| Salesforce | AppExchange listing (optionnel) | 4-8 semaines | Marketing only |

### 6.3 Dépendances Techniques

```mermaid
graph TD
    A[OAuth Google] --> B[Gmail]
    A --> C[Drive]
    A --> D[Sheets]
    A --> E[Docs]
    A --> F[Calendar existant]

    G[Azure AD] --> H[Teams]
    G --> I[Outlook]

    J[Meta Business] --> K[WhatsApp]
```

---

## 7. STRUCTURE DE FICHIERS CIBLE

```
mcp-server/src/tools/
├── calendar.ts       # ✅ Existant (Google Calendar)
├── slack.ts          # ✅ Existant
├── ucp.ts            # ✅ Existant
├── gmail.ts          # 🆕 À créer
├── drive.ts          # ✅ DONE (6 tools)
├── sheets.ts         # ✅ DONE (5 tools)
├── docs.ts           # 🆕 À créer
├── calendly.ts       # ✅ DONE (6 tools)
├── calcom.ts         # 🆕 À créer
├── outlook.ts        # 🆕 À créer
├── teams.ts          # 🆕 À créer
├── whatsapp.ts       # 🆕 À créer
├── zendesk.ts        # 🆕 À créer
├── freshdesk.ts      # ✅ DONE (6 tools)
├── intercom.ts       # 🆕 À créer
└── crisp.ts          # 🆕 À créer

integrations/
├── hubspot-b2b-crm.cjs      # ✅ Existant
├── voice-ecommerce-tools.cjs # ✅ À compléter
├── voice-crm-tools.cjs       # ✅ Existant
├── salesforce-crm.cjs        # 🆕 À créer
├── pipedrive.ts              # ✅ DONE (7 tools) - MCP tool
├── zoho-crm.cjs              # 🆕 À créer
├── woocommerce.cjs           # 🆕 À créer
└── magento.cjs               # 🆕 À créer
```

---

## 8. TEMPLATE D'IMPLÉMENTATION

### 8.1 Pattern MCP Tool

```typescript
// mcp-server/src/tools/{integration}.ts
import { z } from 'zod';

export const {integration}Tools = {
    {action}_name: {
        name: '{integration}_{action}',
        description: 'Description claire de l\'action',
        parameters: {
            param1: z.string().describe('Description'),
            param2: z.number().optional(),
        },
        handler: async (args: { param1: string, param2?: number }) => {
            // 1. Validate credentials
            const apiKey = process.env.{INTEGRATION}_API_KEY;
            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing {INTEGRATION}_API_KEY",
                            hint: "Configure in .env"
                        }, null, 2)
                    }]
                };
            }

            // 2. API call
            try {
                const response = await fetch(`https://api.{integration}.com/v1/endpoint`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });

                if (!response.ok) throw new Error(`API error: ${response.status}`);

                const data = await response.json();

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ status: "success", data }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ status: "error", message: error.message }, null, 2)
                    }]
                };
            }
        }
    }
};
```

### 8.2 Pattern Integration CommonJS

```javascript
// integrations/{integration}.cjs
require('dotenv').config();

const CONFIG = {
    apiKey: process.env.{INTEGRATION}_API_KEY,
    baseUrl: 'https://api.{integration}.com/v1'
};

class {Integration}Client {
    constructor() {
        if (!CONFIG.apiKey) {
            console.warn('⚠️ {INTEGRATION}_API_KEY not set - test mode');
            this.testMode = true;
        }
    }

    async action1(params) {
        if (this.testMode) {
            return { success: true, testMode: true, params };
        }
        // Real implementation
    }

    async healthCheck() {
        console.log('🔍 {Integration} Health Check');
        // Test API connectivity
    }
}

module.exports = new {Integration}Client();
```

---

## 9. MÉTRIQUES DE SUCCÈS

| Métrique | Actuel | Cible Phase 1 | Cible Finale |
|:---------|:------:|:-------------:|:------------:|
| Intégrations implémentées | 6 | 11 | 24 |
| Couverture site | 30% | 55% | 100%+ |
| MCP Tools | 27 | 40 | 60+ |
| Tests unitaires | 0 | 50% | 80% |

---

## 10. RISQUES & MITIGATIONS

| Risque | Probabilité | Impact | Mitigation |
|:-------|:----------:|:------:|:-----------|
| Gmail App Review rejeté | 30% | Haut | Utiliser scope `gmail.readonly` d'abord |
| WhatsApp verification delay | 40% | Moyen | Démarrer process en parallèle |
| API breaking changes | 20% | Moyen | Version lock dans package.json |
| Credentials leak | 10% | Critique | .env.example, .gitignore strict |
| Rate limiting | 50% | Bas | Exponential backoff + queuing |

---

## 11. CHECKLIST PRÉ-IMPLÉMENTATION

- [ ] Credentials Google complets (CLIENT_ID, SECRET, REFRESH_TOKEN)
- [ ] Compte Meta Business vérifié (pour WhatsApp)
- [ ] Azure AD tenant configuré (pour Microsoft)
- [ ] Comptes sandbox: Salesforce, Pipedrive, Zendesk
- [ ] Tests API manuels via Postman/Insomnia

---

## 12. RÉFÉRENCES

- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google Sheets API](https://developers.google.com/workspace/sheets/api/scopes)
- [Google Docs API](https://developers.google.com/workspace/docs/api/auth)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/overview)

---

*Document généré: 30/01/2026 - Session 249*
*Méthodologie: Audit forensique bottom-up*
*Auteur: Claude Opus 4.5*
