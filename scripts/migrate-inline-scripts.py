#!/usr/bin/env python3
"""
Migrate inline scripts to site-init.js for CSP compliance.
Session 250.44

This script:
1. Removes inline plausible stub scripts
2. Removes inline mobile menu scripts
3. Removes inline lucide.createIcons scripts
4. Adds site-init.js reference if not present
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Patterns to remove (inline scripts)
PATTERNS_TO_REMOVE = [
    # Plausible stub
    r'<script>\s*window\.plausible\s*=\s*window\.plausible\s*\|\|\s*function\s*\(\)\s*\{\s*\(window\.plausible\.q\s*=\s*window\.plausible\.q\s*\|\|\s*\[\]\)\.push\(arguments\)\s*\}\s*;?\s*</script>',

    # Lucide createIcons with DOMContentLoaded
    r'<script>\s*document\.addEventListener\([\'"]DOMContentLoaded[\'"]\s*,\s*\(\)\s*=>\s*\{\s*if\s*\(typeof\s+lucide\s*!==\s*[\'"]undefined[\'"]\)\s*lucide\.createIcons\(\)\s*;?\s*\}\)\s*;?\s*</script>',

    # Lucide createIcons (simpler variant)
    r'<script>\s*document\.addEventListener\([\'"]DOMContentLoaded[\'"]\s*,\s*function\s*\(\)\s*\{\s*if\s*\(typeof\s+lucide\s*!==\s*[\'"]undefined[\'"]\)\s*lucide\.createIcons\(\)\s*;?\s*\}\)\s*;?\s*</script>',

    # Mobile menu inline script (IIFE pattern)
    r'<!--\s*Mobile\s+Menu\s+Script\s*-->\s*<script>\s*\(function\(\)\s*\{[\s\S]*?mobileMenuBtn[\s\S]*?\}\)\(\)\s*;?\s*</script>',
]

# Files to skip
SKIP_FILES = {
    'components/header.html',
    'components/footer.html',
    'components/newsletter-cta.html',
    'components/analytics.html',
}

def should_skip(filepath):
    rel_path = str(filepath.relative_to(WEBSITE_DIR))
    return rel_path in SKIP_FILES

def has_site_init(content):
    return 'site-init.js' in content

def add_site_init(content):
    """Add site-init.js before event-delegation.js or at end of scripts"""

    # Try to add before event-delegation.js
    if 'event-delegation.js' in content:
        content = re.sub(
            r'(<script\s+src="/src/lib/event-delegation\.js")',
            r'<script src="/src/lib/site-init.js"></script>\n  \1',
            content
        )
    # Or before </body>
    elif '</body>' in content:
        content = re.sub(
            r'(</body>)',
            r'  <script src="/src/lib/site-init.js"></script>\n\1',
            content
        )

    return content

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    content = original
    changes = []

    # Remove inline scripts
    for pattern in PATTERNS_TO_REMOVE:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        if matches:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.MULTILINE)
            changes.append(f"Removed {len(matches)} inline script(s)")

    # Add site-init.js if not present
    if not has_site_init(content):
        content = add_site_init(content)
        if has_site_init(content):
            changes.append("Added site-init.js")

    # Clean up extra blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filepath.name}: {', '.join(changes)}")
        return True
    else:
        return False

def main():
    print("=== Migrating inline scripts to site-init.js ===\n")

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    modified = 0
    skipped = 0

    for filepath in sorted(html_files):
        if should_skip(filepath):
            skipped += 1
            continue

        if process_file(filepath):
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")
    print(f"Files skipped: {skipped}")
    print(f"Total files: {len(html_files)}")

if __name__ == "__main__":
    main()
