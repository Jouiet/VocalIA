#!/usr/bin/env python3
"""
Fix navigation menu to use data-i18n attributes.
Session 250.44

Problem: Menu items have hardcoded French text instead of i18n attributes.
Fix: Wrap menu text in spans with data-i18n="nav.*" attributes.
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Menu items to fix: (French text, i18n key, English fallback)
MENU_ITEMS = [
    ('Produits', 'nav.products', 'Products'),
    ('Solutions', 'nav.solutions', 'Solutions'),
    ('Ressources', 'nav.resources', 'Resources'),
    ('Fonctionnalités', 'nav.features', 'Features'),
    ('Tarifs', 'nav.pricing', 'Pricing'),
    ('Démo', 'nav.demo', 'Demo'),
    ('Connexion', 'nav.login', 'Login'),
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

    for fr_text, i18n_key, en_text in MENU_ITEMS:
        # Skip if already has data-i18n for this key
        if f'data-i18n="{i18n_key}"' in content:
            continue

        # Pattern 1: Button with just text (desktop nav)
        # <button ...>Produits<i data-lucide=...
        pattern1 = rf'(<button[^>]*>)\s*\n?\s*{fr_text}\s*\n?\s*(<i data-lucide)'
        replacement1 = rf'\1\n                <span data-i18n="{i18n_key}">{fr_text}</span>\n                \2'
        if re.search(pattern1, content):
            content = re.sub(pattern1, replacement1, content)
            changes.append(f'{i18n_key} (button)')

        # Pattern 2: Standalone text in nav (simpler pattern)
        # >Produits</
        # But be careful not to match already wrapped text

        # Pattern 3: Mobile menu items
        # <span class="...">Produits</span> - if not already i18n
        pattern3 = rf'<span([^>]*?)(?<!data-i18n="{i18n_key}")>({fr_text})</span>'
        # This is tricky, let's use a simpler approach

    # Also fix footer section headers
    footer_items = [
        ('Produits', 'nav.products'),
        ('Ressources', 'nav.resources'),
        ('Entreprise', 'footer.company'),
        ('Légal', 'footer.legal'),
    ]

    for fr_text, i18n_key in footer_items:
        if f'data-i18n="{i18n_key}"' in content:
            continue

        # Footer h4 headers
        pattern = rf'(<h4[^>]*>)({fr_text})(</h4>)'
        if re.search(pattern, content) and f'data-i18n="{i18n_key}"' not in content:
            replacement = rf'\1<span data-i18n="{i18n_key}">\2</span>\3'
            content = re.sub(pattern, replacement, content)
            changes.append(f'{i18n_key} (footer)')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes

    return []


def main():
    print("=== Fixing Nav Menu i18n Attributes ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0
    total_changes = 0

    for filepath in sorted(html_files):
        changes = process_file(filepath)
        if changes:
            print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {', '.join(changes)}")
            modified += 1
            total_changes += len(changes)

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")
    print(f"Total changes: {total_changes}")


if __name__ == "__main__":
    main()
