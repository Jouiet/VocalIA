#!/usr/bin/env python3
"""
Fix language switcher across all pages.
Session 250.44

Issues:
1. event-delegation.js not loaded
2. langBtn missing data-action="toggleLangDropdown"
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Files to skip
SKIP_FILES = {'404.html'}
SKIP_DIRS = {'components'}

def process_file(filepath):
    if filepath.name in SKIP_FILES:
        return False
    if any(skip in str(filepath) for skip in SKIP_DIRS):
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content
    changes = []

    # Fix 1: Add event-delegation.js after i18n.js if not present
    if 'event-delegation.js' not in content and 'i18n.js' in content:
        # Pattern: after i18n.js line, add event-delegation.js
        content = re.sub(
            r'(<script src="/src/lib/i18n\.js[^"]*"></script>)',
            r'\1\n  <script src="/src/lib/event-delegation.js?v=250" defer></script>',
            content
        )
        changes.append("Added event-delegation.js")

    # Fix 2: Add data-action="toggleLangDropdown" to langBtn if missing
    if 'id="langBtn"' in content and 'data-action="toggleLangDropdown"' not in content:
        content = re.sub(
            r'(<button[^>]*id="langBtn")([^>]*>)',
            r'\1 data-action="toggleLangDropdown"\2',
            content
        )
        changes.append("Added data-action to langBtn")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {', '.join(changes)}")
        return True

    return False


def main():
    print("=== Fixing Language Switcher ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        if process_file(filepath):
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
