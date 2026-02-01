#!/usr/bin/env python3
"""
Fix CSP to allow unsafe-inline for script-src.
Session 250.44

This is needed because many pages have inline scripts that provide
essential functionality (pricing calculator, visualizers, etc.)
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

def fix_csp(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    # Check if CSP exists and doesn't already have unsafe-inline in script-src
    if "Content-Security-Policy" not in content:
        return False

    if "'unsafe-inline'" in content.split("script-src")[1].split(";")[0] if "script-src" in content else False:
        return False  # Already has unsafe-inline in script-src

    # Add 'unsafe-inline' after 'self' in script-src
    new_content = re.sub(
        r"(script-src\s+'self')",
        r"\1 'unsafe-inline'",
        content
    )

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True

    return False

def main():
    print("=== Adding 'unsafe-inline' to CSP script-src ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        # Skip component files
        if "components/" in str(filepath):
            continue
        if fix_csp(filepath):
            print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}")
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")

if __name__ == "__main__":
    main()
