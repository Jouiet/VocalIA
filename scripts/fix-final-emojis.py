#!/usr/bin/env python3
"""Fix final remaining emojis"""
import os
import re
import glob

# Additional emoji mappings
EMOJI_MAP = {
    '🏷': 'tag',           # price tag
    '📅': 'calendar',      # calendar
    '🔍': 'search',        # search
    '💳': 'credit-card',   # payment
    '👤': 'user',          # user
    '👗': 'shirt',         # clothing/fashion
    '🏦': 'building',      # bank
    '🔧': 'wrench',        # tools
    '📱': 'smartphone',    # mobile
    '📞': 'phone',         # phone
    '💼': 'briefcase',     # business
    '📊': 'bar-chart-3',   # analytics
    '📦': 'package',       # package
    '📋': 'clipboard-list', # clipboard
    '💬': 'message-square', # chat
    '📈': 'trending-up',    # growth
    '🛒': 'shopping-cart',  # cart
    '⚙️': 'settings',       # settings
    '🔒': 'shield-check',   # security
    '🤖': 'bot',            # AI
    '💎': 'gem',            # premium
    '🏥': 'heart-pulse',    # health
    '🔐': 'lock-keyhole',   # secure
    '✅': 'check-circle',   # success
    '❌': 'x-circle',       # error
    '⚠️': 'alert-triangle', # warning
}

COLOR_MAP = {
    'tag': 'text-blue-400',
    'calendar': 'text-indigo-400',
    'search': 'text-slate-400',
    'credit-card': 'text-emerald-400',
    'user': 'text-blue-400',
    'shirt': 'text-pink-400',
    'building': 'text-slate-400',
    'wrench': 'text-slate-400',
    'smartphone': 'text-purple-400',
    'phone': 'text-emerald-400',
    'briefcase': 'text-slate-400',
    'bar-chart-3': 'text-cyan-400',
    'package': 'text-amber-400',
    'clipboard-list': 'text-indigo-400',
    'message-square': 'text-blue-400',
    'trending-up': 'text-emerald-400',
    'shopping-cart': 'text-amber-400',
    'settings': 'text-slate-400',
    'shield-check': 'text-green-400',
    'bot': 'text-blue-400',
    'gem': 'text-purple-400',
    'heart-pulse': 'text-rose-400',
    'lock-keyhole': 'text-amber-400',
    'check-circle': 'text-emerald-400',
    'x-circle': 'text-red-400',
    'alert-triangle': 'text-amber-400',
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    changes = 0

    for emoji, icon in EMOJI_MAP.items():
        color = COLOR_MAP.get(icon, 'text-slate-400')

        # Pattern: <span class="text-Xxl">emoji</span>
        patterns = [
            (rf'<span class="(text-[^"]*)">{re.escape(emoji)}</span>',
             lambda m: f'<i data-lucide="{icon}" class="w-5 h-5 {color}"></i>'),
            (rf'<span class="text-2xl">{re.escape(emoji)}</span>',
             f'<i data-lucide="{icon}" class="w-8 h-8 {color}"></i>'),
            (rf'<span class="text-lg">{re.escape(emoji)}</span>',
             f'<i data-lucide="{icon}" class="w-5 h-5 {color}"></i>'),
            (rf'<span>{re.escape(emoji)}</span>',
             f'<i data-lucide="{icon}" class="w-5 h-5 {color}"></i>'),
        ]

        for pattern, replacement in patterns:
            if isinstance(replacement, str):
                matches = re.findall(pattern, content)
                if matches:
                    content = re.sub(pattern, replacement, content)
                    changes += len(matches)

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
    print(f"TOTAL: {len(files)} files, {total} changes")

if __name__ == '__main__':
    main()
