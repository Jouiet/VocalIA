#!/usr/bin/env python3
"""
Fix buttons without type attribute.
Session 250.39 - Accessibility fix
"""

import os
import re
import glob

def fix_buttons_in_file(filepath):
    """Add type='button' to buttons missing type attribute."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    count = 0

    # Pattern: <button that doesn't have type=
    # Add type="button" for non-submit buttons
    def replace_button(match):
        nonlocal count
        tag = match.group(0)
        # Skip if already has type
        if 'type=' in tag:
            return tag
        # If it's a submit button (in a form context or has submit text)
        if 'type="submit"' in tag or 'submit' in tag.lower():
            return tag
        count += 1
        # Add type="button" after <button
        return tag.replace('<button', '<button type="button"', 1)

    # Match button tags
    content = re.sub(r'<button(?![^>]*type=)[^>]*>', replace_button, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return count
    return 0

def main():
    website_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    website_path = os.path.join(website_dir, 'website')

    html_files = glob.glob(os.path.join(website_path, '**/*.html'), recursive=True)

    total = 0
    for filepath in sorted(html_files):
        count = fix_buttons_in_file(filepath)
        if count > 0:
            rel_path = os.path.relpath(filepath, website_dir)
            print(f'✅ {rel_path}: {count} buttons fixed')
            total += count

    print(f'\n📊 Total: {total} buttons fixed')

if __name__ == '__main__':
    main()
