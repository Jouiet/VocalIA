#!/usr/bin/env python3
"""
Fix Connexion button to link to /login instead of /contact.
Session 250.44
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Files to skip (they have legitimate /contact links we don't want to change)
SKIP_FILES = {'login.html', 'signup.html', 'contact.html'}

def process_file(filepath):
    if filepath.name in SKIP_FILES:
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content

    # Pattern 1: Desktop nav button (multi-line, has nav.login)
    # <a href="/contact" ... data-i18n="nav.login">Connexion</a>
    pattern1 = r'(<a\s+href=")(/contact)("[\s\S]*?data-i18n="nav\.login"[\s\S]*?>[\s\S]*?Connexion[\s\S]*?</a>)'
    content = re.sub(pattern1, r'\1/login\3', content)

    # Pattern 2: Mobile menu Connexion button
    # <a href="/contact" class="...bg-vocalia-500...">...Connexion...</a>
    pattern2 = r'(<a\s+href=")(/contact)("[\s\S]*?bg-vocalia-500[\s\S]*?>[\s\S]*?Connexion[\s\S]*?</a>)'
    content = re.sub(pattern2, r'\1/login\3', content)

    # Pattern 3: Simple Connexion link that's NOT in legitimate contact context
    # Be more careful here - only change if it's clearly a login button
    pattern3 = r'(<a\s+href=")(/contact)("\s*\n?\s*class="[^"]*bg-vocalia-500[^"]*"[^>]*>)\s*Connexion\s*(</a>)'
    content = re.sub(pattern3, r'\1/login\3Connexion\4', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False


def main():
    print("=== Fixing Connexion button links ===\n")

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
