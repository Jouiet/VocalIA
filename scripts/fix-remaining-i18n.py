#!/usr/bin/env python3
"""
Fix remaining nav/footer items without data-i18n.
Session 250.44
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Items to fix: (French text, i18n key)
ITEMS = [
    # Nav links (simple <a> tags)
    (r'>Tarifs</a>', r'><span data-i18n="nav.pricing">Tarifs</span></a>'),
    (r'>Fonctionnalités</a>', r'><span data-i18n="nav.features">Fonctionnalités</span></a>'),
    (r'>Connexion</a>', r'><span data-i18n="nav.login">Connexion</span></a>'),
    (r'>Démo</a>', r'><span data-i18n="nav.demo">Démo</span></a>'),

    # Mobile menu items
    (r'>Voice Widget</a>', r'><span data-i18n="products.voice_widget">Voice Widget</span></a>'),
    (r'>Voice Telephony</a>', r'><span data-i18n="products.voice_telephony">Voice Telephony</span></a>'),

    # Footer links
    (r'>Documentation</a>', r'><span data-i18n="footer.links.docs">Documentation</span></a>'),
    (r'>API Reference</a>', r'><span data-i18n="footer.links.api">API Reference</span></a>'),
    (r'>Blog</a>', r'><span data-i18n="footer.links.blog">Blog</span></a>'),
    (r'>À propos</a>', r'><span data-i18n="footer.links.about">À propos</span></a>'),
    (r'>Contact</a>', r'><span data-i18n="footer.links.contact">Contact</span></a>'),
    (r'>Confidentialité</a>', r'><span data-i18n="footer.links.privacy">Confidentialité</span></a>'),
    (r'>CGU</a>', r'><span data-i18n="footer.links.terms">CGU</span></a>'),
    (r'>Cookies</a>', r'><span data-i18n="footer.links.cookies">Cookies</span></a>'),
]


def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content
    changes = 0

    for old, new in ITEMS:
        # Skip if already has the data-i18n from this fix
        if new in content:
            continue

        count = len(re.findall(old, content))
        if count > 0:
            content = re.sub(old, new, content)
            changes += count

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes

    return 0


def main():
    print("=== Fixing Remaining i18n Items ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0
    total_changes = 0

    for filepath in sorted(html_files):
        changes = process_file(filepath)
        if changes:
            print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {changes} changes")
            modified += 1
            total_changes += changes

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")
    print(f"Total changes: {total_changes}")


if __name__ == "__main__":
    main()
