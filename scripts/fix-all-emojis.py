#!/usr/bin/env python3
"""Replace ALL emojis with Lucide icons - COMPLETE CODEBASE FIX"""
import os
import re
import glob

# Comprehensive emoji → Lucide mapping
EMOJI_TO_LUCIDE = {
    # Core icons
    '🤖': 'bot',
    '💎': 'gem',
    '📞': 'phone',
    '🔒': 'shield-check',
    '🔐': 'lock-keyhole',
    '🏥': 'heart-pulse',
    '🇪🇺': 'globe',

    # E-commerce
    '🛒': 'shopping-cart',
    '📦': 'package',
    '💰': 'coins',
    '🎁': 'gift',

    # Analytics & Data
    '📊': 'bar-chart-3',
    '📈': 'trending-up',
    '📋': 'clipboard-list',

    # Communication
    '💬': 'message-square',
    '📱': 'smartphone',
    '🔔': 'bell',
    '📧': 'mail',
    '📣': 'megaphone',

    # Tech & Tools
    '⚙️': 'settings',
    '🔧': 'wrench',
    '💻': 'laptop',
    '🖥️': 'monitor',
    '🌐': 'globe',
    '🔊': 'volume-2',
    '🎤': 'mic',

    # Business
    '💼': 'briefcase',
    '📝': 'file-text',
    '🗓️': 'calendar',
    '👥': 'users',
    '🏠': 'building-2',

    # Status
    '✅': 'check-circle',
    '❌': 'x-circle',
    '⚠️': 'alert-triangle',
    '✨': 'sparkles',
    '🚀': 'rocket',
    '⭐': 'star',
    '🏆': 'trophy',
    '🔑': 'key',
    '🛡️': 'shield',
    '📍': 'map-pin',
    '🔄': 'refresh-cw',

    # Creative
    '🎨': 'palette',
    '💡': 'lightbulb',
    '🎯': 'target',
    '🌟': 'stars',
}

# Color mapping based on context
def get_color_for_icon(icon_name, context=''):
    color_map = {
        'bot': 'text-blue-400',
        'gem': 'text-purple-400',
        'phone': 'text-emerald-400',
        'shield-check': 'text-green-400',
        'lock-keyhole': 'text-amber-400',
        'heart-pulse': 'text-rose-400',
        'globe': 'text-blue-400',
        'shopping-cart': 'text-amber-400',
        'package': 'text-slate-400',
        'bar-chart-3': 'text-cyan-400',
        'trending-up': 'text-emerald-400',
        'clipboard-list': 'text-indigo-400',
        'message-square': 'text-blue-400',
        'smartphone': 'text-purple-400',
        'bell': 'text-yellow-400',
        'settings': 'text-slate-400',
        'check-circle': 'text-emerald-400',
        'alert-triangle': 'text-amber-400',
        'x-circle': 'text-red-400',
        'sparkles': 'text-yellow-400',
        'rocket': 'text-orange-400',
        'star': 'text-yellow-400',
        'trophy': 'text-amber-400',
        'key': 'text-amber-400',
        'briefcase': 'text-slate-400',
        'coins': 'text-yellow-400',
        'mail': 'text-blue-400',
        'mic': 'text-rose-400',
        'volume-2': 'text-cyan-400',
        'lightbulb': 'text-yellow-400',
        'target': 'text-red-400',
        'users': 'text-blue-400',
        'building-2': 'text-slate-400',
        'wrench': 'text-slate-400',
        'laptop': 'text-blue-400',
        'monitor': 'text-blue-400',
        'palette': 'text-pink-400',
        'calendar': 'text-blue-400',
        'file-text': 'text-slate-400',
        'megaphone': 'text-orange-400',
        'gift': 'text-pink-400',
        'refresh-cw': 'text-blue-400',
        'map-pin': 'text-red-400',
        'shield': 'text-green-400',
        'stars': 'text-yellow-400',
    }
    return color_map.get(icon_name, 'text-vocalia-400')

def get_size_class(original_class):
    """Convert text size to icon size"""
    if 'text-5xl' in original_class:
        return 'w-16 h-16'
    elif 'text-4xl' in original_class:
        return 'w-14 h-14'
    elif 'text-3xl' in original_class:
        return 'w-12 h-12'
    elif 'text-2xl' in original_class:
        return 'w-8 h-8'
    elif 'text-xl' in original_class:
        return 'w-6 h-6'
    elif 'text-lg' in original_class:
        return 'w-5 h-5'
    else:
        return 'w-4 h-4'

def replace_emoji_with_lucide(content, filepath):
    """Replace emoji spans/divs with Lucide icons"""
    count = 0

    for emoji, icon_name in EMOJI_TO_LUCIDE.items():
        # Pattern 1: <span class="text-Xxl">emoji</span>
        pattern1 = rf'<span class="(text-[^"]*)">{re.escape(emoji)}</span>'
        matches1 = re.findall(pattern1, content)
        for match in matches1:
            size = get_size_class(match)
            color = get_color_for_icon(icon_name)
            old = f'<span class="{match}">{emoji}</span>'
            new = f'<i data-lucide="{icon_name}" class="{size} {color}"></i>'
            content = content.replace(old, new)
            count += 1

        # Pattern 2: <div class="text-Xxl ...">emoji</div>
        pattern2 = rf'<div class="(text-[^"]*)">{re.escape(emoji)}</div>'
        matches2 = re.findall(pattern2, content)
        for match in matches2:
            size = get_size_class(match)
            color = get_color_for_icon(icon_name)
            old = f'<div class="{match}">{emoji}</div>'
            new = f'<div class="{match.replace("text-3xl", "").replace("text-2xl", "").strip()}"><i data-lucide="{icon_name}" class="{size} {color}"></i></div>'
            content = content.replace(old, new)
            count += 1

        # Pattern 3: <span>emoji</span> (no class)
        pattern3 = rf'<span>{re.escape(emoji)}</span>'
        if re.search(pattern3, content):
            new = f'<i data-lucide="{icon_name}" class="w-5 h-5 {get_color_for_icon(icon_name)}"></i>'
            content = re.sub(pattern3, new, content)
            count += 1

        # Pattern 4: Inline emoji with text (like "🛒 E-commerce")
        pattern4 = rf'{re.escape(emoji)} '
        if emoji in content:
            # Check if it's in a text context
            new = f'<i data-lucide="{icon_name}" class="w-4 h-4 inline {get_color_for_icon(icon_name)}"></i> '
            content = content.replace(emoji + ' ', new)
            # Also just standalone
            if emoji in content:
                content = content.replace(emoji, f'<i data-lucide="{icon_name}" class="w-4 h-4 {get_color_for_icon(icon_name)}"></i>')
            count += content.count(f'data-lucide="{icon_name}"') - count  # Rough count

    return content, count

def main():
    total_fixed = 0
    files_modified = []

    # Find all HTML files
    html_files = glob.glob('/Users/mac/Desktop/VocalIA/website/**/*.html', recursive=True)

    for filepath in html_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        modified, count = replace_emoji_with_lucide(original, filepath)

        if modified != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified)
            rel_path = os.path.relpath(filepath, '/Users/mac/Desktop/VocalIA/website')
            files_modified.append((rel_path, count))
            total_fixed += count
            print(f"  Fixed: {rel_path}")

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_fixed} emojis replaced in {len(files_modified)} files")
    print(f"{'='*50}")

    # Report
    for f, c in sorted(files_modified):
        print(f"  {f}")

if __name__ == '__main__':
    main()
