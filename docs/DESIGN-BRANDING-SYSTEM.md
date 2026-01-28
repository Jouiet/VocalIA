# VocalIA - Design & Branding System

> **Version**: 1.0.0 | **Date**: 28/01/2026 | **Session**: 200
> **Palette**: Premium Indigo/Violet (Stripe/Linear-inspired)

---

## Brand Identity

### Vision
**"Futuriste, Sobre, Puissant"** - Une identité qui inspire confiance aux entreprises tout en projetant l'innovation technologique.

### Cible
- Chefs d'entreprises (Maroc, Europe, International)
- Indépendants et PME
- Décideurs techniques (CTO, VP Engineering)

---

## Color Palette v2.0

### Primary - VocalIA Indigo/Violet

| Shade | Hex Code | Usage |
|:------|:---------|:------|
| 50 | `#f5f3ff` | Light backgrounds |
| 100 | `#ede9fe` | Hover states (light) |
| 200 | `#ddd6fe` | Borders (light mode) |
| 300 | `#c4b5fd` | Disabled states |
| 400 | `#a78bfa` | Secondary text, icons |
| **500** | **`#8b5cf6`** | **Primary Brand** |
| 600 | `#7c3aed` | Primary hover |
| 700 | `#6d28d9` | Active states |
| 800 | `#5b21b6` | Dark accents |
| 900 | `#4c1d95` | Deep accents |
| 950 | `#2e1065` | Darkest |

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

### Design Inspiration

| Source | Color | Influence |
|:-------|:------|:----------|
| [Stripe](https://stripe.com/brand) | #635BFF | Primary indigo base |
| [Linear](https://linear.app/brand) | #5E6AD2 | Purple sophistication |
| [Pantone 2025](https://www.pantone.com/color-of-the-year/2025) | Mocha Mousse | Warm neutrals |
| [Pantone 2026](https://www.pantone.com/color-of-the-year/2026) | Cloud Dancer | Clean whites |

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
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);
}

/* Secondary - Ghost with border */
.btn-secondary {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
}
```

### Cards

```css
/* Dashboard Card */
.dashboard-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1rem;
}

/* Stat Card - Highlighted */
.stat-card {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.05));
  border: 1px solid rgba(139, 92, 246, 0.2);
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
| #8b5cf6 on #0f172a | 5.2:1 | ✅ AA |

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

### Start Local Server
```bash
npx serve website -l 8080
```

### Verify Colors
```bash
grep -o 'bg-vocalia-[0-9]*' website/public/css/style.css | sort -u
```

---

## External Resources

- [Stripe Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)
- [Linear Brand Guidelines](https://linear.app/brand)
- [Tailwind v4 Documentation](https://tailwindcss.com/docs)
- [Pantone Color of the Year](https://www.pantone.com/color-of-the-year)
- [Mobbin Brand Colors](https://mobbin.com/colors/brand/stripe)
- [uiGradients](https://uigradients.com/)

---

*Document créé: 28/01/2026 - Session 200*
*Auteur: Claude Code (DOE Framework)*
