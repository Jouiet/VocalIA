#!/usr/bin/env python3
"""
Add form-validation.js to pages with forms.
Session 250.37 - P2-4 WCAG Accessibility
"""

import os
import glob
import re

SCRIPT_TAG = '  <script src="/src/lib/form-validation.js" defer></script>'

def has_form(content):
    """Check if page has a form element."""
    return '<form' in content

def has_validation_script(content):
    """Check if page already has validation script."""
    return 'form-validation.js' in content

def add_script_to_file(filepath):
    """Add form validation script before </body>."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not has_form(content):
        return False

    if has_validation_script(content):
        return False

    # Insert before </body>
    if '</body>' in content:
        content = content.replace('</body>', f'{SCRIPT_TAG}\n</body>')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

def main():
    website_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    website_path = os.path.join(website_dir, 'website')

    html_files = glob.glob(os.path.join(website_path, '**/*.html'), recursive=True)

    # Exclude components
    html_files = [f for f in html_files if '/components/' not in f]

    total_modified = 0

    for filepath in sorted(html_files):
        if add_script_to_file(filepath):
            total_modified += 1
            rel_path = os.path.relpath(filepath, website_dir)
            print(f'✅ {rel_path}')

    print(f'\n📊 Total: {total_modified} files modified')

if __name__ == '__main__':
    main()
