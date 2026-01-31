#!/usr/bin/env python3
"""
Add id="main-content" to pages missing it for skip-link accessibility.
Session 250.38
"""

import os
import re
import glob

PAGES_MISSING = [
    'website/academie-business/index.html',
    'website/blog/articles/agence-immo-plus-conversion.html',
    'website/blog/articles/ai-act-europe-voice-ai.html',
    'website/blog/articles/clinique-amal-rappels-vocaux.html',
    'website/blog/articles/integrer-vocalia-shopify.html',
    'website/blog/articles/reduire-couts-support-voice-ai.html',
    'website/blog/articles/rgpd-voice-ai-guide-2026.html',
    'website/blog/articles/vocalia-lance-support-darija.html',
    'website/dashboard/admin.html',
    'website/dashboard/client.html',
    'website/dashboard/widget-analytics.html',
    'website/referral.html',
    'website/status/index.html',
    'website/use-cases/index.html',
]

def add_main_content_id(filepath):
    """Add id='main-content' to first <main> or first content <section>."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'id="main-content"' in content:
        return False

    # Try to add to <main> element first
    if '<main' in content and 'id="main-content"' not in content:
        # Pattern: <main followed by class or >
        content = re.sub(
            r'<main(\s+class="[^"]*")?(\s*)>',
            r'<main\1 id="main-content"\2>',
            content,
            count=1
        )
        # Clean up double spaces
        content = content.replace('  id="main-content"', ' id="main-content"')

    # If no <main>, try first major <section> after header
    elif '<section' in content:
        # Find first section after </header> or after nav
        match = re.search(r'(</header>|</nav>)\s*\n\s*(<section[^>]*)(>)', content)
        if match and 'id="main-content"' not in match.group(2):
            content = content.replace(
                match.group(0),
                match.group(1) + '\n  ' + match.group(2) + ' id="main-content"' + match.group(3)
            )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return True

def main():
    total_modified = 0
    for filepath in PAGES_MISSING:
        if os.path.exists(filepath):
            if add_main_content_id(filepath):
                total_modified += 1
                print(f'✅ {filepath}')
            else:
                print(f'⏭️ {filepath} (already has id)')
        else:
            print(f'❌ {filepath} (not found)')

    print(f'\n📊 Total: {total_modified} files modified')

if __name__ == '__main__':
    main()
