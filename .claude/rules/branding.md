# VocalIA Branding & Design Token Reference

> **Single Source of Truth** | Session 250.123 | 07/02/2026
> **Reference Page: HOMEPAGE (index.html) — ALWAYS the authoritative source**

## RULE: Consult this file BEFORE ANY UI/UX/CSS/widget modification

---

## 1. Approved Color Palette

### Surface Colors (Quantum Void Design System)

| Token | Hex | CSS Variable | Usage |
|:------|:----|:-------------|:------|
| quantum-void | `#050505` | `--quantum-void` | Body background, ALL page bg |
| surface-900 | `#09090b` | `--color-surface-900` | Nav bar, footer bg |
| surface-800 | `#0c0c0f` | `--color-surface-800` | Dropdowns, elevated cards |
| surface-700 | `#111114` | `--color-surface-700` | Card hover states |
| surface-600 | `#18181b` | `--color-surface-600` | Borders, dividers |
| surface-500 | `#27272a` | — | Secondary borders |
| surface-400 | `#3f3f46` | — | Muted text borders |
| surface-300 | `#52525b` | — | Subtle text |
| surface-200 | `#71717a` | — | zinc-500, secondary text |
| surface-100 | `#a1a1aa` | — | zinc-400, body text |
| surface-50 | `#fafafa` | — | zinc-50, headings |

### Brand Colors

| Token | Hex | Usage |
|:------|:----|:------|
| vocalia-primary | `#5E6AD2` | Brand accent (Linear-inspired deep indigo) |
| vocalia-dark | `#4f46e5` | Primary hover (indigo-600) |
| vocalia-accent | `#818cf8` | Secondary accents (indigo-400) |
| indigo-300 | `#a5b4fc` | Soft accent highlights |

### Functional Colors

| Category | Colors |
|:---------|:-------|
| Blue | `#60a5fa`, `#3b82f6`, `#2563eb` |
| Violet | `#a78bfa`, `#8b5cf6`, `#7c3aed` |
| Emerald | `#34d399`, `#10b981`, `#059669` |
| Amber | `#fbbf24`, `#f59e0b` |
| Rose | `#fb7185`, `#f43f5e`, `#e11d48` |
| Red | `#ef4444`, `#f87171` |
| Orange | `#f97316`, `#fb923c`, `#fdba74` |
| Cyan | `#06b6d4` |
| Green | `#22c55e`, `#6ee7b7` |

### FORBIDDEN Colors (rogue — NEVER use)

| Color | Why Forbidden | Fix |
|:------|:-------------|:----|
| `#0c0e1a` | Blue-tint dark | Use `#0c0c0f` (surface-800) |
| `#0a0a0a` | Off-void dark | Use `#050505` (quantum-void) |
| `#1a1a2e` | Purple-tint dark | Use surface colors |
| `#0d0d12` | Rogue dark | Use `#0c0c0f` (surface-800) |
| `#1e1e2e` | Rogue blue-dark | Use `#18181b` (surface-600) |

---

## 2. Widget Branding (voice-widget-b2b.js)

### Widget Color Tokens

| Token | Value | CSS Variable |
|:------|:------|:-------------|
| Primary | `#5E6AD2` | `--va-primary` |
| Primary Dark | `#4f46e5` | `--va-primary-dark` |
| Accent | `#818cf8` | `--va-accent` |
| Dark BG | `#0f172a` | `--va-dark` |

### Widget Trigger Button

| Property | Value |
|:---------|:------|
| Size | 60px circle |
| Background | `linear-gradient(135deg, #5E6AD2, #4f46e5)` |
| Box shadow | `0 4px 20px rgba(94, 106, 210, 0.4)` |
| Pulse animation | `vaTriggerPulse 2.5s ease-in-out infinite` |
| Hover | scale(1.1), no pulse |
| Logo | `/public/images/logo.webp` (36x36px) |

### Widget Notification Bubble

| Property | Value |
|:---------|:------|
| Background | `white` |
| Text color | `#0F172A` |
| Border-left | `4px solid var(--va-primary)` |
| Font | 14px, weight 500 |
| Auto-show | After 3s if not opened |

### CRITICAL: ONE Widget Per Page

- Pages load EITHER `voice-widget-b2b.js` OR `voice-widget.js`, NEVER both
- `voice-widget-b2b.js` = standard for ALL public pages
- `voice-widget.js` = only for `docs/index.html`, `signup.html`
- `voice-widget-ecommerce.js` = only for `use-cases/e-commerce.html`
- Version parameter: `?v=2.3.0` (bump on every change)

---

## 3. Audio Visualizer Branding

### Official Colors (from voice-visualizer.js defaults)

| Token | Hex | Usage |
|:------|:----|:------|
| Electric Blue (primary) | `#5DADE2` | Wave lines, bars, orb core |
| Light Sky Blue (secondary) | `#85C1E9` | Glow, secondary effects |

### RULE: DO NOT override visualizer colors

The homepage init code must NOT set `primaryColor`, `secondaryColor`, `accentColor`, or `glowColor`. Let `voice-visualizer.js` defaults apply (electric blue).

### Visualizer Modes

| Mode | Canvas ID | Config |
|:-----|:----------|:-------|
| Wave | `#visualizer-wave` | default barCount |
| Bars | `#visualizer-bars` | barCount: 24 |
| Orb | `#visualizer-orb` | default |
| Pulse | `#visualizer-pulse` | default |

---

## 4. White Opacity Levels

### Approved

| Class | Usage |
|:------|:------|
| `bg-white/[0.03]` | Subtle highlight (featured cards) |
| `bg-white/[0.04]` | Card backgrounds, badges, buttons |
| `bg-white/[0.05]` | Hover states |
| `bg-white/[0.06]` | Social icons, active cards |
| `border-white/[0.04]` | Nav border, footer border (SUBTLE) |
| `border-white/[0.06]` | Card borders, dropdown borders |
| `border-white/[0.08]` | Dropdown separators ONLY |

### FORBIDDEN

| Pattern | Why |
|:--------|:----|
| `bg-white/[0.02]` on `<section>` | Creates invisible banding |
| `bg-white/[0.15]` | Too bright for quantum void |
| `border-white/[0.08]` on footer/nav | Too visible |
| Any `/[0.92]` opacity | Semi-transparent = bleed-through |

---

## 5. Navigation & Layout

| Component | Background | Border |
|:----------|:-----------|:-------|
| Nav bar | `bg-[#09090b]/95 backdrop-blur-xl` | `border-b border-white/[0.04]` |
| Dropdowns | `bg-[#0c0c0f]` (100% opaque) | `border border-white/[0.06]` |
| Footer | `bg-[#09090b]` (100% opaque) | `border-t border-white/[0.04]` |
| Mobile menu | `bg-[#050505]/98 backdrop-blur-xl` | None |
| Lang dropdown | `bg-[#0c0c0f]` (100% opaque) | `border border-white/[0.06]` |

### CSS Variables (in input.css)

```css
--nav-bg: rgba(9, 9, 11, 0.95);
--dropdown-bg: #0c0c0f;
--footer-bg: #09090b;
--section-border: rgba(255, 255, 255, 0.04);
```

---

## 6. Section Backgrounds & Gradients

| Pattern | Status |
|:--------|:-------|
| Transparent (body shows) | DEFAULT |
| `from-[#050505] to-[#050505]` | OK (same endpoints) |
| `from-vocalia-900/50 ...` | OK (brand gradient CTAs) |
| `bg-white/[0.02]` on `<section>` | FORBIDDEN |
| `to-[#0a0a0a]` | FORBIDDEN |
| `via-[#0a0a0a]` | FORBIDDEN |

---

## 7. Platform Numbers (VERIFIED 07/02/2026)

| Metric | Value | Source |
|:-------|:------|:-------|
| Personas | **38** | `voice-persona-injector.cjs` |
| Function Tools | **25** | `voice-telephony-bridge.cjs` |
| MCP Tools | **203** | `mcp-server/src/index.ts` |
| Languages | **5** | FR, EN, ES, AR, ARY |
| Widgets | **8** | `widget/*.js` |

### RULE: Update ALL HTML + ALL 5 locale files when numbers change

---

## 8. Component System (components.js)

- Header/footer injected dynamically via `data-component="header"`
- Scripts in component HTML are executed by components.js after injection
- Event delegation (`data-action="switchLang"`) handled by `event-delegation.js`
- `switchLang()` globally available via `window.switchLang`
- Language switcher: 5 buttons (FR, EN, ES, AR, ARY) in dropdown

---

## 9. i18n Consistency

- All 5 languages MUST be visually identical
- RTL (AR, ARY) uses same color tokens
- Language switcher MUST include all 5 languages on ALL pages
- Auth pages (app/auth/*) must include Darija (ARY) button

---

## 10. Validation

```bash
node scripts/validate-design-tokens.cjs
```

**v2.3** — 17 checks, scans full codebase (HTML + JS + CSS + core + data)
Detects: forbidden colors, rogue patterns, widget duplication, stale numbers, opacity violations, component coverage, header/footer structure, i18n.js, etc.

**Run BEFORE any commit touching CSS/HTML/widget/core.**

### ⛔ TÂCHE RÉCURRENTE CRITIQUE — NE JAMAIS SUPPRIMER

**Toutes les 15-20 sessions**, exécuter le validateur ET vérifier que `STALE_NUMBER_PATTERNS` dans
`scripts/validate-design-tokens.cjs` est à jour avec les vrais chiffres de la plateforme:

| Chiffre | Variable | Source de vérité | Commande |
|:--------|:---------|:-----------------|:---------|
| Personas | `PLATFORM_NUMBERS.personas` | `voice-persona-injector.cjs` | `grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs \| sort -u \| wc -l` |
| MCP Tools | `PLATFORM_NUMBERS.mcpTools` | `mcp-server/src/index.ts` | `grep -c "server.tool(" mcp-server/src/index.ts` |
| Function Tools | `PLATFORM_NUMBERS.functionTools` | `voice-telephony-bridge.cjs` | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` |
| Widgets | `PLATFORM_NUMBERS.widgets` | `widget/*.js` | `ls widget/*.js \| wc -l` |
| Languages | `PLATFORM_NUMBERS.languages` | Locale files | `ls website/src/locales/*.json \| wc -l` |

**Si un chiffre a changé**: mettre à jour `STALE_NUMBER_PATTERNS` pour détecter l'ancienne valeur,
puis corriger toutes les occurrences dans le codebase.

**Historique des changements de chiffres:**
- Session 250.120: Personas 40 → 38 (5 eliminated)
- Session 250.124: MCP tools 182 → 203 (stale value eradicated)

---

## References

| Source | Content |
|:-------|:--------|
| `website/src/input.css` | @theme + :root (design system) |
| `website/index.html` | **THE reference page** |
| `website/components/header.html` | Header component (325 lines) |
| `website/components/footer.html` | Footer component |
| `website/src/lib/voice-visualizer.js` | Visualizer (electric blue defaults) |
| `website/voice-assistant/voice-widget-b2b.js` | Widget (indigo brand) |
| `website/src/lib/event-delegation.js` | Event delegation + switchLang |
| `website/src/lib/components.js` | Dynamic component loader |
| `scripts/validate-design-tokens.cjs` | Automated validator |
