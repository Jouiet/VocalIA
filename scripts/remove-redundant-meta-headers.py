#!/usr/bin/env python3
"""
Remove redundant meta http-equiv tags that should only be HTTP headers.
Session 250.44

These tags are already set in .htaccess and cause console errors:
- X-Frame-Options
- frame-ancestors (part of CSP)

Also updates CSP meta tags to match .htaccess (with plausible.io).
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Updated CSP that matches .htaccess
NEW_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://plausible.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.vocalia.ma https://plausible.io https://ipapi.co; base-uri 'self'; form-action 'self'"

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = content
    changes = []

    # Remove X-Frame-Options meta tag (line 81 typically)
    x_frame_pattern = r'\s*<meta\s+http-equiv="X-Frame-Options"[^>]*>\s*'
    if re.search(x_frame_pattern, content, re.IGNORECASE):
        content = re.sub(x_frame_pattern, '\n', content)
        changes.append("Removed X-Frame-Options meta")

    # Update CSP meta tag to remove frame-ancestors and add plausible.io
    csp_pattern = r'<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*">'
    if re.search(csp_pattern, content, re.IGNORECASE):
        content = re.sub(
            csp_pattern,
            f'<meta http-equiv="Content-Security-Policy" content="{NEW_CSP}">',
            content
        )
        changes.append("Updated CSP (removed frame-ancestors, added plausible.io)")

    # Clean up multiple blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.relative_to(WEBSITE_DIR)}: {', '.join(changes)}")
        return True

    return False


def main():
    print("=== Removing redundant meta headers ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0

    for filepath in sorted(html_files):
        # Skip components
        if "components/" in str(filepath):
            continue
        if process_file(filepath):
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
