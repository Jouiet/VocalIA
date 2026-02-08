---
paths:
  - "website/**/*.html"
  - "website/**/*.css"
  - "website/src/**"
  - "widget/**/*.js"
  - "scripts/validate-design-tokens.cjs"
---

# VocalIA Branding & Design Tokens

> SSoT | Reference: HOMEPAGE (index.html) | Consult BEFORE any UI/CSS/widget change

## Colors

### Surface (Quantum Void)
quantum-void `#050505` (body bg) | surface-900 `#09090b` (nav/footer) | surface-800 `#0c0c0f` (dropdowns/cards) | surface-700 `#111114` (hover) | surface-600 `#18181b` (borders) | surface-500 `#27272a` | surface-400 `#3f3f46` | surface-300 `#52525b` | surface-200 `#71717a` | surface-100 `#a1a1aa` | surface-50 `#fafafa`

### Brand
vocalia-primary `#5E6AD2` | vocalia-dark `#4f46e5` (hover) | vocalia-accent `#818cf8` | indigo-300 `#a5b4fc`

### Functional
Blue: `#60a5fa` `#3b82f6` `#2563eb` | Violet: `#a78bfa` `#8b5cf6` `#7c3aed` | Emerald: `#34d399` `#10b981` `#059669` | Amber: `#fbbf24` `#f59e0b` | Rose: `#fb7185` `#f43f5e` `#e11d48` | Red: `#ef4444` `#f87171` | Orange: `#f97316` `#fb923c` | Cyan: `#06b6d4` | Green: `#22c55e` `#6ee7b7`

### FORBIDDEN Colors
`#0c0e1a` `#0a0a0a` `#1a1a2e` `#0d0d12` `#1e1e2e`

## Widget
Tokens: `--va-primary: #5E6AD2` `--va-primary-dark: #4f46e5` `--va-accent: #818cf8` `--va-dark: #0f172a`
Trigger: 60px circle, `linear-gradient(135deg, #5E6AD2, #4f46e5)`, logo 36x36, pulse animation.
ONE widget per page: `voice-widget-b2b.js` = all public, `voice-widget-ecommerce.js` = e-commerce.html only. Version: `?v=2.3.0`

## Visualizer
Electric Blue `#5DADE2` (primary) | Light Sky Blue `#85C1E9` (secondary)
DO NOT override colors in homepage init — let voice-visualizer.js defaults apply.

## White Opacity
Approved bg: `/[0.03]` `/[0.04]` `/[0.05]` `/[0.06]` | Approved border: `/[0.04]` `/[0.06]` `/[0.08]` (separators only)
FORBIDDEN: `bg-white/[0.02]` on sections, `bg-white/[0.15]`, `border-white/[0.08]` on nav/footer, `/[0.92]`

## Navigation & Layout
| Component | Background | Border |
|:----------|:-----------|:-------|
| Nav | `bg-[#09090b]/95 backdrop-blur-xl` | `border-white/[0.04]` |
| Dropdowns | `bg-[#0c0c0f]` (opaque) | `border-white/[0.06]` |
| Footer | `bg-[#09090b]` (opaque) | `border-white/[0.04]` |
| Mobile menu | `bg-[#050505]/98 backdrop-blur-xl` | None |

CSS vars: `--nav-bg: rgba(9,9,11,0.95)` `--dropdown-bg: #0c0c0f` `--footer-bg: #09090b` `--section-border: rgba(255,255,255,0.04)`

## Section Backgrounds
DEFAULT: transparent. OK: `from-[#050505] to-[#050505]`, brand gradients. FORBIDDEN: `bg-white/[0.02]` on sections, `to-/via-[#0a0a0a]`

## Components & i18n
- Header/footer: `data-component="header"` → components.js injects + executes scripts
- Events: `data-action="switchLang"` → event-delegation.js, `window.switchLang` global
- All 5 langs visually identical. RTL (AR/ARY) same tokens. All pages: 5-lang switcher.

## Platform Numbers (VERIFIED 08/02/2026)
| Metric | Value |
|:-------|:------|
| Personas | 38 |
| MCP Tools | 203 |
| Function Tools | 25 |
| Widgets | 7 |
| Languages | 5 |

Update ALL HTML + ALL 5 locale files when numbers change. Verify commands in `.claude/rules/factuality.md`.

## Validation
`node scripts/validate-design-tokens.cjs` — v3.0, 23 checks (17 CSS + 6 business/factual). Run BEFORE CSS/HTML/widget commits.

### ⛔ RECURRING TASK (every 15-20 sessions — NEVER DELETE)
Run validator + verify STALE_NUMBER_PATTERNS matches real numbers. History: 250.120 personas 40→38 | 250.124 MCP 182→203

## References
input.css (design SSoT) | index.html (reference page) | components/header.html | voice-visualizer.js | voice-widget-b2b.js | event-delegation.js | components.js | validate-design-tokens.cjs
