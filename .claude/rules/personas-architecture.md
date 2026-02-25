# Persona Architecture — DO NOT MODIFY

`personas/voice-persona-injector.cjs` has TWO structures per persona. This is INTENTIONAL.

1. **SYSTEM_PROMPTS** (line 77-4482): Multilingual prompts (40 × 5 langs = 200 prompts, all with SECURITY section)
2. **PERSONAS** (line 4484+): Metadata + EN-only fallback systemPrompt

```
buildFullInstructions():
  basePrompt = PERSONAS[key].systemPrompt          // EN fallback
  IF SYSTEM_PROMPTS[key][lang] exists:
    basePrompt = SYSTEM_PROMPTS[key][lang]          // Override multilingual
```

**NEVER remove PERSONAS.systemPrompt** — it's the fallback when SYSTEM_PROMPTS lacks the requested language.
