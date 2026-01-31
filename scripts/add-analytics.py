#!/usr/bin/env python3
"""
Add Plausible Analytics to all HTML pages.
Privacy-respecting, GDPR compliant, no cookies.
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / 'website'

# Analytics script to add (before </head>)
ANALYTICS_SCRIPT = '''  <!-- Plausible Analytics (Privacy-First, GDPR Compliant) -->
  <script defer data-domain="vocalia.ma" src="https://plausible.io/js/script.js"></script>
  <script>window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) };</script>
'''

def add_analytics_to_file(file_path):
    """Add analytics script to a single HTML file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has plausible
    if 'plausible.io' in content:
        return False, "Already has Plausible"

    # Skip component files (they're included in other pages)
    if '/components/' in str(file_path):
        return False, "Component file (skipped)"

    # Find </head> and insert before it
    head_close = content.find('</head>')
    if head_close == -1:
        return False, "No </head> found"

    # Insert analytics script
    new_content = content[:head_close] + ANALYTICS_SCRIPT + content[head_close:]

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True, "Added"

def main():
    """Process all HTML files."""
    html_files = list(WEBSITE_DIR.rglob('*.html'))

    added = 0
    skipped = 0

    print(f"Processing {len(html_files)} HTML files...")
    print("-" * 50)

    for file_path in sorted(html_files):
        relative_path = file_path.relative_to(WEBSITE_DIR)
        success, message = add_analytics_to_file(file_path)

        if success:
            added += 1
            print(f"✅ {relative_path}: {message}")
        else:
            skipped += 1
            print(f"⏭️  {relative_path}: {message}")

    print("-" * 50)
    print(f"Added: {added}, Skipped: {skipped}")

if __name__ == '__main__':
    main()
