#!/usr/bin/env python3
"""
Fix 403 errors by adding inline fallback script.
Session 250.44

The server (Hostinger/LiteSpeed) returns 403 for newly uploaded JS files.
This script adds an inline fallback that handles:
1. Lucide icons initialization
2. Mobile menu toggle
3. i18n initialization
4. Plausible stub

This works because:
- CSP already has 'unsafe-inline' in script-src
- The inline script doesn't depend on blocked files
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# The inline fallback script - handles all critical functionality
INLINE_FALLBACK = '''
  <!-- Inline Fallback (403 workaround) -->
  <script>
  (function() {
    'use strict';
    // Plausible stub
    window.plausible = window.plausible || function() {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };

    // Lucide icons init
    function initLucide() {
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }

    // Mobile menu
    function initMobileMenu() {
      var btn = document.getElementById('mobileMenuBtn');
      var menu = document.getElementById('mobileMenu');
      if (!btn || !menu) return;

      btn.addEventListener('click', function() {
        var isOpen = menu.classList.contains('translate-x-0');
        if (isOpen) {
          menu.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
          menu.classList.add('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
          document.body.style.overflow = '';
        } else {
          menu.classList.remove('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
          menu.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
          document.body.style.overflow = 'hidden';
        }
      });
    }

    // i18n init
    async function initI18n() {
      if (typeof VocaliaGeo === 'undefined' || typeof VocaliaI18n === 'undefined') return;
      try {
        var geo = await VocaliaGeo.getGeo();
        await VocaliaI18n.initI18n(geo.lang);
        VocaliaI18n.translatePage();
      } catch (e) {}
    }

    // Language switcher
    window.switchLang = async function(lang) {
      if (typeof VocaliaI18n === 'undefined') return;
      await VocaliaI18n.setLocale(lang);
      var labels = {fr:'FR',en:'EN',es:'ES',ar:'AR',ary:'Darija'};
      var el = document.getElementById('currentLang');
      if (el) el.textContent = labels[lang] || lang.toUpperCase();
      var dd = document.getElementById('langDropdown');
      if (dd) dd.classList.add('hidden');
      VocaliaI18n.translatePage();
      localStorage.setItem('vocalia_lang', lang);
    };

    // Init on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        initLucide();
        initMobileMenu();
        initI18n();
      });
    } else {
      initLucide();
      initMobileMenu();
      initI18n();
    }

    // Re-init on load
    window.addEventListener('load', initLucide);
  })();
  </script>
'''

# Files to remove from script references (they return 403)
BLOCKED_FILES = [
    '/src/lib/site-init.js',
    '/src/lib/event-delegation.js',
    '/src/lib/ab-testing.js',
    '/src/lib/form-validation.js',
    '/src/lib/home-page.js',
]

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content
    changes = []

    # Check if inline fallback already exists
    if 'Inline Fallback (403 workaround)' in content:
        return False

    # Remove references to blocked files
    for blocked in BLOCKED_FILES:
        pattern = rf'<script\s+src="{re.escape(blocked)}[^"]*"[^>]*></script>\s*'
        if re.search(pattern, content):
            content = re.sub(pattern, '', content)
            changes.append(f"Removed {blocked}")

    # Add inline fallback after Lucide script
    lucide_pattern = r'(</script>\s*)(<!--\s*i18n\s*System\s*-->)'
    if re.search(lucide_pattern, content):
        # Use string replace to avoid regex escaping issues
        match = re.search(lucide_pattern, content)
        if match:
            insert_pos = match.start(2)
            content = content[:insert_pos] + INLINE_FALLBACK.strip() + '\n  ' + content[insert_pos:]
        changes.append("Added inline fallback")
    elif '</body>' in content:
        # Alternative: add before </body>
        content = content.replace('</body>', INLINE_FALLBACK + '</body>')
        changes.append("Added inline fallback before </body>")

    # Clean up multiple blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {', '.join(changes)}")
        return True

    return False


def main():
    print("=== Fixing 403 errors with inline fallback ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        # Skip components
        if "components/" in str(filepath):
            continue
        if process_file(filepath):
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
