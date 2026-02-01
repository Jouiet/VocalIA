#!/usr/bin/env python3
"""
Fix script loading order - geo-detect.js and i18n.js must load BEFORE inline scripts that use them.
Session 250.44
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content

    # Pattern: Find the i18n scripts block that appears AFTER inline script
    # We need to move geo-detect.js and i18n.js BEFORE the inline fallback script

    # Check if this file has the problematic order
    inline_pos = content.find('<!-- Inline Fallback')
    geodetect_pos = content.find('geo-detect.js')

    if inline_pos == -1 or geodetect_pos == -1:
        return False

    if geodetect_pos < inline_pos:
        # Already in correct order
        return False

    # Extract the script tags we need to move
    scripts_pattern = r'(\s*<!-- i18n System -->\s*\n\s*<script src="/src/lib/geo-detect\.js[^"]*"></script>\s*\n\s*<script src="/src/lib/i18n\.js[^"]*"></script>)'

    match = re.search(scripts_pattern, content)
    if not match:
        # Try simpler pattern
        scripts_pattern = r'(\s*<script src="/src/lib/geo-detect\.js[^"]*"></script>\s*\n\s*<script src="/src/lib/i18n\.js[^"]*"></script>)'
        match = re.search(scripts_pattern, content)

    if not match:
        return False

    scripts_block = match.group(1)

    # Remove from original position
    content = content.replace(scripts_block, '')

    # Insert BEFORE the inline fallback script
    insert_marker = '<!-- Inline Fallback'
    if insert_marker in content:
        content = content.replace(
            insert_marker,
            scripts_block.strip() + '\n\n  ' + insert_marker
        )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False


def main():
    print("=== Fixing Script Order (geo-detect.js before inline) ===\n")

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
