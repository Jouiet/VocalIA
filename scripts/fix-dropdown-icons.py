#!/usr/bin/env python3
"""
Fix dropdown icons to use chevron-down (UX standard) instead of thematic icons.
Session 250.44

Current (non-standard):
- Products: box with rotate
- Solutions: lightbulb with rotate
- Resources: book-open with rotate

Standard (correct):
- All dropdowns: chevron-down with rotate
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Patterns to fix - thematic icons used as dropdown indicators
FIXES = [
    # Products dropdown
    (
        r'(<button[^>]*data-i18n="nav\.products"[^>]*>[\s\S]*?)<i data-lucide="box" class="w-4 h-4 group-hover:rotate-180',
        r'\1<i data-lucide="chevron-down" class="w-4 h-4 group-hover:rotate-180'
    ),
    # Solutions dropdown
    (
        r'(<button[^>]*data-i18n="nav\.solutions"[^>]*>[\s\S]*?)<i data-lucide="lightbulb" class="w-4 h-4 group-hover:rotate-180',
        r'\1<i data-lucide="chevron-down" class="w-4 h-4 group-hover:rotate-180'
    ),
    # Resources dropdown
    (
        r'(<button[^>]*data-i18n="nav\.resources"[^>]*>[\s\S]*?)<i data-lucide="book-open" class="w-4 h-4 group-hover:rotate-180',
        r'\1<i data-lucide="chevron-down" class="w-4 h-4 group-hover:rotate-180'
    ),
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

    for pattern, replacement in FIXES:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            changes.append(pattern.split('"')[1].split('.')[-1])  # Extract nav.X

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {', '.join(set(changes))}")
        return True

    return False


def main():
    print("=== Fixing Dropdown Icons to chevron-down ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        if "components/" in str(filepath):
            continue
        if process_file(filepath):
            modified += 1

    # Also fix component
    component = WEBSITE_DIR / "components" / "header.html"
    if component.exists() and process_file(component):
        modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
