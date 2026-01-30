#!/usr/bin/env python3
"""
Add i18n.js and geo-detect.js to all pages missing them.
Phase 0 of i18n Implementation Plan.
"""

import os
import re

WEBSITE_DIR = "/Users/mac/Desktop/VocalIA/website"

# Pages that are MISSING i18n scripts (from audit)
PAGES_TO_FIX = [
    "about.html",
    "contact.html",
    "features.html",
    "pricing.html",
    "changelog.html",
    "products/voice-widget.html",
    "products/voice-telephony.html",
    "industries/index.html",
    "industries/healthcare.html",
    "industries/real-estate.html",
    "industries/finance.html",
    "industries/retail.html",
    "docs/index.html",
    "docs/api.html",
    "blog/index.html",
    "blog/articles/reduire-couts-support-voice-ai.html",
    "blog/articles/vocalia-lance-support-darija.html",
    "blog/articles/clinique-amal-rappels-vocaux.html",
    "blog/articles/integrer-vocalia-shopify.html",
    "blog/articles/rgpd-voice-ai-guide-2026.html",
    "blog/articles/agence-immo-plus-conversion.html",
    "blog/articles/ai-act-europe-voice-ai.html",
]

# Script tags to add (before </body>)
I18N_SCRIPTS = '''  <!-- i18n System -->
  <script src="/src/lib/geo-detect.js?v=240"></script>
  <script src="/src/lib/i18n.js?v=240"></script>
'''

def add_i18n_to_page(filepath):
    """Add i18n scripts to a page if not already present."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already has i18n.js
    if 'i18n.js' in content:
        print(f"  SKIP (already has i18n.js): {filepath}")
        return False

    # Find </body> and insert scripts before it
    if '</body>' not in content:
        print(f"  ERROR (no </body>): {filepath}")
        return False

    # Insert before </body>
    new_content = content.replace('</body>', f'{I18N_SCRIPTS}</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ADDED: {filepath}")
    return True

def main():
    print("=" * 60)
    print("Phase 0: Adding i18n Scripts to Missing Pages")
    print("=" * 60)

    added = 0
    skipped = 0
    errors = 0

    for page in PAGES_TO_FIX:
        filepath = os.path.join(WEBSITE_DIR, page)
        if not os.path.exists(filepath):
            print(f"  NOT FOUND: {filepath}")
            errors += 1
            continue

        if add_i18n_to_page(filepath):
            added += 1
        else:
            skipped += 1

    print("=" * 60)
    print(f"RESULTS: Added={added}, Skipped={skipped}, Errors={errors}")
    print("=" * 60)

if __name__ == "__main__":
    main()
