'use strict';

/**
 * VocalIA Design Token Validator v3.0
 * Ultra-rigorous branding + business factual compliance checker.
 * Validates ALL sections of .claude/rules/branding.md
 * + Full codebase stale number detection (personas, MCP tools)
 * + Business/factual compliance (eliminated products, pricing, claims)
 * + Component system coverage on ALL public pages
 * + Header/footer structural integrity (nav links, i18n, lang switcher)
 *
 * Scans: HTML, JS (widgets + core), CSS, JSON (locales + data)
 * Run: node scripts/validate-design-tokens.cjs
 *
 * Session 250.160 | 08/02/2026
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.join(__dirname, '..', 'website');
const ROOT_DIR = path.join(__dirname, '..');

// ═══════════════════════════════════════════════════════
// SECTION 1: Color Palette
// ═══════════════════════════════════════════════════════

const APPROVED_HEX = new Set([
  // Surface colors (quantum void design system)
  '#050505', '#09090b', '#0c0c0f', '#111114', '#18181b',
  '#27272a', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#fafafa',
  // Zinc extended
  '#f4f4f5', '#e4e4e7', '#d4d4d8',
  // Brand colors
  '#5e6ad2', '#4f46e5', '#818cf8', '#a5b4fc',
  // Blue
  '#60a5fa', '#3b82f6', '#2563eb',
  // Violet
  '#a78bfa', '#8b5cf6', '#7c3aed',
  // Emerald
  '#34d399', '#10b981', '#059669',
  // Amber
  '#fbbf24', '#f59e0b',
  // Rose
  '#fb7185', '#f43f5e', '#e11d48',
  // Red
  '#ef4444', '#f87171',
  // Orange
  '#f97316', '#fb923c', '#fdba74',
  // Cyan
  '#06b6d4',
  // Green
  '#22c55e', '#6ee7b7',
  // Extended Tailwind (used in features, blog, docs, auth)
  '#6366f1', '#c4b5fd', '#a855f7', '#c792ea',
  '#94a3b8', '#cbd5e1', '#e2e8f0',
  '#1e293b', '#334155', '#475569', '#64748b',
  '#0f172a', '#0f0f23',
  // Auth gradient
  '#667eea', '#764ba2', '#4f5abd',
  // Syntax highlight (code blocks)
  '#c3e88d', '#82aaff', '#546e7a',
  // Google brand (OAuth)
  '#4285f4', '#34a853', '#fbbc05', '#ea4335',
  // Visualizer (electric blue)
  '#5dade2', '#85c1e9',
  // Widget
  '#0f172a',
  // White/black
  '#ffffff', '#000000',
]);

const FORBIDDEN_HEX = {
  '#0c0e1a': 'Blue-tint rogue → use #0c0c0f (surface-800)',
  '#0a0a0a': 'Off-void rogue → use #050505 (quantum-void)',
  '#1a1a2e': 'Purple-tint rogue → use surface colors',
  '#0d0d12': 'Rogue dark → use #0c0c0f (surface-800)',
  '#1e1e2e': 'Rogue blue-dark → use #18181b (surface-600)',
};

// ═══════════════════════════════════════════════════════
// SECTION 2: Widget Rules
// ═══════════════════════════════════════════════════════

const WIDGET_EXPECTED_VERSION = '2.7.0';

// Pages that use voice-widget.js (NOT voice-widget-b2b.js)
// NOTE: voice-widget.js is DEAD (0 pages). docs + signup use B2B widget.
const VOICE_WIDGET_ONLY_PAGES = new Set([]);

// Pages that use voice-widget-ecommerce.js
const ECOMMERCE_WIDGET_PAGES = new Set([
  'use-cases/e-commerce.html',
]);

// ═══════════════════════════════════════════════════════
// SECTION 4: Forbidden Opacity Patterns
// ═══════════════════════════════════════════════════════

const FORBIDDEN_PATTERNS = [
  // Forbidden gradient endpoints
  { regex: /to-\[#0a0a0a\]/g, reason: 'Gradient endpoint #0a0a0a forbidden → use to-[#050505]' },
  { regex: /via-\[#0a0a0a\]/g, reason: 'Gradient via #0a0a0a forbidden → use via-[#050505]' },
  // Forbidden rogue bg
  { regex: /bg-\[#0c0e1a\]/g, reason: 'Rogue bg #0c0e1a → use bg-[#0c0c0f]' },
  { regex: /bg-\[#1a1a2e\]/g, reason: 'Rogue bg #1a1a2e → use surface colors' },
  { regex: /bg-\[#0d0d12\]/g, reason: 'Rogue bg #0d0d12 → use bg-[#0c0c0f]' },
  { regex: /bg-\[#1e1e2e\]/g, reason: 'Rogue bg #1e1e2e → use bg-[#18181b]' },
  // Forbidden opacities
  { regex: /bg-white\/\[0\.15\]/g, reason: 'bg-white/[0.15] too bright for quantum void → max 0.06' },
  { regex: /\/\[0\.92\]/g, reason: '92% opacity = bleed-through → use 100% opaque or /95 min' },
  // Forbidden section backgrounds
  { regex: /<section[^>]*bg-white\/\[0\.02\]/g, reason: 'bg-white/[0.02] on <section> creates banding' },
];

// ═══════════════════════════════════════════════════════
// SECTION 7: Platform Numbers
// ═══════════════════════════════════════════════════════

const PLATFORM_NUMBERS = {
  personas: 38,
  functionTools: 25,
  mcpTools: 203,
  languages: 5,
  widgets: 7,
};

// Stale number patterns (detect old counts across ALL file types)
const STALE_NUMBER_PATTERNS = [
  // Personas: was 40, now 38
  { regex: /\b40\s+persona/gi, reason: 'Stale "40 personas" → should be 38' },
  { regex: /\b40\s+Persona/g, reason: 'Stale "40 Persona" → should be 38' },
  { regex: />40<\/.*persona/gi, reason: 'Stale "40" persona in HTML → should be 38' },
  { regex: /40 industry persona/gi, reason: 'Stale "40 industry personas" → should be 38' },
  { regex: /40 PERSONAS/g, reason: 'Stale "40 PERSONAS" → should be 38' },
  { regex: /40 SOTA persona/gi, reason: 'Stale "40 SOTA personas" → should be 38' },
  { regex: /40 pre-configured/gi, reason: 'Stale "40 pre-configured" → should be 38' },
  // MCP Tools: was 182, now 203
  { regex: /\b182\s+(?:MCP\s+)?tools?\b/gi, reason: 'Stale "182 tools" → should be 203' },
  { regex: /\b182\s+integration/gi, reason: 'Stale "182 integration" → should be 203' },
  { regex: /MCP[^)]*182/gi, reason: 'Stale "MCP...182" → should be 203' },
];

// ═══════════════════════════════════════════════════════
// SECTION 8: Business/Factual Compliance
// Source of truth: docs/BUSINESS-INTELLIGENCE.md
// ═══════════════════════════════════════════════════════

const BUSINESS_PATTERNS = [
  // 18. Eliminated B2C product (merged into Pro 99€ — BI.md L70)
  { regex: /Voice Widget B2C/gi, rule: 'ELIMINATED_PRODUCT', reason: 'B2C product ELIMINATED → merged into Pro (99€)' },

  // 19. Old pricing (non-viable telephony margin — BI.md L71, L77)
  { regex: /\$0\.06/g, rule: 'OLD_PRICING', reason: '$0.06 is OLD telephony cost (8% margin) → now $0.10-0.11/min' },
  { regex: /\b0[.,]06\s*€/g, rule: 'OLD_PRICING', reason: '0.06€ is OLD telephony price (8% margin) → now 0.10€/min' },
  { regex: /\b79\s*€/g, rule: 'OLD_PRICING', reason: '79€ was B2C tier — ELIMINATED. Use Pro 99€/mo' },

  // 20. Unverifiable uptime claim (API not deployed — production readiness 3.5/10)
  { regex: /99[.,]9\s*%/g, rule: 'UPTIME_CLAIM', reason: '99.9% claim unverifiable — API backend NOT deployed' },

  // 21. Unverified metrics (0 paying customers)
  { regex: /[Rr]ésultat mesuré/g, rule: 'UNVERIFIED_METRIC', reason: '"Résultat mesuré" — 0 customers, nothing measured' },
  { regex: /[Mm]easured result/g, rule: 'UNVERIFIED_METRIC', reason: '"Measured result" — 0 customers, nothing measured' },
  { regex: /[Rr]esultado medido/g, rule: 'UNVERIFIED_METRIC', reason: '"Resultado medido" — 0 customers, nothing measured' },
  { regex: /نتيجة مُقاسة/g, rule: 'UNVERIFIED_METRIC', reason: 'AR "measured result" — 0 customers, nothing measured' },
  { regex: /نتيجة مقاسة/g, rule: 'UNVERIFIED_METRIC', reason: 'AR "measured result" — 0 customers, nothing measured' },

  // 22. Unqualified competitive claims (TRUE for FR/EU, FALSE for Morocco — BI.md L105)
  { regex: /60\s*%\s*(?:moins cher|cheaper|más barato|أرخص|ارخص)/gi, rule: 'COMPETITIVE_CLAIM', reason: '"60% cheaper" TRUE for FR/EU, FALSE for Morocco ($0.83/min Twilio) — needs qualification' },
];

// ═══════════════════════════════════════════════════════
// File Discovery
// ═══════════════════════════════════════════════════════

function findFiles(dir, extensions, excludeDirs = ['node_modules', '.git', 'coverage', 'clients', '.locale-backups']) {
  const results = [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !excludeDirs.includes(item.name)) {
      results.push(...findFiles(fullPath, extensions, excludeDirs));
    } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════
// Validator Engine
// ═══════════════════════════════════════════════════════

function validate() {
  const errors = [];
  const warnings = [];

  // Scan HTML + JS + CSS
  const htmlFiles = findFiles(WEBSITE_DIR, ['.html']);
  const jsFiles = [
    ...findFiles(path.join(WEBSITE_DIR, 'voice-assistant'), ['.js']),
    ...findFiles(path.join(WEBSITE_DIR, 'src', 'lib'), ['.js']),
  ];
  const cssFiles = findFiles(path.join(WEBSITE_DIR, 'src'), ['.css']);
  const allFiles = [...htmlFiles, ...jsFiles, ...cssFiles];

  const relPath = (f) => path.relative(ROOT_DIR, f);

  // ── CHECK 1: Forbidden hex colors (all files) ──
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const rel = relPath(file);

    for (const [hex, reason] of Object.entries(FORBIDDEN_HEX)) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(hex)) {
          errors.push({ file: rel, line: i + 1, rule: 'FORBIDDEN_COLOR', msg: `${hex} — ${reason}` });
        }
      }
    }
  }

  // ── CHECK 2: Forbidden patterns (all files) ──
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    for (const { regex, reason } of FORBIDDEN_PATTERNS) {
      const globalRegex = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        errors.push({ file: rel, line: lineNum, rule: 'FORBIDDEN_PATTERN', msg: `${match[0]} — ${reason}` });
      }
    }
  }

  // ── CHECK 3: Unknown hex (HTML files only, warnings) ──
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    const lines = content.split('\n');

    const hexMatches = content.matchAll(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g);
    for (const match of hexMatches) {
      const hex = match[0].toLowerCase();
      if (!APPROVED_HEX.has(hex) && !FORBIDDEN_HEX[hex]) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNum - 1] || '';
        // Skip HTML entities, script content, meta tags, SVG, comments
        if (!line.includes('&#x') && !line.includes('<script') && !line.includes('<!--')
            && !line.includes('content="') && !line.includes('<meta')) {
          warnings.push({ file: rel, line: lineNum, rule: 'UNKNOWN_HEX', msg: `${match[0]} not in approved palette` });
        }
      }
    }
  }

  // ── CHECK 4: Widget duplication (one widget per page) ──
  // Only count actual <script src="...widget..."> tags, not code examples/docs
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    const lines = content.split('\n');

    let b2bCount = 0;
    let stdCount = 0;
    let ecomCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Only count lines that are actual <script src="..."> tags
      // Skip lines with escaped tags (<\/script>) — those are inside JS string literals
      if (/<script\s[^>]*src=/.test(line) && !line.includes('<\\/')) {
        if (line.includes('voice-widget-b2b.js')) b2bCount++;
        else if (line.includes('voice-widget-ecommerce.js')) ecomCount++;
        else if (/voice-widget\.js/.test(line) && !line.includes('voice-widget-b2b') && !line.includes('voice-widget-ecommerce')) stdCount++;
      }
    }

    const totalWidgets = b2bCount + stdCount + ecomCount;
    if (totalWidgets > 1) {
      errors.push({ file: rel, line: 0, rule: 'WIDGET_DUPLICATE', msg: `${totalWidgets} widget scripts loaded — only 1 allowed per page` });
    }
  }

  // ── CHECK 5: Widget version consistency ──
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    // Check all widget script tags for version
    const widgetRefs = content.matchAll(/voice-widget(?:-b2b|-ecommerce(?:-core)?)?(?:\.min)?\.js\?v=([0-9.]+)/g);
    for (const match of widgetRefs) {
      if (match[1] !== WIDGET_EXPECTED_VERSION) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        errors.push({ file: rel, line: lineNum, rule: 'WIDGET_VERSION', msg: `version ${match[1]} ≠ expected ${WIDGET_EXPECTED_VERSION}` });
      }
    }

    // Check widget scripts WITHOUT version param
    const noVersion = content.matchAll(/voice-widget(?:-b2b|-ecommerce(?:-core)?)?\.js(?:"|'|\s)/g);
    for (const match of noVersion) {
      const matchText = match[0].trim();
      if (!matchText.includes('?v=')) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const line = (content.split('\n')[lineNum - 1] || '').trim();
        // Only flag if it's in a <script> tag (not a comment or text)
        if (line.includes('<script') || line.includes('src=')) {
          warnings.push({ file: rel, line: lineNum, rule: 'WIDGET_NO_VERSION', msg: `widget script missing ?v= cache-bust param` });
        }
      }
    }
  }

  // ── CHECK 6: Widget page assignment (correct widget on correct page) ──
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    const relToWebsite = path.relative(WEBSITE_DIR, file);

    // Pages that should use voice-widget.js
    if (VOICE_WIDGET_ONLY_PAGES.has(relToWebsite)) {
      if (content.includes('voice-widget-b2b')) {
        warnings.push({ file: rel, line: 0, rule: 'WIDGET_WRONG_TYPE', msg: `should use voice-widget.js, not voice-widget-b2b` });
      }
    }

    // Pages that should use ecommerce widget
    if (ECOMMERCE_WIDGET_PAGES.has(relToWebsite)) {
      if (!content.includes('voice-widget-ecommerce')) {
        warnings.push({ file: rel, line: 0, rule: 'WIDGET_WRONG_TYPE', msg: `should use voice-widget-ecommerce` });
      }
    }
  }

  // ── CHECK 7: Visualizer color overrides ──
  const indexHtml = path.join(WEBSITE_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    const content = fs.readFileSync(indexHtml, 'utf-8');
    const colorOverrides = ['primaryColor', 'secondaryColor', 'accentColor', 'glowColor'];
    for (const prop of colorOverrides) {
      // Check inside VoiceVisualizer constructor calls
      const regex = new RegExp(`new\\s+VoiceVisualizer\\([^)]*${prop}`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        errors.push({ file: relPath(indexHtml), line: lineNum, rule: 'VISUALIZER_OVERRIDE', msg: `${prop} override found — let defaults apply (electric blue)` });
      }
    }
  }

  // ── CHECK 8: Stale platform numbers (FULL codebase scan) ──
  const codebaseFiles = [
    ...findFiles(WEBSITE_DIR, ['.html', '.js', '.json']),
    ...findFiles(path.join(ROOT_DIR, 'core'), ['.cjs', '.js']),
    ...findFiles(path.join(ROOT_DIR, 'personas'), ['.cjs', '.json']),
    ...findFiles(path.join(ROOT_DIR, 'widget'), ['.js']),
    ...findFiles(path.join(ROOT_DIR, 'telephony'), ['.cjs', '.json']),
    ...findFiles(path.join(ROOT_DIR, 'data'), ['.json']),
    ...findFiles(path.join(ROOT_DIR, 'scripts'), ['.cjs', '.js']),
  ];
  // Exclude: this validator, coverage, generated indexes
  const codebaseFilesFiltered = codebaseFiles.filter(f =>
    !f.includes('validate-design-tokens') && !f.includes('coverage')
    && !f.includes('tfidf_index') && !f.includes('automations-registry-index')
  );

  for (const file of codebaseFilesFiltered) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    for (const { regex, reason } of STALE_NUMBER_PATTERNS) {
      const globalRegex = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        errors.push({ file: rel, line: lineNum, rule: 'STALE_NUMBER', msg: `"${match[0].trim()}" — ${reason}` });
      }
    }
  }

  // ── CHECK 9: Locale file stale numbers ──
  const localeDir = path.join(WEBSITE_DIR, 'src', 'locales');
  if (fs.existsSync(localeDir)) {
    const localeFiles = findFiles(localeDir, ['.json']);
    for (const file of localeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const rel = relPath(file);

      // Check for stale numbers in locale values
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        // Stale persona count
        if (line.includes('"40') && (line.includes('persona') || line.includes('شخصية'))) {
          errors.push({ file: rel, line: i + 1, rule: 'STALE_LOCALE', msg: `"40" persona count → should be 38` });
        }
        // Stale MCP tools count
        if (line.includes('182') && (line.includes('tool') || line.includes('mcp') || line.includes('outil'))) {
          errors.push({ file: rel, line: i + 1, rule: 'STALE_LOCALE', msg: `"182" MCP tools count → should be 203` });
        }
      }
    }
  }

  // ── CHECK 10: border-white/[0.08] on footer/nav (forbidden) ──
  const componentFiles = [
    path.join(WEBSITE_DIR, 'components', 'header.html'),
    path.join(WEBSITE_DIR, 'components', 'footer.html'),
  ];
  for (const file of componentFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    const matches = content.matchAll(/border-white\/\[0\.08\]/g);
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const line = (content.split('\n')[lineNum - 1] || '');
      // OK inside dropdown separator, forbidden on nav/footer border
      if (line.includes('border-b') || line.includes('border-t')) {
        errors.push({ file: rel, line: lineNum, rule: 'OPACITY_NAV_FOOTER', msg: `border-white/[0.08] on nav/footer — too visible → use border-white/[0.04]` });
      }
    }
  }

  // ── CHECK 11: Widget pulse animation presence ──
  const widgetB2B = path.join(WEBSITE_DIR, 'voice-assistant', 'voice-widget-b2b.js');
  if (fs.existsSync(widgetB2B)) {
    const content = fs.readFileSync(widgetB2B, 'utf-8');
    if (!content.includes('vaTriggerPulse')) {
      errors.push({ file: relPath(widgetB2B), line: 0, rule: 'WIDGET_NO_PULSE', msg: 'Missing vaTriggerPulse animation on .va-trigger' });
    }
  }

  const widgetStd = path.join(WEBSITE_DIR, 'voice-assistant', 'voice-widget.js');
  if (fs.existsSync(widgetStd)) {
    const content = fs.readFileSync(widgetStd, 'utf-8');
    if (!content.includes('TriggerPulse') && !content.includes('triggerPulse')) {
      warnings.push({ file: relPath(widgetStd), line: 0, rule: 'WIDGET_NO_PULSE', msg: 'Missing pulse animation on trigger button' });
    }
  }

  // ── CHECK 12: Language switcher — 5 languages present in header ──
  const headerFile = path.join(WEBSITE_DIR, 'components', 'header.html');
  if (fs.existsSync(headerFile)) {
    const content = fs.readFileSync(headerFile, 'utf-8');
    const requiredLangs = ['fr', 'en', 'es', 'ar', 'ary'];
    for (const lang of requiredLangs) {
      const pattern = new RegExp(`data-params=["']${lang}["']`);
      if (!pattern.test(content)) {
        errors.push({ file: relPath(headerFile), line: 0, rule: 'LANG_MISSING', msg: `Language "${lang}" missing from switcher` });
      }
    }
  }

  // ── CHECK 13: components.js script execution ──
  const componentsJs = path.join(WEBSITE_DIR, 'src', 'lib', 'components.js');
  if (fs.existsSync(componentsJs)) {
    const content = fs.readFileSync(componentsJs, 'utf-8');
    // Verify it handles script execution (not just outerHTML)
    if (content.includes('el.outerHTML = html') && !content.includes('createElement(\'script')
        && !content.includes('createElement("script')) {
      errors.push({ file: relPath(componentsJs), line: 0, rule: 'COMPONENTS_NO_SCRIPT', msg: 'outerHTML used without script re-execution — lang switcher will break' });
    }
  }

  // ── CHECK 14: CSS variables in input.css ──
  const inputCss = path.join(WEBSITE_DIR, 'src', 'input.css');
  if (fs.existsSync(inputCss)) {
    const content = fs.readFileSync(inputCss, 'utf-8');
    const requiredVars = ['--nav-bg', '--dropdown-bg', '--footer-bg', '--section-border'];
    for (const v of requiredVars) {
      if (!content.includes(v)) {
        warnings.push({ file: relPath(inputCss), line: 0, rule: 'CSS_VAR_MISSING', msg: `Required CSS variable "${v}" not found` });
      }
    }
  }

  // ── CHECK 15: Component system coverage (ALL pages) ──
  // Three component systems:
  //   1. Public pages: data-component="header" + components.js + event-delegation.js + i18n.js
  //   2. App pages (app/client/, app/admin/): data-app-component + app-components.js + i18n.js
  //   3. Auth pages (app/auth/): standalone with i18n.js (no sidebar by design)
  // Redirect pages (meta http-equiv="refresh") and component templates are acceptable exceptions
  const COMPONENT_TEMPLATE_DIRS = ['components'];
  for (const file of htmlFiles) {
    const relToWebsite = path.relative(WEBSITE_DIR, file);
    const topDir = relToWebsite.split(path.sep)[0];
    const parts = relToWebsite.split(path.sep);

    // Skip component template files (they ARE the components)
    if (COMPONENT_TEMPLATE_DIRS.includes(topDir)) continue;
    // Skip app/components/ (sidebar templates)
    if (parts[0] === 'app' && parts[1] === 'components') continue;

    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);
    const isRedirect = /meta\s+http-equiv=["']refresh["']/i.test(content);
    const isAppPage = parts[0] === 'app' && (parts[1] === 'client' || parts[1] === 'admin');
    const isAuthPage = parts[0] === 'app' && parts[1] === 'auth';
    const isDashboardRedirect = topDir === 'dashboard';

    const missing = [];

    if (isRedirect || isDashboardRedirect) {
      // Redirect pages — acceptable, just check they have the redirect meta
      if (!isRedirect && isDashboardRedirect) {
        missing.push('meta http-equiv="refresh"');
      }
    } else if (isAppPage) {
      // App pages need: data-app-component + app-components.js + i18n.js
      const hasAppComponent = content.includes('data-app-component=');
      const hasAppComponentsJs = content.includes('app-components.js');
      const hasI18n = content.includes('i18n.js');
      if (!hasAppComponent) missing.push('data-app-component');
      if (!hasAppComponentsJs) missing.push('app-components.js');
      if (!hasI18n) missing.push('i18n.js');
    } else if (isAuthPage) {
      // Auth pages are standalone — just need i18n.js
      const hasI18n = content.includes('i18n.js');
      if (!hasI18n) missing.push('i18n.js');
    } else {
      // Public website pages — need full component system
      const hasComponents = content.includes('components.js');
      const hasHeader = content.includes('data-component="header"') || content.includes("data-component='header'");
      const hasFooter = content.includes('data-component="footer"') || content.includes("data-component='footer'");
      const hasEventDelegation = content.includes('event-delegation.js');
      const hasI18n = content.includes('i18n.js');
      if (!hasComponents) missing.push('components.js');
      if (!hasHeader) missing.push('data-component="header"');
      if (!hasFooter) missing.push('data-component="footer"');
      if (!hasEventDelegation) missing.push('event-delegation.js');
      if (!hasI18n) missing.push('i18n.js');
    }

    if (missing.length > 0) {
      const msg = `Missing: ${missing.join(', ')}`;
      if (isRedirect) {
        warnings.push({ file: rel, line: 0, rule: 'COMPONENT_COVERAGE', msg: `${msg} (redirect page — acceptable exception)` });
      } else {
        errors.push({ file: rel, line: 0, rule: 'COMPONENT_COVERAGE', msg });
      }
    }
  }

  // ── CHECK 16: Header/footer structural integrity ──
  const headerFile2 = path.join(WEBSITE_DIR, 'components', 'header.html');
  const footerFile = path.join(WEBSITE_DIR, 'components', 'footer.html');

  if (fs.existsSync(headerFile2)) {
    const content = fs.readFileSync(headerFile2, 'utf-8');
    const rel = relPath(headerFile2);

    // Header must have navigation links
    const requiredNavLinks = ['/features', '/pricing', '/products/voice-widget', '/products/voice-telephony'];
    for (const link of requiredNavLinks) {
      if (!content.includes(`href="${link}"`)) {
        errors.push({ file: rel, line: 0, rule: 'HEADER_STRUCTURE', msg: `Missing nav link: ${link}` });
      }
    }

    // Header must have mobile menu with same 5 language buttons
    const desktopLangs = (content.match(/data-params="(fr|en|es|ar|ary)"/g) || []).length;
    if (desktopLangs < 10) {
      errors.push({ file: rel, line: 0, rule: 'HEADER_STRUCTURE', msg: `Only ${desktopLangs}/10 lang buttons (need 5 desktop + 5 mobile)` });
    }

    // Header must have CTA buttons (booking/login)
    if (!content.includes('/booking') && !content.includes('/login')) {
      warnings.push({ file: rel, line: 0, rule: 'HEADER_STRUCTURE', msg: 'Missing CTA link (/booking or /login)' });
    }

    // Header must have data-i18n for translateable text
    const i18nCount = (content.match(/data-i18n="/g) || []).length;
    if (i18nCount < 5) {
      errors.push({ file: rel, line: 0, rule: 'HEADER_STRUCTURE', msg: `Only ${i18nCount} data-i18n attributes — header must be fully translateable` });
    }
  }

  if (fs.existsSync(footerFile)) {
    const content = fs.readFileSync(footerFile, 'utf-8');
    const rel = relPath(footerFile);

    // Footer must have 4 category sections
    const requiredSections = ['footer.product', 'footer.solutions', 'nav.resources', 'footer.company'];
    for (const section of requiredSections) {
      if (!content.includes(`data-i18n="${section}"`)) {
        errors.push({ file: rel, line: 0, rule: 'FOOTER_STRUCTURE', msg: `Missing section: ${section}` });
      }
    }

    // Footer must have legal links
    const requiredFooterLinks = ['/privacy', '/terms', '/contact'];
    for (const link of requiredFooterLinks) {
      if (!content.includes(`href="${link}"`)) {
        errors.push({ file: rel, line: 0, rule: 'FOOTER_STRUCTURE', msg: `Missing legal link: ${link}` });
      }
    }

    // Footer must have data-i18n for translateable text
    const footerI18nCount = (content.match(/data-i18n="/g) || []).length;
    if (footerI18nCount < 10) {
      errors.push({ file: rel, line: 0, rule: 'FOOTER_STRUCTURE', msg: `Only ${footerI18nCount} data-i18n attributes — footer must be fully translateable` });
    }

    // Footer must have social links
    if (!content.includes('aria-label="LinkedIn"') && !content.includes('aria-label="GitHub"')) {
      warnings.push({ file: rel, line: 0, rule: 'FOOTER_STRUCTURE', msg: 'Missing social media links' });
    }
  }

  // ── CHECK 18-22: Business/factual patterns (HTML + locale files) ──
  const businessFiles = [
    ...htmlFiles,
    ...findFiles(path.join(WEBSITE_DIR, 'src', 'locales'), ['.json']),
  ];

  for (const file of businessFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    for (const { regex, rule, reason } of BUSINESS_PATTERNS) {
      const globalRegex = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const line = (content.split('\n')[lineNum - 1] || '').trim();

        // Context-aware exceptions:
        // B2C as widget mode label (e.g., "B2C : Prise de RDV") — acceptable
        if (rule === 'ELIMINATED_PRODUCT' && /B2C\s*:/.test(line)) continue;
        // B2C redirect page (meta refresh IS the fix)
        if (rule === 'ELIMINATED_PRODUCT' && line.includes('http-equiv')) continue;
        // 99.9% inside HTML comments
        if (rule === 'UPTIME_CLAIM' && line.includes('<!--')) continue;
        // "60% moins cher" qualified with EU/européen/Europe/Vapi/Retell = acceptable
        if (rule === 'COMPETITIVE_CLAIM' && /europ|EU[\s"'.,)}<]|Vapi|Retell/i.test(line)) continue;

        const target = rule === 'COMPETITIVE_CLAIM' ? warnings : errors;
        target.push({ file: rel, line: lineNum, rule, msg: `"${match[0]}" — ${reason}` });
      }
    }
  }

  // ── CHECK 23: Telephony per-minute price without base fee ──
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relPath(file);

    const hasTelephonyPerMin = /0[.,]10\s*€\s*\/?\s*min/i.test(content);
    const hasBaseFee = /199\s*€/.test(content);

    if (hasTelephonyPerMin && !hasBaseFee) {
      const match = content.match(/0[.,]10\s*€\s*\/?\s*min/i);
      const lineNum = match ? content.substring(0, match.index).split('\n').length : 0;
      warnings.push({ file: rel, line: lineNum, rule: 'TELEPHONY_BASE_MISSING', msg: 'Shows 0.10€/min without 199€/month base fee — incomplete pricing' });
    }
  }

  // ═══════════════════════════════════════════════════════
  // Report
  // ═══════════════════════════════════════════════════════

  const totalFiles = allFiles.length;
  const totalChecks = 23;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        VocalIA Design Token Validator v3.0                  ║');
  console.log('║  Branding + Business factual compliance (23 checks)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nScanned: ${totalFiles} files (${htmlFiles.length} HTML + ${jsFiles.length} JS + ${cssFiles.length} CSS)`);
  console.log(`Checks: ${totalChecks} rules enforced\n`);

  // Group errors by rule
  const errorsByRule = {};
  for (const e of errors) {
    if (!errorsByRule[e.rule]) errorsByRule[e.rule] = [];
    errorsByRule[e.rule].push(e);
  }

  const warningsByRule = {};
  for (const w of warnings) {
    if (!warningsByRule[w.rule]) warningsByRule[w.rule] = [];
    warningsByRule[w.rule].push(w);
  }

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    for (const [rule, items] of Object.entries(errorsByRule)) {
      console.log(`\n  [${rule}] (${items.length})`);
      for (const e of items) {
        console.log(`    ${e.file}${e.line ? ':' + e.line : ''} — ${e.msg}`);
      }
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    for (const [rule, items] of Object.entries(warningsByRule)) {
      console.log(`\n  [${rule}] (${items.length})`);
      for (const w of items.slice(0, 10)) {
        console.log(`    ${w.file}${w.line ? ':' + w.line : ''} — ${w.msg}`);
      }
      if (items.length > 10) {
        console.log(`    ... and ${items.length - 10} more`);
      }
    }
    console.log();
  }

  // Summary table
  console.log('┌────────────────────────────────┬────────┐');
  console.log('│ Check                          │ Status │');
  console.log('├────────────────────────────────┼────────┤');
  const checks = [
    ['1. Forbidden colors', 'FORBIDDEN_COLOR'],
    ['2. Forbidden patterns', 'FORBIDDEN_PATTERN'],
    ['3. Unknown hex colors', 'UNKNOWN_HEX'],
    ['4. Widget duplication', 'WIDGET_DUPLICATE'],
    ['5. Widget version', 'WIDGET_VERSION'],
    ['6. Widget page assignment', 'WIDGET_WRONG_TYPE'],
    ['7. Visualizer overrides', 'VISUALIZER_OVERRIDE'],
    ['8. Stale numbers (HTML)', 'STALE_NUMBER'],
    ['9. Stale numbers (locales)', 'STALE_LOCALE'],
    ['10. Footer/nav opacity', 'OPACITY_NAV_FOOTER'],
    ['11. Widget pulse anim', 'WIDGET_NO_PULSE'],
    ['12. Language switcher', 'LANG_MISSING'],
    ['13. Components.js scripts', 'COMPONENTS_NO_SCRIPT'],
    ['14. CSS variables', 'CSS_VAR_MISSING'],
    ['15. Component coverage', 'COMPONENT_COVERAGE'],
    ['16. Header structure', 'HEADER_STRUCTURE'],
    ['17. Footer structure', 'FOOTER_STRUCTURE'],
    ['18. Eliminated products', 'ELIMINATED_PRODUCT'],
    ['19. Old pricing', 'OLD_PRICING'],
    ['20. Uptime claims', 'UPTIME_CLAIM'],
    ['21. Unverified metrics', 'UNVERIFIED_METRIC'],
    ['22. Competitive claims', 'COMPETITIVE_CLAIM'],
    ['23. Telephony base fee', 'TELEPHONY_BASE_MISSING'],
  ];

  for (const [name, rule] of checks) {
    const eCount = (errorsByRule[rule] || []).length;
    const wCount = (warningsByRule[rule] || []).length;
    let status;
    if (eCount > 0) status = `❌ ${eCount}`;
    else if (wCount > 0) status = `⚠️  ${wCount}`;
    else status = '✅';
    console.log(`│ ${name.padEnd(30)} │ ${status.padEnd(6)} │`);
  }
  console.log('└────────────────────────────────┴────────┘');

  console.log(`\nTotal: ${errors.length} errors, ${warnings.length} warnings`);

  if (errors.length > 0) {
    console.log('\n❌ FAIL — Fix all errors before committing.');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  PASS with warnings — Review recommended.');
  } else {
    console.log('\n✅ ALL CLEAR — Branding fully compliant.');
  }
}

validate();
