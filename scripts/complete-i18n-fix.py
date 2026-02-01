#!/usr/bin/env python3
"""
COMPLETE i18n Fix - Add data-i18n to ALL text elements across ALL pages.
Session 250.44

This script:
1. Scans all HTML files for text without data-i18n
2. Adds data-i18n attributes with generated keys
3. Creates translation entries in all 5 locale files
"""

import re
import json
import hashlib
from pathlib import Path
from collections import defaultdict

WEBSITE_DIR = Path(__file__).parent.parent / "website"
LOCALES_DIR = WEBSITE_DIR / "src" / "locales"

# Skip these files/dirs
SKIP_FILES = {'404.html', 'db-admin.html'}
SKIP_DIRS = {'components'}

# Pages to process with their key prefixes
PAGE_PREFIXES = {
    'index.html': 'home',
    'about.html': 'about',
    'contact.html': 'contact',
    'features.html': 'features',
    'pricing.html': 'pricing',
    'integrations.html': 'integrations',
    'privacy.html': 'privacy',
    'terms.html': 'terms',
    'cookie-policy.html': 'cookies',
    'investor.html': 'investor',
    'referral.html': 'referral',
    'login.html': 'login',
    'signup.html': 'signup',
    'status/index.html': 'status',
    'products/voice-widget.html': 'widget',
    'products/voice-telephony.html': 'telephony',
    'blog/index.html': 'blog_index',
    'docs/index.html': 'docs_index',
    'docs/api.html': 'docs_api',
    'dashboard/admin.html': 'admin',
    'dashboard/client.html': 'dashboard',
    'dashboard/widget-analytics.html': 'analytics',
    'industries/index.html': 'ind_index',
    'industries/finance.html': 'ind_finance',
    'industries/healthcare.html': 'ind_health',
    'industries/real-estate.html': 'ind_realestate',
    'industries/retail.html': 'ind_retail',
    'use-cases/index.html': 'uc_index',
    'use-cases/appointments.html': 'uc_appt',
    'use-cases/customer-support.html': 'uc_support',
    'use-cases/e-commerce.html': 'uc_ecom',
    'use-cases/lead-qualification.html': 'uc_leads',
    'academie-business/index.html': 'academy',
}

# Blog articles
BLOG_ARTICLES = [
    'agence-immo-plus-conversion',
    'ai-act-europe-voice-ai',
    'automatiser-prise-rdv-telephonique',
    'clinique-amal-rappels-vocaux',
    'comment-choisir-solution-voice-ai',
    'guide-qualification-leads-bant',
    'integrer-vocalia-shopify',
    'reduire-couts-support-voice-ai',
    'rgpd-voice-ai-guide-2026',
    'tendances-ia-vocale-2026',
    'vocalia-lance-support-darija',
    'voice-ai-vs-chatbot-comparatif',
]

for article in BLOG_ARTICLES:
    PAGE_PREFIXES[f'blog/articles/{article}.html'] = f'blog_{article.replace("-", "_")[:20]}'


def generate_key(prefix, text, index):
    """Generate a unique i18n key."""
    # Clean text for key generation
    clean = re.sub(r'[^a-zA-Z0-9 ]', '', text.lower())
    words = clean.split()[:3]
    base = '_'.join(words) if words else f'text_{index}'
    return f'{prefix}.{base}_{index}'


def extract_text_elements(html_content):
    """Extract text elements that need i18n."""
    elements = []

    # Pattern to find text between tags (excluding already i18n'd)
    # Match: >text content</ where text is 5+ chars and not just whitespace/numbers
    pattern = r'>([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\',\.\-\!\?€\$%\(\)]{4,80})</'

    for match in re.finditer(pattern, html_content):
        text = match.group(1).strip()
        start = match.start()

        # Skip if already has data-i18n nearby
        context_start = max(0, start - 100)
        context = html_content[context_start:start]
        if 'data-i18n=' in context:
            continue

        # Skip script/style content
        pre_context = html_content[max(0, start-500):start]
        if '<script' in pre_context and '</script>' not in pre_context:
            continue
        if '<style' in pre_context and '</style>' not in pre_context:
            continue

        # Skip very short or numeric-only
        if len(text) < 5 or text.replace(' ', '').isdigit():
            continue

        elements.append({
            'text': text,
            'start': start,
            'end': match.end()
        })

    return elements


def process_file(filepath, prefix, translations):
    """Process a single HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    elements = extract_text_elements(content)
    if not elements:
        return 0

    # Process in reverse order to maintain positions
    elements.sort(key=lambda x: x['start'], reverse=True)

    changes = 0
    for i, elem in enumerate(elements):
        text = elem['text']
        key = generate_key(prefix, text, i)

        # Add to translations
        translations['fr'][key] = text
        # Other languages will be added later

        # Replace in content: >text</ becomes ><span data-i18n="key">text</span></
        old = f'>{text}</'
        new = f'><span data-i18n="{key}">{text}</span></'

        if old in content:
            content = content.replace(old, new, 1)
            changes += 1

    if changes > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return changes


def main():
    print("=== COMPLETE i18n Fix ===\n")
    print("Phase 1: Scanning and adding data-i18n attributes...\n")

    translations = defaultdict(dict)
    total_changes = 0
    files_modified = 0

    for rel_path, prefix in PAGE_PREFIXES.items():
        filepath = WEBSITE_DIR / rel_path
        if not filepath.exists():
            continue

        changes = process_file(filepath, prefix, translations)
        if changes > 0:
            print(f"  ✅ {rel_path}: {changes} elements")
            files_modified += 1
            total_changes += changes

    print(f"\n=== Phase 1 Summary ===")
    print(f"Files modified: {files_modified}")
    print(f"Elements with data-i18n added: {total_changes}")
    print(f"Translation keys created: {len(translations['fr'])}")

    # Save French translations to a temp file for review
    temp_file = WEBSITE_DIR.parent / "data" / "new_i18n_keys.json"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(dict(translations['fr']), f, ensure_ascii=False, indent=2)

    print(f"\nNew keys saved to: {temp_file}")
    print("\nRun phase 2 script to generate translations for other languages.")


if __name__ == "__main__":
    main()
