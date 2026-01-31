#!/usr/bin/env python3
"""
Add SRI (Subresource Integrity) hashes to CDN script tags.
Session 250.37 - Security P1-1
"""

import os
import glob

# SRI hashes (verified from cdnjs API and calculated)
SRI_REPLACEMENTS = [
    # GSAP gsap.min.js (with defer)
    (
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>',
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" integrity="sha512-7eHRwcbYkK4d9g/6tD/mhkf++eoTHwpNM9woBxtPUBWm67zeAfFC+HrdoE2GanKeocly/VxeLvIqwvCdk7qScg==" crossorigin="anonymous" defer></script>'
    ),
    # GSAP ScrollTrigger.min.js (with defer)
    (
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>',
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" integrity="sha512-onMTRKJBKz8M1TnqqDuGBlowlH0ohFzMXYRNebz+yOcc5TQr/zAKsthzhuv0hiyUKEiQEQXEynnXCvNTOk50dg==" crossorigin="anonymous" defer></script>'
    ),
    # Lucide (short URL, with defer)
    (
        '<script src="https://unpkg.com/lucide@0.469.0" defer></script>',
        '<script src="https://unpkg.com/lucide@0.469.0" integrity="sha384-hJnF5AwidE18GSWTAGHv3ByzzvfNZ1Tcx5y1UUV3WkauuMCEzBJBMSwSt/PUPXnM" crossorigin="anonymous" defer></script>'
    ),
    # Lucide (short URL, without defer)
    (
        '<script src="https://unpkg.com/lucide@0.469.0"></script>',
        '<script src="https://unpkg.com/lucide@0.469.0" integrity="sha384-hJnF5AwidE18GSWTAGHv3ByzzvfNZ1Tcx5y1UUV3WkauuMCEzBJBMSwSt/PUPXnM" crossorigin="anonymous"></script>'
    ),
    # Lucide (full URL, with defer)
    (
        '<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js" defer></script>',
        '<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js" integrity="sha384-hJnF5AwidE18GSWTAGHv3ByzzvfNZ1Tcx5y1UUV3WkauuMCEzBJBMSwSt/PUPXnM" crossorigin="anonymous" defer></script>'
    ),
    # Lucide (full URL, without defer)
    (
        '<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"></script>',
        '<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js" integrity="sha384-hJnF5AwidE18GSWTAGHv3ByzzvfNZ1Tcx5y1UUV3WkauuMCEzBJBMSwSt/PUPXnM" crossorigin="anonymous"></script>'
    ),
]

def add_sri_to_file(filepath):
    """Add SRI attributes to script tags in a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    for old, new in SRI_REPLACEMENTS:
        content = content.replace(old, new)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    website_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    website_path = os.path.join(website_dir, 'website')

    html_files = glob.glob(os.path.join(website_path, '**/*.html'), recursive=True)

    total_modified = 0
    modified_files = []

    for filepath in sorted(html_files):
        if add_sri_to_file(filepath):
            total_modified += 1
            rel_path = os.path.relpath(filepath, website_dir)
            modified_files.append(rel_path)
            print(f'✅ {rel_path}')

    print(f'\n📊 Total: {total_modified} files modified')

if __name__ == '__main__':
    main()
