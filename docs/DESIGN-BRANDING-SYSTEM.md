# VocalIA - Design & Branding System

> **Version**: 4.5.0 | **Date**: 30/01/2026 | **Session**: 228.2
> **Palette**: OKLCH P3 Wide-Gamut "4K" Colors | **Brand Assets**: Complete ✅
> **Research**: Apple Liquid Glass, GitHub ihlamury/design-skills, LogRocket OKLCH, CodePen 3D Tilt
> **Security**: Technology Disclosure Protection (Session 222)

---

## Brand Identity

### Vision
**"Futuriste, Sobre, Puissant"** - Une identité qui inspire confiance aux entreprises tout en projetant l'innovation technologique.

### Cible
- Chefs d'entreprises (Maroc, Europe, International)
- Indépendants et PME
- Décideurs techniques (CTO, VP Engineering)

---

## 🔐 Content Security Guidelines (Session 222)

### Principe

**Ne JAMAIS divulguer les technologies internes sur les pages publiques.**

VocalIA compète contre des plateformes IA frontières. Exposer notre stack technologique donne un avantage direct aux concurrents.

### Règles d'Obfuscation

| ❌ NE PAS ÉCRIRE | ✅ ÉCRIRE À LA PLACE |
|:-----------------|:---------------------|
| "Grok AI" | "IA temps réel", "IA Engine" |
| "Gemini" | "Multi-AI", "Fallback IA" |
| "Twilio" | "PSTN", "Téléphonie" |
| "grok-4-1-fast-reasoning" | "Multi-AI temps réel" |
| "Grok → Gemini → Claude → Atlas" | "5 niveaux de redondance IA" |
| "xAI", "Google", "Anthropic" | "Providers IA", "Multi-provider" |

### Zones Protégées

| Zone | Protection |
|:-----|:-----------|
| Pages publiques (landing, features, pricing) | ✅ Obfuscation totale |
| Pages produit (voice-widget, voice-telephony) | ✅ Obfuscation totale |
| Documentation API | ⚠️ Générique seulement |
| Dashboard client | ⚠️ Générique (Provider 1, Provider 2) |
| Dashboard admin | ⚠️ Obfusqué par cohérence |
| Code backend (non public) | ✅ Noms réels OK |

### Vérification

```bash
# Avant chaque deploy, vérifier absence de divulgations
grep -riE "Grok|Gemini|Twilio|xAI|Anthropic" website/ --include="*.html" --include="*.json"
# Attendu: 0 résultats (ou seulement CSS comments)
```

---

## Color Palette v4.0 (Enterprise Dark)

### Primary - VocalIA Deep Indigo (Linear #5E6AD2 inspired)

| Shade | Hex Code | Usage |
|:------|:---------|:------|
| 50 | `#eef2ff` | Light backgrounds |
| 100 | `#e0e7ff` | Hover states (light) |
| 200 | `#c7d2fe` | Borders (light mode) |
| 300 | `#a5b4fc` | Highlight text |
| 400 | `#818cf8` | Secondary accents |
| 500 | `#6366f1` | Secondary brand |
| **600** | **`#5E6AD2`** | **Primary Brand (Linear)** |
| 700 | `#4f46e5` | Primary hover |
| 800 | `#4338ca` | Active states |
| 900 | `#3730a3` | Deep accents |
| 950 | `#1e1b4b` | Darkest |

### Surface Colors (Slate v4.2 - Harmonized)

| Token | Hex Code | Tailwind | Usage |
|:------|:---------|:---------|:------|
| `--bg-base` | `#1e293b` | slate-800 | Page background |
| `--bg-raised` | `#334155` | slate-700 | Cards, modals |
| `--bg-elevated` | `#475569` | slate-600 | Elevated elements |
| `--bg-overlay` | `#64748b` | slate-500 | Overlays, tooltips |

### Harmonization Rules (Session 213)

| Usage | Palette | Examples |
|:------|:--------|:---------|
| **Surfaces** | slate-700/800 | Cards, backgrounds, modals |
| **Accents** | vocalia-400/500/600 | Buttons, highlights, links |
| **Borders** | slate-600 | Card borders, dividers |
| **Text** | vocalia-300/400 | Accent text, labels |

**Important:** Never use vocalia-700/800/900 for backgrounds - these are accent colors only.

### Neutral - Slate

| Shade | Hex Code | Usage |
|:------|:---------|:------|
| 50 | `#f8fafc` | Light background |
| 100 | `#f1f5f9` | Cards (light mode) |
| 200 | `#e2e8f0` | Borders |
| 300 | `#cbd5e1` | Muted text (light) |
| 400 | `#94a3b8` | Secondary text |
| 500 | `#64748b` | Muted text |
| 600 | `#475569` | Body text (light) |
| 700 | `#334155` | Cards (dark mode) |
| 800 | `#1e293b` | Secondary background |
| **900** | **`#0f172a`** | **Primary Dark BG** |
| 950 | `#020617` | Deepest dark |

### Semantic Colors

| Purpose | Color | Hex Code |
|:--------|:------|:---------|
| Success | Emerald | `#10b981` |
| Warning | Amber | `#f59e0b` |
| Error | Rose | `#f43f5e` |
| Info | Cyan | `#06b6d4` |

### Design Inspiration (Researched Sources)

| Source | Color | Influence |
|:-------|:------|:----------|
| [Linear Design Skills](https://github.com/ihlamury/design-skills) | #5E6AD2 | Primary accent |
| [Stripe Brand](https://stripe.com/brand) | #635BFF | Enterprise trust |
| Linear Dark | #111111 | Ultra-dark surfaces |
| [pipecat-ai/voice-ui-kit](https://github.com/pipecat-ai/voice-ui-kit) | Tailwind 4 | Voice AI components |

### Research Sources

- **Gemini Deep Research**: Enterprise Voice AI SaaS design 2026
- **GitHub Design Skills**: Opinionated UI constraints from Linear, Stripe, Linear
- **Hugging Face**: Color-Pedia dataset for color psychology
- **Voice AI Repos**: react-voice-visualizer, assistant-ui, VoiceFlow-Pro

---

## Design Tools Available

### 1. Google Stitch (Internal)

**Location**: `core/stitch-api.cjs`

**Purpose**: UI generation via Google's Stitch API (MCP Protocol)

**Capabilities**:
- Project creation/management
- UI component generation
- CSS extraction

**Usage**:
```bash
node core/stitch-api.cjs list        # List projects
node core/stitch-api.cjs create "VocalIA Dashboard"
node core/stitch-api.cjs generate <projectId> "Modern pricing table"
```

**Documentation**: [Google Stitch](https://developers.google.com/stitch)

---

### 2. Google Whisk

**URL**: [labs.google/fx/tools/whisk](https://labs.google/fx/tools/whisk)

**Purpose**: Image-based AI design (no text prompts needed)

**How It Works**:
1. Upload images for: **Subject** + **Scene** + **Style**
2. Whisk uses Gemini to caption → Imagen 3 generates
3. Refine via chat-like interface

**Use Cases for VocalIA**:
- Hero section illustrations
- Marketing visuals
- Social media assets

**Source**: [Geeky Gadgets Guide](https://www.geeky-gadgets.com/how-to-use-google-whisk-2025/)

---

### 3. Remotion

**URL**: [remotion.dev](https://www.remotion.dev/)

**Purpose**: Programmatic video creation with React

**Capabilities**:
- React components as video frames
- MP4, WebM, GIF export
- Cloud rendering (Lambda)

**Use Cases for VocalIA**:
- Product demo videos
- Onboarding animations
- Social media content

**Installation**:
```bash
npm init video
npm run start  # Runs on localhost:3000
```

**Key Hooks**:
- `useVideoConfig()` - Video properties
- `useCurrentFrame()` - Current frame number
- `spring()` - Natural motion
- `interpolate()` - Value mapping

**License**: Free for <3 employees, paid for larger teams

**Source**: [GitHub remotion-dev/remotion](https://github.com/remotion-dev/remotion)

---

### 4. Gemini MCP

**Available Tools**:

| Tool | Purpose |
|:-----|:--------|
| `gemini_chat` | General design consultation |
| `gemini_list_models` | Available models |
| `gemini_deep_research` | Multi-step design research |

**Models Available**:
- Gemini 2.5 Flash
- Gemini Pro (for complex tasks)

**Design Prompting**:
```
"Design a color palette for enterprise Voice AI SaaS.
Requirements: WCAG 2.1 compliant, works in dark mode,
inspired by Stripe/Linear aesthetics."
```

---

### 5. Playwright MCP (Visual Testing)

**Purpose**: Automated visual verification of designs

**Capabilities**:
- Navigate to pages
- Take screenshots
- DOM snapshot for accessibility audit

**Usage for Design**:
```javascript
// Navigate and capture
mcp__playwright__browser_navigate({ url: "http://localhost:8080/" })
mcp__playwright__browser_take_screenshot({ filename: "homepage.png", fullPage: true })
```

---

### 6. Chrome DevTools MCP

**Purpose**: Real-time design debugging

**Capabilities**:
- Live CSS inspection
- Performance analysis
- Console monitoring
- Network requests

---

## Typography

### Font Stack

```css
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

### Type Scale

| Element | Size | Weight | Usage |
|:--------|:-----|:-------|:------|
| H1 | 3rem (48px) | 800 | Hero titles |
| H2 | 2.25rem (36px) | 700 | Section titles |
| H3 | 1.5rem (24px) | 600 | Card titles |
| H4 | 1.25rem (20px) | 600 | Subsections |
| Body | 1rem (16px) | 400 | Paragraphs |
| Small | 0.875rem (14px) | 400 | Labels, captions |
| XS | 0.75rem (12px) | 500 | Badges |

---

## Component Library

### Buttons

```css
/* Primary - Gradient with glow */
.btn-primary {
  background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4);
}

/* Secondary - Ghost with border */
.btn-secondary {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
```

### Cards

```css
/* Dashboard Card */
.dashboard-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85));
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 1rem;
}

/* Stat Card - Highlighted */
.stat-card {
  background: linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(15, 118, 110, 0.05));
  border: 1px solid rgba(13, 148, 136, 0.2);
}
```

### Glassmorphism

```css
.glass-panel {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(148, 163, 184, 0.2);
}
```

---

## Animation Principles

### Timing Functions

```css
/* Smooth interactions */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Bouncy effects */
transition: all 0.3s ease;
```

### Key Animations

| Animation | Usage | Duration |
|:----------|:------|:---------|
| `glow` | Button hover | 2s alternate |
| `float` | Hero elements | 6s infinite |
| `scan` | Demo modal | 3s linear |

---

## Accessibility

### WCAG 2.1 Compliance

| Requirement | Implementation |
|:------------|:---------------|
| Color Contrast | Minimum 4.5:1 for text |
| Focus States | `ring-vocalia-500` visible outline |
| Skip Links | "Aller au contenu principal" |
| ARIA Labels | All interactive elements |

### Color Contrast Verification

| Combination | Ratio | Status |
|:------------|:------|:------:|
| #f8fafc on #0f172a | 15.6:1 | ✅ AAA |
| #94a3b8 on #0f172a | 6.8:1 | ✅ AA |
| #14b8a6 on #0f172a | 7.1:1 | ✅ AA |
| #2dd4bf on #0f172a | 9.4:1 | ✅ AAA |

---

## File Structure

```
website/
├── src/
│   ├── input.css              # Source design tokens (435 lines)
│   └── lib/
│       ├── geo-detect.js      # Currency/region detection
│       └── i18n.js            # Localization
├── public/
│   └── css/
│       └── style.css          # Generated (54KB)
└── assets/                    # Images, icons (TBD)
```

---

## Design Workflow

### 1. Ideation
- Use **Google Whisk** for visual concepts
- Use **Gemini** for color palette research

### 2. Prototyping
- Use **Google Stitch** for rapid UI generation
- Extract CSS with `stitch-to-3a-css.cjs`

### 3. Implementation
- Edit `input.css` with Tailwind v4 tokens
- Run `npm run build:css`

### 4. Verification
- Use **Playwright MCP** for screenshots
- Use **Chrome DevTools MCP** for debugging

### 5. Video/Animation
- Use **Remotion** for demo videos
- Export MP4/WebM for marketing

---

## Quick Reference

### Build CSS
```bash
npm run build:css
# Output: website/public/css/style.css
```

### ⚠️ CRITICAL: Tailwind Pre-Compilation Limitation (Session 228.2)

**Problem Discovered:** Tailwind CSS is pre-compiled. New utility classes don't exist unless they were in source files during build.

| Class Type | Status |
|:-----------|:------:|
| `bg-white`, `bg-white/10` | ✅ In compiled CSS |
| `bg-white/30`, `bg-white/25` | ❌ NOT in compiled CSS |

**Workaround:** Use inline styles for opacity values not in compiled CSS:
```html
<!-- Instead of bg-white/25 (not compiled) -->
<div style="background-color: rgba(255,255,255,0.25);">
```

**Proper Fix:** Add required classes to source files and rebuild:
```bash
# 1. Add classes to input.css or any HTML file
# 2. Rebuild CSS
npm run build:css
# 3. Verify classes exist
grep "bg-white\/25" website/public/css/style.css
```

### Start Local Server
```bash
npx serve website -l 8080
```

### Verify Colors
```bash
grep -o 'bg-vocalia-[0-9]*' website/public/css/style.css | sort -u
```

---

## Related Documentation

- **[DESIGN-TOOLS-WORKFLOWS.md](./DESIGN-TOOLS-WORKFLOWS.md)** - Actionable workflows for Stitch, Whisk, Remotion, Gemini, Playwright, DevTools
- **[FORENSIC-AUDIT-WEBSITE.md](./FORENSIC-AUDIT-WEBSITE.md)** - Website audit & remediation history

## External Resources

- [Stripe Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)
- [Linear Brand Guidelines](https://linear.app/brand)
- [Tailwind v4 Documentation](https://tailwindcss.com/docs)
- [Pantone Color of the Year](https://www.pantone.com/color-of-the-year)
- [Remotion Docs - Claude Code](https://www.remotion.dev/docs/ai/claude-code)
- [Google Stitch](https://stitch.withgoogle.com/)
- [Google Whisk](https://labs.google/fx/tools/whisk)
- [Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp)

---

## Session 209 - 2026 Components Added

### Bento Grid System

```css
/* 4-column asymmetric grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(120px, auto);
  gap: 1rem;
}

.bento-large { grid-column: span 2; grid-row: span 2; }
.bento-wide { grid-column: span 2; }
.bento-tall { grid-row: span 2; }
.bento-featured { grid-column: span 3; grid-row: span 2; }
```

### Accessible Status Indicators (WCAG 2.1)

```html
<!-- Icon + Color + Text (not color alone) -->
<span class="status-indicator status-indicator-online">
  <span class="status-indicator-dot"></span>
  <span>En ligne</span>
</span>
```

Classes disponibles:
- `.status-indicator-online` (green + checkmark)
- `.status-indicator-warning` (amber + exclamation)
- `.status-indicator-error` (red + X)
- `.status-indicator-offline` (gray + circle)

### GPU-Only Animations

```css
/* GOOD - Compositor only (no repaints) */
.animate-gradient-gpu    /* transform: rotate() scale() */
.animate-glow-pulse      /* opacity on pseudo-element */
.animate-shimmer         /* transform: translateX() */

/* DEPRECATED - Causes repaints */
.animate-gradient        /* was: background-position (slow) */
```

### Dashboard Drag-and-Drop

```javascript
// Initialize
new DashboardGrid('.dashboard-content', {
  storageKey: 'vocalia-layout',
  enableCollapse: true,
  enableDrag: true
});
```

Features:
- Vanilla JS (no dependencies)
- Layout persistence (localStorage)
- Keyboard accessible
- Collapse/expand widgets

### AI Insights Card

```html
<div class="ai-insights-card">
  <div class="ai-insights-header">
    <div class="ai-insights-icon">...</div>
    <span class="ai-insights-badge">AI</span>
  </div>
  <p class="ai-insights-content">
    <strong>Insight title</strong> — Details here.
  </p>
</div>
```

---

## Brand Assets (Session 212)

| Asset | Size | Path | Description |
|:------|:----:|:-----|:------------|
| **OG Image** | 19KB | `public/images/og-image.webp` | Social preview, 1024x1024 |
| **Logo Icon** | 10KB | `public/images/logo.webp` | Sound wave, #5E6AD2 |

**Generated via:** Gemini 2.0 Flash Image Generation

---

## Session 214 - Liquid Glass & 4K Colors

### OKLCH P3 Wide-Gamut Colors

Upgraded from hex/RGBA to OKLCH for 50% more vibrant colors on P3 displays (93%+ browser support 2026).

```css
/* OKLCH P3 Wide-Gamut "4K" Colors */
--color-vocalia-500: oklch(58% 0.24 275);
--color-vocalia-600: oklch(54% 0.22 270);
--primary: oklch(54% 0.22 270);
```

**Source:** [LogRocket OKLCH](https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes)

### Liquid Glass Card Component

Apple 2026-inspired three-layer system:

```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px) saturate(180%);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.liquid-glass::before { /* Inner glow */ }
.liquid-glass::after { /* Shimmer highlight */ }
```

**Sources:**
- [Apple Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass)
- [DEV.to Pure CSS Implementation](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)

### 3D Floating Card with Mouse Tracking

```javascript
// card-tilt.js - Mouse-tracking 3D effect
<div data-tilt data-tilt-max="10" data-tilt-perspective="1200">
  <div class="tilt-inner">Content</div>
  <div class="tilt-glare"></div>
</div>
```

**Sources:**
- [GitHub alexanderuk82/3d-card](https://github.com/alexanderuk82/3d-card)
- [CodePen Glassmorphism 3D Tilt](https://codepen.io/Ahmod-Musa/pen/Qwjjezj)

### New CSS Classes

| Class | Effect |
|:------|:-------|
| `.liquid-glass` | Apple Liquid Glass with 3 layers |
| `.card-float` | Floating card with perspective |
| `[data-tilt]` | Mouse-tracking 3D tilt |
| `.animate-float-card` | Subtle floating animation |
| `.animate-shimmer-glass` | Shimmer effect |

## PLAN ACTIONNABLE (Session 215)

| # | Action | Priorité | Fichier |
|:-:|:-------|:--------:|:--------|
| 1 | Deploy to Linear | P1 | deploy config |
| 2 | Fix VocaliaGeo error | P1 | index.html |
| 3 | Dashboard liquid-glass integration | P2 | dashboard/*.html |
| 4 | E2E Visual Testing | P2 | Playwright |

---

*Document créé: 28/01/2026 - Session 200*
*Màj: 29/01/2026 - Session 214 (Liquid Glass & 4K Colors)*
*Auteur: Claude Code (DOE Framework)*
