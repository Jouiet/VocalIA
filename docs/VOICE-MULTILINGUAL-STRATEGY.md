# VOICE MULTILINGUAL STRATEGY - 3A AUTOMATION

> **Version:** 3.2.0 | **Date:** 27/01/2026 | **Session:** 171 (Atlas-Chat-9B Integrated)
> **Statut:** COMPLET - Widget 5 Langues + Telephony Multilingue + **Services 3/3 HEALTHY** + **Atlas-Chat-9B Fallback**

---

## TABLE DES MATIÈRES

1. [Synthèse Exécutive](#1-synthèse-exécutive)
2. [État Actuel des Systèmes Voice](#2-état-actuel-des-systèmes-voice)
3. [Marchés Cibles et Exigences Linguistiques](#3-marchés-cibles-et-exigences-linguistiques)
4. [Benchmark Darija - Options Disponibles](#4-benchmark-darija---options-disponibles)
5. [Benchmark Providers Cloud](#5-benchmark-providers-cloud)
6. [Gap Analysis](#6-gap-analysis)
7. [Plan d'Action par Priorité](#7-plan-daction-par-priorité)
8. [Estimation Efforts et Coûts](#8-estimation-efforts-et-coûts)
9. [Risques et Dépendances](#9-risques-et-dépendances)
10. [Sources et Références](#10-sources-et-références)

---

## 1. SYNTHÈSE EXÉCUTIVE

### 1.1 Verdict Global (MIS À JOUR - Session 166septies)

| Aspect | État Actuel | Cible | Validation |
|--------|-------------|-------|------------|
| **Architecture** | ✅ **OPTIMISÉE** | Core + Lang JSON | Maintenable |
| **Langues Web Widget** | ✅ **FR, EN, ES, AR, ARY (5)** | 5 langues | **100% COMPLET** |
| **Langues Telephony** | ✅ **FR, EN, ES, AR, ARY (5)** | 5 langues | **100% COMPLET** |
| **TTS Darija** | ✅ **VALIDÉ** | ElevenLabs "Ghizlane" | 1.3s latence |
| **STT Darija** | ✅ **VALIDÉ** | ElevenLabs Scribe v1 | 707ms latence |
| **LLM Darija** | ✅ **VALIDÉ** | Grok-4-1 + **Atlas-Chat-9B fallback** | Génère Darija authentique (Session 170-171) |
| **Espagnol** | ✅ **DONE** | Web Speech API | Widget + JSON |
| **Arabe MSA** | ✅ **DONE** | Web Speech API (RTL) | Widget + JSON |
| **Darija (ARY)** | ✅ **DONE** | voice-ary.json | Widget + JSON (RTL) |

### 1.1bis Nouvelle Architecture (Session 166quinquies)

```
voice-assistant/
├── voice-widget-core.js    # Logique unique (600 lignes)
├── lang/
│   ├── voice-fr.json       # ✅ Traductions FR
│   ├── voice-en.json       # ✅ Traductions EN
│   ├── voice-es.json       # ✅ Traductions ES
│   ├── voice-ar.json       # ✅ Traductions AR (RTL)
│   └── voice-ary.json      # ✅ Traductions Darija (RTL) - Session 166septies
└── [LEGACY - à supprimer]
    ├── voice-widget.js         # FR standalone
    ├── voice-widget-en.js      # EN standalone
    ├── voice-widget-es.js      # ES standalone
    └── voice-widget-ar.js      # AR standalone
```

**Avantages:**

- Code unique = maintenabilité x4
- Ajout langue = 1 fichier JSON (~300 lignes)
- Auto-détection langue speaker (limitée FR/EN/ES/AR/Darija)
- RTL automatique pour AR

### 1.2 Validation Empirique Phase 0 (26/01/2026)

| Test | Provider | Input | Output | Latence |
|------|----------|-------|--------|---------|
| **TTS Darija** | ElevenLabs Ghizlane | "السلام عليكم، كيف داير؟" | Audio MP3 (34KB) | 1.3s |
| **STT Darija** | ElevenLabs Scribe v1 | Audio Darija | "السلام عليكم. كيف داير؟" | 707ms |
| **LLM Darija** | Grok-4-1-fast-reasoning | Question ventes | Réponse Darija 500+ chars | 10.3s |

### 1.3 Conclusion (Post-Validation)

**Le marché Maroc est DÉBLOQUÉ.** Stack Darija validé empiriquement:

- ✅ TTS: ElevenLabs "Ghizlane" (voix communautaire, fonctionne)
- ✅ STT: ElevenLabs Scribe v1 (supporte Maghrebi officiellement)
- ✅ LLM: Grok-4 (comprend et génère du Darija authentique)

**Découverte: SAWT IA (sawtia.ma)** = Sensei Prod (Maroc) a développé son propre ML Darija in-house.

### 1.4 Voice Services Status (Session 168quaterdecies - 27/01/2026)

| Service | Port | Status | Latence | Fix Appliqué |
|---------|------|--------|---------|--------------|
| Voice API | 3004 | ✅ HEALTHY | 23ms | RateLimiter bug (commit `1212695`) |
| Grok Realtime | 3007 | ✅ HEALTHY | 2ms | - |
| Telephony Bridge | 3009 | ✅ HEALTHY | 3ms | - |

**Commande de démarrage:**

```bash
node automations/agency/core/voice-api-resilient.cjs &
node automations/agency/core/grok-voice-realtime-proxy.cjs &
node automations/agency/core/voice-telephony-bridge.cjs &
```

**Vérification santé:**

```bash
node automations/agency/core/voice-quality-sensor.cjs --health
```

---

## 2. ÉTAT ACTUEL DES SYSTÈMES VOICE

### 2.1 Architecture Voice Systems

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE SYSTEMS - 3A AUTOMATION                         │
│                         (État Janvier 2026)                              │
└─────────────────────────────────────────────────────────────────────────┘

BROWSER LAYER (Web Speech API - GRATUIT)
├── voice-widget-core.js    [UNIFIED] → Charge lang/*.json
│   ├── lang/voice-fr.json  [FR] ✅ PRODUCTION
│   ├── lang/voice-en.json  [EN] ✅ PRODUCTION
│   ├── lang/voice-es.json  [ES] ✅ PRODUCTION
│   ├── lang/voice-ar.json  [AR] ✅ PRODUCTION (RTL)
│   └── lang/voice-ary.json [Darija] ✅ PRODUCTION (RTL) - S166septies
└── [LEGACY - voice-widget*.js] → À supprimer après migration

TEXT GENERATION API
└── voice-api-resilient.cjs (port 3004)
    └── Fallback: Grok → OpenAI → Gemini → Claude
    └── Langues: Non restreint (dépend du LLM)

REALTIME VOICE BRIDGE
└── grok-voice-realtime.cjs (port 3007)
    ├── Primary: Grok Realtime WebSocket (100+ langues)
    ├── Config: language: 'auto' (auto-detect)
    └── Fallback: Gemini TTS (FR/EN principalement)

TELEPHONY BRIDGE (PSTN) - Session 166sexies FIX
└── voice-telephony-bridge.cjs (port 3009)
    ├── Provider: Twilio (CREDENTIALS VIDES)
    ├── TwiML: ✅ MULTILINGUAL (5 langues) - TWIML_MESSAGES
    ├── RAG: ✅ MULTILINGUAL keywords (ES/AR/ARY ajoutés)
    └── Status: ⚠️ CREDENTIALS TWILIO MANQUANTS

MULTI-TENANT DIRECTOR - Session 166sexies FIX
└── voice-persona-injector.cjs
    ├── 7 Personas configurés
    ├── Langue par défaut: VOICE_CONFIG.defaultLanguage
    └── ENV: VOICE_DEFAULT_LANGUAGE configurable
```

### 2.2 Scripts Voice Inventoriés (7 fichiers - 5,809 lignes)

| Script | Lignes | Port | Langues Hardcodées | Status |
|--------|--------|------|-------------------|--------|
| `grok-voice-realtime.cjs` | ~700 | 3007 | `language: 'auto'` | ✅ Flexible |
| `voice-telephony-bridge.cjs` | 2,320 | 3009 | `language="fr-FR"` | ⚠️ FR ONLY |
| `voice-api-resilient.cjs` | 1,209 | 3004 | Non restreint | ✅ Flexible |
| `voice-widget-templates.cjs` | 800 | - | `['fr', 'en']` default | ⚠️ 2 langues |
| `voice-persona-injector.cjs` | 517 | - | `language: 'fr'` default | ⚠️ FR default |
| `voice-agent-b2b.cjs` | 719 | - | Non spécifié | - |
| `voice-quality-sensor.cjs` | 244 | - | N/A (monitoring) | ✅ |

### 2.3 Providers Voice Intégrés

| Provider | Intégré | TTS | STT | Realtime | Langues |
|----------|---------|-----|-----|----------|---------|
| **Grok Voice (xAI)** | ✅ Production | ✅ | ✅ | ✅ WebSocket | 100+ |
| **Gemini TTS** | ✅ Fallback | ✅ | ❌ | ❌ | ~30 |
| **ElevenLabs** | ⚠️ Credentials vides | ✅ | ✅ | ❌ | 32+ |
| **Twilio** | ⚠️ Credentials vides | ✅ | ✅ | ❌ | ~20 |
| **Web Speech API** | ✅ Browser | ✅ | ✅ | ❌ | Navigateur |

### 2.4 Knowledge Bases

| Fichier | Chemin | Langues | Statut |
|---------|--------|---------|--------|
| `knowledge_base.json` | `automations/agency/core/` | FR (119 automations) | ✅ **HYBRID V3.0** |
| `knowledge_base_ary.json` | `automations/agency/core/` | ARY (Darija) | ✅ **HYBRID V3.0** |
| `dialplus-knowledge-base.json` | `automations/shared-components/` | FR | ✅ |

### 2.5 Credentials Status (Voice-Related)

| Credential | Variable | Status | Impact |
|------------|----------|--------|--------|
| Grok API | `XAI_API_KEY` | ✅ SET | Voice realtime OK |
| Gemini API | `GEMINI_API_KEY` | ✅ SET | TTS fallback OK |
| ElevenLabs | `ELEVENLABS_API_KEY` | ❌ VIDE | Darija TTS bloqué |
| Twilio Account | `TWILIO_ACCOUNT_SID` | ❌ VIDE | PSTN bloqué |
| Twilio Token | `TWILIO_AUTH_TOKEN` | ❌ VIDE | PSTN bloqué |
| Twilio Phone | `TWILIO_PHONE_NUMBER` | ❌ VIDE | PSTN bloqué |

---

## 3. MARCHÉS CIBLES ET EXIGENCES LINGUISTIQUES

### 3.1 Définition des Marchés

| Marché | Pays | Langue Site | Devise | Langues Voice Requises |
|--------|------|-------------|--------|------------------------|
| **Maroc** | Maroc, Algérie, Tunisie | Français | MAD | FR + **Darija** + Arabe MSA |
| **Europe** | France, Belgique, Suisse, etc. | Français | EUR (€) | FR + ES (optionnel) |
| **International** | Reste du monde | Anglais | USD ($) | EN + ES |

### 3.2 Logique de Détection (Site Web)

```
IF (IP in [Maroc, Algérie, Tunisie])
  → Langue: Français
  → Devise: MAD (si Maroc) / DZD / TND
  → Voice: FR + Darija toggle

ELSE IF (IP in Europe)
  → Langue: Français
  → Devise: EUR (€)
  → Voice: FR (+ ES si Espagne)

ELSE
  → Langue: Anglais
  → Devise: USD ($)
  → Voice: EN (+ ES si LATAM)
```

### 3.3 Matrice Langues × Marchés

| Langue | Maroc | Europe | International | Priorité |
|--------|-------|--------|---------------|----------|
| **Français** | ✅ Principal | ✅ Principal | ❌ | P0 - FAIT |
| **Anglais** | ❌ | ❌ | ✅ Principal | P0 - FAIT |
| **Espagnol** | ❌ | ⚠️ Espagne | ⚠️ LATAM | P1 - TRIVIAL |
| **Arabe MSA** | ⚠️ Formel | ❌ | ❌ | P2 - TRIVIAL |
| **Darija** | ✅ **CRITIQUE** | ❌ | ❌ | P0 - **BLOQUANT** |

---

## 4. BENCHMARK DARIJA - OPTIONS DISPONIBLES

### 4.1 TTS (Text-to-Speech) Darija

#### ⚠️ CORRECTION FACTUELLE (26/01/2026)

**ElevenLabs NE SUPPORTE PAS officiellement le Darija en TTS.**

Documentation officielle vérifiée:

- [ElevenLabs Models](https://elevenlabs.io/docs/overview/models): Liste Arabic (ara) générique + Arabic (Saudi Arabia, UAE)
- **Aucune mention de ar-MA, Moroccan Arabic, ou Darija dans la doc officielle**

#### 4.1.1 Solutions Disponibles

| Solution | Type | Officiel | Qualité | Prix | Recommandation |
|----------|------|----------|---------|------|----------------|
| **[Ghizlane](https://json2video.com/ai-voices/elevenlabs/voices/OfGMGmhShO8iL9jCkXy8/)** | Voice Library | ❌ Communautaire | ⭐⭐⭐ | ElevenLabs plan | **À TESTER** |
| [SpeechGen.io ar-MA](https://speechgen.io/en/tts-arabic-morocco/) | Cloud | ❓ | ⭐⭐ | Variable | Alternative |
| [voices.ma](https://voices.ma/) | **HUMAIN** | N/A | ⭐⭐⭐⭐⭐ | Custom 24h+ | Branding only |
| [sawtia.ma](https://sawtia.ma/) | Cloud | ❓ | ❓ Non testé | ❓ | À tester |

**Voix Ghizlane - Détails Importants:**

- Voice ID: `OfGMGmhShO8iL9jCkXy8`
- Type: **Community Voice** (créée par utilisateur, PAS officielle ElevenLabs)
- Description: "Natural, dynamic, expressive voice in Darija (Moroccan Arabic)"
- ⚠️ Risques: Qualité non garantie, peut être retirée sans préavis

#### 4.1.2 Solutions Open-Source (Self-Hosted)

| Solution | Modèle | Qualité | Effort Deploy | Latence | Lien |
|----------|--------|---------|---------------|---------|------|
| **[DarijaTTS-v0.1-500M](https://model.aibase.com/models/details/1915692888522121218)** | OuteTTS fine-tuned | ⭐⭐ | HIGH (GPU) | ~200ms | HuggingFace |
| [SpeechT5 Darija](https://huggingface.co/spaces/HAMMALE/speecht5-darija) | SpeechT5 | ⭐⭐ | MEDIUM | ~300ms | HF Space |
| [FastSpeech 2 Fine-tuned](https://link.springer.com/chapter/10.1007/978-3-032-07718-9_11) | FastSpeech 2 | ⭐⭐⭐ | HIGH | ~150ms | Académique |

#### 4.1.3 Décision TTS Darija

**⚠️ SITUATION COMPLEXE - Pas de solution officielle**

| Option | Avantages | Inconvénients | Recommandation |
|--------|-----------|---------------|----------------|
| **Ghizlane (communautaire)** | API prête, facile | Non officiel, risque retrait | **TESTER D'ABORD** |
| **DarijaTTS self-hosted** | Contrôle total | GPU requis, effort élevé | Backup |
| **Grok Voice auto-detect** | Déjà intégré | Non testé Darija | **TESTER D'ABORD** |

**Action requise Phase 0:** Tester Ghizlane + Grok avant de choisir.

### 4.2 STT (Speech-to-Text) Darija

#### 4.2.1 Solutions Commerciales

| Solution | Type | WER Estimé | API | Prix | Lien |
|----------|------|------------|-----|------|------|
| **[ElevenLabs Scribe](https://elevenlabs.io/speech-to-text/arabic)** | Cloud | ❓ Non publié | ✅ REST | Inclus plan | ✅ **MAGHREBI OFFICIEL** |
| [AssemblyAI](https://www.assemblyai.com/) | Cloud | ❓ | ✅ REST | $0.37/h | Arabe mais pas Darija |

**Note importante:** ElevenLabs Scribe supporte OFFICIELLEMENT les accents Maghrebi (Moroccan, Algerian, Tunisian) pour le STT. C'est documenté: [ElevenLabs Arabic STT](https://elevenlabs.io/speech-to-text/arabic)

#### 4.2.2 Solutions Open-Source

| Solution | Modèle Base | WER Darija | Effort | Lien |
|----------|-------------|------------|--------|------|
| **[Whisper Large v3 Turbo Darija](https://huggingface.co/anaszil/whisper-large-v3-turbo-darija)** | Whisper Large v3 | ~30%* | HIGH | LoRA adapter |
| [DVoice Darija](https://huggingface.co/speechbrain/asr-wav2vec2-dvoice-darija) | wav2vec2-large-xlsr-53 | ~50% | HIGH | SpeechBrain |
| [Whisper-darija-finetuned](https://huggingface.co/TaloCreations/whisper-darija-finetuned) | Whisper | ~50% | MEDIUM | 10 epochs |
| [Seamless M4T Darija](https://huggingface.co/AnasAber/seamless-darija-eng) | SeamlessM4T v2 | ⭐⭐⭐ | HIGH | Darija↔EN |

*WER estimé après fine-tuning, baseline Whisper ~70%+ sur Darija

#### 4.2.3 Décision STT Darija

**Choix: ElevenLabs Scribe**

- ✅ Support Maghrebi OFFICIEL (Moroccan, Algerian, Tunisian)
- Avantage: Même provider que TTS, billing unifié
- Backup: Whisper fine-tuned self-hosted

#### 4.2.4 ElevenLabs MCP Integration (Bonus)

**Source:** [ElevenLabs MCP Docs](https://elevenlabs.io/docs/agents-platform/customization/tools/mcp)

ElevenLabs supporte Model Context Protocol (MCP):

| Feature | Description |
|---------|-------------|
| **Protocol** | SSE + HTTP streamable |
| **Intégration** | Zapier MCP → 100s de services tiers |
| **Approval Modes** | Always Ask, Fine-Grained, No Approval |
| **Restrictions** | Pas dispo pour Zero Retention / HIPAA |

**Potentiel:** Connecter ElevenLabs Agents à nos automations via MCP.

### 4.3 LLM avec Compréhension Darija

| Modèle | Provider | Darija Support | Params | API | Recommandation |
|--------|----------|----------------|--------|-----|----------------|
| **[Mistral Saba](https://mistral.ai/news/mistral-saba)** | Mistral AI | ⭐⭐⭐⭐ Officiel | 24B | ✅ API | À tester |
| **[Atlas-Chat-9B](https://huggingface.co/MBZUAI-Paris/Atlas-Chat-9B)** | MBZUAI | ⭐⭐⭐⭐ Spécialisé | 9B | ✅ HF | **✅ INTÉGRÉ Session 170-171** |
| [Atlas-Chat-2B](https://huggingface.co/MBZUAI-Paris/Atlas-Chat-2B) | MBZUAI | ⭐⭐⭐ | 2B | ✅ HF | Edge/Mobile |
| [DarijaBERT](https://huggingface.co/SI2M-Lab/DarijaBERT) | SI2M-Lab | ⭐⭐⭐ NLU | BERT | ✅ HF | Classification |
| Grok-4 | xAI | ⭐⭐⭐ Testé | ❓ | ✅ API | **✅ PRIMARY + Atlas fallback** |
| GPT-4o | OpenAI | ⭐⭐ Générique | ❓ | ✅ API | Non spécialisé |

### 4.4 Partenariat Mistral × Maroc (Annoncé Janvier 2026)

**Source:** [Morocco World News](https://www.moroccoworldnews.com/2026/01/274777/morocco-moves-toward-local-ai-with-darija-amazigh-language-models), [Ecofin Agency](https://www.ecofinagency.com/news-digital/1601-51978-ai-made-in-morocco-mistral-ai-partners-with-mtnra-on-cultural-linguistic-ai-models)

| Aspect | Information |
|--------|-------------|
| **Partenaires** | Mistral AI + MTNRA (Maroc) |
| **Langues ciblées** | Darija + Amazigh (Tamazight) |
| **Lab créé** | "Mistral AI & MTNRA" (Casablanca/Rabat) |
| **Annonce voice** | "Voice-based systems à terme" (Arthur Mensch, CEO) |
| **Statut** | **ANNONCÉ, PAS ENCORE DISPONIBLE** |
| **Timeline** | Aucune date officielle |

**Verdict:** Ne pas compter sur ce partenariat pour la roadmap immédiate.

---

## 5. BENCHMARK PROVIDERS CLOUD

### 5.1 TTS Cloud - Support ar-MA (Darija)

| Provider | ar-MA (Darija) | ar-SA (MSA) | Notes | Source |
|----------|----------------|-------------|-------|--------|
| **ElevenLabs** | ❌ **NON OFFICIEL** | ✅ Multiple | "Ghizlane" = voix communautaire | [Docs](https://elevenlabs.io/docs/overview/models) |
| Google Cloud TTS | ❌ NON | ✅ ar-XA | MSA uniquement | [Forum](https://discuss.ai.google.dev/t/how-to-achieve-different-arabic-dialcets-using-chirp3-tts/109273) |
| Azure Speech | ❌ NON | ✅ ar-SA, ar-EG, ar-LB | Pas Maghrebi | [Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) |
| Amazon Polly | ❌ NON | ⚠️ Gulf focus | - | AWS Docs |
| **Grok Voice** | ❓ NON TESTÉ | ✅ 100+ langues | Auto-detect, à tester | [Docs](https://docs.x.ai/docs/guides/voice) |

**⚠️ Conclusion TTS Darija:** AUCUN provider cloud ne supporte officiellement le Darija en TTS.

### 5.2 STT Cloud - Support ar-MA (Darija)

| Provider | ar-MA (Darija) | ar-SA (MSA) | Notes | Source |
|----------|----------------|-------------|-------|--------|
| **ElevenLabs Scribe** | ✅ Maghrebi | ✅ | Accent detection | [Docs](https://elevenlabs.io/speech-to-text/arabic) |
| Google Cloud STT | ❓ Non confirmé | ✅ | Vérifier docs | [Docs](https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages) |
| Azure Speech | ❌ NON | ✅ | Pas Maghrebi | Azure Docs |
| **Meta Seamless** | ✅ Moroccan | ✅ | Open-source | [Paper](https://arxiv.org/abs/2308.11596) |
| OpenAI Whisper | ⚠️ ~50-70% WER | ✅ | Baseline mauvais | [HF Discussion](https://github.com/openai/whisper/discussions/466) |

### 5.3 Grok Voice - Langues Supportées (Vérifié)

**Source:** [xAI Docs](https://docs.x.ai/docs/guides/voice), [xAI Announcement](https://x.ai/news/grok-voice-agent-api)

| Feature | Valeur |
|---------|--------|
| Langues totales | 100+ |
| Auto-detection | ✅ Instantané |
| Switch mid-conversation | ✅ |
| Arabic (arabe standard) | ✅ Confirmé |
| **Darija spécifique** | ❓ **NON TESTÉ** |
| Espagnol | ✅ Confirmé |
| Français | ✅ Confirmé |
| Prix | $0.05/min |

**Action requise:** Tester Grok Voice avec input audio Darija pour valider.

---

## 6. GAP ANALYSIS

### 6.1 Langues Manquantes - Détail

| Langue | TTS Code | STT Code | LLM | Widget | Knowledge | Telephony |
|--------|----------|----------|-----|--------|-----------|-----------|
| **Français** | ✅ | ✅ | ✅ | ✅ | ✅ 33 keys | ✅ fr-FR |
| **Anglais** | ✅ | ✅ | ✅ | ✅ | ✅ 33 keys | ❌ Manque |
| **Espagnol** | ❌ | ❌ | ✅ Grok | ❌ | ❌ | ❌ |
| **Arabe MSA** | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| **Darija** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Fichiers à Créer

```
FICHIERS MANQUANTS:

Widget Layer (landing-page-hostinger/voice-assistant/)
├── voice-widget-es.js           # Widget Espagnol
├── voice-widget-es.min.js       # Minifié
├── voice-widget-ar.js           # Widget Arabe MSA
├── voice-widget-ar.min.js       # Minifié
├── voice-widget-darija.js       # Widget Darija (ElevenLabs)
├── voice-widget-darija.min.js   # Minifié
├── knowledge-es.json            # KB Espagnol (33+ keys)
├── knowledge-ar.json            # KB Arabe MSA (33+ keys)
└── knowledge-darija.json        # KB Darija (33+ keys)

Core Scripts (automations/agency/core/)
├── elevenlabs-darija-client.cjs # Client ElevenLabs Darija
└── darija-voice-bridge.cjs      # Bridge Darija TTS/STT

Config Updates (existants à modifier):
├── voice-widget-templates.cjs   # Ajouter ES, AR, Darija presets
├── voice-persona-injector.cjs   # Ajouter personas multilingues
└── voice-telephony-bridge.cjs   # Ajouter TwiML ES, EN
```

### 6.3 Modifications Code Requises

#### 6.3.1 voice-telephony-bridge.cjs

```xml
<!-- ACTUEL (ligne 1235) -->
<Say language="fr-FR">Je vous transfère...</Say>

<!-- REQUIS -->
<Say language="{{DETECTED_LANGUAGE}}">{{LOCALIZED_MESSAGE}}</Say>

Langues à ajouter:
- es-ES (Espagnol Espagne)
- es-MX (Espagnol Mexique)
- en-US (Anglais US)
- en-GB (Anglais UK)
- ar-SA (Arabe MSA) ← Twilio supporte
- Darija ← Twilio NE SUPPORTE PAS (bridge ElevenLabs requis)
```

#### 6.3.2 voice-widget-templates.cjs

```javascript
// ACTUEL (ligne 419)
languages = ['fr'],

// REQUIS
languages = ['fr', 'en', 'es', 'ar', 'darija'],

// Ajouter presets
INDUSTRY_PRESETS.ecommerce.prompts.TEXT_ES = '...'
INDUSTRY_PRESETS.ecommerce.prompts.TEXT_AR = '...'
INDUSTRY_PRESETS.ecommerce.prompts.TEXT_DARIJA = '...'
```

#### 6.3.3 grok-voice-realtime.cjs

```javascript
// ACTUEL (ligne 70)
language: 'auto',

// REQUIS - Ajouter mapping explicite pour fallbacks
const LANGUAGE_FALLBACKS = {
  'darija': 'ar', // Fallback vers arabe si Grok ne comprend pas
  'ar-MA': 'ar',
  'es-MX': 'es',
};
```

---

## 7. PLAN D'ACTION PAR PRIORITÉ

### 7.1 Phase 0: Validation (1-2 jours) - PRÉREQUIS

| # | Tâche | Objectif | Effort | Dépendance |
|---|-------|----------|--------|------------|
| 0.1 | Tester Grok Voice avec audio Darija | Valider si auto-detect fonctionne | 2h | XAI_API_KEY ✅ |
| 0.2 | Créer compte ElevenLabs test | Valider voix "Ghizlane" | 1h | Carte bancaire |
| 0.3 | Tester ElevenLabs Scribe Darija | Valider STT qualité | 2h | 0.2 |
| 0.4 | Décision Go/No-Go | Choisir stack final | 1h | 0.1, 0.2, 0.3 |

**Livrable:** Document de décision avec stack validé

### 7.2 Phase 1: Espagnol (3-5 jours) - TRIVIAL

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 1.1 | Créer knowledge-es.json | 1 fichier | 4h |
| 1.2 | Créer voice-widget-es.js | 1 fichier | 4h |
| 1.3 | Ajouter ES à voice-widget-templates.cjs | Modification | 2h |
| 1.4 | Ajouter es-ES/es-MX à TwiML | voice-telephony-bridge.cjs | 2h |
| 1.5 | Tests E2E | - | 4h |

**Livrable:** Widget Espagnol fonctionnel

### 7.3 Phase 2: Arabe MSA (3-5 jours) - TRIVIAL

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 2.1 | Créer knowledge-ar.json | 1 fichier | 4h |
| 2.2 | Créer voice-widget-ar.js | 1 fichier (RTL!) | 6h |
| 2.3 | Ajouter AR à voice-widget-templates.cjs | Modification | 2h |
| 2.4 | Ajouter ar-SA à TwiML | voice-telephony-bridge.cjs | 2h |
| 2.5 | Tests E2E | - | 4h |

**Note:** RTL (Right-to-Left) nécessite adaptation CSS.

### 7.4 Phase 3: Darija (10-15 jours) - COMPLEXE

| # | Tâche | Fichiers | Effort | Dépendance |
|---|-------|----------|--------|------------|
| 3.1 | Intégrer ElevenLabs API | elevenlabs-darija-client.cjs | 8h | 0.2 |
| 3.2 | Créer knowledge-darija.json | 1 fichier | 8h | Traducteur natif |
| 3.3 | Créer voice-widget-darija.js | 1 fichier | 8h | 3.1 |
| 3.4 | Bridge Darija pour telephony | darija-voice-bridge.cjs | 16h | 3.1 |
| 3.5 | Tests avec locuteurs natifs | - | 8h | 3.2, 3.3 |
| 3.6 | Optimisation latence | - | 8h | 3.4 |

**Livrable:** Voice assistant Darija fonctionnel (web + phone)

### 7.5 Phase 4: LLM Darija (5-8 jours) - OPTIONNEL

| # | Tâche | Objectif | Effort |
|---|-------|----------|--------|
| 4.1 | Intégrer Mistral Saba API | LLM spécialisé Darija | 8h |
| 4.2 | A/B test Grok vs Mistral Saba | Comparer qualité | 8h |
| 4.3 | Décision LLM final | Choisir provider | 2h |
| 4.4 | Fallback chain update | voice-api-resilient.cjs | 4h |

---

## 8. ESTIMATION EFFORTS ET COÛTS

### 8.1 Effort Total

| Phase | Tâches | Effort (heures) | Équivalent jours |
|-------|--------|-----------------|------------------|
| Phase 0 - Validation | 4 | 6h | 1j |
| Phase 1 - Espagnol | 5 | 16h | 2j |
| Phase 2 - Arabe MSA | 5 | 18h | 2.5j |
| Phase 3 - Darija | 6 | 56h | 7j |
| Phase 4 - LLM Darija | 4 | 22h | 3j |
| **TOTAL** | 24 | **118h** | **~15j** |

### 8.2 Coûts Récurrents (Mensuels)

| Service | Plan | Prix/mois | Usage estimé |
|---------|------|-----------|--------------|
| ElevenLabs | Creator | $22/mo | 100k chars/mo |
| ElevenLabs | Pro (si volume) | $99/mo | 500k chars/mo |
| Mistral Saba API | Pay-as-you-go | ~$20/mo | 1M tokens |
| Grok Voice | Pay-as-you-go | ~$50/mo | 1000 min |
| **TOTAL (baseline)** | - | **~$92/mo** | - |
| **TOTAL (volume)** | - | **~$169/mo** | - |

### 8.3 Coûts One-Time

| Item | Coût |
|------|------|
| Traduction knowledge base (3 langues × 33 keys) | ~$200-500 |
| Tests avec locuteurs natifs Darija | ~$200-300 |
| GPU pour self-hosted (si choisi) | ~$500-1000 |

---

## 9. RISQUES ET DÉPENDANCES

### 9.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Qualité TTS Darija insuffisante | MEDIUM | HIGH | Tester avant commit |
| WER STT Darija > 30% | HIGH | HIGH | Whisper fine-tuned backup |
| Grok Voice ne comprend pas Darija | MEDIUM | MEDIUM | Fallback ElevenLabs |
| Latence ElevenLabs > 200ms | LOW | MEDIUM | Edge caching |
| Twilio ne supporte pas Darija | **CONFIRMÉ** | HIGH | Bridge ElevenLabs |

### 9.2 Dépendances Externes

| Dépendance | Type | Status | Risque |
|------------|------|--------|--------|
| ElevenLabs API | Commerciale | Stable | LOW |
| Mistral Saba API | Commerciale | Nouveau (Feb 2025) | MEDIUM |
| Twilio | Commerciale | Stable | LOW |
| Locuteurs natifs Darija | Humaine | À trouver | MEDIUM |
| Mistral × Maroc (futur) | Partenariat | Non disponible | N/A |

### 9.3 Dépendances Internes

| Dépendance | Status | Bloquant pour |
|------------|--------|---------------|
| `ELEVENLABS_API_KEY` | ❌ VIDE | Phase 3 |
| `TWILIO_*` credentials | ❌ VIDES | Telephony toutes phases |
| Traductions Darija | ❌ MANQUANT | Phase 3 |
| Tests locuteurs natifs | ❌ MANQUANT | Phase 3 validation |

---

## 10. SOURCES ET RÉFÉRENCES

### 10.1 Documentation Officielle

| Provider | Lien | Dernière vérification |
|----------|------|----------------------|
| xAI Grok Voice | <https://docs.x.ai/docs/guides/voice> | 26/01/2026 |
| ElevenLabs Languages | <https://help.elevenlabs.io/hc/en-us/articles/13313366263441> | 26/01/2026 |
| ElevenLabs Scribe | <https://elevenlabs.io/speech-to-text/arabic> | 26/01/2026 |
| Mistral Saba | <https://mistral.ai/news/mistral-saba> | 26/01/2026 |
| Google Cloud TTS | <https://cloud.google.com/text-to-speech/docs/list-voices-and-types> | 26/01/2026 |
| Azure Speech | <https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support> | 26/01/2026 |
| Meta SeamlessM4T | <https://github.com/facebookresearch/seamless_communication> | 26/01/2026 |

### 10.2 Modèles Open-Source Darija

| Modèle | Type | Lien HuggingFace |
|--------|------|------------------|
| DVoice Darija | STT | <https://huggingface.co/speechbrain/asr-wav2vec2-dvoice-darija> |
| Whisper Large v3 Turbo Darija | STT | <https://huggingface.co/anaszil/whisper-large-v3-turbo-darija> |
| Whisper Darija Finetuned | STT | <https://huggingface.co/TaloCreations/whisper-darija-finetuned> |
| Seamless Darija-English | Translation | <https://huggingface.co/AnasAber/seamless-darija-eng> |
| Atlas-Chat-2B | LLM | <https://huggingface.co/MBZUAI-Paris/Atlas-Chat-2B> |
| DarijaBERT | NLU | <https://huggingface.co/SI2M-Lab/DarijaBERT> |
| DarijaTTS-v0.1-500M | TTS | <https://model.aibase.com/models/details/1915692888522121218> |
| SpeechT5 Darija | TTS | <https://huggingface.co/spaces/HAMMALE/speecht5-darija> |
| Moroccan Darija Wiki Audio | Dataset | <https://huggingface.co/datasets/atlasia/Moroccan-Darija-Wiki-Audio-Dataset> |
| Moroccan Darija Datasets List | Datasets | <https://github.com/nainiayoub/moroccan-darija-datasets> |

### 10.3 Recherche Académique

| Paper | Année | Lien |
|-------|-------|------|
| Moroccan Darija TTS (FastSpeech 2) | 2025 | <https://link.springer.com/chapter/10.1007/978-3-032-07718-9_11> |
| DARIJA-C Corpus | 2023 | <https://ieeexplore.ieee.org/document/10085164/> |
| Darija ASR Survey | 2021 | <https://ieeexplore.ieee.org/document/9520690/> |
| SeamlessM4T | 2023 | <https://arxiv.org/abs/2308.11596> |
| Habibi: Arabic Dialect Speech Synthesis | 2025 | <https://arxiv.org/html/2601.13802> |
| Whisper Arabic N-Shot Benchmarking | 2023 | <https://www.isca-archive.org/interspeech_2023/talafha23_interspeech.pdf> |
| Context-Aware Whisper Arabic | 2025 | <https://arxiv.org/abs/2511.18774> |
| Darija→Classical Arabic Speech Translation | 2025 | <https://ieeexplore.ieee.org/document/11009145/> |

### 10.4 Actualités Partenariat Mistral × Maroc

| Source | Date | Lien |
|--------|------|------|
| Morocco World News | Jan 2026 | <https://www.moroccoworldnews.com/2026/01/274777/morocco-moves-toward-local-ai-with-darija-amazigh-language-models> |
| Ecofin Agency | Jan 2026 | <https://www.ecofinagency.com/news-digital/1601-51978-ai-made-in-morocco-mistral-ai-partners-with-mtnra-on-cultural-linguistic-ai-models> |
| TechCrunch (Mistral Saba) | Feb 2025 | <https://techcrunch.com/2025/02/17/mistral-releases-regional-model-focused-on-arabic-language-and-culture/> |
| Medium (Darija SLMs) | Sep 2025 | <https://medium.com/@ahmed.hafdi.contact/why-small-language-models-in-darija-are-the-future-of-moroccan-ai-fa8a433bb173> |

### 10.5 Services Commerciaux Darija

| Service | Type | Lien |
|---------|------|------|
| ElevenLabs Ghizlane Voice | TTS | <https://json2video.com/ai-voices/elevenlabs/voices/OfGMGmhShO8iL9jCkXy8/> |
| SpeechGen ar-MA | TTS | <https://speechgen.io/en/tts-arabic-morocco/> |
| voices.ma | Human VO | <https://voices.ma/> |
| sawtia.ma | TTS (?) | <https://sawtia.ma/> |
| TranslatorDarija | Translation | <https://translatordarija.com/> |

---

## ANNEXE A: GLOSSAIRE

| Terme | Définition |
|-------|------------|
| **Darija** | Dialecte arabe marocain, distinct de l'arabe standard (MSA) |
| **MSA** | Modern Standard Arabic - Arabe littéraire/formel |
| **TTS** | Text-to-Speech - Synthèse vocale |
| **STT** | Speech-to-Text - Reconnaissance vocale |
| **WER** | Word Error Rate - Taux d'erreur par mot (STT) |
| **RTL** | Right-to-Left - Direction d'écriture arabe |
| **PSTN** | Public Switched Telephone Network - Téléphonie classique |
| **TwiML** | Twilio Markup Language - XML pour appels Twilio |

---

## ANNEXE B: CHECKLIST PRÉ-IMPLÉMENTATION

```
PHASE 0 - VALIDATION (OBLIGATOIRE AVANT TOUT)
□ XAI_API_KEY configurée
□ Test Grok Voice avec audio Darija effectué
□ Compte ElevenLabs créé
□ Voix "Ghizlane" testée
□ ElevenLabs Scribe Darija testé
□ Document de décision rédigé
□ Budget approuvé

PHASE 1 - ESPAGNOL
□ knowledge-es.json créé (33+ clés)
□ voice-widget-es.js créé et testé
□ voice-widget-templates.cjs mis à jour
□ TwiML es-ES/es-MX ajouté
□ Tests E2E passés

PHASE 2 - ARABE MSA
□ knowledge-ar.json créé (33+ clés)
□ CSS RTL ajouté
□ voice-widget-ar.js créé et testé
□ voice-widget-templates.cjs mis à jour
□ TwiML ar-SA ajouté
□ Tests E2E passés

PHASE 3 - DARIJA
□ ELEVENLABS_API_KEY configurée
□ elevenlabs-darija-client.cjs créé
□ knowledge-darija.json créé (validation native)
□ voice-widget-darija.js créé et testé
□ darija-voice-bridge.cjs créé (telephony)
□ Tests avec locuteurs natifs passés
□ Latence < 200ms validée
```

---

**Document créé:** 26/01/2026 - Session 166bis
**Auteur:** Claude Code (Audit automatisé)
**Statut:** RECHERCHE ET DOCUMENTATION - Pas d'implémentation
**Prochaine action:** Validation Phase 0 (tests providers)
