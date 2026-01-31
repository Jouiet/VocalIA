# VocalIA - Matrice Intégrations × Use Cases

> **Version**: 1.1.0 | **Date**: 31/01/2026 | **Session**: 249.16
> **21 Intégrations natives réelles + 3 iPaaS = 159 MCP Tools**
> **VÉRIFIÉ**: Audit codebase 31/01/2026 - Corrections appliquées

---

## 1. Vue d'Ensemble

### Intégrations Natives (23)

```
E-COMMERCE (5)        CRM (3)           SCHEDULING (2)      SUPPORT (2)
├── Shopify           ├── Pipedrive     ├── Calendar        ├── Freshdesk
├── WooCommerce       ├── Zoho          └── Calendly        └── Zendesk
├── Magento           └── HubSpot*
├── PrestaShop
└── BigCommerce

COMMUNICATION (3)     WEBSITE (2)       PRODUCTIVITY (3)    iPaaS (3)
├── Slack             ├── Wix           ├── Sheets          ├── Zapier (+7000)
├── Gmail             └── Squarespace   ├── Drive           ├── Make
└── Email                               └── Docs            └── n8n

* HubSpot via WebhookRouter
```

---

## 2. Matrice Intégration × Use Case

### 2.1 E-commerce (5 intégrations)

| Intégration | READ | WRITE | Cancel/Refund | MCP Tools |
|:------------|:----:|:-----:|:-------------:|:---------:|
| **Shopify** | ✅ | ✅ | ✅ | **8** |
| **WooCommerce** | ✅ | ✅ | ✅ | 7 |
| **Magento** | ✅ | ✅ | ✅ | **10** |
| **PrestaShop** | ✅ | ✅ | ✅ | **10** |
| **BigCommerce** | ✅ | ✅ | ✅ | **9** |

> **✅ SHOPIFY FULL CRUD** (Session 249.20):
> - `shopify_get_order`, `shopify_list_orders` = lecture commandes
> - `shopify_get_product`, `shopify_search_customers` = lecture produits/clients
> - **`shopify_cancel_order`** = GraphQL orderCancel mutation ✅
> - **`shopify_create_refund`** = GraphQL refundCreate mutation ✅
> - **`shopify_update_order`** = GraphQL orderUpdate mutation ✅
> - **`shopify_create_fulfillment`** = Mark shipped with tracking ✅
>
> **✅ WooCommerce** peut modifier status à 'cancelled' ou 'refunded' via `woocommerce_update_order`

#### Workflows E-commerce

```
[Appel entrant] → qualify_lead → check_order_status → [Shopify lookup]
                                                    ↓
                              [Statut commande communiqué au client]
                                                    ↓
                              track_conversion_event → [Analytics]
```

### 2.2 CRM (3 intégrations)

| Intégration | Use Cases Directs | Sync Bidirectionnel | Personas |
|:------------|:------------------|:--------------------|:---------|
| **Pipedrive** | Lead management, Deal tracking, Activity log | ✅ Full (7 MCP tools) | AGENCY, UNIVERSAL_SME |
| **Zoho CRM** | Contact management, Pipeline | ✅ Full (6 MCP tools) | AGENCY, UNIVERSAL_SME |
| **HubSpot** | Inbound marketing, Contact sync | ✅ Full CRUD (hubspot-b2b-crm.cjs) | AGENCY |

> **CORRECTION 31/01/2026**: HubSpot a une API bidirectionnelle COMPLÈTE via `hubspot-b2b-crm.cjs`:
> - `searchContacts()`, `upsertContact()`, `batchCreateContacts()`, `batchUpdateContacts()`
> - `createDeal()`, `updateDealStage()`, `updateLeadScore()`
> - HITL support pour high-value deals

#### Workflows CRM

```
[Lead qualifié (score 80+)] → Pipedrive: create_deal
                           → Slack: notification équipe vente
                           → Calendar: schedule_callback
```

### 2.3 Scheduling (2 intégrations)

| Intégration | Use Cases Directs | Capacités | Personas |
|:------------|:------------------|:----------|:---------|
| **Google Calendar** | RDV, Rappels, Disponibilité | Read/Write events | DENTAL, PROPERTY, RECRUITER |
| **Calendly** | Self-booking, Event types | Full API | DENTAL, COUNSELOR, TRAINER |

#### Workflows Scheduling

```
[Demande RDV] → Calendly: get_available_times
             → [Client choisit créneau]
             → create_booking → Calendar: create_event
             → Gmail: confirmation email
             → Slack: notification équipe
```

### 2.4 Support (2 intégrations)

| Intégration | Use Cases Directs | Ticket Management | Personas |
|:------------|:------------------|:------------------|:---------|
| **Freshdesk** | Ticket creation, Status check, Reply | Full CRUD | CONCIERGE, DISPATCHER |
| **Zendesk** | Enterprise support, Multi-channel | Full CRUD | CONCIERGE |

#### Workflows Support

```
[Problème signalé] → search_knowledge_base → [Solution trouvée?]
                                           ↓ Non
                   Freshdesk: create_ticket → Slack: alert support
                                           ↓
                   [Résolution] → Freshdesk: update_ticket → Email: confirmation
```

### 2.5 Communication (3 intégrations)

| Intégration | Use Cases Directs | Capacités | Personas |
|:------------|:------------------|:----------|:---------|
| **Slack** | Team alerts, Notifications, Escalation | Post messages, Channels | Tous |
| **Gmail** | Email confirmations, Follow-ups | Send emails | Tous |
| **Email (SMTP)** | Transactional emails | Send emails | Tous |

### 2.6 Website Builders (2 intégrations)

| Intégration | Use Cases Directs | Capacités | Personas |
|:------------|:------------------|:----------|:---------|
| **Wix** | Form submissions, Store sync | Read data | UNIVERSAL_SME |
| **Squarespace** | Booking, Commerce | Read data | STYLIST, ARCHITECT |

### 2.7 Productivity (3 intégrations)

| Intégration | Use Cases Directs | Capacités | Personas |
|:------------|:------------------|:----------|:---------|
| **Google Sheets** | Lead logging, Data export, Reports | Full CRUD | Tous |
| **Google Drive** | Document storage, File sharing | Upload/Download | ACCOUNTANT, INSURER |
| **Google Docs** | Report generation | Create/Edit | SURVEYOR, PLANNER |

### 2.8 iPaaS (3 intégrations)

| Intégration | Apps Connectées | Use Case Clé |
|:------------|:----------------|:-------------|
| **Zapier** | +7,000 apps | Universal connector |
| **Make** | +1,500 apps | Complex workflows |
| **n8n** | Self-hosted | Data sovereignty |

---

## 3. Use Cases par Secteur avec Intégrations

### 3.1 Immobilier (PROPERTY, RENTER)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Qualification prospect** | Pipedrive + Calendly | Lead → Score → RDV visite |
| **Suivi dossier** | Sheets + Gmail | Dossier → Updates → Notifications |
| **Réclamation locataire** | Freshdesk + Slack | Problème → Ticket → Dispatch |

### 3.2 Santé (DENTAL, HEALER, PHARMACIST)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Prise RDV** | Calendly + Gmail | Demande → Dispo → Confirmation |
| **Rappel prescription** | Sheets + Email | Check → Alert → Confirmation |
| **Urgence** | Slack + transfer_call | Triage → Escalade → Humain |

### 3.3 E-commerce (UNIVERSAL_ECOMMERCE)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Suivi commande** | Shopify + Email | Requête → Lookup → Statut |
| **Retour produit** | Zendesk + Shopify | Demande → Ticket → Étiquette |
| **Réapprovisionnement** | Shopify + Slack | Stock bas → Alert → Action |

### 3.4 Agence Marketing (AGENCY)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Audit client** | Pipedrive + Sheets | Appel → Diagnostic → Rapport |
| **Suivi projet** | Slack + Sheets | Update → Notification → Log |
| **Facturation** | Gmail + Docs | Génération → Envoi → Suivi |

### 3.5 RH & Recrutement (RECRUITER)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Screening candidat** | Calendly + Pipedrive | Appel → Score → Pipeline |
| **Planification entretien** | Calendar + Gmail | Dispo → Invitation → Confirmation |
| **Onboarding** | Sheets + Slack | Checklist → Tasks → Notification |

### 3.6 Finance (ACCOUNTANT, INSURER, COLLECTOR)

| Use Case | Intégrations | Workflow |
|:---------|:-------------|:---------|
| **Relance impayé** | Pipedrive + Email | Due date → Appel → Suivi |
| **Déclaration sinistre** | Freshdesk + Drive | Déclaration → Docs → Ticket |
| **Conseil fiscal** | Calendar + Sheets | RDV → Analyse → Rapport |

---

## 4. Potentiel iPaaS (Zapier + Make + n8n)

### 4.1 Apps Accessibles via Zapier (+7,000)

| Catégorie | Exemples | Use Cases Débloqués |
|:----------|:---------|:--------------------|
| **HRIS** | BambooHR, Workday, Gusto | PTO balance, Employee data |
| **Accounting** | QuickBooks, Xero, FreshBooks | Invoice lookup, Payment status |
| **Survey** | Typeform, SurveyMonkey | Post-call feedback |
| **Marketing** | Mailchimp, ActiveCampaign | Campaign triggers |
| **Project** | Asana, Monday, Trello | Task creation |
| **ERP** | SAP, Oracle, NetSuite | Enterprise data |
| **Healthcare** | DrChrono, Kareo | Patient management |
| **Real Estate** | Zillow, Realtor.com | Property data |

### 4.2 Workflows iPaaS Avancés

```
EXEMPLE 1: Lead → Full Pipeline
─────────────────────────────────
VocalIA (qualify_lead)
    → Zapier → Pipedrive (create deal)
    → Zapier → Slack (notification)
    → Zapier → ActiveCampaign (nurture sequence)
    → Zapier → Calendly (booking link)

EXEMPLE 2: Support → Resolution
─────────────────────────────────
VocalIA (support call)
    → Make → Zendesk (create ticket)
    → Make → Slack (alert team)
    → Make → Jira (if dev needed)
    → Make → Gmail (customer update)

EXEMPLE 3: E-commerce → Analytics
─────────────────────────────────
VocalIA (order inquiry)
    → n8n → Shopify (order lookup)
    → n8n → Google Sheets (log)
    → n8n → BigQuery (analytics)
    → n8n → Looker (dashboard)
```

---

## 5. Gaps & Opportunités

### 5.1 Intégrations Manquantes (Haute Valeur)

| Intégration | Impact | Effort | Priorité |
|:------------|:------:|:------:|:--------:|
| Twilio SMS | ⭐⭐⭐ | ⭐ | P1 |
| WhatsApp Business | ⭐⭐⭐ | ⭐⭐ | P1 |
| Stripe (paiements) | ⭐⭐⭐ | ⭐⭐ | P1 |
| Doctolib | ⭐⭐ | ⭐⭐⭐ | P2 |
| Salesforce | ⭐⭐⭐ | ⭐⭐⭐ | P2 |
| Microsoft Teams | ⭐⭐ | ⭐⭐ | P3 |
| Notion | ⭐⭐ | ⭐ | P3 |

### 5.2 Function Tools Manquants

| Tool | Use Case | Priorité |
|:-----|:---------|:--------:|
| `send_sms` | Confirmations SMS | P1 |
| `collect_payment` | Paiement par téléphone | P1 |
| `create_survey` | Post-call feedback | P2 |
| `sentiment_analysis` | Analyse temps réel | P2 |
| `voice_biometrics` | Authentification vocale | P3 |

---

## 6. Métriques Clés

### 6.1 Couverture Use Cases

| Secteur | Use Cases Supportés | Coverage |
|:--------|:-------------------:|:--------:|
| E-commerce | 5/5 | 100% |
| Sales | 5/5 | 100% |
| Real Estate | 5/5 | 100% |
| Healthcare | 3/5 | 60% |
| Finance | 3/5 | 60% |
| Restaurants | 4/5 | 80% |
| HR | 4/5 | 80% |
| Logistics | 4/5 | 80% |
| **TOTAL** | **33/45** | **73%** |

### 6.2 Potentiel avec iPaaS

Avec Zapier/Make/n8n, la couverture potentielle passe à:

| Secteur | Sans iPaaS | Avec iPaaS |
|:--------|:----------:|:----------:|
| Healthcare | 60% | **90%** |
| Finance | 60% | **85%** |
| Government | 20% | **50%** |
| **TOTAL** | 73% | **~90%** |

---

## 7. Conclusion (CORRIGÉE)

### Forces VÉRIFIÉES

| Force | Preuve Code | Impact Client |
|:------|:------------|:--------------|
| **CRM complet** | Pipedrive (7), Zoho (6), HubSpot (full CRUD) | Sales automation |
| **Scheduling natif** | Calendly (6), Calendar (2) | Booking 24/7 |
| **iPaaS triple** | Zapier (3), Make (5), n8n (5) | 7000+ apps |
| **WooCommerce Full** | 7 tools avec refund/cancel | E-commerce EU |

### Faiblesses VÉRIFIÉES

| Faiblesse | Impact | Priorité Fix |
|:----------|:-------|:------------:|
| ~~**Shopify READ-ONLY**~~ | ~~Pas de cancel/refund~~ | ✅ FAIT (249.20) |
| **WhatsApp needs creds** | Pas de fallback SMS | P0 |
| **Stripe webhook only** | Pas de payment initiation | P1 |

---

## 8. Plan Actionnable (Session 249.16)

### Priorité 1: Shopify WRITE (5 jours)

```
Créer: mcp-server/src/tools/shopify.ts
- shopify_cancel_order (GraphQL orderCancel mutation)
- shopify_create_refund (GraphQL refundCreate mutation)
- shopify_update_order (GraphQL orderUpdate mutation)
Dépendance: SHOPIFY_ACCESS_TOKEN avec scopes write_orders
```

### ~~Priorité 2: Twilio SMS Fallback~~ ✅ FAIT (Session 249.18)

```
✅ IMPLÉMENTÉ: telephony/voice-telephony-bridge.cjs
- sendTwilioSMS() - Twilio REST API + SDK
- sendMessage() - Unified: WhatsApp → SMS fallback
- /messaging/send - HTTP endpoint
- messaging_send - MCP tool (117 total)
Coût: $0.0083/SMS US, $0.07/SMS FR
```

### ~~Priorité 3: Page Use Cases Website~~ ✅ FAIT (Session 249.19)

```
✅ CRÉÉ: website/use-cases/index.html (22.8 KB)
- 4 use cases principaux avec cartes
- Workflow 4 étapes
- Integration stack (6 catégories)
- Traductions 5 langues (fr, en, es, ar, ary)
```

---

*Document mis à jour: 31/01/2026 - Session 249.16*
*21 intégrations natives réelles + 3 iPaaS = 116 MCP tools*
*Corrections: HubSpot=Full CRUD, Shopify=READ-ONLY, WhatsApp=Implémenté*
