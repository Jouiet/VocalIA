#!/usr/bin/env python3
"""
Fix inline initI18n to check localStorage FIRST before geo detection.
Session 250.44

The problem: inline initI18n always passes geo.lang to VocaliaI18n.initI18n(),
ignoring the user's stored preference.

Fix: Check localStorage FIRST, only use geo if no stored preference.
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

OLD_PATTERN = r'''    // i18n init
    async function initI18n\(\) \{
      if \(typeof VocaliaGeo === 'undefined' \|\| typeof VocaliaI18n === 'undefined'\) return;
      try \{
        var geo = await VocaliaGeo\.getGeo\(\);
        await VocaliaI18n\.initI18n\(geo\.lang\);
        VocaliaI18n\.translatePage\(\);
      \} catch \(e\) \{\}
    \}'''

NEW_CODE = '''    // i18n init - Priority: localStorage > geo detection
    async function initI18n() {
      if (typeof VocaliaI18n === 'undefined') return;
      try {
        var storedLang = localStorage.getItem('vocalia_lang');
        if (storedLang) {
          await VocaliaI18n.setLocale(storedLang);
        } else if (typeof VocaliaGeo !== 'undefined') {
          var geo = await VocaliaGeo.getGeo();
          await VocaliaI18n.setLocale(geo.lang);
        } else {
          await VocaliaI18n.setLocale('fr');
        }
        VocaliaI18n.translatePage();
      } catch (e) {}
    }'''


def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content

    # Check if already fixed
    if "var storedLang = localStorage.getItem('vocalia_lang')" in content:
        return False

    # Apply fix using regex
    content = re.sub(OLD_PATTERN, NEW_CODE, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False


def main():
    print("=== Fixing Inline initI18n (localStorage priority) ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        if process_file(filepath):
            print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}")
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
