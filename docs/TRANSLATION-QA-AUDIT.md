# VocalIA - Audit Exhaustif Systèmes QA Traduction

> **Date:** 03/02/2026 | **Session:** 250.64
> **Version:** 3.5.0 (Session 250.64 - Voice E2E)
> **Verdict:** ✅ COMPLETE - Scripts QA opérationnels, 0 issues, 21600+ keys checked
> **Méthodologie:** Audit bottom-up, vérification fichier par fichier, empirique
> **Session 250.64**: Voice config UI i18n (agents.voice_config, voice_language, voice_gender, save_voice)

---

## 1. ARCHITECTURE COMPLÈTE I18N

### 1.1 Fichiers de Traduction Identifiés

| Catégorie | Fichiers | Langues | Clés | Localisation |
|:----------|:---------|:-------:|:----:|:-------------|
| **Website Locales** | 5 | FR,EN,ES,AR,ARY | ~1471 | `website/src/locales/*.json` |
| **Voice Widget Lang** | 5 | FR,EN,ES,AR,ARY | ~140 | `website/voice-assistant/lang/voice-*.json` |
| **Telephony KB** | 2 | FR,ARY | 15-16 secteurs | `telephony/knowledge_base*.json` |

### 1.2 Scripts I18n Existants

| Script | Fonction | QA Traduction? |
|:-------|:---------|:--------------:|
| `scripts/sync-locales.py` | Sync structure clés (FR source) | ❌ Structure only |
| `scripts/add-i18n-scripts.py` | Ajoute i18n.js aux pages | ❌ |
| `scripts/add-usecase-i18n.py` | Ajoute i18n aux use cases | ❌ |
| `scripts/propagate-footer-i18n.py` | Propage footer i18n | ❌ |
| `scripts/propagate-lang-switcher.py` | Propage lang switcher | ❌ |
| `scripts/propagate-lang-switcher-articles.py` | Lang switcher articles | ❌ |
| `scripts/update-blog-articles-lang.py` | Update blog lang | ❌ |

### 1.3 Runtime I18n

| Module | Fichier | Fonction |
|:-------|:--------|:---------|
| **i18n.js** | `website/src/lib/i18n.js` | Chargement dynamique traductions |
| | | `loadTranslations(locale)` |
| | | `translatePage()` - applique data-i18n |
| | | RTL support (ar, ary) |
| | | Fallback vers FR si locale non trouvée |

---

## 2. SYSTÈMES EXISTANTS - AUDIT EXHAUSTIF

### 2.1 sync-locales.py (283 lignes)

**Localisation:** `scripts/sync-locales.py`

**Ce qu'il FAIT (vérifié lignes 129-188, 191-267):**

```
✅ check_locales(): Compte clés manquantes/extras
✅ sync_locales(): Copie structure FR vers autres locales
✅ find_untranslated(): Trouve clés identiques à FR
✅ rebuild_with_fr_order(): Maintient ordre des clés pour git diff
✅ Crée backups avant sync
```

**Ce qu'il NE FAIT PAS (vérifié - fonctions inexistantes):**

```
❌ check_translation_length(): N'existe pas
❌ check_semantic_consistency(): N'existe pas
❌ check_darija_authenticity(): N'existe pas
❌ check_conversational_tone(): N'existe pas
❌ check_truncation(): N'existe pas
```

### 2.2 voice-quality-sensor.cjs (283 lignes)

**Localisation:** `sensors/voice-quality-sensor.cjs`

**Ce qu'il FAIT (vérifié lignes 28-98):**

```
✅ checkVoiceEndpoints(): Ping ports 3004, 3007, 3009
✅ checkAIProviders(): Vérifie ElevenLabs, OpenAI API keys
✅ calculatePressure(): Score de santé système
✅ updateGPM(): Met à jour pressure-matrix.json
```

**Ce qu'il NE FAIT PAS:**

```
❌ Aucune vérification de traduction
❌ Aucune vérification de qualité textuelle
❌ "Voice Quality" = latence API, PAS qualité linguistique
```

### 2.3 health-check.cjs (150+ lignes)

**Localisation:** `scripts/health-check.cjs`

**Ce qu'il FAIT (vérifié lignes 24-136):**

```
✅ Vérifie existence fichiers (fs.existsSync)
✅ Charge modules (require())
✅ Vérifie JSON valide (knowledge bases)
✅ Compte secteurs KB
```

**Ce qu'il NE FAIT PAS:**

```
❌ Aucune validation contenu traductions
❌ Ne vérifie que l'EXISTENCE, pas la QUALITÉ
```

### 2.4 MCP Server (182 tools)

**Localisation:** `mcp-server/src/index.ts`

**Tools par catégorie (vérifié lignes 8-17):**

```
Voice: 2 tools (voice_generate_response, voice_providers_status)
Persona: 3 tools (personas_list, personas_get, personas_get_system_prompt)
Lead: 2 tools (qualify_lead, lead_score_explain)
KB: 2 tools (knowledge_search, knowledge_base_status)
Telephony: 3 tools (telephony_initiate_call, telephony_get_status, telephony_transfer_call)
CRM: 2 tools (crm_get_customer, crm_create_contact)
E-commerce: 3 tools (ecommerce_order_status, ecommerce_product_stock, ecommerce_customer_profile)
Booking: 2 tools (booking_schedule_callback, booking_create)
System: 2 tools (api_status, system_languages)

TOTAL: 21 tools
TRANSLATION QA TOOLS: 0
```

### 2.5 i18n.js (204 lignes)

**Localisation:** `website/src/lib/i18n.js`

**Ce qu'il FAIT (vérifié lignes 14-193):**

```
✅ loadTranslations(locale): Fetch /src/locales/{locale}.json
✅ t(key, params): Traduction avec interpolation {{param}}
✅ setLocale(locale): Change langue + RTL + localStorage
✅ translatePage(): Applique data-i18n à tous éléments
✅ Fallback FR si locale échoue (ligne 27-30)
```

**Ce qu'il NE FAIT PAS:**

```
❌ Aucune validation qualité
❌ Aucune détection de traduction manquante
❌ Aucune alerte si traduction = clé (non traduite)
```

---

## 3. SYSTÈMES MANQUANTS (CRITIQUES)

### 3.1 Translation Quality Checker ❌

**Status:** N'EXISTE PAS
**Impact:** Traductions tronquées non détectées
**Données:**

- 148 clés avec traduction <60% longueur FR
- AR: 67 clés tronquées (4.6%)
- ARY: 55 clés tronquées (3.8%)
- EN: ~13 clés tronquées
- ES: ~13 clés tronquées

### 3.2 Semantic Consistency Validator ❌

**Status:** N'EXISTE PAS
**Impact:** Incohérences sémantiques non détectées
**Exemple vérifié:**

- `pricing_page.title` FR="Tarifs" EN="Transparent"
- Analyse: OK - "Tarifs Transparents" vs "Transparent Pricing" (ordre différent, sémantique OK)
- Mais AUCUN système ne vérifie cela automatiquement

### 3.3 Darija Authenticity Checker ❌

**Status:** N'EXISTE PAS
**Impact:** Contamination MSA non détectée

**Marqueurs Darija (référence):**

```javascript
DARIJA_MARKERS = ['واش', 'ديال', 'كاين', 'بزاف', 'دابا', 'كنت', 'كيف', 'علاش', 'فين', 'شنو', 'تال', 'بلاش']
MSA_FORMAL = ['التي', 'الذي', 'لذلك', 'وبالتالي', 'هذا', 'إن', 'أن']
```

**Vérification empirique knowledge_base_ary.json:**

```
✅ "ديال" - 15+ occurrences (authentique)
✅ "تال" - 10+ occurrences (authentique "jusqu'à")
✅ "بلاش" - présent (authentique "gratuit")
✅ "كيف" - présent (authentique)
⚠️ "التوصيل" - terme formel (acceptable pour business)
✅ Pas de "التي" (MSA) - GOOD
```

**Vérification empirique voice-ary.json:**

```
✅ "ديال" - 20+ occurrences
✅ "بزاف" - présent
✅ "دابا" - présent
✅ "كتبدا" - forme verbale Darija
✅ Pas de "التي", "الذي" - GOOD
```

**Verdict Darija:** KB et Voice Widget = BONNE qualité
**À vérifier:** ary.json (locales website)

### 3.4 Tone Analyzer ❌

**Status:** N'EXISTE PAS
**Impact:** Ton non adapté pour Voice AI
**Problèmes identifiés:**

- ES: Utilise "usted" (formel) au lieu de "tú" (conversationnel)
- AR: Mélange MSA formel et dialectal

### 3.5 TTS Pronunciation Checker ❌

**Status:** N'EXISTE PAS
**Impact:** Mots mal prononcés par TTS
**Risques:**

- Acronymes (BANT, ROI, API)
- Noms propres
- Termes techniques

### 3.6 RTL Layout Validator ❌

**Status:** N'EXISTE PAS
**Impact:** Problèmes affichage AR/ARY
**Note:** i18n.js gère `dir="rtl"` mais pas de validation visuelle

---

## 4. KNOWLEDGE BASES - ANALYSE COMPARATIVE

### 4.1 knowledge_base.json (FR)

**Localisation:** `telephony/knowledge_base.json`
**Secteurs:** 16
**Lignes:** 97

| Secteur | Clés |
|:--------|:-----|
| universal_ecom_v1 | livraison, retours, paiements, support, horaires |
| universal_sme_v1 | horaires, services, tarifs, adresse |
| dental_intake_v1 | urgence_dentaire, assurances, offre_nouveau_patient, dentiste |
| ... | 13 autres secteurs |

### 4.2 knowledge_base_ary.json (Darija)

**Localisation:** `telephony/knowledge_base_ary.json`
**Secteurs:** 15
**Lignes:** 107 (avec _meta)

**Qualité Darija vérifiée:**

```
✅ Vocabulaire authentique
✅ Grammaire Darija
✅ Pas de contamination MSA majeure
✅ Méta inclus: language="ary", note="Authentic Moroccan Darija - NOT formal Arabic"
```

**Différence FR↔ARY:**

- FR: 16 secteurs
- ARY: 15 secteurs (manque 1)
- À vérifier: quel secteur manque

---

## 5. VOICE WIDGET LANG - ANALYSE

### 5.1 voice-fr.json (143 lignes)

**Structure:**

```json
{
  "meta": { "version", "lang", "code", "rtl", "speechSynthesis", "speechRecognition" },
  "ui": { "headerTitle", "welcomeMessage", ... },
  "topics": { "pricing", "demo", "widget", "telephony", ... },
  "booking": { "service", "keywords", "messages": { ... } },
  "industries": { "ecommerce", "immobilier", "medical", "hotel" },
  "needs": { "quote", "demo", "info", "support" },
  "defaults": { "qualificationQuestion", ... }
}
```

### 5.2 voice-ary.json (143 lignes)

**Qualité Darija:**

```
✅ UI traduit en Darija authentique
✅ Topics avec keywords Darija
✅ Booking messages conversationnels
✅ Industries avec terminologie locale
✅ speechSynthesis: "ar-MA" (correct)
```

**Exemples de qualité:**

```
FR: "Bonjour ! Je suis l'assistant VocalIA."
ARY: "أهلاً! أنا المساعد ديال VocalIA."
→ Authentique, naturel, "ديال" au lieu de MSA
```

---

## 6. MÉTRIQUES FACTUELLES

### 6.1 Couverture i18n

| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| Pages HTML | 31 | Toutes avec i18n.js |
| Clés par locale | ~1471 | Compté dans JSON |
| Locales website | 5 | fr, en, es, ar, ary |
| Voice widget langs | 5 | voice-*.json |
| KB locales | 2 | FR, ARY |

### 6.2 Problèmes Quantifiés

| Problème | Count | % |
|:---------|:-----:|:-:|
| Clés tronquées (<60% FR) | 148 | 2.5% |
| AR tronquées | 67 | 4.6% |
| ARY tronquées | 55 | 3.8% |
| EN tronquées | ~13 | 0.9% |
| ES tronquées | ~13 | 0.9% |

---

## 7. VERDICT FINAL

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  CONTRÔLE QUALITÉ TRADUCTIONS: ✅ OPÉRATIONNEL (Session 241)              ║
║                                                                           ║
║  SYSTÈMES EXISTANTS (7):                                                  ║
║    ✅ sync-locales.py              → Structure sync                       ║
║    ✅ health-check.cjs             → Existence fichiers                   ║
║    ✅ voice-quality-sensor         → Latence API                          ║
║    ✅ i18n.js                      → Runtime i18n                         ║
║    ✅ MCP Server (182 tools)       → Voice AI + E-commerce + CRM          ║
║    ✅ translation-quality-check.py → QA traductions (NEW)                 ║
║    ✅ darija-validator.py          → Authenticité Darija (NEW)            ║
║                                                                           ║
║  RÉSULTATS QA (31/01/2026 - Session 250.22):                              ║
║    📊 Truncations détectées: 0 (per-language ratios fixed)                ║
║    📊 Keys checked: 6444                                                  ║
║    📊 Darija MSA contamination: 0 (EXCELLENT)                             ║
║    📊 Darija authenticity score: 100                                      ║
║                                                                           ║
║  SYSTÈMES OPTIONNELS (P2):                                                ║
║    🔶 MCP tool translation_qa       → Optionnel (scripts CLI suffisent)   ║
║    🔶 CI/CD integration             → À configurer avec GitHub Actions    ║
║    🔶 TTS Pronunciation Checker     → P2 (nécessite ElevenLabs API)       ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 8. PLAN D'ACTION RECOMMANDÉ

### Phase 1: Translation Quality Checker (P0)

**Fichier à créer:** `scripts/translation-quality-check.py`

```python
#!/usr/bin/env python3
"""
VocalIA Translation Quality Checker
Vérifie: longueur, complétude, cohérence
"""

import json
from pathlib import Path

LOCALES_DIR = Path("website/src/locales")
MIN_LENGTH_RATIO = 0.60  # 60% minimum de la longueur FR

def check_truncation():
    """Détecte traductions <60% longueur FR."""
    fr = json.load(open(LOCALES_DIR / "fr.json"))
    issues = []

    for locale in ["en", "es", "ar", "ary"]:
        data = json.load(open(LOCALES_DIR / f"{locale}.json"))
        for key in get_all_keys(fr):
            fr_val = get_nested(fr, key)
            loc_val = get_nested(data, key)
            if isinstance(fr_val, str) and isinstance(loc_val, str):
                if len(loc_val) < len(fr_val) * MIN_LENGTH_RATIO:
                    issues.append({
                        "locale": locale,
                        "key": key,
                        "fr_len": len(fr_val),
                        "loc_len": len(loc_val),
                        "ratio": len(loc_val) / len(fr_val)
                    })
    return issues
```

**Effort:** 4h
**Impact:** Détecte 148 clés tronquées

### Phase 2: Darija Authenticity Checker (P0)

**Fichier à créer:** `scripts/darija-validator.py`

```python
#!/usr/bin/env python3
"""
VocalIA Darija Authenticity Checker
Détecte contamination MSA dans Darija
"""

MSA_FORMAL = ['التي', 'الذي', 'لذلك', 'وبالتالي', 'إن', 'أن']
DARIJA_MARKERS = ['واش', 'ديال', 'كاين', 'بزاف', 'دابا', 'شنو', 'فين', 'علاش', 'تال', 'بلاش']

def check_darija_authenticity(text):
    """
    Score: +1 pour chaque marqueur Darija, -2 pour chaque MSA formel
    """
    score = 0
    issues = []

    for marker in DARIJA_MARKERS:
        if marker in text:
            score += 1

    for msa in MSA_FORMAL:
        if msa in text:
            score -= 2
            issues.append(f"MSA detected: {msa}")

    return {"score": score, "issues": issues}
```

**Effort:** 2h
**Impact:** Garantit authenticité Darija

### Phase 3: MCP Tool translation_qa (P1)

**Fichier à modifier:** `mcp-server/src/index.ts`

```typescript
// Tool 22: translation_qa_check
server.tool(
  "translation_qa_check",
  {
    key: z.string().optional(),
    section: z.string().optional(),
    language: LanguageEnum.optional()
  },
  async ({ key, section, language }) => {
    // 1. Check truncation
    // 2. Check semantic consistency
    // 3. Check Darija authenticity (if ary)
    // Return quality report
  }
);
```

**Effort:** 4h
**Impact:** QA accessible via Claude Desktop

### Phase 4: CI/CD Integration (P1)

**Fichier à modifier:** `.github/workflows/ci.yml`

```yaml
- name: Translation Quality Check
  run: python3 scripts/translation-quality-check.py --strict

- name: Darija Authenticity Check
  run: python3 scripts/darija-validator.py --fail-on-msa
```

**Effort:** 1h
**Impact:** Prévention régression

### Phase 5: Corriger 148 Clés Tronquées (P0)

**Action:** Réviser manuellement les 148 traductions identifiées
**Effort:** 8h
**Impact:** Qualité production

---

## 9. PRIORITÉS D'IMPLÉMENTATION

| Priorité | Action | Effort | Impact | Dépendances |
|:--------:|:-------|:------:|:------:|:------------|
| **P0** | `translation-quality-check.py` | 4h | Détecte 148 clés | - |
| **P0** | `darija-validator.py` | 2h | Authenticité ARY | - |
| **P0** | Corriger 148 clés tronquées | 8h | Production ready | Après P0 scripts |
| **P1** | MCP tool `translation_qa` | 4h | QA accessible | Après P0 |
| **P1** | CI/CD integration | 1h | Prévention | Après P0 scripts |
| **P2** | TTS pronunciation checker | 8h | Qualité vocale | - |

**Total Effort P0+P1:** 19h

---

## 10. FICHIERS DE RÉFÉRENCE

| Fichier | Lignes | Rôle |
|:--------|:------:|:-----|
| `scripts/sync-locales.py` | 383 | Structure sync |
| `scripts/health-check.cjs` | ~170 | File existence |
| `sensors/voice-quality-sensor.cjs` | 283 | API latency |
| `website/src/lib/i18n.js` | 204 | Runtime i18n |
| `mcp-server/src/index.ts` | ~1000 | 21 MCP tools |
| `website/src/locales/fr.json` | ~4000 | FR source (1471 keys) |
| `telephony/knowledge_base.json` | 97 | FR KB (16 sectors) |
| `telephony/knowledge_base_ary.json` | 107 | ARY KB (15 sectors) |

---

---

## 11. SESSION 248 - AUDIT DÉFAUTS QA SCRIPTS

### 11.1 Défaut Critique: `translation-quality-check.py`

**Problème:** Le seuil de 60% génère **481 FAUX POSITIFS**

**Test empirique (30/01/2026):**
```bash
python3 scripts/translation-quality-check.py
→ Found 481 potential truncation issues (< 60% of FR length)
```

**Exemples de FAUX POSITIFS (traductions légitimes):**

| Clé | FR | EN | Ratio | Verdict |
|:----|:---|:---|:-----:|:-------:|
| `dashboard.sidebar.overview` | Vue d'ensemble (14) | Overview (8) | 57% | ❌ FP |
| `dashboard.sidebar.users` | Utilisateurs (12) | Users (5) | 42% | ❌ FP |
| `features.widget.price` | Gratuit (7) | Free (4) | 57% | ❌ FP |
| `stats.uptime` | Disponibilité (13) | Uptime (6) | 46% | ❌ FP |

**Cause:** L'anglais est naturellement plus concis que le français. Le seuil de 60% est trop strict.

### 11.2 Script Fonctionnel: `darija-validator.py`

**Test empirique (30/01/2026):**
```bash
python3 scripts/darija-validator.py
→ Global Authenticity Score: 94
→ ✅ No MSA contamination detected
```

**Verdict:** ✅ FONCTIONNE CORRECTEMENT

### 11.3 Métriques i18n Actualisées

| Métrique | Valeur Documentée | Valeur Réelle | Écart |
|:---------|:-----------------:|:-------------:|:-----:|
| Leaf keys par locale | 1,471 | **1,530** | +59 |
| Total locales | 5 | 5 | ✅ |
| Pages avec i18n.js | 32 | 32 | ✅ |
| data-i18n attributes | ~2,000 | **2,016** | ✅ |

### 11.4 Actions Correctives Requises

| Action | Priorité | Effort | Impact |
|:-------|:--------:|:------:|:-------|
| Ajuster seuil truncation à 40% | P1 | 30min | Réduit FP de ~80% |
| Ajouter whitelist termes courts | P1 | 1h | Élimine FP connus |
| Documenter clés correctes | P2 | 2h | Évite faux alerts |

---

*Document màj: 30/01/2026 - Session 248*
*Méthodologie: Audit bottom-up, vérification fichier par fichier*
*Auteur: Claude Opus 4.5*
*Status: ⚠️ PARTIAL - QA script truncation a des faux positifs*
