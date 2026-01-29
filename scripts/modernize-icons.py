#!/usr/bin/env python3
"""
VocalIA - Icons Modernization Script
Replaces Heroicons v1 (2019) with Lucide (2026)
Session 224
"""

import os
import re
import glob

# Icon replacements: old pattern -> new pattern
# These are the full path d="" attribute values

ICON_REPLACEMENTS = {
    # OLD PHONE (Heroicons) -> NEW PHONE (Lucide)
    'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z':
    'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',

    # OLD HEART (Heroicons) -> NEW HEART (Lucide)
    'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z':
    'M2 9.5a5.5 5.5 0 0 1 9.591-3.676A5.5 5.5 0 0 1 21.5 9.5a7.02 7.02 0 0 1-2.104 5.004L12 21.5l-7.396-6.996A7.02 7.02 0 0 1 2 9.5',

    # OLD CHECK (Heroicons) -> NEW CHECK (Lucide)
    'M5 13l4 4L19 7':
    'M20 6L9 17l-5-5',

    # OLD CHEVRON DOWN (Heroicons) -> NEW CHEVRON DOWN (Lucide)
    'M19 9l-7 7-7-7':
    'm6 9 6 6 6-6',

    # OLD GLOBE (Heroicons) - multiple variations
    'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9':
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10',

    # OLD HOME (Heroicons) -> NEW HOME (Lucide)
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6':
    'M9 21H5a2 2 0 0 1-2-2V9l9-7 9 7v10a2 2 0 0 1-2 2h-4M9 21v-7h6v7M9 21h6',

    # OLD MENU (Heroicons) -> NEW MENU (Lucide)
    'M4 6h16M4 12h16M4 18h16':
    'M3 12h18M3 6h18M3 18h18',

    # OLD X/CLOSE (Heroicons) -> NEW X (Lucide)
    'M6 18L18 6M6 6l12 12':
    'M18 6 6 18M6 6l12 12',

    # OLD MAIL (Heroicons) -> NEW MAIL (Lucide)
    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z':
    'M22 6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2zm-2 0-8 5-8-5',

    # OLD CALENDAR (Heroicons) -> NEW CALENDAR (Lucide)
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z':
    'M21 8H3V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zM8 2v4M16 2v4',

    # OLD USER (Heroicons) -> NEW USER (Lucide)
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z':
    'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',

    # OLD CLOCK (Heroicons) -> NEW CLOCK (Lucide)
    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z':
    'M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0',

    # OLD STAR (Heroicons) -> NEW STAR (Lucide)
    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z':
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2',

    # OLD COG/SETTINGS (Heroicons) -> NEW SETTINGS (Lucide)
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z':
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2',
}

# Also need to update stroke-width from 2 to 1.5 globally
def update_stroke_width(content):
    """Replace stroke-width="2" with stroke-width="1.5" """
    return re.sub(r'stroke-width="2"', 'stroke-width="1.5"', content)

def replace_icons(content):
    """Replace old Heroicons paths with new Lucide paths"""
    for old_path, new_path in ICON_REPLACEMENTS.items():
        # Handle both d="..." and d='...' formats
        content = content.replace(f'd="{old_path}"', f'd="{new_path}"')
        content = content.replace(f"d='{old_path}'", f'd="{new_path}"')
        # Handle slight variations in spacing
        old_normalized = old_path.replace(' 0 ', ' 0  ').replace('  ', ' ')
        content = content.replace(f'd="{old_normalized}"', f'd="{new_path}"')
    return content

def process_file(filepath):
    """Process a single HTML file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        modified = original
        modified = update_stroke_width(modified)
        modified = replace_icons(modified)

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

if __name__ == '__main__':
    main()
