# MARKETING COPY REMEDIATION — Plan d'Exécution

> **Créé**: 10/02/2026 | **Statut**: TERMINÉ ✅
> **Objectif**: Corriger 40 findings marketing sur 80 pages web — 0% bullshit, 100% vérifiable
> **Règle**: Aucun claim sans preuve empirique. Chaque modification doit être vérifiable.

---

## BENCHMARK PRIX CONCURRENTS (vérifié 10/02/2026)

### Sources
- Vapi: [vapi.ai/pricing](https://vapi.ai/pricing) | [Lindy review](https://www.lindy.ai/blog/vapi-ai) | [Ringg breakdown](https://www.ringg.ai/blogs/vapi-ai-pricing)
- Retell: [retellai.com/pricing](https://www.retellai.com/pricing) | [Ringg breakdown](https://www.ringg.ai/blogs/retell-ai-pricing)
- Bland: [docs.bland.ai/billing](https://docs.bland.ai/platform/billing) | [Lindy breakdown](https://www.lindy.ai/blog/bland-ai-pricing) | [CloudTalk guide](https://www.cloudtalk.io/blog/bland-ai-pricing/)

### Données vérifiées

| Concurrent | Tarif base | Tarif total typique (GPT-4o + TTS + STT + téléphonie) | Frais mensuels |
|:-----------|:-----------|:------------------------------------------------------|:---------------|
| **VocalIA** | 0.10€/min | 0.10€/min (IA incluse dans 199€/mois) | 199€/mois + 100 min incluses |
| **Retell** | $0.07/min | ~$0.135/min (GPT-4o + OpenAI voice + Twilio) | Aucun (pay-as-you-go) |
| **Vapi** | $0.05/min | ~$0.13–$0.33/min (avec STT + LLM + TTS + téléphonie) | Aucun (pay-as-you-go) |
| **Bland** | $0.09–$0.11/min | ~$0.09–$0.11/min (tout inclus) | $0–$499/mois selon plan |

### Coût total RÉEL par volume (comparaison honnête incluant frais mensuels)

| Volume/mois | VocalIA | Retell (GPT-4o) | Vapi (typique) | Bland (Scale) |
|:------------|:--------|:-----------------|:---------------|:--------------|
| 100 min | **289€** ($312) | $13.50 | $15–$33 | $499+$11=$510 |
| 500 min | **239€** ($258) | $67.50 | $75–$165 | $499+$55=$554 |
| 1000 min | **289€** ($312) | $135 | $150–$330 | $499+$110=$609 |
| 2000 min | **389€** ($420) | $270 | $300–$660 | $499+$220=$719 |
| 5000 min | **689€** ($744) | $675 | $750–$1650 | $499+$550=$1049 |

> **Note**: VocalIA = 199€/mois + (minutes - 100) × 0.10€. Taux EUR/USD ≈ 1.08.

### VERDICT BENCHMARK
- **VocalIA est 2–4× PLUS CHER** que Retell/Vapi à faible/moyen volume (<2000 min/mois)
- **VocalIA est comparable** à Retell/Vapi à haut volume (5000+ min/mois)
- **VocalIA est moins cher que Bland** à tous les volumes (<5000 min/mois)
- **La claim "60% moins cher" est FAUSSE** — elle ne tient dans aucun scénario réaliste
- **VocalIA inclut** 38 personas, KB, analytics, multi-AI fallback — les concurrents facturent ces extras séparément
- **Le vrai avantage**: tout-en-un avec personas métier pré-configurés, pas le prix

### Remplacement recommandé pour "60% moins cher"
**Option A** (factuelle): "Plateforme tout-en-un : IA + Personas + KB + Analytics inclus dans un seul abonnement"
**Option B** (comparative honnête): "À partir de 0.10€/min, tout inclus — pas de frais cachés par composant"

---

## DONNÉES EMPIRIQUES VÉRIFIÉES

### Tailles widget (gzip réel mesuré)
| Widget | Brut | Gzip |
|:-------|:-----|:-----|
| voice-widget-b2b.js | 72,842 bytes | **17,954 bytes (~18KB)** ✓ |
| voice-widget-v3.js | 150,229 bytes | **34,410 bytes (~34KB)** |
| voice-widget-b2b.min.js | 41,100 bytes | ~14KB (estimé) |

- Claim "18KB gzip" sur voice-widget.html: **CORRECT** (pour B2B)
- Claim "~45KB gzipped" sur specs B2B/Ecom: **FAUX** (B2B = 18KB, v3 = 34KB)

### Web Workers
- `grep -ri "Worker" widget/` → **0 résultats**
- Claim "Web Workers pour le traitement audio": **FAUX VÉRIFIÉ**

### Function Tools téléphonie
- `grep -c "name: '" telephony/voice-telephony-bridge.cjs` → **25**
- Claim "11 Function Tools" sur voice-telephony.html: **FAUX** (correct = 25)
- Claim "25 outils métier" sur pricing.html: **CORRECT** ✓

---

## CHECKLIST D'EXÉCUTION

### PHASE 1 — CRITIQUE: Supprimer/Corriger le FAUX pur (10 items)

> **Priorité**: IMMÉDIATE — Risque légal, SEO, confiance

#### [x] C1: Schema.org faux — `website/index.html`
- **Action 1a**: Supprimer `"iOS, Android"` de `operatingSystem` → garder `"Web"` uniquement
- **Action 1b**: Changer `"highPrice": "299"` → `"199"`
- **Action 1c**: Remplacer `"+1-762-422-4223"` par un email de contact ou supprimer le champ telephone
- **Localisation**: Bloc `<script type="application/ld+json">` dans `<head>`
- **Vérification**: Valider avec [Google Rich Results Test](https://search.google.com/test/rich-results)

#### [x] C2: Nombre employés faux — `website/investor.html`
- **Action**: Supprimer le champ `"numberOfEmployees"` du Schema.org ou mettre `"1"`
- **Localisation**: Ligne ~59, bloc Organization JSON-LD
- **Vérification**: `grep "numberOfEmployees" website/investor.html`

#### [x] C3: Données concurrents fabriquées — `website/features.html`
- **Action 3a**: Supprimer le tableau comparatif concurrents OU remplacer par données vérifiables
- **Action 3b**: Si on garde un tableau, mettre "N/D" pour les données qu'on ne peut pas vérifier
- **Action 3c**: Corriger "Vapi Voice Widget: ✗" → "✓" (Vapi a un web widget)
- **Action 3d**: Corriger "Retell Voice Widget: ✗" → "✓" (Retell a un web SDK et un chat agent)
- **Action 3e**: Supprimer "Self-Hosted Option: ✓" (n'existe pas)
- **Action 3f**: Mettre les chiffres MCP concurrents à "N/D" ou supprimer la ligne
- **Vérification**: Chaque ✓/✗ doit être vérifiable sur le site du concurrent

#### [x] C4: Produit Enterprise self-hosted fantôme — 5 fichiers
- **Fichiers**: `pricing.html` (FAQ Schema.org), `features.html` (tableau), `voice-telephony.html` (tableau), `integrations.html` (mention)
- **Action 4a**: Supprimer la FAQ "Comment fonctionne l'option self-hosted?" de pricing.html Schema.org
- **Action 4b**: Supprimer "Self-Hosted" de tous tableaux comparatifs
- **Action 4c**: Grep et supprimer toute mention de self-hosted comme feature VocalIA
- **Vérification**: `grep -ri "self-hosted\|self.hosted" website/*.html website/**/*.html | grep -v "analytics\|Plausible"` → 0 résultats VocalIA

#### [x] C5: Certification ISO 27001 fausse — `website/privacy.html`
- **Action**: Supprimer le badge `<span>ISO 27001</span>` (ligne ~147)
- **Garder**: "RGPD Conforme" et "AI Act Compliant" (en cours de conformité)
- **Vérification**: `grep -i "iso.27001" website/privacy.html` → 0 résultats

#### [x] C6: SLA 99.5% faux — `website/terms.html`
- **Action**: Changer "s'engage sur une disponibilité de 99,5%" → "s'efforce d'assurer la meilleure disponibilité possible"
- **Localisation**: Ligne ~239, section 4.4
- **Vérification**: `grep "99" website/terms.html` → 0 résultats SLA

#### [x] C7: Témoignages fictifs présentés comme réels — `website/index.html`
- **Action 7a**: Changer le titre "Témoignages Clients" → "Scénarios d'Usage" (ou "Cas d'Usage Illustratifs")
- **Action 7b**: Changer "Ce Que Nos Clients Disent" → "Comment VocalIA S'Intègre à Votre Activité"
- **Action 7c**: Appliquer les mêmes changements dans les 5 fichiers locales (fr.json, en.json, es.json, ar.json, ary.json) pour les clés `testimonials.badge`, `testimonials.title`, `testimonials.subtitle`
- **Vérification**: `grep -i "témoignage\|testimonial\|clients disent" website/index.html` → 0 résultats trompeurs

#### [x] C8: Support/Ventes faux — 4 fichiers
- **Fichiers**: `contact.html`, `pricing.html`, `voice-widget.html`, FAQ contact
- **Action 8a**: `contact.html` — Changer "Support 24/7 pour clients Pro/Enterprise" → "Support par email, réponse sous 48h ouvrées"
- **Action 8b**: `contact.html` — Changer "Notre équipe communique en FR, EN, ES, AR" → "Communication disponible en FR et EN"
- **Action 8c**: `pricing.html` — Supprimer "Support Dédié 24/7" du plan Telephony ou le qualifier en "Support email prioritaire"
- **Action 8d**: `voice-widget.html` — Changer "Support technique inclus" → "Documentation complète incluse"
- **Action 8e**: Changer "Contacter les Ventes" → "Nous Contacter" partout
- **Action 8f**: `contact.html` FAQ — Changer "Le support est disponible 24/7" → "Le support répond par email en jours ouvrés"
- **Action 8g**: Appliquer dans les 5 locales les changements correspondants
- **Vérification**: `grep -i "support 24/7\|support dédié\|contacter.*ventes\|contact.*sales" website/*.html` → 0 résultats

#### [x] C9: Prix Schema.org périmés 0.06€ → 0.10€ — 3 fichiers
- **Fichiers**: `voice-telephony.html` (2 occurrences), `integrations.html` (1 occurrence)
- **Action**: Changer `"price": "0.06"` → `"price": "0.10"` dans tous les blocs JSON-LD
- **Vérification**: `grep '"0.06"' website/products/voice-telephony.html website/integrations.html` → 0 résultats

#### [x] C10: Prix Schema.org E-commerce faux 49→99 — `website/products/voice-widget-ecommerce.html`
- **Action**: Changer `"price": "49"` → `"price": "99"` dans le bloc Product JSON-LD
- **Vérification**: `grep '"price".*"49"' website/products/voice-widget-ecommerce.html` → 0 résultats

---

### PHASE 2 — ÉLEVÉ: Qualifier/Honnêteté (10 items)

> **Priorité**: HAUTE — Crédibilité auprès de la cible (CEO, directeurs marketing)

#### [x] H1: Remplacer "60% moins cher" — 17+ occurrences dans ~10 fichiers

**Remplacement factuel basé sur benchmark vérifié:**

| Contexte | Ancienne claim | Nouveau texte (FR) |
|:---------|:---------------|:-------------------|
| Hero/titre | "60% Moins Cher" | "Plateforme Tout-en-Un" |
| Moat/avantage | "Jusqu'à 60% moins cher que les alternatives EU" | "Tarification transparente tout inclus : IA + personas + analytics dans un seul abonnement" |
| Comparaison | "60% d'économie" | "0.10€/min tout compris — pas de surcoût par composant (STT, LLM, TTS facturés séparément chez les concurrents)" |
| Investor moats | "Moat Prix: 60% moins cher" | "Moat Valeur: plateforme unifiée Widget + Téléphonie + 38 personas inclus" |
| Investor moat_3 | "Architecture optimisée: jusqu'à 60% moins cher" | "Architecture optimisée: tarif unique tout inclus vs facturation par composant" |

**Fichiers à modifier** (grep exhaustif):
1. `website/index.html` — hero, Schema.org, testimonial
2. `website/about.html` — stat card
3. `website/investor.html` — titre, moat_1_desc, moat_3_desc
4. `website/features.html` — comparaison
5. `website/products/voice-telephony.html` — si présent
6. `website/src/locales/fr.json` — toutes les clés contenant "60%"
7. `website/src/locales/en.json` — idem
8. `website/src/locales/es.json` — idem
9. `website/src/locales/ar.json` — idem
10. `website/src/locales/ary.json` — idem
11. Blog articles: `clinique-amal`, `automatiser-prise-rdv`, `reduire-couts-support`, `guide-qualification-leads`

**Vérification**: `grep -ri "60%" website/ --include="*.html" --include="*.json" | grep -i "moins\|cheaper\|cheaper\|économie\|saving"` → 0 résultats

#### [x] H2: Qualifier les pourcentages marketing — ~15 occurrences

**Règle**: Tout % sans source vérifiable → qualifier avec "objectif" ou "benchmark sectoriel" ou supprimer

| Page | Claim | Action |
|:-----|:------|:-------|
| `voice-widget.html` | "+25% conversion" | → "Optimisé pour la conversion" |
| `use-cases/lead-qualification` meta | "Augmentez votre taux de conversion de 40%" | → "Améliorez votre qualification de leads" |
| `use-cases/customer-support` meta | "Réduisez 60% des coûts support" | → "Réduisez vos coûts de support client" |
| `use-cases/e-commerce` meta | "Réduisez 70% des tickets" | → "Réduisez significativement vos tickets support" |
| `use-cases/index.html` | "+40% Conversion" stat badge | → Supprimer le % ou qualifier "objectif sectoriel" |
| `blog/index.html` | "réduire de 70% vos coûts" (titre article) | → Garder (c'est un titre d'article de blog éducatif) |
| `academie-business/index.html` | "+40% conversion", "+70% conversion paiement" ×8 | → Qualifier chaque "Projection sectorielle" avec "(benchmark sectoriel)" |

**Vérification**: `grep -rn "+[0-9]\+%" website/use-cases/ website/products/voice-widget.html` → vérifier que tous sont qualifiés

#### [x] H3: "Conversations illimitées" — `website/pricing.html`
- **Action**: Changer "Conversations illimitées" → "Conversations incluses" ou spécifier une limite (ex: "jusqu'à 1000 conversations/mois")
- **Vérification**: `grep -i "illimitée" website/pricing.html` → 0 résultats

#### [x] H4: Projections investisseur sans sources — `website/investor.html`
- **Action 4a**: TAM/SAM/SOM — Ajouter source: "(Source: Grand View Research, 2024)" ou équivalent vérifié
- **Action 4b**: Gartner claim — Soit ajouter la référence exacte (rapport, date), soit supprimer
- **Vérification**: Chaque chiffre doit avoir une parenthèse (Source: xxx)

#### [x] H5: "CDN global (latence <50ms)" — 2 fichiers produit
- **Fichiers**: `voice-widget-b2b.html`, `voice-widget-ecommerce.html`
- **Action**: Changer "CDN global (latence <50ms)" → "Hébergement Europe (VPS dédié)"
- **Aussi dans locales**: Clé `voice_widget_page.specs_perf_cdn`
- **Vérification**: `grep -i "CDN\|latence.*50ms" website/products/voice-widget-*.html` → 0 résultats

#### [x] H6: "Aucune donnée stockée côté VocalIA" — 2 fichiers produit
- **Fichiers**: `voice-widget-b2b.html`, `voice-widget-ecommerce.html`
- **Action**: Changer → "Données chiffrées en transit et au repos. Voir notre politique de confidentialité."
- **Aussi dans locales**: Clé `voice_widget_page.specs_security_data`
- **Vérification**: `grep -i "aucune donnée stockée" website/products/voice-widget-*.html` → 0 résultats

#### [x] H7: "Infrastructure dédiée" STT/TTS — 2 fichiers produit
- **Fichiers**: `voice-widget-b2b.html`, `voice-widget-ecommerce.html`
- **Action**: Changer "Infrastructure dédiée" → "Web Speech API (natif navigateur, $0/requête)"
- **Aussi dans locales**: Clé `voice_widget_page.feature1_desc`
- **Vérification**: `grep -i "infrastructure dédiée" website/products/voice-widget-*.html` → 0 résultats

#### [x] H8: "Web Workers pour le traitement audio" — 2 fichiers produit
- **Fichiers**: `voice-widget-b2b.html`, `voice-widget-ecommerce.html`
- **Action**: Supprimer cette ligne de specs OU changer → "Shadow DOM isolé pour sécurité"
- **Aussi dans locales**: Clé `voice_widget_page.specs_perf_workers`
- **Vérification**: `grep -i "web.worker" website/products/voice-widget-*.html` → 0 résultats

#### [x] H9: Billing annuel -20% toggle — `website/pricing.html`
- **Action**: Supprimer le toggle annuel/mensuel et toute référence à -20% annuel
- **Alternative**: Garder le toggle mais désactiver le calcul et afficher "Bientôt disponible" en grisé
- **Vérification**: Vérifier visuellement que le toggle n'apparaît plus ou est désactivé

#### [x] H10: Paliers volume discount fictifs — `website/pricing.html`
- **Action**: Supprimer la section "Volume Discounts" (1000+, 5000+, 10000+ min)
- **Alternative**: Changer → "Contactez-nous pour les tarifs grands comptes"
- **Vérification**: `grep -i "volume.*discount\|1000.*min\|5000.*min\|10000.*min" website/pricing.html` → 0 résultats

---

### PHASE 3 — MOYEN: Harmoniser les incohérences (7 items)

> **Priorité**: MOYENNE — Professionnalisme, cohérence

#### [x] M1: Taille bundle incohérente
- `voice-widget.html` hero → "18KB gzip" : **CORRECT** (B2B = 17,954 bytes gzip vérifié)
- `voice-widget-b2b.html` / `voice-widget-ecommerce.html` specs → "~45KB gzipped"
- **Action**: Corriger "~45KB" → "~18KB" pour B2B, "~34KB" pour E-commerce core
- **Aussi dans locales**: Clé `voice_widget_page.specs_perf_bundle`
- **Vérification**: Tailles déjà vérifiées empiriquement (voir section Données Empiriques)

#### [x] M2: Personas "30+" → "38" — `website/about.html`
- **Action**: Changer "30+" → "38" dans le stat card
- **Aussi dans locales**: Clé correspondante about.stat_personas (vérifier la clé exacte)
- **Vérification**: `grep "30+" website/about.html` → 0 résultats

#### [x] M3: Duplicate Twitter Card meta tags — **22 fichiers**
**Liste exhaustive des fichiers avec 2 blocs `<!-- Twitter Card -->`:**
1. `products/voice-widget-b2b.html`
2. `products/voice-widget-ecommerce.html`
3. `products/voice-telephony.html`
4. `industries/healthcare.html`
5. `industries/finance.html`
6. `industries/real-estate.html`
7. `industries/retail.html`
8. `industries/index.html`
9. `use-cases/index.html`
10. `use-cases/appointments.html`
11. `use-cases/lead-qualification.html`
12. `use-cases/customer-support.html`
13. `use-cases/e-commerce.html`
14. `blog/index.html`
15. `blog/articles/reduire-couts-support-voice-ai.html`
16. `blog/articles/rgpd-voice-ai-guide-2026.html`
17. `blog/articles/vocalia-lance-support-darija.html`
18. `blog/articles/clinique-amal-rappels-vocaux.html`
19. `blog/articles/integrer-vocalia-shopify.html`
20. `blog/articles/ai-act-europe-voice-ai.html`
21. `blog/articles/agence-immo-plus-conversion.html`
22. `docs/index.html`

- **Action**: Dans chaque fichier, supprimer le 2ème bloc `<!-- Twitter Card -->` (celui qui est souvent générique/mauvaise URL)
- **Vérification**: `grep -c "<!-- Twitter Card" website/FILE.html` → 1 pour chaque fichier

#### [x] M4: "11 Function Tools" → "25" — `website/products/voice-telephony.html`
- **Fait vérifié**: `grep -c "name: '" telephony/voice-telephony-bridge.cjs` = **25**
- **Action**: Changer "11 Function Tools Intégrés" → "25 Function Tools Intégrés"
- **Aussi**: Mettre à jour le stat "11 Tools" en hero → "25"
- **Aussi dans locales**: Clés `voice_telephony_page.tools_title`, `voice_telephony_page.stat_tools`
- **Vérification**: `grep "11" website/products/voice-telephony.html | grep -i "tool\|function"` → 0 résultats

#### [x] M5: EUR/USD mixés — `website/pricing.html`
- **Action**: "Darija inbound: $0.25/min" → "Darija inbound: 0.25€/min" (harmoniser en EUR)
- **Vérification**: `grep "\\\$" website/pricing.html` → vérifier qu'aucun USD n'apparaît dans un contexte EUR

#### [x] M6: Citation Gartner sans source — `website/investor.html`
- **Action**: Soit trouver et citer le rapport exact, soit supprimer la mention Gartner
- **Localisation**: Ligne ~194, `investor.market_subtitle`
- **Aussi dans locales**: Clé `investor.market_subtitle`
- **Vérification**: Toute mention "Gartner" doit avoir un lien ou une référence complète

#### [x] M7: "Monitoring 24/7, détection d'intrusion" — `website/privacy.html`
- **Action**: Changer → "Surveillance de disponibilité, mises à jour de sécurité régulières"
- **Localisation**: Ligne ~257
- **Vérification**: `grep -i "monitoring 24/7\|détection d'intrusion" website/privacy.html` → 0 résultats

---

### PHASE 4 — BAS: Polish et qualité (7 items)

> **Priorité**: BASSE — Finitions, professionnalisme

#### [x] L1: Ajouter disclaimers blogs sans mention "fictif/benchmark"
**4 articles concernés:**
1. `blog/articles/reduire-couts-support-voice-ai.html` — ajouter disclaimer benchmark
2. `blog/articles/voice-ai-vs-chatbot-comparatif.html` — ajouter disclaimer
3. `blog/articles/automatiser-prise-rdv-telephonique.html` — ajouter disclaimer
4. `blog/articles/guide-qualification-leads-bant.html` — ajouter disclaimer

- **Format**: Même style que clinique-amal et agence-immo-plus (encadré jaune/amber avec `<strong>Note:</strong>`)
- **Texte type**: "Les chiffres cités sont des moyennes sectorielles issues de benchmarks publics et ne représentent pas des résultats garantis. Les résultats varient selon le secteur, le volume et la configuration."
- **Vérification**: Chaque article de blog avec des % doit avoir un disclaimer visible

#### [x] L2: "Réponse sous 24h" — `website/contact.html`
- **Action**: Changer "< 24h Temps de réponse moyen" → "Nous répondons dans les meilleurs délais"
- **Localisation**: Ligne ~285
- **Vérification**: `grep "24h" website/contact.html | grep -i "réponse\|response"` → 0 résultats

#### [x] L3: "Essai 14 jours" — audit des CTA
- **Décision**: GARDER — L'essai 14 jours est le modèle tarifaire planifié (pricing.html: "Essai gratuit 14 jours"). Les CTA sont cohérents avec la roadmap produit.
- **Fichiers**: Aucune modification nécessaire

#### [x] L4: Code sample `voice-widget-v3.js` — `website/products/voice-widget-ecommerce.html`
- **Action**: Vérifier que le fichier référencé dans le code sample existe bien au chemin indiqué
- **Localisation**: Ligne ~372 et ~631
- **Vérification**: `ls website/voice-assistant/voice-widget-v3.js` → doit exister (note: c'est voice-widget-ecommerce-core.js le vrai nom)

#### [x] L5: Newsletter signup — présent sur ~10 pages
- **Décision**: GARDER — Les formulaires servent de collecte d'intention (standard marketing). Le backend newsletter sera connecté lors du lancement. Pas trompeur car pas de promesse de livraison immédiate.

#### [x] L6: Booking page — `website/booking.html`
- **Décision**: GARDER — Le booking page utilise un formulaire de contact standard (pas de faux calendrier). Le lien vers un vrai calendrier (Calendly) sera connecté lors du lancement. Pas trompeur en l'état.

#### [x] L7: Academie projections sectorielles — `website/academie-business/index.html`
- **Action**: Ajouter "(benchmark sectoriel)" après chaque mention de "+X% conversion" dans les 8 blocs "Projection sectorielle"
- **Vérification**: Chaque % dans academie doit être accompagné de sa qualification

---

## SUIVI D'EXÉCUTION

### Compteurs

| Phase | Total items | Faits | Restants | % |
|:------|:------------|:------|:---------|:--|
| Phase 1 — CRITIQUE | 10 | **10** | 0 | **100%** ✅ |
| Phase 2 — ÉLEVÉ | 10 | **10** | 0 | **100%** ✅ |
| Phase 3 — MOYEN | 7 | **7** | 0 | **100%** ✅ |
| Phase 4 — BAS | 7 | **7** | 0 | **100%** ✅ |
| **TOTAL** | **34** | **34** | **0** | **100%** ✅ |

> Note: Les items C3 et C4 comptent comme 1 chacun malgré leurs sous-actions multiples.
> Le nombre réel de modifications unitaires (fichiers × changements) est ~120+.

### Dépendances

```
Phase 1 (CRITIQUE) → peut commencer immédiatement
Phase 2 (ÉLEVÉ)    → H1 dépend du benchmark (FAIT ✓), reste peut commencer
Phase 3 (MOYEN)    → indépendant
Phase 4 (BAS)      → L3, L5, L6 nécessitent des décisions produit
```

### Estimation de travail
- Phase 1: ~2-3 sessions (modifications HTML + 5 locales × 10 items)
- Phase 2: ~2-3 sessions (17+ occurrences "60%" seul = beaucoup de fichiers)
- Phase 3: ~1-2 sessions (22 fichiers Twitter Card = mécanique mais long)
- Phase 4: ~1 session
- **Total estimé**: ~6-9 sessions

---

## RÈGLES D'EXÉCUTION

1. **Chaque modification** doit avoir sa commande de vérification exécutée APRÈS le changement
2. **Chaque fichier locale** (fr/en/es/ar/ary) doit être modifié en même temps que le HTML
3. **Aucun nouveau claim** ne peut être ajouté sans preuve empirique documentée ici
4. **Ce document** est mis à jour après chaque session avec les cases cochées [x]
5. **Les blogs** gardent leurs % mais DOIVENT avoir un disclaimer visible
6. **Le tableau concurrent** dans features.html est soit supprimé soit basé uniquement sur des données vérifiables sur les sites officiels des concurrents

---

*Document créé le 10/02/2026 — Session 250.195*
*Dernière mise à jour: 10/02/2026 — Session 250.195 — 34/34 TERMINÉ*
