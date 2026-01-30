#!/usr/bin/env python3
"""
VocalIA - Propagate 5-Language Switcher to All Pages
Session 236 - 30/01/2026

Adds the 5-language switcher (FR, EN, ES, AR, ARY) to all HTML pages.
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# The 5-language switcher HTML to insert
LANG_SWITCHER_HTML = '''<!-- Language Switcher -->
            <div class="relative">
              <button onclick="toggleLangDropdown()" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors" aria-label="Changer de langue">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span id="currentLang" class="text-sm font-medium">FR</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div id="langDropdown" class="hidden absolute right-0 mt-2 w-40 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 shadow-xl z-50 overflow-hidden">
                <button onclick="switchLang('fr')" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left">
                  <span class="text-lg">&#127467;&#127479;</span>
                  <span class="text-sm">Francais</span>
                </button>
                <button onclick="switchLang('en')" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left">
                  <span class="text-lg">&#127468;&#127463;</span>
                  <span class="text-sm">English</span>
                </button>
                <button onclick="switchLang('es')" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left">
                  <span class="text-lg">&#127466;&#127480;</span>
                  <span class="text-sm">Espanol</span>
                </button>
                <button onclick="switchLang('ar')" dir="rtl" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-right">
                  <span class="text-lg">&#127480;&#127462;</span>
                  <span class="text-sm">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</span>
                </button>
                <button onclick="switchLang('ary')" dir="rtl" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-right">
                  <span class="text-lg">&#127474;&#127462;</span>
                  <span class="text-sm">&#1575;&#1604;&#1583;&#1575;&#1585;&#1580;&#1577;</span>
                </button>
              </div>
            </div>'''

# The JavaScript for language switching
LANG_SCRIPT = '''<script>
    // Language Switcher
    const LANG_LABELS = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ary: 'دارجة' };

    function toggleLangDropdown() {
      const dropdown = document.getElementById('langDropdown');
      dropdown.classList.toggle('hidden');
    }

    async function switchLang(lang) {
      if (typeof VocaliaI18n !== 'undefined') {
        await VocaliaI18n.setLocale(lang);
        VocaliaI18n.translatePage();
      }
      document.getElementById('currentLang').textContent = LANG_LABELS[lang] || lang.toUpperCase();
      document.getElementById('langDropdown').classList.add('hidden');
      localStorage.setItem('vocalia_lang', lang);
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('langDropdown');
      const button = e.target.closest('[onclick*="toggleLangDropdown"]');
      if (!button && dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    // Initialize language from storage
    document.addEventListener('DOMContentLoaded', () => {
      const savedLang = localStorage.getItem('vocalia_lang') || 'fr';
      document.getElementById('currentLang').textContent = LANG_LABELS[savedLang] || savedLang.toUpperCase();
    });
  </script>'''

# Files to update (excluding index.html which already has it, components, and dashboards which have different layouts)
HTML_FILES = [
    "about.html",
    "contact.html",
    "features.html",
    "integrations.html",
    "pricing.html",
    "privacy.html",
    "terms.html",
    "blog/index.html",
    "changelog.html",
    "docs/index.html",
    "docs/api.html",
    "industries/index.html",
    "industries/finance.html",
    "industries/healthcare.html",
    "industries/real-estate.html",
    "industries/retail.html",
    "products/voice-widget.html",
    "products/voice-telephony.html",
    "use-cases/appointments.html",
    "use-cases/customer-support.html",
    "use-cases/e-commerce.html",
    "use-cases/lead-qualification.html",
]

def find_header_insert_point(content):
    """Find where to insert the language switcher in the header."""
    # Look for the mobile menu button or end of nav links
    patterns = [
        r'(<!-- Mobile Menu Button -->)',
        r'(<button[^>]*id="mobileMenuBtn"[^>]*>)',
        r'(<a[^>]*href="/booking\.html"[^>]*class="[^"]*bg-indigo[^"]*"[^>]*>[^<]*</a>\s*</div>)',
    ]

    for pattern in patterns:
        match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
        if match:
            return match.start()

    return None

def has_lang_switcher(content):
    """Check if page already has the language switcher."""
    return 'id="langDropdown"' in content or 'toggleLangDropdown' in content

def add_lang_switcher(filepath):
    """Add language switcher to a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if has_lang_switcher(content):
            print(f"  SKIP: {filepath.name} - already has switcher")
            return False

        # Find insert point
        insert_point = find_header_insert_point(content)
        if insert_point is None:
            print(f"  WARN: {filepath.name} - could not find insert point")
            return False

        # Insert the language switcher HTML before the mobile menu button
        new_content = content[:insert_point] + LANG_SWITCHER_HTML + "\n\n            " + content[insert_point:]

        # Add the script before </body> if not already present
        if 'toggleLangDropdown' not in new_content and 'switchLang' not in new_content:
            new_content = new_content.replace('</body>', LANG_SCRIPT + '\n</body>')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"  OK: {filepath.name}")
        return True

    except Exception as e:
        print(f"  ERR: {filepath.name} - {e}")
        return False

def main():
    print("VocalIA - Propagate 5-Language Switcher")
    print("=" * 50)

    updated = 0
    skipped = 0
    errors = 0

    for relpath in HTML_FILES:
        filepath = WEBSITE_DIR / relpath
        if not filepath.exists():
            print(f"  MISS: {relpath} - file not found")
            errors += 1
            continue

        result = add_lang_switcher(filepath)
        if result:
            updated += 1
        else:
            skipped += 1

    print("=" * 50)
    print(f"Updated: {updated} | Skipped: {skipped} | Errors: {errors}")

if __name__ == "__main__":
    main()
