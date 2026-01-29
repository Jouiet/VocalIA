#!/usr/bin/env python3
"""
VocalIA - Icons Modernization Script V2
Replaces ALL old Heroicons (both Outline and Solid) with Lucide 2026
Session 224 - COMPREHENSIVE FIX
"""

import os
import re
import glob

def modernize_icons(content):
    """
    Replace ALL old Heroicons patterns with modern Lucide 2026 icons
    """

    # ============================================================
    # PATTERN 1: Heroicons Solid Check (viewBox 20x20, fill)
    # OLD: <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
    #        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8..."/>
    # NEW: <svg class="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    #        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/>
    # ============================================================

    # Pattern for solid checkmark with fill="currentColor" viewBox="0 0 20 20"
    old_check_solid = r'''<svg\s+class="([^"]+)"\s+fill="currentColor"\s+viewBox="0 0 20 20"[^>]*>\s*<path\s+fill-rule="evenodd"\s+d="M16\.707 5\.293a1 1 0 010 1\.414l-8 8a1 1 0 01-1\.414 0l-4-4a1 1 0 011\.414-1\.414L8 12\.586l7\.293-7\.293a1 1 0 011\.414 0z"\s*clip-rule="evenodd"\s*/>\s*</svg>'''

    new_check_lucide = r'<svg class="\1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/></svg>'

    content = re.sub(old_check_solid, new_check_lucide, content, flags=re.DOTALL)

    # Pattern with aria-hidden="true"
    old_check_aria = r'''<svg\s+class="([^"]+)"\s+fill="currentColor"\s+viewBox="0 0 20 20"\s+aria-hidden="true">\s*<path\s+fill-rule="evenodd"\s+d="M16\.707 5\.293a1 1 0 010 1\.414l-8 8a1 1 0 01-1\.414 0l-4-4a1 1 0 011\.414-1\.414L8 12\.586l7\.293-7\.293a1 1 0 011\.414 0z"\s*clip-rule="evenodd"\s*/>\s*</svg>'''

    new_check_aria = r'<svg class="\1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/></svg>'

    content = re.sub(old_check_aria, new_check_aria, content, flags=re.DOTALL)

    # Multiline version with flex-shrink-0
    old_check_multiline = r'''<svg\s+class="w-4 h-4 text-green-400 mr-2 flex-shrink-0"\s+fill="currentColor"\s*\n\s*viewBox="0 0 20 20">\s*\n\s*<path\s+fill-rule="evenodd"\s*\n\s*d="M16\.707 5\.293a1 1 0 010 1\.414l-8 8a1 1 0 01-1\.414 0l-4-4a1 1 0 011\.414-1\.414L8 12\.586l7\.293-7\.293a1 1 0 011\.414 0z"\s*\n\s*clip-rule="evenodd"\s*/>\s*</svg>'''

    new_check_multiline = '<svg class="w-4 h-4 text-green-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/></svg>'

    content = re.sub(old_check_multiline, new_check_multiline, content, flags=re.DOTALL)

    # Simple multiline version
    old_check_simple_ml = r'''<svg\s+class="w-4 h-4 text-green-400 mr-2"\s+fill="currentColor"\s*\n\s*viewBox="0 0 20 20">\s*\n\s*<path\s+fill-rule="evenodd"\s*\n\s*d="M16\.707 5\.293a1 1 0 010 1\.414l-8 8a1 1 0 01-1\.414 0l-4-4a1 1 0 011\.414-1\.414L8 12\.586l7\.293-7\.293a1 1 0 011\.414 0z"\s*\n\s*clip-rule="evenodd"\s*/>\s*</svg>'''

    new_check_simple_ml = '<svg class="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/></svg>'

    content = re.sub(old_check_simple_ml, new_check_simple_ml, content, flags=re.DOTALL)

    # ============================================================
    # PATTERN 2: Any remaining viewBox="0 0 20 20" check icons
    # Generic pattern to catch variations
    # ============================================================

    # Generic solid check pattern
    content = re.sub(
        r'fill="currentColor"\s+viewBox="0 0 20 20"',
        'fill="none" stroke="currentColor" viewBox="0 0 24 24"',
        content
    )

    # Old check path
    content = re.sub(
        r'<path\s+fill-rule="evenodd"\s+d="M16\.707 5\.293a1 1 0 010 1\.414l-8 8a1 1 0 01-1\.414 0l-4-4a1 1 0 011\.414-1\.414L8 12\.586l7\.293-7\.293a1 1 0 011\.414 0z"\s*clip-rule="evenodd"\s*/>',
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 6L9 17l-5-5"/>',
        content
    )

    # ============================================================
    # PATTERN 3: Old stroke-width="2" to 1.5
    # ============================================================
    content = re.sub(r'stroke-width="2"', 'stroke-width="1.5"', content)

    # ============================================================
    # PATTERN 4: Remaining Heroicons Outline patterns
    # ============================================================

    # Old phone
    content = content.replace(
        'd="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"',
        'd="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"'
    )

    # Old heart
    content = content.replace(
        'd="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"',
        'd="M2 9.5a5.5 5.5 0 0 1 9.591-3.676A5.5 5.5 0 0 1 21.5 9.5a7.02 7.02 0 0 1-2.104 5.004L12 21.5l-7.396-6.996A7.02 7.02 0 0 1 2 9.5"'
    )

    # Old chevron
    content = content.replace('d="M19 9l-7 7-7-7"', 'd="m6 9 6 6 6-6"')

    return content


def process_file(filepath):
    """Process a single HTML file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        modified = modernize_icons(original)

        if modified != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False


def main():
    """Main function"""
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    # Find all HTML files
    html_files = []
    for pattern in ['**/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern), recursive=True))

    print(f"Found {len(html_files)} HTML files")

    modified_count = 0
    for filepath in sorted(html_files):
        if process_file(filepath):
            rel_path = os.path.relpath(filepath, website_dir)
            print(f"  Modified: {rel_path}")
            modified_count += 1

    print(f"\nTotal: {modified_count} files modified")

    # Verify
    print("\n=== VERIFICATION ===")

    # Check for remaining old patterns
    import subprocess

    # viewBox 20x20
    result = subprocess.run(
        ['grep', '-r', 'viewBox="0 0 20 20"', website_dir, '--include=*.html'],
        capture_output=True, text=True
    )
    count_20 = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0
    print(f"viewBox='0 0 20 20' remaining: {count_20}")

    # fill="currentColor" (excluding social icons)
    result = subprocess.run(
        ['grep', '-c', 'fill="currentColor"', f'{website_dir}/index.html'],
        capture_output=True, text=True
    )
    count_fill = result.stdout.strip() if result.stdout.strip() else '0'
    print(f"fill='currentColor' in index.html: {count_fill}")


if __name__ == '__main__':
    main()
