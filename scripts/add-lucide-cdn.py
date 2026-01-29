#!/usr/bin/env python3
"""
VocalIA - Add Lucide CDN Script
Session 228 - Inject Lucide CDN into HTML files that use data-lucide
"""

import os
import glob

LUCIDE_SCRIPT = '''
    <!-- Lucide Icons 2026 -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    </script>
'''

def process_html_file(filepath):
    """Add Lucide CDN to HTML file if it uses data-lucide"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if file uses data-lucide icons
        if 'data-lucide=' not in content:
            return False

        # Check if Lucide script is already added
        if 'unpkg.com/lucide' in content:
            return False

        # Add before closing </body> tag
        if '</body>' in content:
            content = content.replace('</body>', f'{LUCIDE_SCRIPT}</body>')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True

        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    html_files = []
    for pattern in ['*.html', '*/*.html', '*/*/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern)))

    print(f"Found {len(html_files)} HTML files")
    print("Adding Lucide CDN script...\n")

    modified_count = 0
    for filepath in sorted(html_files):
        rel_path = os.path.relpath(filepath, website_dir)
        if process_html_file(filepath):
            print(f"  Added CDN: {rel_path}")
            modified_count += 1

    print(f"\nTotal: {modified_count} files updated with Lucide CDN")

if __name__ == '__main__':
    main()
