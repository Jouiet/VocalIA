#!/usr/bin/env python3
"""
Fix newsletter subtitle fallback text to match official CTA.
Session 250.44

The official subtitle is: "Recevez nos conseils Voice AI et mises à jour produit."
NOT: "Articles, guides et études de cas. Pas de spam."
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

OLD_TEXT = "Articles, guides et études de cas. Pas de spam."
NEW_TEXT = "Recevez nos conseils Voice AI et mises à jour produit."

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    if OLD_TEXT not in content:
        return False

    original = content
    content = content.replace(OLD_TEXT, NEW_TEXT)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}")
        return True

    return False


def main():
    print("=== Fixing Newsletter Subtitle Fallback ===\n")
    print(f"OLD: {OLD_TEXT}")
    print(f"NEW: {NEW_TEXT}\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        if process_file(filepath):
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
