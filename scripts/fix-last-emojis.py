#!/usr/bin/env python3
"""Fix LAST remaining emojis"""
import os
import re
import glob

# Final mappings
EMOJI_MAP = {
    '🏷': ('tag', 'text-blue-400'),
    '🏢': ('building-2', 'text-slate-400'),
    '🏗': ('construction', 'text-amber-400'),
    '📚': ('book-open', 'text-indigo-400'),
    '🦷': ('heart-pulse', 'text-cyan-400'),  # dental → healthcare icon
    '🏨': ('building', 'text-slate-400'),    # hotel
    '🎓': ('graduation-cap', 'text-purple-400'),
    '🎙': ('mic', 'text-rose-400'),          # microphone
    '🟡': ('circle', 'text-yellow-400'),     # status indicator
    '🐍': ('file-code', 'text-yellow-400'),  # Python
    '🐹': ('file-code', 'text-cyan-400'),    # Go
    '🚧': ('alert-triangle', 'text-orange-400'),  # WIP
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = 0

    for emoji, (icon, color) in EMOJI_MAP.items():
        # Various span patterns
        patterns = [
            (f'<span class="text-2xl">{emoji}</span>', f'<i data-lucide="{icon}" class="w-8 h-8 {color}"></i>'),
            (f'<span class="text-xl">{emoji}</span>', f'<i data-lucide="{icon}" class="w-6 h-6 {color}"></i>'),
            (f'<span class="text-lg">{emoji}</span>', f'<i data-lucide="{icon}" class="w-5 h-5 {color}"></i>'),
            (f'<span>{emoji}</span>', f'<i data-lucide="{icon}" class="w-4 h-4 {color}"></i>'),
            # Standalone emoji
            (f'>{emoji}<', f'><i data-lucide="{icon}" class="w-4 h-4 {color} inline"></i><'),
        ]

        for old, new in patterns:
            if old in content:
                content = content.replace(old, new)
                changes += 1

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, changes

    return False, 0

def main():
    total = 0
    files = []

    for f in glob.glob('/Users/mac/Desktop/VocalIA/website/**/*.html', recursive=True):
        modified, count = fix_file(f)
        if modified:
            rel = os.path.relpath(f, '/Users/mac/Desktop/VocalIA/website')
            files.append(rel)
            total += count
            print(f"  Fixed: {rel}")

    print(f"\n{'='*50}")
    print(f"TOTAL: {len(files)} files modified")

if __name__ == '__main__':
    main()
