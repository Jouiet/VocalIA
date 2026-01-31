#!/usr/bin/env python3
"""
VocalIA - Footer Component Propagation Script
Replaces all footers with the standardized footer from components/footer.html
Session 250 - Updated to read from component file
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"
FOOTER_COMPONENT_PATH = WEBSITE_DIR / "components" / "footer.html"

def read_footer_component():
    """Read the footer component from file"""
    with open(FOOTER_COMPONENT_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def find_footer_boundaries(content):
    """Find the start and end of the footer section"""
    # Find <!-- Footer --> comment or <footer class=
    footer_comment = re.search(r'(\s*)<!-- Footer -->', content)
    footer_tag = re.search(r'(\s*)<footer class="bg-slate-900', content)

    if footer_comment:
        start_idx = footer_comment.start()
        indent = footer_comment.group(1)
    elif footer_tag:
        start_idx = footer_tag.start()
        indent = footer_tag.group(1)
    else:
        return None, None, ""

    # Find </footer>
    footer_end = content.find('</footer>', start_idx)
    if footer_end == -1:
        return None, None, ""

    end_idx = footer_end + len('</footer>')

    # Include any trailing newlines
    while end_idx < len(content) and content[end_idx] in '\n\r':
        end_idx += 1

    return start_idx, end_idx, indent

def process_file(filepath, footer_html):
    """Process a single HTML file"""
    # Skip dashboard and component files
    if 'dashboard' in str(filepath) or 'components' in str(filepath):
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find footer boundaries
        start_idx, end_idx, indent = find_footer_boundaries(content)

        if start_idx is None:
            print(f"  Skipped (no footer found): {filepath.name}")
            return False

        # Get existing footer
        existing_footer = content[start_idx:end_idx]

        # Prepare new footer with proper indentation
        new_footer = "<!-- Footer -->\n" + footer_html

        # Check if already up to date (compare key elements)
        if 'href="/careers"' in existing_footer or 'href="/status"' in existing_footer:
            # Needs update - has old links
            pass
        elif 'href="/use-cases"' in new_footer and 'href="/use-cases"' in existing_footer:
            # Check if the structure is similar
            if 'href="/industries/"' in existing_footer and 'Académie Business' in existing_footer:
                print(f"  Skipped (already updated): {filepath.name}")
                return False

        # Replace footer
        new_content = content[:start_idx] + new_footer + content[end_idx:]

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"  Updated: {filepath.name}")
        return True

    except Exception as e:
        print(f"  Error processing {filepath}: {e}")
        return False

def main():
    print("VocalIA Footer Propagation Script")
    print("=" * 50)

    # Read footer component
    footer_html = read_footer_component()
    print(f"Read footer from: {FOOTER_COMPONENT_PATH}")
    print(f"Footer length: {len(footer_html)} chars")
    print()

    # Find all HTML files
    html_files = list(WEBSITE_DIR.glob("**/*.html"))

    updated = 0
    for filepath in html_files:
        if process_file(filepath, footer_html):
            updated += 1

    print()
    print(f"Total: {updated} files updated")

if __name__ == "__main__":
    main()
