#!/usr/bin/env python3
"""
Complete footer i18n fix - add data-i18n to ALL footer elements.
Session 250.44
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Footer headers to fix
HEADER_FIXES = [
    # (old pattern, new replacement)
    (r'<h4([^>]*)>Produit</h4>', r'<h4\1><span data-i18n="footer.product">Produit</span></h4>'),
    (r'<h4([^>]*)>Solutions</h4>', r'<h4\1><span data-i18n="footer.solutions">Solutions</span></h4>'),
    (r'<h4([^>]*)>Ressources</h4>', r'<h4\1><span data-i18n="footer.resources">Ressources</span></h4>'),
]

# Footer links to fix (without data-i18n)
LINK_FIXES = [
    (r">Cas d'Usage</a>", r'><span data-i18n="footer.links.use_cases">Cas d\'Usage</span></a>'),
    (r">Par Industrie</a>", r'><span data-i18n="footer.links.industries">Par Industrie</span></a>'),
    (r">E-commerce</a>", r'><span data-i18n="footer.links.ecommerce">E-commerce</span></a>'),
    (r">Service Client</a>", r'><span data-i18n="footer.links.customer_support">Service Client</span></a>'),
    (r">Santé</a>", r'><span data-i18n="footer.links.healthcare">Santé</span></a>'),
    (r">Immobilier</a>", r'><span data-i18n="footer.links.real_estate">Immobilier</span></a>'),
    (r">Académie Business</a>", r'><span data-i18n="footer.links.academy">Académie Business</span></a>'),
    (r">Investisseurs</a>", r'><span data-i18n="footer.links.investors">Investisseurs</span></a>'),
    (r">Intégrations</a>", r'><span data-i18n="footer.links.integrations">Intégrations</span></a>'),
]


def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    original = content
    changes = 0

    # Apply header fixes
    for old, new in HEADER_FIXES:
        if re.search(old, content) and new.split('"')[1] not in content:
            content = re.sub(old, new, content)
            changes += 1

    # Apply link fixes
    for old, new in LINK_FIXES:
        # Skip if already has data-i18n
        i18n_key = new.split('"')[1] if '"' in new else ''
        if old in content and f'data-i18n="{i18n_key}"' not in content:
            content = content.replace(old, new)
            changes += 1

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return changes


def main():
    print("=== Complete Footer i18n Fix ===\n")

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
