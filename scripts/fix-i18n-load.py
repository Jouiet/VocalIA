#!/usr/bin/env python3
"""
Fix i18n initialization - add window.load handler for initI18n.
Session 250.44

Problem: initI18n() is called before geo-detect.js/i18n.js are loaded.
Fix: Add window.addEventListener('load', initI18n) to run after scripts load.
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"
SKIP_FILES = {'404.html'}

def process_file(filepath):
    if filepath.name in SKIP_FILES:
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content

    # Check if fix already applied
    if "window.addEventListener('load', initI18n)" in content:
        return False

    # Pattern: Add initI18n to window load event after initLucide
    old_pattern = "window.addEventListener('load', initLucide);"
    new_pattern = "window.addEventListener('load', initLucide);\n    window.addEventListener('load', initI18n);"

    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False


def main():
    print("=== Fixing i18n Load Timing ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        if process_file(filepath):
            print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}")
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
