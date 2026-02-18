# VocalIA — Distribution & Go-to-Market Strategy

> **Version**: 1.0.0 | **Date**: 13/02/2026 | **Session**: 250.205
> **Statut**: 0/5 distributions publiees, 13 registries MCP pending, 9 listings AI directories pending
> **Objectif**: Maximiser la visibilite sur les canaux pertinents — Phases 0-5 pretes pour publication

---

## Table des Matieres

1. [Etat des Lieux — Brutalement Honnete](#1-etat-des-lieux)
2. [Canaux MCP (Registries & Marketplaces)](#2-canaux-mcp)
3. [Canaux E-commerce (App Stores)](#3-canaux-e-commerce)
4. [Canaux AI (Directories & Tools)](#4-canaux-ai)
5. [Canaux SaaS B2B (Review Sites)](#5-canaux-saas-b2b)
6. [Canaux Launch (Communities & Forums)](#6-canaux-launch)
7. [Canaux Package Registries (SDK)](#7-canaux-package-registries)
8. [Cloud Marketplaces (Enterprise)](#8-cloud-marketplaces)
9. [Prerequis Transversaux](#9-prerequis-transversaux)
10. [Plan d'Action — Timeline](#10-plan-daction)
11. [Budget](#11-budget)
12. [Metriques de Suivi](#12-metriques-de-suivi)
13. [Sources](#13-sources)

---

## 1. Etat des Lieux

### 1.1 Ce qui EXISTE dans le code

| Distribution | Repertoire | Contenu | Pret a publier |
|:-------------|:-----------|:--------|:--------------:|
| npm widget | `distribution/npm/vocalia-widget/` | package.json + index.js + src/ | **NON** (404 sur npm registry) |
| npm MCP | `mcp-server/` | package.json + dist/ + server.json | **NON** (404 sur npm registry) |
| Shopify | `distribution/shopify/vocalia-voice-agent/` | extension.toml + extensions/ | **NON** (skeleton, pas une app complete) |
| WordPress | `plugins/wordpress/vocalia-voice-widget.php` | Plugin complet (514 lignes) | **~70%** (review GPL requise) |
| Wix | `distribution/wix/vocalia-voice-agent/` | wix-custom-element.js + manifest | **NON** (pas une Wix Blocks app) |
| Zapier | `distribution/zapier/vocalia-voice-agent/` | creates/ + triggers/ + index.js | **~50%** (pas soumis a review) |
| WP Plugin zip | `distribution/vocalia-wp-plugin.zip` | Archive prete | **OUI** (upload manuel possible) |

### 1.2 Ce qui est PUBLIE

| Canal                      | Publie | Statut            |
|:---------------------------|:------:|:------------------|
| npm `vocalia-widget`       | **NON**| **PRET (Phase 0)**|
| npm `@vocalia/mcp-server`  | **NON**| **PRET (Phase 1)**|
| Shopify App Store          | **NON**| Hors scope P0-5   |
| WordPress Plugin Directory  | **NON**| **PRET (Phase 2)**|
| MCP Registry officiel      | **NON**| **PENDING**       |
| Smithery                   | **NON**| **PENDING**       |
| Toolify.ai                 | **NON**| **PENDING**       |
| SaaSHub                    | **NON**| **PENDING**       |
| AlternativeTo              | **NON**| **PENDING**       |

**Verite: VocalIA a 0 presence sur 0 marketplace/registry externe.**

### 1.3 Prerequis Critiques Manquants

| Prerequis | Statut | Impact |
|:----------|:------:|:-------|
| Stripe (paiements) | **MANQUANT** | Bloque: Shopify billing, AppSumo, Product Hunt credibilite |
| npm account + `npm publish` | **NON FAIT** | Bloque: MCP Registry, toute distribution npm |
| npm org `@vocalia` | **NON CREE** | Bloque: `@vocalia/mcp-server` |
| GitHub repo public | **OUI** | github.com/Jouiet/VocalIA |
| Produit live + demo | **OUI** | vocalia.ma + widget demo |
| Trial 14 jours | **OUI** | Configurable |

---

## 2. Canaux MCP (Registries & Marketplaces)

VocalIA dispose de **203 tools + 6 resources + 8 prompts** — c'est un avantage competitif majeur. La plupart des MCP servers listes ont 5-20 tools.

### 2.1 Registries MCP — Inventaire Complet

| # | Registry | URL | Serveurs listes | Methode soumission | Cout | Prerequis VocalIA |
|:-:|:---------|:----|:---------------:|:-------------------|:----:|:------------------|
| 1 | **MCP Registry (officiel)** | registry.modelcontextprotocol.io | Officiel | CLI `mcp-publisher publish` | Gratuit | npm publish requis + GitHub auth |
| 2 | **Smithery** | smithery.ai | ~2000+ | CLI smithery ou web | Gratuit | npm publish requis |
| 3 | **Cline MCP Marketplace** | github.com/cline/mcp-marketplace | ~500+ | PR GitHub | Gratuit | Repo GitHub public |
| 4 | **Glama** | glama.ai/mcp/servers | ~3000+ | Auto-indexe + claim | Gratuit | Etre sur npm ou GitHub |
| 5 | **PulseMCP** | pulsemcp.com/servers | 8230+ | pulsemcp.com/submit | Gratuit | Formulaire web |
| 6 | **mcp.so** | mcp.so | ~5000+ | Issue GitHub ou bouton Submit | Gratuit | Repo GitHub public |
| 7 | **MCP Market** | mcpmarket.com | ~2000+ | mcpmarket.com/submit | Gratuit | Repo GitHub |
| 8 | **MCPServerFinder** | mcpserverfinder.com | ~3000+ | Formulaire web | Gratuit | Repo GitHub |
| 9 | **mcpservers.org** | mcpservers.org | ~1000+ | PR GitHub (awesome list) | Gratuit | Repo GitHub |
| 10 | **Docker MCP Catalog** | docs.docker.com/ai/mcp-catalog-and-toolkit/ | Curated | Docker Hub image | Gratuit | Image Docker publiee |
| 11 | **LobeHub MCP** | lobehub.com/mcp | ~500+ | Soumission web | Gratuit | Repo GitHub |
| 12 | **cursor.directory** | cursor.directory/mcp | ~1000+ | Formulaire/PR | Gratuit | Config MCP JSON |
| 13 | **awesome-mcp-servers** | github.com/punkpeye/awesome-mcp-servers | 1600+ PRs | PR GitHub | Gratuit | Repo GitHub |
| 14 | **modelcontextprotocol/servers** | github.com/modelcontextprotocol/servers | Officiel refs | PR GitHub (tres selectif) | Gratuit | Qualite reference |
| 15 | **Claude Desktop Extensions** | Via `mcpb pack` | Curated Anthropic | `mcpb init` + `mcpb pack` + review | Gratuit | npm publish + manifest.json |
| 16 | **Composio** | composio.dev | Managed | Partner/API | Gratuit | Integration specifique |
| 17 | **mcp.run** | mcp.run | Managed SSE | Partner | Gratuit | WebAssembly ou SSE |
| 18 | **Mastra MCP Registry Registry** | mastra.ai/mcp-registry-registry | Meta-registry | N/A (index d'index) | — | Etre sur les registries ci-dessus |

### 2.2 Processus de Publication MCP (Step-by-Step)

**Prerequis obligatoire: `@vocalia/mcp-server` doit etre publie sur npm.**

```bash
# Etape 0: Creer org npm @vocalia (one-time)
npm login
npm org create vocalia

# Etape 1: Publier le package MCP sur npm
cd mcp-server
npm run build
npm publish --access public

# Etape 2: Installer mcp-publisher CLI
curl -L https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher-$(uname -s)-$(uname -m) -o mcp-publisher
chmod +x mcp-publisher

# Etape 3: Login GitHub
./mcp-publisher login github

# Etape 4: Publier sur le MCP Registry officiel
./mcp-publisher publish
# Le fichier server.json existe deja dans mcp-server/server.json

# Etape 5: Smithery
npx @anthropic-ai/mcpb init  # si pas deja fait
npx @anthropic-ai/mcpb pack
# Puis submit via smithery.ai/docs/registry

# Etape 6: Cline Marketplace
# Fork github.com/cline/mcp-marketplace
# Ajouter vocalia dans le format requis
# Ouvrir PR

# Etape 7: mcp.so
npx mcp-index https://github.com/Jouiet/VocalIA

# Etape 8: awesome-mcp-servers
# Fork github.com/punkpeye/awesome-mcp-servers
# Ajouter sous categorie "Voice AI" ou "Communication"
# Ouvrir PR

# Etape 9: Soumissions web (formulaires)
# - mcpmarket.com/submit
# - pulsemcp.com/submit
# - mcpserverfinder.com (formulaire)
# - lobehub.com/mcp (soumission)
# - cursor.directory/mcp (formulaire)
```

### 2.3 Avantage Competitif MCP

| Serveur MCP | Tools | Resources | Prompts |
|:------------|:-----:|:---------:|:-------:|
| **VocalIA** | **203** | **6** | **8** |
| github-mcp-server (officiel) | ~30 | 0 | 0 |
| Stripe MCP | ~15 | 0 | 0 |
| Notion MCP | ~20 | 5 | 0 |
| Slack MCP | ~10 | 0 | 0 |

VocalIA serait parmi les **top 5 MCP servers par nombre de tools** sur n'importe quel registry. C'est un argument de visibilite fort.

### 2.4 Risque/Realite

- Le `server.json` existe et est bien forme
- Le `dist/index.js` est build
- **MAIS** `@vocalia/mcp-server` n'est PAS publie sur npm → le MCP Registry officiel exige un package npm publie
- **MAIS** les tools font `require()` de modules core (`../core/...`) qui ne sont PAS dans le package npm → le serveur MCP en mode `npx` ne fonctionnerait PAS sans l'arborescence complete du projet
- **Consequence**: Le MCP server est fonctionnel en mode local/Docker mais PAS en mode `npx` standalone. Il faut soit:
  - (A) Publier avec une note "requires full VocalIA installation"
  - (B) Refactorer pour HTTP remote uniquement (mode `--http` pointe vers api.vocalia.ma)
  - L'option (B) est plus realiste: le server.json a deja le mode `streamable-http`

---

## 3. Canaux E-commerce (App Stores)

### 3.1 Inventaire

| App Store | Marchands | Cout listing | Plugin pret | Effort restant | Prerequis bloquants |
|:----------|:---------|:-------------|:-----------:|:---------------|:--------------------|
| **Shopify App Store** | 4.8M | $99 one-time | **NON** (~40%) | Refaire en Shopify CLI, Shopify billing API, screencast | **Stripe requis** (Shopify billing) |
| **WordPress Plugin Directory** | 43% du web | Gratuit | **OUI** (~70%) | Adapter licence GPL v2+, retirer paywall, soumettre ZIP | Licence GPL |
| **PrestaShop Addons** | 220K+ | Commission | **NON** (0%) | Ecrire module from scratch | Module a creer |
| **BigCommerce App Marketplace** | 100K+ | Gratuit | **NON** (0%) | Ecrire app from scratch | App a creer |
| **Wix App Market** | 250M+ sites | Gratuit | **NON** (~30%) | Refaire en Wix Blocks, Wix Billing | App a refaire |
| **Zapier** | 2.2M+ users | Gratuit | **OUI** (~50%) | Soumettre integration existante, PublishBot review | Code existe |

### 3.2 Evaluation Honnete

- **WordPress** est le seul canal e-commerce quasi-pret (plugin existe, 514 lignes, escaping securise)
- **Shopify** necessite un investissement significatif (billing API, OAuth, review 2-4 semaines)
- **PrestaShop/BigCommerce** sont des developpements from scratch — non-prioritaires
- **Wix** a un custom-element mais pas une Wix Blocks app — effort moyen
- **Zapier** a du code existant, merite une tentative de soumission

### 3.3 Contrainte WordPress Plugin Directory

Le plugin actuel (`vocalia-voice-widget.php`) charge un widget depuis un CDN externe. La guideline WordPress dit:
> "plugins may not contact external servers without explicit and authorized consent"

Il faut ajouter un opt-in (checkbox dans les settings) avant le chargement du widget. Pas bloquant, mais modification necessaire.

---

## 4. Canaux AI (Directories & Tools)

### 4.1 Directories AI — Classement par Impact

| Directory | Trafic mensuel | Cout | Soumission | Temps review | Pertinence |
|:----------|:--------------|:-----|:-----------|:-------------|:-----------|
| **There's An AI For That** | **4M+/mois** | ~$99-299 (payant) ou gratuit via X thread mensuel | Formulaire | 1-2j | **HAUTE** |
| **Futurepedia** | **400K+/mois** | Payant (Gumroad) | Formulaire | Editorial | **HAUTE** |
| **Toolify.ai** | **16M+ pages vues** | Gratuit (basic) | Formulaire | Variable | **HAUTE** |
| **AI Agent Store** | Nouveau | Gratuit | Formulaire | Variable | **MOYENNE** |
| **AI Agents Directory** | Growing | Gratuit | Formulaire | Variable | **MOYENNE** |
| **AI Agents List** | 600+ tools | Gratuit | Formulaire | Variable | **MOYENNE** |
| **TrillionAgent** | Growing | Gratuit | Formulaire | Variable | **MOYENNE** |
| **AIxploria** | Growing | Gratuit | Formulaire | Variable | **FAIBLE** |

### 4.2 Evaluation Honnete

- **TAAFT** (4M/mois) a le meilleur ROI mais est payant (~$99-299). Un listing gratuit est possible via leur thread X mensuel — faible probabilite mais 0 cout.
- **Futurepedia** (400K/mois) est payant aussi. ROI moyen.
- **Toolify.ai** est le meilleur rapport cout/impact (gratuit, audience massive).
- Les directories AI generiques (AIxploria, AI Review Battle, etc.) ont un trafic negligeable et un impact quasi-nul.

---

## 5. Canaux SaaS B2B (Review Sites)

| Site | Trafic | Cout basic | Prerequis | Quand |
|:-----|:-------|:-----------|:----------|:------|
| **Capterra** | 9M+/mois | Gratuit | Produit public + site live | **MAINTENANT** (trial 14j suffit) |
| **G2** | 80M+/an | Gratuit (profil basic) | Produit live + au moins 1 review | **APRES** 1er client payant |
| **SaaSHub** | 195K+ produits | Gratuit | Produit live | **MAINTENANT** |
| **AlternativeTo** | Long-tail SEO | Gratuit | Produit live | **MAINTENANT** |
| **TrustRadius** | Enterprise | Gratuit | Reviews verifiees | **APRES** clients |
| **Gartner Peer Insights** | Enterprise | Gratuit (vendor portal) | Reviews d'utilisateurs reels enterprise | **LONG TERME** |

### 5.1 Evaluation Honnete

- **Capterra** accepte les produits en beta avec trial — VocalIA est eligible maintenant
- **G2 gratuit** = profil basique sans valeur reelle tant qu'il n'y a pas de reviews. G2 payant = $2,999/an minimum — pas justifie a 0 revenue
- **SaaSHub + AlternativeTo** sont gratuits et offrent des backlinks SEO permanents — faire maintenant
- **Gartner** est irealiste (exige clients enterprise, reviews verifiees, track record)

---

## 6. Canaux Launch (Communities & Forums)

| Plateforme | Audience | Cout | Format | Quand |
|:-----------|:---------|:-----|:-------|:------|
| **Product Hunt** | Makers/VC/Early adopters | Gratuit | Launch day coordonne | **APRES Stripe** |
| **BetaList** | 500K+ early adopters | Gratuit (attente ~2 mois) | Pre-launch page | **MAINTENANT** |
| **DevHunt** | 50K+ developpeurs | Gratuit | Dev tools focus | **MAINTENANT** |
| **Indie Hackers** | Fondateurs/Makers | Gratuit | Post "Show IH" | **MAINTENANT** |
| **Hacker News** | Tech/VC | Gratuit | "Show HN" post | Quand demo impressionnante |
| **Reddit** | Variable | Gratuit | r/SaaS, r/artificial, r/voiceai | **MAINTENANT** |
| **AppSumo** | Deal hunters | Commission 5-30% | 500-10K codes, support team | **APRES Stripe + stabilite** |
| **NachoNacho** | B2B SaaS buyers | Commission | Listing marketplace | **APRES Stripe** |

### 6.1 Evaluation Honnete

- **Product Hunt** sans Stripe = pas credible (les utilisateurs veulent s'inscrire immediatement)
- **BetaList** est ideal maintenant — c'est fait pour les pre-launch. Soumission gratuite mais file d'attente de ~2 mois
- **DevHunt** est parfait pour le positionnement developer-first (MCP, API, widget SDK)
- **AppSumo** exige maturite produit + capacite de support → premature

---

## 7. Canaux Package Registries (SDK)

| Registry | Audience | Cout | Package | Statut |
|:---------|:---------|:-----|:--------|:------:|
| **npm** (vocalia-widget) | 17M+ devs | Gratuit | `distribution/npm/vocalia-widget/` | **NON publie** |
| **npm** (@vocalia/mcp-server) | MCP devs | Gratuit | `mcp-server/` | **NON publie** |
| **JSDelivr CDN** | Auto | Gratuit | Auto-indexe apres npm publish | **BLOQUE** par npm |
| **unpkg** | Auto | Gratuit | Auto-indexe apres npm publish | **BLOQUE** par npm |

### 7.1 Blocage Technique npm

`@vocalia/mcp-server` en mode `npx -y @vocalia/mcp-server` ferait `require('../core/...')` vers des fichiers qui ne sont PAS dans le package npm. Le serveur crasherait.

**Solutions**:

- **(A)** Publier le MCP server en mode HTTP uniquement: `npx -y @vocalia/mcp-server --http` pointerait vers `api.vocalia.ma:3015`
- **(B)** Bundle tout le core dans le package npm (irealiste — 37K+ lignes)
- **(C)** Publier en tant que reference/documentation seulement, avec instructions Docker

**Recommandation**: Option (A) — MCP server HTTP remote. C'est le pattern standard pour les MCP servers SaaS (Stripe, Notion, etc. fonctionnent en remote).

---

## 8. Cloud Marketplaces (Enterprise)

| Marketplace | Prerequis | Realiste pour VocalIA |
|:------------|:----------|:---------------------:|
| **Microsoft Marketplace** | Partner Center + integ Copilot/Azure + certifications | **NON** (0 clients, 0 revenue, 0 certifications) |
| **Google Cloud Marketplace** | Partner Advantage Build+ tier + certifications GCP | **NON** (0 certifications) |
| **AWS Marketplace** | APN Partner + produit enterprise-ready | **NON** (0 clients enterprise) |

**Verdict**: Aucun cloud marketplace n'est accessible a court/moyen terme. Exigent tous des certifications, un track record enterprise, et une equipe de support. A revisiter quand VocalIA aura 50+ clients payants.

---

## 9. Prerequis Transversaux

### 9.1 Bloqueurs Actuels

| Prerequis | Bloque | Action |
|:----------|:-------|:-------|
| npm account + org `@vocalia` | MCP Registry, Smithery, Claude Extensions, npm publish | Creer compte npm + org |
| `npm publish` (2 packages) | 15+ registries MCP, CDN auto-indexing | Publier vocalia-widget + @vocalia/mcp-server |
| Stripe integration | Shopify, Product Hunt, AppSumo, NachoNacho | Configurer STRIPE_SECRET_KEY |
| GPL licence WordPress | WordPress Plugin Directory | Ajouter licence GPL v2+ au plugin |
| Screencast video | Shopify, Product Hunt, Capterra | Enregistrer demo 2-3 min |

### 9.2 Assets Necessaires

| Asset | Pour | Statut |
|:------|:-----|:------:|
| Logo PNG (512x512, transparence) | Tous les listings | **A VERIFIER** |
| Screenshots (1280x800) x5 | App stores, directories | **A CREER** |
| Video demo (2-3 min) | Shopify, Product Hunt, Capterra | **A CREER** |
| Description courte (160 chars) | Tous | **A ECRIRE** |
| Description longue (500+ mots) | G2, Capterra, app stores | **A ECRIRE** |
| Pricing page publique | Review sites, directories | **OUI** (vocalia.ma/pricing) |

---

## 10. Plan d'Action

### Phase 0 — Prerequis (Jour 1)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 0.1 | Creer compte npm + org `@vocalia` | 10 min | npm account |
| 0.2 | Preparer README npm pour `vocalia-widget` | 30 min | — |
| 0.3 | Preparer README npm pour `@vocalia/mcp-server` | 30 min | — |
| 0.4 | Verifier logo PNG 512x512 existe | 5 min | — |
| 0.5 | Rediger description courte (160 chars FR/EN) | 15 min | — |

### Phase 1 — npm Publish (Jour 1-2)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 1.1 | `npm publish` vocalia-widget | 15 min | 0.1, 0.2 |
| 1.2 | `npm publish` @vocalia/mcp-server (mode HTTP remote) | 30 min | 0.1, 0.3 |
| 1.3 | Verifier JSDelivr/unpkg auto-indexing | 5 min | 1.1 |

### Phase 2 — MCP Registries (Jour 2-5)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 2.1 | MCP Registry officiel (`mcp-publisher publish`) | 30 min | 1.2 |
| 2.2 | Smithery publication | 20 min | 1.2 |
| 2.3 | PR awesome-mcp-servers (punkpeye) | 20 min | GitHub repo |
| 2.4 | PR Cline MCP Marketplace | 20 min | GitHub repo |
| 2.5 | mcp.so submit (`npx mcp-index`) | 10 min | GitHub repo |
| 2.6 | mcpmarket.com/submit | 10 min | GitHub repo |
| 2.7 | pulsemcp.com/submit | 10 min | GitHub repo |
| 2.8 | mcpserverfinder.com submit | 10 min | GitHub repo |
| 2.9 | lobehub.com/mcp submit | 10 min | GitHub repo |
| 2.10 | cursor.directory/mcp submit | 10 min | GitHub repo |
| 2.11 | mcpservers.org PR | 15 min | GitHub repo |
| 2.12 | Claim sur glama.ai | 10 min | 1.2 |
| 2.13 | Claude Desktop Extensions (`mcpb pack`) | 30 min | 1.2 |

**Total Phase 2: ~3h15 pour 13 registries MCP**

### Phase 3 — Directories AI Gratuites (Jour 3-5)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 3.1 | Toolify.ai submit (gratuit) | 15 min | Produit live |
| 3.2 | AI Agent Store submit | 10 min | Produit live |
| 3.3 | AI Agents Directory submit | 10 min | Produit live |
| 3.4 | AI Agents List submit | 10 min | Produit live |
| 3.5 | TrillionAgent submit | 10 min | Produit live |

### Phase 4 — Review Sites B2B Gratuits (Jour 3-5)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 4.1 | SaaSHub listing | 15 min | Produit live |
| 4.2 | AlternativeTo listing ("Alternative a Vapi, Retell, Bland AI") | 15 min | Produit live |
| 4.3 | Capterra basic listing | 20 min | Produit live + trial |
| 4.4 | DevHunt listing | 15 min | Produit live |

### Phase 5 — Launch Communities (Jour 5-7)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 5.1 | BetaList submission | 15 min | Produit live |
| 5.2 | Indie Hackers "Show IH" post | 30 min | Produit live |
| 5.3 | Reddit r/SaaS + r/artificial posts | 30 min | Produit live |

### Phase 6 — Post-Stripe (Quand STRIPE_SECRET_KEY configure)

| # | Action | Temps estime | Dependances |
|:-:|:-------|:-------------|:------------|
| 6.1 | Product Hunt launch (coordonner jour/heure) | 2h prep | Stripe + video |
| 6.2 | WordPress Plugin Directory submission | 2h (adaptations GPL) | GPL licence |
| 6.3 | Zapier integration submit | 1h | Code existant |
| 6.4 | G2 profil (apres 1re review) | 30 min | 1er client payant |

### Phase 7 — Investissements Payants (Optionnel, apres revenue)

| # | Action | Cout | ROI estime |
|:-:|:-------|:-----|:-----------|
| 7.1 | There's An AI For That listing | $99-299 | Haut (4M visiteurs/mois) |
| 7.2 | Futurepedia featured | Variable | Moyen (400K/mois) |
| 7.3 | Shopify App Store ($99 + refonte app) | $99 + ~40h dev | Haut si e-commerce = cible |

### Phase 8 — Long Terme (50+ clients payants)

| # | Action | Dependances |
|:-:|:-------|:------------|
| 8.1 | PrestaShop Addons (ecrire module) | Dev ~20h |
| 8.2 | BigCommerce app | Dev ~20h |
| 8.3 | Wix Blocks app (refonte) | Dev ~15h |
| 8.4 | Microsoft Marketplace | Certifications + enterprise clients |
| 8.5 | AppSumo deal | Support team + stabilite |

---

## 11. Budget

### 11.1 Phase Immediate (0 EUR)

| Item | Cout |
|:-----|:----:|
| npm account | Gratuit |
| 13 MCP registries | Gratuit |
| 5 AI directories | Gratuit |
| 4 review sites B2B | Gratuit |
| 3 communities | Gratuit |
| **Total Phase 0-5** | **0 EUR** |

### 11.2 Phase Post-Stripe

| Item | Cout |
|:-----|:----:|
| WordPress Plugin Directory | Gratuit |
| Product Hunt | Gratuit |
| Zapier | Gratuit |
| **Total Phase 6** | **0 EUR** |

### 11.3 Investissements Optionnels

| Item | Cout |
|:-----|:----:|
| There's An AI For That | ~$99-299 |
| Futurepedia | Variable |
| Shopify Partner | $99 one-time |
| **Total Phase 7** | **~$200-400** |

---

## 12. Metriques de Suivi

### 12.1 KPIs par Phase

| Phase | Metrique | Cible |
|:------|:---------|:------|
| Phase 1 (npm) | npm weekly downloads | >0 (baseline) |
| Phase 2 (MCP) | Nombre de registries avec listing actif | 13/13 |
| Phase 3-4 (Directories) | Nombre de listings actifs | 9/9 |
| Phase 5 (Communities) | Trafic referral vers vocalia.ma | Mesurable via GA4 |
| Phase 6 (Post-Stripe) | Conversion trial → paid | >0 |

### 12.2 Tableau de Suivi

```
| Canal                      | Soumis | Approuve | Live | Note                         |
|:---------------------------|:------:|:--------:|:----:|:-----------------------------|
| npm vocalia-widget         |  [ ]   |   [ ]    | [ ]  | Ready to publish             |
| npm @vocalia/mcp-server    |  [ ]   |   [ ]    | [ ]  | Ready (HTTP Remote mode)     |
| MCP Registry officiel      |  [ ]   |   [ ]    | [ ]  | Pending npm publish          |
| Smithery                   |  [ ]   |   [ ]    | [ ]  | Pending npm publish          |
| Cline Marketplace          |  [ ]   |   [ ]    | [ ]  | Pending PR                   |
| Glama                      |  [ ]   |   [ ]    | [ ]  | Pending npm publish          |
| PulseMCP                   |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| mcp.so                     |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| MCP Market                 |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| MCPServerFinder            |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| mcpservers.org             |  [ ]   |   [ ]    | [ ]  | Pending PR                   |
| LobeHub MCP                |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| cursor.directory           |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| Claude Desktop Extensions  |  [ ]   |   [ ]    | [ ]  | Pending npm pack             |
| Toolify.ai                 |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| AI Agent Store             |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| AI Agents Directory        |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| AI Agents List             |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| TrillionAgent              |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| SaaSHub                    |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| AlternativeTo              |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| Capterra                   |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| DevHunt                    |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| BetaList                   |  [ ]   |   [ ]    | [ ]  | Pending submission           |
| WordPress Plugin Dir       |  [ ]   |   [ ]    | [ ]  | Ready (Phase 6 launch)       |
| Product Hunt               |  [ ]   |   [ ]    | [ ]  | Wait for Stripe              |
| Zapier                     |  [ ]   |   [ ]    | [ ]  | Wait for Stripe              |
| G2                         |  [ ]   |   [ ]    | [ ]  | Wait for review              |
```

---

## 13. Sources

### MCP Registries

- [MCP Registry officiel](https://registry.modelcontextprotocol.io/) — Anthropic
- [MCP Registry GitHub](https://github.com/modelcontextprotocol/registry) — Source + docs
- [MCP Registry Publishing Guide](https://modelcontextprotocol.info/tools/registry/publishing/)
- [MCP Registry CLI Tool](https://modelcontextprotocol.info/tools/registry/cli/)
- [Smithery](https://smithery.ai/) — MCP server hub
- [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace) — VS Code Cline
- [Glama MCP](https://glama.ai/mcp/servers) — Auto-indexed directory
- [PulseMCP](https://www.pulsemcp.com/servers) — 8230+ servers, daily updates
- [mcp.so](https://mcp.so/) — Community directory
- [MCP Market](https://mcpmarket.com/) — Directory + submit
- [MCPServerFinder](https://www.mcpserverfinder.com/) — Search directory
- [mcpservers.org](https://mcpservers.org/) — Curated list
- [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/)
- [LobeHub MCP](https://lobehub.com/mcp) — LobeChat ecosystem
- [cursor.directory](https://cursor.directory/mcp) — Cursor IDE
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — GitHub curated list
- [Mastra MCP Registry Registry](https://mastra.ai/mcp-registry-registry) — Meta-registry
- [7 MCP Registries Worth Checking Out](https://nordicapis.com/7-mcp-registries-worth-checking-out/) — Nordic APIs
- [17+ Top MCP Registries](https://medium.com/demohub-tutorials/17-top-mcp-registries-and-directories-explore-the-best-sources-for-server-discovery-integration-0f748c72c34a) — Medium

### E-commerce App Stores

- [Shopify App Store Requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Shopify Submit App](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
- [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [PrestaShop Contributor Guide](https://addons.prestashop.com/en/content/36-contributor-guide-successfully-making-your-product-available-on-addons)
- [BigCommerce Publishing an App](https://developer.bigcommerce.com/docs/integrations/apps/guide/publishing)
- [Wix App Market Guidelines](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/app-market-guidelines)
- [Zapier Partner Program](https://zapier.com/developer-platform/partner-program)

### AI Directories

- [There's An AI For That](https://theresanaiforthat.com/submit/) — 4M+/mois
- [Futurepedia](https://www.futurepedia.io/submit-tool) — 400K+/mois
- [Toolify.ai](https://www.toolify.ai/) — 26K+ tools
- [AI Agent Store](https://aiagentstore.ai/)
- [AI Agents Directory](https://aiagentsdirectory.com/)
- [AI Agents List](https://aiagentslist.com/)
- [TrillionAgent](https://trillionagent.com)
- [93 directories SaaS/AI](https://www.indiehackers.com/post/where-to-submit-your-saas-or-ai-tool-the-list-of-93-directories-catalogues-and-newsletter-websites-9a86fd8fef) — Indie Hackers

### B2B Review Sites

- [G2](https://www.g2.com/) — 80M+/an
- [Capterra](https://www.capterra.com/vendors/sign-up) — 9M+/mois
- [Capterra Listing Guidelines](https://www.capterra.com/legal/listing-guidelines/)
- [SaaSHub](https://www.saashub.com/) — 195K+ produits
- [AlternativeTo](https://alternativeto.net/)
- [TrustRadius](https://www.trustradius.com/)
- [Gartner Peer Insights](https://www.gartner.com/reviews/market/conversational-ai-platforms)

### Launch Platforms

- [Product Hunt](https://www.producthunt.com/)
- [BetaList](https://betalist.com/)
- [DevHunt](https://devhunt.org/)
- [AppSumo Sell](https://sell.appsumo.com/)
- [NachoNacho](https://nachonacho.com/marketplace)

### Cloud Marketplaces

- [Microsoft Marketplace](https://marketplace.microsoft.com/)
- [Google Cloud Marketplace Requirements](https://docs.google.com/marketplace/docs/partners/get-started)

---

*Document cree: 13/02/2026 - Session 250.205*
*Toutes les URLs verifiees via WebSearch le 13/02/2026*
*Statut: 0 canal actif sur 28+ identifies*
