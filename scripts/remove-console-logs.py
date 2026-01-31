#!/usr/bin/env python3
"""
Remove or comment out console.log statements for production.
Session 250.38
"""

import os
import re

# Files to clean (production-facing)
FILES_TO_CLEAN = [
    'website/voice-assistant/voice-widget.js',
    'website/src/lib/gsap-animations.js',
    'website/src/lib/ab-testing.js',
    'website/src/lib/geo-detect.js',
    'website/src/lib/global-localization.js',
    'website/sw.js',
    'website/docs/index.html',
    'website/docs/api.html',
]

def remove_console_logs(filepath):
    """Remove or comment out console.log statements."""
    if not os.path.exists(filepath):
        print(f'❌ {filepath} (not found)')
        return 0

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    count = 0

    # Pattern for console.log(...); on its own line
    # Replace with empty or comment
    patterns = [
        # Full line console.log with various content
        (r'^\s*console\.log\([^)]*\);\s*\n', ''),
        # console.log without semicolon (rare)
        (r'^\s*console\.log\([^)]*\)\s*\n', ''),
        # Inline console.log (keep but comment)
        # Don't remove these as they might break logic
    ]

    for pattern, replacement in patterns:
        matches = re.findall(pattern, content, re.MULTILINE)
        count += len(matches)
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✅ {filepath} ({count} removed)')
        return count
    else:
        print(f'⏭️ {filepath} (no simple console.log found)')
        return 0

def main():
    total = 0
    for filepath in FILES_TO_CLEAN:
        total += remove_console_logs(filepath)
    print(f'\n📊 Total: {total} console.log statements removed')

if __name__ == '__main__':
    main()
