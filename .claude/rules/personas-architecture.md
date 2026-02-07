# Architecture Personas - NE PAS MODIFIER

## Structure Duale (INTENTIONNELLE)

Le fichier `personas/voice-persona-injector.cjs` contient **DEUX structures** par persona.
C'est **INTENTIONNEL** et **aligné avec les pratiques industry**.

### 1. SYSTEM_PROMPTS (ligne 42-779)

```javascript
SYSTEM_PROMPTS = {
  AGENCY: {
    fr: "prompt en français...",
    en: "prompt in english...",
    es: "prompt en español...",
    ar: "البرومبت بالعربية...",
    ary: "البرومبت بالدارجة..."
  },
  // ... 38 personas × 5 langues = 200 prompts
}
```

**Rôle:** Prompts MULTILINGUES (source primaire)

### 2. PERSONAS (ligne 781-5010)

```javascript
PERSONAS = {
  AGENCY: {
    id: "agency_v3",
    name: "VocalIA Voice AI Consultant",
    voice: "ara",
    personality_traits: [...],
    background: "...",
    tone_guidelines: {...},
    forbidden_behaviors: [...],
    escalation_triggers: [...],
    example_dialogues: [...],
    complaint_scenarios: [...],
    systemPrompt: "fallback EN only..."
  },
  // ... 38 personas
}
```

**Rôle:** Metadata + fallback systemPrompt (EN)

## Flux d'Exécution

```
buildFullInstructions() {
  1. basePrompt = PERSONAS[key].systemPrompt  // Fallback EN
  2. IF SYSTEM_PROMPTS[key][lang] exists:
     → basePrompt = SYSTEM_PROMPTS[key][lang]  // OVERRIDE multilingue
}
```

## POURQUOI CE N'EST PAS UNE DUPLICATION

| Aspect | SYSTEM_PROMPTS | PERSONAS |
|--------|----------------|----------|
| Contenu | Texte prompt | Metadata |
| Langues | 5 (fr,en,es,ar,ary) | 1 (EN fallback) |
| Usage | Prompt injection | Config + fallback |

## Sources Industry (Session 250.31)

- [Character.AI](https://blog.character.ai/prompt-design-at-character-ai/) - Sépare prompts/données
- [NVIDIA PersonaPlex](https://huggingface.co/nvidia/personaplex-7b-v1) - 2 prompts (voice + text)
- [XPersona](https://huggingface.co/papers?q=PERSONA-CHAT) - Single model multilingue

## RÈGLE STRICTE

**NE PAS "corriger" cette architecture en supprimant PERSONAS.systemPrompt.**
C'est un fallback NÉCESSAIRE pour les cas où SYSTEM_PROMPTS n'a pas la langue demandée.

Documenté: Session 250.31 | Vérifié: 31/01/2026
