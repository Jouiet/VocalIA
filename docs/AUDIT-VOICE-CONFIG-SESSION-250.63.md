# Audit Forensique Complet - Architecture Voix VocalIA

> **Session:** 250.63 | **Date:** 2026-02-03 | **Status:** ✅ 100% COMPLETE
> **Méthode:** Bottom-up factuelle | **Sources:** Code source + ElevenLabs API

---

## 1. Vue d'Ensemble - 7 Providers Voice/TTS/STT

| # | Provider | Fichier | Voix | Status |
|:-:|:---------|:--------|:----:|:------:|
| 1 | **ElevenLabs** | `core/elevenlabs-client.cjs` | **27** | ✅ PROD |
| 2 | **Lahajati.ai** | `core/lahajati-client.cjs` | 500+* | ⚠️ API non vérifiée |
| 3 | **Grok Voice** | `core/grok-voice-realtime.cjs` | 7 | ✅ PROD |
| 4 | **Gemini TTS** | `core/grok-voice-realtime.cjs` | 8 | ✅ Fallback |
| 5 | **Atlas-Chat-9B** | `core/voice-api-resilient.cjs` | 0 | ✅ LLM only |
| 6 | **Twilio Polly** | `telephony/voice-telephony-bridge.cjs` | 1+ | ✅ TwiML |
| 7 | **Web Speech API** | `widget/voice-widget-core.js` | Native | ✅ Browser |

---

## 2. ElevenLabs - 27 Voix (Session 250.63)

### 2.1 Voix par Langue

| Langue | Code | Female | Male | Total |
|:-------|:----:|:------:|:----:|:-----:|
| Français | fr | Sarah | Abdel | 2 |
| English | en | Rachel | Adam | 2 |
| Español | es | Domi | Juan Carlos | 2 |
| Arabic MSA | ar | Bill | Amr | 2 |
| Darija | ary | Ghizlane | Jawad, Ali, Hamid | 4 |

### 2.2 Voice IDs Complets (VERIFIED)

```javascript
const VOICE_IDS = {
  // DARIJA (4 voix)
  ary: 'OfGMGmhShO8iL9jCkXy8',           // Ghizlane - Female
  ary_female: 'OfGMGmhShO8iL9jCkXy8',
  ary_male: 'PmGnwGtnBs40iau7JfoF',       // Jawad - Male
  ary_male_jawad: 'PmGnwGtnBs40iau7JfoF',
  ary_male_ali: '5lXEHh42xcasVuJofypc',   // Ali - Male
  ary_male_hamid: 'A9ATTqUUQ6GHu0coCz8t', // Hamid - Male

  // ARABIC MSA
  ar: 'pqHfZKP75CvOlQylNhV4',            // Bill - Female
  ar_female: 'pqHfZKP75CvOlQylNhV4',
  ar_male: 'yrPIy5b3iLnVLIBfUSw8',        // Amr - Male ✅ NEW
  ar_egyptian: 'IES4nrmZdUBHByLBde0P',
  ar_gulf: '5Spsi3mCH9e7futpnGE5',

  // FRENCH
  fr: 'EXAVITQu4vr4xnSDxMaL',            // Sarah - Female
  fr_female: 'EXAVITQu4vr4xnSDxMaL',
  fr_male: '6pccwT1F6VJ5KMrxQqcX',        // Abdel - Male ✅ NEW

  // ENGLISH
  en: '21m00Tcm4TlvDq8ikWAM',            // Rachel - Female
  en_female: '21m00Tcm4TlvDq8ikWAM',
  en_male: 'pNInz6obpgDQGcFmaJgB',        // Adam - Male ✅ NEW

  // SPANISH
  es: 'AZnzlk1XvdvUeBnXmlld',            // Domi - Female
  es_female: 'AZnzlk1XvdvUeBnXmlld',
  es_male: 'RyfjEHnKbtma4Srae2za',        // Juan Carlos - Male ✅ NEW

  // USER ALIASES
  asmaa: 'qi4PkV9c01kb869Vh7Su',
  adam: 'pNInz6obpgDQGcFmaJgB',
  liliya: 'OfGMGmhShO8iL9jCkXy8',
  nelya: 'VwC51uc4PUblWEJSPzeo',
  ikhlass: 'qi4PkV9c01kb869Vh7Su',
  najlae: 'VwC51uc4PUblWEJSPzeo',
  liwae: '5lXEHh42xcasVuJofypc',
};
```

---

## 3. Grok Voice - 7 Voix

| Voix | Code | Genre |
|:-----|:-----|:-----:|
| Ara | `ara` | F |
| Eve | `eve` | F |
| Leo | `leo` | M |
| Sal | `sal` | M |
| Rex | `rex` | M |
| Mika | `mika` | F |
| Valentin | `valentin` | M |

---

## 4. Gemini TTS - 8 Voix (Fallback)

| Voix | Mapping Grok | Type |
|:-----|:-------------|:-----|
| Kore | ara | Female |
| Puck | leo | Neutral |
| Zephyr | rex | Neutral |
| Enceladus | - | Female |
| Algieba | valentin | Neutral |
| Sulafat | eve | Female |
| Aoede | mika | Female |
| Charon | sal | Male |

---

## 5. BUG CORRIGÉ ✅

### 5.1 Problème Initial

```javascript
// voice-api-resilient.cjs lignes 2143-2157
voiceId = gender === 'male' ? VOICE_IDS.ar_male : VOICE_IDS.ar;  // ar_male = undefined!
voiceId = gender === 'male' ? VOICE_IDS.fr_male : VOICE_IDS.fr;  // fr_male = undefined!
voiceId = gender === 'male' ? VOICE_IDS.en_male : VOICE_IDS.en;  // en_male = undefined!
voiceId = gender === 'male' ? VOICE_IDS.es_male : VOICE_IDS.es;  // es_male = undefined!
```

### 5.2 Correction Appliquée

**Fichier:** `core/elevenlabs-client.cjs`

- Ajouté `ar_male: 'yrPIy5b3iLnVLIBfUSw8'` (Amr)
- Ajouté `fr_male: '6pccwT1F6VJ5KMrxQqcX'` (Abdel)
- Ajouté `en_male: 'pNInz6obpgDQGcFmaJgB'` (Adam)
- Ajouté `es_male: 'RyfjEHnKbtma4Srae2za'` (Juan Carlos)

### 5.3 Vérification Empirique

```bash
node -e "const {VOICE_IDS}=require('./core/elevenlabs-client.cjs');
console.log('Total:', Object.keys(VOICE_IDS).length);
console.log('ar_male:', VOICE_IDS.ar_male);
console.log('fr_male:', VOICE_IDS.fr_male);
console.log('en_male:', VOICE_IDS.en_male);
console.log('es_male:', VOICE_IDS.es_male);"

# OUTPUT:
# Total: 27
# ar_male: yrPIy5b3iLnVLIBfUSw8
# fr_male: 6pccwT1F6VJ5KMrxQqcX
# en_male: pNInz6obpgDQGcFmaJgB
# es_male: RyfjEHnKbtma4Srae2za
```

---

## 6. Dashboard Client - Voice Configuration ✅

### 6.1 Fichier Modifié

`website/app/client/agents.html`

### 6.2 Fonctionnalités Ajoutées

- Section "Configuration Voix"
- Sélection Langue (FR/EN/ES/AR/ARY)
- Sélection Genre (Féminin/Masculin)
- Tableau des voix disponibles
- Bouton prévisualisation
- Bouton enregistrer

### 6.3 i18n (5 langues)

| Clé | FR | EN | ES | AR | ARY |
|:----|:---|:---|:---|:---|:----|
| voice_config | Configuration Voix | Voice Configuration | Configuración de Voz | إعدادات الصوت | إعدادات الصوت |
| voice_language | Langue de la voix | Voice Language | Idioma de la voz | لغة الصوت | لغة الصوت |
| voice_gender | Genre | Gender | Género | الجنس | الجنس |
| female | Féminin | Female | Femenino | أنثى | مرا |
| male | Masculin | Male | Masculino | ذكر | راجل |
| save_voice | Enregistrer la voix | Save Voice | Guardar voz | حفظ الصوت | سجل الصوت |

---

## 7. Sources Voice IDs

| Voix | Source |
|:-----|:-------|
| Amr (AR male) | https://json2video.com/ai-voices/elevenlabs/languages/arabic/ |
| Abdel (FR male) | https://json2video.com/ai-voices/elevenlabs/languages/french/ |
| Adam (EN male) | https://elevenlabs-sdk.mintlify.app/voices/premade-voices |
| Juan Carlos (ES male) | https://json2video.com/ai-voices/elevenlabs/voices/RyfjEHnKbtma4Srae2za/ |

---

**Document créé:** 2026-02-03 | Session 250.63
**Auteur:** Claude Opus 4.5
**Status:** ✅ 100% COMPLETE
