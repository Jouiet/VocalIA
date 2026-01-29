#!/usr/bin/env python3
"""
VocalIA - Remove Changelog Links
Session 227 - Delete changelog page and all references
"""

import os
import re
import glob

def remove_changelog_links(content):
    """Remove all changelog links from HTML content"""

    # Pattern 1: Full listitem with changelog link
    # <li><a href="/changelog" ...>Changelog</a></li>
    content = re.sub(
        r'\s*<li>\s*<a\s+href="/changelog"[^>]*>Changelog</a>\s*</li>\s*',
        '',
        content,
        flags=re.IGNORECASE
    )

    # Pattern 2: Standalone link in dropdown/menu
    # <a href="/changelog" class="...">Changelog</a>
    content = re.sub(
        r'\s*<a\s+href="/changelog"[^>]*>Changelog</a>\s*',
        '',
        content,
        flags=re.IGNORECASE
    )

    # Pattern 3: Link with nested content
    content = re.sub(
        r'\s*<a\s+href="/changelog"[^>]*>[^<]*</a>\s*',
        '',
        content,
        flags=re.IGNORECASE
    )

    return content

def process_file(filepath):
    """Process a single HTML file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        if '/changelog' not in original.lower():
            return False

        modified = remove_changelog_links(original)

        if modified != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    # Find all HTML files
    html_files = []
    for pattern in ['*.html', '*/*.html', '*/*/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern)))

    print(f"Found {len(html_files)} HTML files")

    modified_count = 0
    for filepath in sorted(html_files):
        # Skip the changelog file itself
        if 'changelog.html' in filepath:
            continue
        if process_file(filepath):
            rel_path = os.path.relpath(filepath, website_dir)
            print(f"  Modified: {rel_path}")
            modified_count += 1

    print(f"\nTotal: {modified_count} files modified")

    # Update sitemap.xml
    sitemap_path = os.path.join(website_dir, 'sitemap.xml')
    if os.path.exists(sitemap_path):
        with open(sitemap_path, 'r') as f:
            sitemap = f.read()

        # Remove changelog entry from sitemap
        sitemap = re.sub(
            r'\s*<url>\s*<loc>https://vocalia\.ma/changelog</loc>[^<]*</url>',
            '',
            sitemap,
            flags=re.DOTALL
        )

        with open(sitemap_path, 'w') as f:
            f.write(sitemap)
        print("Updated: sitemap.xml")

    # Delete changelog.html
    changelog_path = os.path.join(website_dir, 'changelog.html')
    if os.path.exists(changelog_path):
        os.remove(changelog_path)
        print("Deleted: changelog.html")

if __name__ == '__main__':
    main()
