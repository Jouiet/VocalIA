#!/usr/bin/env python3
"""Fix remaining emojis (except country flags which are intentional)"""
import os
import re
import glob

# Emojis to replace (excluding country flags)
REPLACEMENTS = {
    # Microphone for logo
    '<span class="text-xl">🎙️</span>': '<i data-lucide="mic" class="w-6 h-6 text-white"></i>',
    '<span class="text-lg">🎙️</span>': '<i data-lucide="mic" class="w-5 h-5 text-white"></i>',

    # Globe for multi-language
    '<span class="text-lg">🌍</span>': '<i data-lucide="globe" class="w-5 h-5 text-blue-400"></i>',
    '<span class="text-xl">🌍</span>': '<i data-lucide="globe" class="w-6 h-6 text-blue-400"></i>',

    # Envelope
    '<span class="text-lg">✉</span>': '<i data-lucide="mail" class="w-5 h-5 text-slate-400"></i>',
    '<span class="text-xl">✉</span>': '<i data-lucide="mail" class="w-6 h-6 text-slate-400"></i>',
    '✉️': '<i data-lucide="mail" class="w-4 h-4 inline text-slate-400"></i>',

    # Checkmarks (common in pricing/features tables)
    '>✓<': '><i data-lucide="check" class="w-5 h-5 text-emerald-400 inline"></i><',
    '>✗<': '><i data-lucide="x" class="w-5 h-5 text-red-400 inline"></i><',
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    count = 0

    for old, new in REPLACEMENTS.items():
        if old in content:
            content = content.replace(old, new)
            count += content.count(new) - original.count(new)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, count
    return False, 0

def main():
    total = 0
    files_modified = []

    for f in glob.glob('/Users/mac/Desktop/VocalIA/website/**/*.html', recursive=True):
        modified, count = fix_file(f)
        if modified:
            rel = os.path.relpath(f, '/Users/mac/Desktop/VocalIA/website')
            files_modified.append(rel)
            total += count
            print(f"  Fixed: {rel}")

    print(f"\n{'='*50}")
    print(f"TOTAL: {len(files_modified)} files modified")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
