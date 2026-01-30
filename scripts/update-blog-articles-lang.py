#!/usr/bin/env python3
"""
VocalIA - Update Blog Articles with Language Switcher
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

LANG_SWITCHER_NAV = '''<div class="flex items-center gap-4">
        <div class="relative">
          <button onclick="toggleLangDropdown()" class="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50 transition text-sm">
            <span id="currentLang">FR</span>
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div id="langDropdown" class="hidden absolute right-0 mt-2 w-32 rounded-lg bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 shadow-xl z-50">
            <button onclick="switchLang('fr')" class="w-full px-3 py-2 hover:bg-slate-700/50 text-left text-sm">Francais</button>
            <button onclick="switchLang('en')" class="w-full px-3 py-2 hover:bg-slate-700/50 text-left text-sm">English</button>
            <button onclick="switchLang('es')" class="w-full px-3 py-2 hover:bg-slate-700/50 text-left text-sm">Espanol</button>
            <button onclick="switchLang('ar')" dir="rtl" class="w-full px-3 py-2 hover:bg-slate-700/50 text-right text-sm">العربية</button>
            <button onclick="switchLang('ary')" dir="rtl" class="w-full px-3 py-2 hover:bg-slate-700/50 text-right text-sm">الدارجة</button>
          </div>
        </div>
        <a href="/blog" class="text-vocalia-300 hover:text-white transition text-sm">← Retour au blog</a>
      </div>'''

LANG_SCRIPT = '''
  <script>
    const LANG_LABELS = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ary: 'دارجة' };
    function toggleLangDropdown() { document.getElementById('langDropdown').classList.toggle('hidden'); }
    function switchLang(lang) {
      document.getElementById('currentLang').textContent = LANG_LABELS[lang] || lang.toUpperCase();
      document.getElementById('langDropdown').classList.add('hidden');
      localStorage.setItem('vocalia_lang', lang);
    }
    document.addEventListener('click', (e) => {
      const d = document.getElementById('langDropdown');
      if (!e.target.closest('[onclick*="toggleLangDropdown"]') && d && !d.contains(e.target)) d.classList.add('hidden');
    });
    document.addEventListener('DOMContentLoaded', () => {
      const l = localStorage.getItem('vocalia_lang') || 'fr';
      document.getElementById('currentLang').textContent = LANG_LABELS[l] || l.toUpperCase();
    });
  </script>
</body>'''

ARTICLES = [
    "blog/articles/agence-immo-plus-conversion.html",
    "blog/articles/ai-act-europe-voice-ai.html",
    "blog/articles/clinique-amal-rappels-vocaux.html",
    "blog/articles/integrer-vocalia-shopify.html",
    "blog/articles/reduire-couts-support-voice-ai.html",
    "blog/articles/rgpd-voice-ai-guide-2026.html",
    "blog/articles/vocalia-lance-support-darija.html",
]

def update_article(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'id="langDropdown"' in content:
            print(f"  SKIP: {filepath.name}")
            return False

        # Replace the simple "Back to blog" link with the new nav structure
        pattern = r'<a href="/blog"[^>]*class="[^"]*text-vocalia-300[^"]*"[^>]*>.*?Retour au blog</a>'
        new_content = re.sub(pattern, LANG_SWITCHER_NAV, content, flags=re.DOTALL)

        # Add script before </body>
        new_content = new_content.replace('</body>', LANG_SCRIPT)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"  OK: {filepath.name}")
        return True

    except Exception as e:
        print(f"  ERR: {filepath.name} - {e}")
        return False

def main():
    print("VocalIA - Update Blog Articles Language Switcher")
    print("=" * 50)

    for relpath in ARTICLES:
        filepath = WEBSITE_DIR / relpath
        if filepath.exists():
            update_article(filepath)
        else:
            print(f"  MISS: {relpath}")

if __name__ == "__main__":
    main()
