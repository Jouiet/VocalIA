#!/usr/bin/env python3
"""
Replace VocalIA logo icons with actual mascot image
Run: python3 scripts/replace-logo-icons.py
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Old patterns to find (various gradient backgrounds with mic icon)
# Using [\s\S] instead of . for multiline matching
OLD_PATTERNS = [
    # Pattern 1: Header nav logo (vocalia colors) - with possible line breaks
    (
        r'<div\s+class="w-10 h-10 rounded-xl bg-gradient-to-br from-vocalia-500 to-vocalia-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-10 h-10 rounded-xl object-contain">'
    ),
    # Pattern 1b: Same but class on next line
    (
        r'<div\s+'
        r'class="w-10 h-10 rounded-xl bg-gradient-to-br from-vocalia-500 to-vocalia-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-10 h-10 rounded-xl object-contain">'
    ),
    # Pattern 2: Footer logo (indigo colors)
    (
        r'<div\s+class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-10 h-10 rounded-xl object-contain">'
    ),
    # Pattern 2b: Same but class on next line
    (
        r'<div\s+'
        r'class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-10 h-10 rounded-xl object-contain">'
    ),
    # Pattern 3: Auth pages (gradient-bg class)
    (
        r'<div class="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-10 h-10 rounded-xl object-contain">'
    ),
    # Pattern 4: Dashboard sidebar (smaller, indigo-600)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 5: App sidebar (vocalia-600)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-vocalia-600 to-vocalia-500 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 6: Status page (smaller)
    (
        r'<div class="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-6 h-6 rounded-lg object-contain">'
    ),
    # Pattern 7: Cookie policy (tiny)
    (
        r'<div class="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-3 h-3 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-5 h-5 rounded object-contain">'
    ),
    # Pattern 8: Login page specific
    (
        r'<div class="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-6 h-6 rounded object-contain">'
    ),
    # Pattern 9: Smaller nav logo
    (
        r'<div class="w-6 h-6 rounded-lg bg-gradient-to-br from-vocalia-600 to-vocalia-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-6 h-6 rounded-lg object-contain">'
    ),
    # Pattern 10: Admin/Client sidebar (indigo-purple)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 11: Blog article nav logo
    (
        r'<div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-7 h-7 rounded-lg object-contain">'
    ),
    # Pattern 12: Status page header
    (
        r'<div class="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-3 h-3 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-4 h-4 rounded object-contain">'
    ),
    # Pattern 13: Cookie policy small
    (
        r'<div class="w-4 h-4 rounded bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-2\.5 h-2\.5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-4 h-4 rounded object-contain">'
    ),
    # Pattern 14: Blog articles (w-8, vocalia colors)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-vocalia-500 to-vocalia-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 15: Login page card
    (
        r'<div class="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-7 h-7 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-12 h-12 rounded-xl object-contain">'
    ),
    # Pattern 16: Cookie policy header
    (
        r'<div class="w-5 h-5 rounded bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shrink-0">\s*'
        r'<i data-lucide="mic" class="w-3 h-3 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-5 h-5 rounded object-contain shrink-0">'
    ),
    # Pattern 17: Cookie policy nav
    (
        r'<div class="w-5 h-5 rounded bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-5 h-5 rounded object-contain">'
    ),
    # Pattern 18: Status header
    (
        r'<div class="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-5 h-5 rounded object-contain">'
    ),
    # Pattern 19: App client sidebar (indigo-600 to purple-600)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-5 h-5 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 20: Login page large logo
    (
        r'<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">\s*'
        r'<i data-lucide="mic" class="w-6 h-6 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-12 h-12 rounded-xl object-contain shadow-lg shadow-indigo-500/25">'
    ),
    # Pattern 21: Cookie/Status nav (w-8 indigo-500 to indigo-400 with w-4 icon)
    (
        r'<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-4 h-4 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-8 h-8 rounded-lg object-contain">'
    ),
    # Pattern 22: Cookie footer (w-6 small)
    (
        r'<div class="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">\s*'
        r'<i data-lucide="mic" class="w-3 h-3 text-white"></i>\s*'
        r'</div>',
        '<img src="/public/images/logo.webp" alt="VocalIA" class="w-6 h-6 rounded object-contain">'
    ),
]

def replace_in_file(filepath):
    """Replace old logo patterns with new mascot image in a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content
        changes = 0

        for old_pattern, new_html in OLD_PATTERNS:
            matches = len(re.findall(old_pattern, content, re.DOTALL))
            if matches > 0:
                content = re.sub(old_pattern, new_html, content, flags=re.DOTALL)
                changes += matches

        if changes > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes
        return 0
    except Exception as e:
        print(f"  Error: {e}")
        return 0

def main():
    print("=" * 60)
    print("VocalIA Logo Replacement Script")
    print("=" * 60)

    html_files = list(WEBSITE_DIR.rglob("*.html"))
    print(f"\nFound {len(html_files)} HTML files")

    total_changes = 0
    files_changed = 0

    for filepath in sorted(html_files):
        rel_path = filepath.relative_to(WEBSITE_DIR)
        changes = replace_in_file(filepath)
        if changes > 0:
            print(f"  [{changes}] {rel_path}")
            total_changes += changes
            files_changed += 1

    print("\n" + "=" * 60)
    print(f"SUMMARY: {total_changes} replacements in {files_changed} files")
    print("=" * 60)

    # Also check for remaining mic icons that might be logos
    print("\nChecking for remaining potential logos...")
    remaining = 0
    for filepath in html_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Check for gradient + mic patterns that weren't caught
        if re.search(r'bg-gradient.*mic.*text-white', content, re.DOTALL):
            if 'logo.webp' not in content or content.count('logo.webp') < 2:
                rel_path = filepath.relative_to(WEBSITE_DIR)
                print(f"  REVIEW: {rel_path}")
                remaining += 1

    if remaining == 0:
        print("  None found - all patterns replaced!")

if __name__ == "__main__":
    main()
