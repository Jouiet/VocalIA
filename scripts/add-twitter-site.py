#!/usr/bin/env python3
"""Add twitter:site meta tag to pages missing it."""

import os
import re
from pathlib import Path

# Pages to update (excluding dashboard and status which are internal)
pages_to_update = [
    "website/products/voice-widget.html",
    "website/products/voice-telephony.html",
    "website/industries/retail.html",
    "website/industries/finance.html",
    "website/industries/index.html",
    "website/industries/real-estate.html",
    "website/industries/healthcare.html",
    "website/docs/index.html",
    "website/docs/api.html",
    "website/blog/index.html",
    "website/blog/articles/ai-act-europe-voice-ai.html",
    "website/blog/articles/vocalia-lance-support-darija.html",
    "website/blog/articles/integrer-vocalia-shopify.html",
    "website/blog/articles/clinique-amal-rappels-vocaux.html",
    "website/blog/articles/rgpd-voice-ai-guide-2026.html",
    "website/blog/articles/reduire-couts-support-voice-ai.html",
    "website/blog/articles/agence-immo-plus-conversion.html",
    "website/academie-business/index.html",
    "website/use-cases/lead-qualification.html",
    "website/use-cases/customer-support.html",
    "website/use-cases/index.html",
    "website/use-cases/e-commerce.html",
    "website/use-cases/appointments.html",
]

TWITTER_CARD_TEMPLATE = '''
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@vocalia_ma">
'''

def add_twitter_site(filepath):
    """Add twitter:site meta tag after og:image or before </head>."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already has twitter:site
    if 'twitter:site' in content:
        print(f"  ⏭️  {filepath} - already has twitter:site")
        return False

    # Try to insert after og:image
    og_image_pattern = r'(<meta property="og:image"[^>]*/>)'
    if re.search(og_image_pattern, content):
        content = re.sub(og_image_pattern, r'\1' + TWITTER_CARD_TEMPLATE, content, count=1)
    else:
        # Insert before </head>
        content = content.replace('</head>', TWITTER_CARD_TEMPLATE + '</head>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  ✅ {filepath}")
    return True

def main():
    base_path = Path(__file__).parent.parent
    updated = 0

    print("Adding twitter:site to pages...\n")

    for page in pages_to_update:
        filepath = base_path / page
        if filepath.exists():
            if add_twitter_site(filepath):
                updated += 1
        else:
            print(f"  ❌ {page} - file not found")

    print(f"\n✅ Updated {updated}/{len(pages_to_update)} pages")

if __name__ == "__main__":
    main()
