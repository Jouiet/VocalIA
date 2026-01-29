# VocalIA - Site Architecture SOTA

> **Version**: 1.0.0 | **Session**: 214 | **Status**: Planning
> **Benchmark**: Linear.app, Stripe, Vapi, Retell AI
> **Target**: 22+ pages professional enterprise SaaS

---

## Navigation Structure

### Primary Navigation (Header)

```
┌─────────────────────────────────────────────────────────────────┐
│  🎙️ VocalIA    Produits ▼   Solutions ▼   Tarifs   Ressources ▼   [Connexion] [Démo] │
└─────────────────────────────────────────────────────────────────┘
```

**Produits (Mega Menu)**
- Voice Widget → /products/voice-widget
- Voice Telephony AI → /products/voice-telephony
- Toutes les fonctionnalités → /features

**Solutions (Mega Menu)**
- Par Cas d'Usage:
  - E-commerce → /use-cases/e-commerce
  - Service Client → /use-cases/customer-support
  - Prise de RDV → /use-cases/appointments
  - Qualification Leads → /use-cases/lead-qualification
- Par Industrie:
  - Santé → /industries/healthcare
  - Immobilier → /industries/real-estate
  - Services Financiers → /industries/finance
  - Retail → /industries/retail

**Tarifs**
- /pricing

**Ressources (Mega Menu)**
- Documentation → /docs
- Intégrations → /integrations
- Blog → /blog
- Changelog → /changelog
- API Reference → /docs/api

---

## Complete Sitemap (22 pages)

### Tier 1 - Core Pages (6)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| Home | `/` | P0 | ✅ Done |
| Features | `/features` | P0 | ✅ Done (Session 214) |
| Pricing | `/pricing` | P0 | ✅ Done (Session 214) |
| About | `/about` | P1 | ✅ Done (Session 210) |
| Contact | `/contact` | P1 | ✅ Done (Session 210) |
| Documentation Hub | `/docs` | P1 | ✅ Done (Session 210) |

### Tier 2 - Product Pages (2)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| Voice Widget | `/products/voice-widget` | P0 | ✅ Done (Session 214) |
| Voice Telephony | `/products/voice-telephony` | P0 | ✅ Done (Session 214) |

### Tier 3 - Use Cases (4)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| E-commerce | `/use-cases/e-commerce` | P1 | ✅ Done (Session 210) |
| Customer Support | `/use-cases/customer-support` | P1 | ✅ Done (Session 210) |
| Appointments | `/use-cases/appointments` | P2 | ✅ Done (Session 210) |
| Lead Qualification | `/use-cases/lead-qualification` | P2 | ✅ Done (Session 210) |

### Tier 4 - Industries (4)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| Healthcare | `/industries/healthcare` | P2 | 🔴 TODO |
| Real Estate | `/industries/real-estate` | P2 | 🔴 TODO |
| Financial Services | `/industries/finance` | P2 | 🔴 TODO |
| Retail | `/industries/retail` | P2 | 🔴 TODO |

### Tier 5 - Resources (4)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| Integrations | `/integrations` | P1 | ✅ Done (Session 217) |
| Blog | `/blog` | P2 | 🔴 TODO |
| Changelog | `/changelog` | P2 | 🔴 TODO |
| API Reference | `/docs/api` | P1 | 🔴 TODO |

### Tier 6 - Legal (2)

| Page | URL | Priority | Status |
|:-----|:----|:--------:|:------:|
| Privacy Policy | `/privacy` | P1 | ✅ Done (Session 217) |
| Terms of Service | `/terms` | P1 | ✅ Done (Session 217) |

---

## Page Templates

### Template 1: Product Page (Voice Widget, Voice Telephony)

```
┌──────────────────────────────────────────────┐
│ Hero: Product name + value proposition       │
│ Badge: Free / Pricing                        │
│ CTA: Try Now + See Demo                      │
├──────────────────────────────────────────────┤
│ Screenshot/Demo: Interactive product demo    │
├──────────────────────────────────────────────┤
│ Features Grid: 6-8 key features with icons   │
├──────────────────────────────────────────────┤
│ Technical Specs: API, Languages, Latency     │
├──────────────────────────────────────────────┤
│ Integration: How it works (3 steps)          │
├──────────────────────────────────────────────┤
│ Use Cases: 3-4 relevant use cases            │
├──────────────────────────────────────────────┤
│ Pricing: Plan comparison for this product    │
├──────────────────────────────────────────────┤
│ FAQ: 5-6 product-specific questions          │
├──────────────────────────────────────────────┤
│ CTA: Get Started + Contact Sales             │
└──────────────────────────────────────────────┘
```

### Template 2: Use Case Page

```
┌──────────────────────────────────────────────┐
│ Hero: Use case name + industry context       │
│ Stats: ROI metrics, time saved               │
├──────────────────────────────────────────────┤
│ Problem: Pain points addressed               │
├──────────────────────────────────────────────┤
│ Solution: How VocalIA solves it              │
├──────────────────────────────────────────────┤
│ Features: Relevant features for this case    │
├──────────────────────────────────────────────┤
│ Case Study: Customer success story           │
├──────────────────────────────────────────────┤
│ ROI Calculator: Interactive savings calc     │
├──────────────────────────────────────────────┤
│ CTA: Start Free Trial + Talk to Sales        │
└──────────────────────────────────────────────┘
```

### Template 3: Industry Page

```
┌──────────────────────────────────────────────┐
│ Hero: Industry name + compliance badges      │
│ (HIPAA for Healthcare, PCI for Finance)      │
├──────────────────────────────────────────────┤
│ Challenges: Industry-specific pain points    │
├──────────────────────────────────────────────┤
│ Solutions: Tailored voice AI solutions       │
├──────────────────────────────────────────────┤
│ Compliance: Security & regulatory features   │
├──────────────────────────────────────────────┤
│ Integrations: Industry tools (EHR, CRM)      │
├──────────────────────────────────────────────┤
│ Case Study: Industry customer story          │
├──────────────────────────────────────────────┤
│ CTA: Request Industry Demo                   │
└──────────────────────────────────────────────┘
```

---

## Folder Structure

```
website/
├── index.html                    # Home (exists)
├── features.html                 # All features
├── pricing.html                  # Pricing page
├── about.html                    # About company
├── contact.html                  # Contact page
├── privacy.html                  # Privacy policy
├── terms.html                    # Terms of service
├── products/
│   ├── voice-widget.html         # Voice Widget product
│   └── voice-telephony.html      # Voice Telephony product
├── use-cases/
│   ├── e-commerce.html
│   ├── customer-support.html
│   ├── appointments.html
│   └── lead-qualification.html
├── industries/
│   ├── healthcare.html
│   ├── real-estate.html
│   ├── finance.html
│   └── retail.html
├── docs/
│   ├── index.html                # Docs hub
│   └── api.html                  # API reference
├── integrations.html             # Integrations
├── blog/
│   └── index.html                # Blog listing
└── changelog.html                # Changelog
```

---

## Implementation Order

### Phase 1 - Core (Session 214-215)
1. ✅ Home (refine existing)
2. 🔴 `/features` - All features page
3. 🔴 `/pricing` - Dedicated pricing
4. 🔴 `/products/voice-widget` - Widget product page
5. 🔴 `/products/voice-telephony` - Telephony product page

### Phase 2 - Company (Session 216)
6. 🔴 `/about` - About page
7. 🔴 `/contact` - Contact page
8. 🔴 `/docs` - Documentation hub

### Phase 3 - Solutions (Session 217)
9. 🔴 `/use-cases/e-commerce`
10. 🔴 `/use-cases/customer-support`
11. 🔴 `/industries/healthcare`
12. 🔴 `/industries/real-estate`

### Phase 4 - Resources & Legal (Session 218)
13. 🔴 `/integrations`
14. 🔴 `/privacy`
15. 🔴 `/terms`
16. 🔴 `/changelog`

### Phase 5 - Extended (Session 219+)
17-22. Remaining pages

---

## Shared Components

### Header Component
- Logo + brand
- Mega menu navigation
- Language switcher (FR/EN)
- Login + Demo CTA buttons

### Footer Component
- 4-column layout: Produits, Solutions, Ressources, Entreprise
- Social links
- Trust badges (GDPR, AI Act, SOC2)
- Copyright

### Common Sections
- Trust badges section
- CTA banner (reusable)
- FAQ accordion
- Pricing comparison table

---

## SEO Considerations

### URL Structure
- Clean, semantic URLs
- Hreflang for FR/EN
- Canonical tags

### Schema.org
- Organization
- SoftwareApplication
- FAQPage
- BreadcrumbList

### Meta Tags (per page)
- Title (60 chars)
- Description (155 chars)
- OG tags
- Twitter cards

---

*Document créé: 29/01/2026 - Session 214*
*Sources: [Linear.app](https://linear.app), [Stripe Sitemap](https://stripe.com/sitemap), [Vapi.ai](https://vapi.ai), [Retell AI](https://www.retellai.com)*
