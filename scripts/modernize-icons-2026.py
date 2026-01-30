#!/usr/bin/env python3
"""
VocalIA Icon Modernization Script - 2026 Standards
Replaces obsolete icons with modern equivalents
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# X (formerly Twitter) inline SVG - official X logo
X_LOGO_SVG = '''<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-label="X (Twitter)">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>'''

# Replacements: data-lucide="old" -> data-lucide="new" or inline SVG
ICON_REPLACEMENTS = {
    # Twitter -> X (2023 rebrand)
    'twitter': 'X_LOGO',  # Special case - use inline SVG
}

def process_file(filepath):
    """Process a single HTML file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = []

    # Replace twitter icon with X logo SVG
    # Pattern: <i data-lucide="twitter" class="..."></i>
    twitter_pattern = r'<i data-lucide="twitter"([^>]*)></i>'

    def replace_twitter(match):
        attrs = match.group(1)
        # Extract class if present
        class_match = re.search(r'class="([^"]*)"', attrs)
        if class_match:
            classes = class_match.group(1)
            # Adapt SVG class to match original
            svg = X_LOGO_SVG.replace('class="w-5 h-5"', f'class="{classes}"')
        else:
            svg = X_LOGO_SVG
        return svg.strip()

    new_content = re.sub(twitter_pattern, replace_twitter, content)

    if new_content != original:
        twitter_count = len(re.findall(twitter_pattern, original))
        if twitter_count > 0:
            changes.append(f"twitter → X logo ({twitter_count})")

    content = new_content

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes

    return []

def main():
    print("=== VocalIA Icon Modernization 2026 ===\n")

    total_files = 0
    total_changes = 0

    for html_file in WEBSITE_DIR.rglob("*.html"):
        changes = process_file(html_file)
        if changes:
            rel_path = html_file.relative_to(WEBSITE_DIR)
            print(f"✅ {rel_path}")
            for change in changes:
                print(f"   └─ {change}")
            total_files += 1
            total_changes += len(changes)

    print(f"\n=== Summary ===")
    print(f"Files updated: {total_files}")
    print(f"Icon replacements: {total_changes}")
    print(f"\nTwitter (2019) → X (2026) ✅")

if __name__ == "__main__":
    main()
