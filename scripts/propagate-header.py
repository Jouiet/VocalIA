#!/usr/bin/env python3
"""
VocalIA - Header Component Propagation Script
Replaces old headers with unified mega menu + mobile drawer
Session 224
"""

import os
import re
import glob

# Read the header component
HEADER_COMPONENT_PATH = '/Users/mac/Desktop/VocalIA/website/components/header.html'

def read_header_component():
    """Read the unified header component"""
    with open(HEADER_COMPONENT_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def find_header_boundaries(content):
    """Find the start and end of the header section in an HTML file"""
    # Try to find <!-- Skip Link --> first (preferred start marker)
    skip_link_match = re.search(r'(\s*)<!-- Skip Link -->', content)

    # Or find the start of the nav tag
    nav_match = re.search(r'(\s*)<nav class="fixed top-0', content)

    if skip_link_match:
        start_idx = skip_link_match.start()
        indent = skip_link_match.group(1)
    elif nav_match:
        start_idx = nav_match.start()
        indent = nav_match.group(1)
    else:
        return None, None, ""

    # Find the end of the header section
    # Look for the mobile menu script end (</script>) or </nav> if no mobile menu

    # Check if there's a mobile menu (id="mobileMenu")
    has_mobile_menu = 'id="mobileMenu"' in content[start_idx:]

    if has_mobile_menu:
        # Find the closing script tag after the mobile menu
        # Pattern: </script> followed by whitespace
        mobile_script_end = content.find('})();', start_idx)
        if mobile_script_end != -1:
            # Find the closing </script> tag after this
            script_end = content.find('</script>', mobile_script_end)
            if script_end != -1:
                end_idx = script_end + len('</script>')
                # Include any trailing newlines
                while end_idx < len(content) and content[end_idx] in '\n\r':
                    end_idx += 1
                return start_idx, end_idx, indent

    # Fall back to finding just </nav>
    # Find all </nav> tags and use the last one in the header section
    nav_close_idx = content.find('</nav>', start_idx)
    if nav_close_idx != -1:
        end_idx = nav_close_idx + len('</nav>')
        # Include any trailing newlines
        while end_idx < len(content) and content[end_idx] in '\n\r':
            end_idx += 1
        return start_idx, end_idx, indent

    return None, None, ""

def process_file(filepath, header_component):
    """Process a single HTML file"""
    # Skip dashboard files and component files
    if 'dashboard' in filepath or 'components' in filepath:
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find header boundaries
        start_idx, end_idx, indent = find_header_boundaries(content)

        if start_idx is None or end_idx is None:
            print(f"  Skipped (no header found): {os.path.basename(filepath)}")
            return False

        # Get the old header for comparison
        old_header = content[start_idx:end_idx]

        # Check if already has the new mobile menu
        if '})();' in old_header and 'mobileMenu' in old_header:
            # Already has the new header
            print(f"  Skipped (already updated): {os.path.basename(filepath)}")
            return False

        # Indent the header component appropriately
        indented_header = header_component.strip()
        if indent:
            lines = indented_header.split('\n')
            indented_header = '\n'.join(indent + line if line.strip() else line for line in lines)

        # Replace the old header with the new one
        new_content = content[:start_idx] + indented_header + '\n' + content[end_idx:]

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        return True
    except Exception as e:
        print(f"  Error: {filepath}: {e}")
        return False

def main():
    """Main function"""
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    # Read header component
    header_component = read_header_component()
    print(f"Header component: {len(header_component)} chars")

    # Find all HTML files (excluding dashboards and components)
    html_files = []
    for pattern in ['*.html', '*/*.html', '*/*/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern)))

    # Filter out dashboard and component files
    html_files = [f for f in html_files if 'dashboard' not in f and 'components' not in f]

    print(f"Found {len(html_files)} HTML files to process")

    modified_count = 0
    for filepath in sorted(html_files):
        rel_path = os.path.relpath(filepath, website_dir)
        if process_file(filepath, header_component):
            print(f"  Updated: {rel_path}")
            modified_count += 1

    print(f"\nTotal: {modified_count} files updated")

if __name__ == '__main__':
    main()
