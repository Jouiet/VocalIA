#!/usr/bin/env python3
"""
VocalIA - Icon Modernization Script
Session 228 - Replace ALL inline SVGs with Lucide Icons (2026 Standard)

Lucide Icons: https://lucide.dev
CDN: https://unpkg.com/lucide@latest
"""

import os
import re
import glob

# Lucide CDN script to inject
LUCIDE_SCRIPT = '''
    <!-- Lucide Icons 2026 -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    </script>
'''

# Icon path patterns to Lucide mappings
# Format: (regex_pattern_for_path, lucide_icon_name)
ICON_MAPPINGS = [
    # Check/checkmark icons
    (r'M20 6L9 17l-5-5|M5 13l4 4L19 7', 'check'),

    # Arrow icons
    (r'M19 14l-7 7m0 0l-7-7m7 7V3', 'arrow-down'),
    (r'M5 10l7-7m0 0l7 7m-7-7v18', 'arrow-up'),
    (r'M9 5l7 7-7 7', 'chevron-right'),
    (r'M15 19l-7-7 7-7', 'chevron-left'),
    (r'M19 9l-7 7-7-7', 'chevron-down'),
    (r'M5 15l7-7 7 7', 'chevron-up'),
    (r'M17 8l4 4m0 0l-4 4m4-4H3', 'arrow-right'),
    (r'M7 16l-4-4m0 0l4-4m-4 4h18', 'arrow-left'),

    # Menu icons
    (r'M4 6h16M4 12h16M4 18h16', 'menu'),
    (r'M6 18L18 6M6 6l12 12', 'x'),

    # Communication icons
    (r'M3 8l7.89 5.26.*7.89-5.26', 'mail'),
    (r'M21 11.5a8.38.*3 8l7.89 5.26', 'mail'),
    (r'M22 16.92v3a2.*phone', 'phone'),
    (r'M13.832 16.568.*6.392 6.384', 'phone'),
    (r'M3 5a2 2.*telephony|phone', 'phone'),

    # Globe/World icons
    (r'M12 2a10 10.*0 0 0-20.*M2 12h20.*M12 2a15.3', 'globe'),
    (r'M21.54 15H17.*2.18 2.18 0', 'globe-2'),
    (r'M12 22C6.477 22 2 17.523', 'globe'),

    # User/People icons
    (r'M16 7a4 4.*M12 14a7 7', 'user'),
    (r'M20 21v-2a4 4.*M4 21v-2a4 4', 'users'),
    (r'M17 21v-2a4 4.*13 21v-2', 'users'),
    (r'M12 4.354a4 4 0 1 1 0 5.292', 'user-circle'),

    # Settings/Gear icons
    (r'M12 15a3 3.*M19.4 15.*cog|gear|settings', 'settings'),
    (r'M9.594 3.94c.09-.542.*gear', 'settings'),
    (r'M12 8a4 4 0 1 0 0 8.*M2 12.*M20 12.*M12 2.*M12 20', 'settings'),

    # Document/File icons
    (r'M9 12h6m-6 4h6m2 5H7a2 2.*file|document', 'file-text'),
    (r'M7 21h10a2 2.*M14 2H6a2 2', 'file'),
    (r'M14 2H6a2 2.*h12a2 2', 'file'),
    (r'M4 4v16.*M20 4v16', 'file'),

    # Search icons
    (r'M21 21l-6-6m2-5a7 7|M21 21l-4.35-4.35', 'search'),
    (r'M10 21a7 7 0 1 0 0-14', 'search'),

    # Home icons
    (r'M3 9l9-7 9 7v11a2 2|M3 10a2 2.*l7-6.*home', 'home'),
    (r'M15 21v-8.*M3 10a2 2', 'home'),

    # Chart/Analytics icons
    (r'M18 20V10m-6 10V4M6 20v-6', 'bar-chart-3'),
    (r'M3 3v18h18|M18 17V9.*M13 17V5.*M8 17v-3', 'bar-chart-2'),
    (r'M12 20V10m6 10V4M6 20v-4', 'bar-chart'),
    (r'M22 12h-4l-3 9L9 3l-3 9H2', 'activity'),
    (r'M3 3v18h18.*line|trend', 'trending-up'),

    # Clock/Time icons
    (r'M12 8v4l3 3m6-3a9 9|M12 6v6h4.5', 'clock'),
    (r'M21 12a9 9.*M12 8v4l3 3', 'clock'),
    (r'M12 2v4.*M12 18v4.*M4.93 4.93', 'clock'),

    # Calendar icons
    (r'M8 2v4m8-4v4.*M3 10h18', 'calendar'),
    (r'M19 4H5a2 2.*rect.*calendar', 'calendar'),
    (r'M21 8H3V6a2 2 0 0 1 2-2h14a2 2', 'calendar'),

    # Bell/Notification icons
    (r'M18 8A6 6.*M13.73 21', 'bell'),
    (r'M10 5a2 2 0 0 1 4 0.*M6 8a6 6', 'bell'),

    # Heart/Favorite icons
    (r'M20.84 4.61a5.5 5.5|M2 9.5a5.5 5.5.*heart', 'heart'),
    (r'M19 14c1.49-1.46.*heart', 'heart'),

    # Star icons
    (r'M12 2l3.09 6.26L22 9.27|M11.049 2.927.*star', 'star'),
    (r'M12 17.27L18.18 21', 'star'),

    # Eye icons
    (r'M1 12s4-8 11-8.*eye|M2 12s3-7 10-7', 'eye'),
    (r'M15 12a3 3.*M2.458 12C3.732', 'eye'),

    # Lock/Security icons
    (r'M19 11H5a2 2.*M7 11V7a5 5|rect.*lock', 'lock'),
    (r'M12 17a2 2 0 1 0 0-4.*lock', 'lock'),
    (r'M16.5 9.4l-9-5.19M21 16V8.*M3.27 6.96', 'shield'),
    (r'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10', 'shield'),
    (r'M9 12l2 2 4-4m5.618-4.016', 'shield-check'),

    # Database icons
    (r'M3 12a9 3 0 0 0 18 0.*M3 5.*database', 'database'),
    (r'M21 5a9 3 0 1 1-18 0', 'database'),

    # Cloud icons
    (r'M18 10h-1.26A8 8.*cloud', 'cloud'),
    (r'M17.5 19H9a7 7 0 1 1 6.71-9h1.79', 'cloud'),

    # Download/Upload icons
    (r'M21 15v4a2 2.*M7 10l5 5 5-5.*download', 'download'),
    (r'M4 16v1a3 3.*M12 12v9.*download', 'download'),
    (r'M21 15v4a2 2.*M17 8l-5-5-5 5.*upload', 'upload'),

    # Trash/Delete icons
    (r'M19 7l-.867 12.142.*M1 trash|M3 6h18', 'trash-2'),
    (r'M4 7h16.*M10 11v6.*M14 11v6', 'trash-2'),

    # Edit/Pencil icons
    (r'M11 4H4a2 2.*M18.5 2.5a2.121|pencil|edit', 'pencil'),
    (r'M12 20h9.*M16.5 3.5a2.121', 'pencil'),

    # Plus/Add icons
    (r'M12 4v16m8-8H4|M12 5v14.*M5 12h14', 'plus'),
    (r'M12 6v12m6-6H6', 'plus'),

    # Minus icons
    (r'M5 12h14|M6 12h12', 'minus'),

    # Copy icons
    (r'M8 4v12a2 2.*M16 4h2a2 2', 'copy'),
    (r'M9 5H7a2 2.*M9 5a2 2 0 0 1 2-2h2', 'clipboard'),

    # External link icons
    (r'M18 13v6a2 2.*M15 3h6v6.*M10 14L21 3', 'external-link'),
    (r'M10 6H6a2 2.*M14 4h6m0 0v6m0-6', 'external-link'),

    # Message/Chat icons
    (r'M21 15a2 2.*M17 9V6a2 2.*message|chat', 'message-square'),
    (r'M8 12h.01M12 12h.01M16 12h.01', 'message-circle'),
    (r'M7.9 20A9 9 0 1 0 4 16.1L2 22', 'message-circle'),

    # Mic/Audio icons
    (r'M12 1a3 3.*M19 10v2a7 7.*mic', 'mic'),
    (r'M12 2a3 3 0 0 0-3 3v7a3 3', 'mic'),

    # Volume/Speaker icons
    (r'M11 5L6 9H2v6h4l5 4V5z|M3 9v6h4l5 5V4L7 9H3', 'volume-2'),
    (r'M3 9v6h4l5 4V5z.*M16.5 12', 'volume-2'),

    # Play/Pause/Stop icons
    (r'M5 3l14 9-14 9V3z|M6 3.*19 12.*6 21', 'play'),
    (r'M10 9v6.*M14 9v6|M6 4h4v16H6.*M14 4h4', 'pause'),
    (r'M6 4h12v16H6', 'square'),

    # Refresh icons
    (r'M23 4v6h-6.*M1 20v-6h6.*rotate|refresh', 'refresh-cw'),
    (r'M21 2v6h-6.*M3 12a9 9', 'refresh-cw'),

    # Zap/Lightning icons
    (r'M13 2L3 14h9l-1 8 10-12h-9l1-8|M4 14.*13 10 10', 'zap'),
    (r'M13 3L4 14h7l-2 7 9-11h-7', 'zap'),

    # Sun/Moon icons
    (r'M12 3v1m0 16v1m9-9h-1M4 12H3.*sun', 'sun'),
    (r'M21 12.79A9 9.*moon', 'moon'),
    (r'M12 3a6 6 0 0 0 9 9.*moon', 'moon'),

    # Info icons
    (r'M12 16v-4.*M12 8h.01|M13 16h-1v-4h-1', 'info'),
    (r'M12 2a10 10.*M12 16v-4.*M12 8h.01', 'info'),

    # Warning/Alert icons
    (r'M12 9v2m0 4h.01.*M10.29 3.86|triangle.*alert', 'alert-triangle'),
    (r'M7.86 2h8.28L22 7.86v8.28L16.14 22', 'alert-octagon'),

    # Success/Circle check icons
    (r'M22 11.08V12a10 10.*M9 11l3 3L22 4', 'check-circle'),
    (r'M12 2a10 10.*M9 12l2 2 4-4', 'check-circle-2'),

    # Error/X circle icons
    (r'M12 2a10 10.*M15 9l-6 6.*M9 9l6 6', 'x-circle'),

    # Code icons
    (r'M16 18l6-6-6-6.*M8 6l-6 6 6 6', 'code'),
    (r'M8 18l-6-6 6-6.*M16 6l6 6-6 6', 'code-2'),

    # Terminal icons
    (r'M4 17l6-6-6-6.*M12 19h8', 'terminal'),

    # Link icons
    (r'M10 13a5 5.*M14 11a5 5.*link', 'link'),
    (r'M15 7h3a5 5.*M9 17h-3a5 5', 'link'),

    # Image icons
    (r'M4 5a1 1.*image|photo', 'image'),
    (r'M21 19V5a2 2.*M21 15l-5-5L5', 'image'),

    # Video icons
    (r'M23 7l-7 5 7 5V7z.*video', 'video'),
    (r'M15 10l4.553-2.276.*video', 'video'),

    # Headphones icons
    (r'M3 18v-6a9 9.*headphone', 'headphones'),

    # Wifi icons
    (r'M5 12.55a11 11.*wifi', 'wifi'),

    # Bluetooth icons
    (r'M6.5 6.5l11 11.*bluetooth', 'bluetooth'),

    # Battery icons
    (r'M17 6h4v10h-4.*battery', 'battery'),

    # Credit card icons
    (r'M1 4c0-1.1.9-2 2-2h18.*card', 'credit-card'),
    (r'M21 4H3a2 2.*M1 10h22', 'credit-card'),

    # Shopping cart icons
    (r'M3 3h2l.4 2M7 13h10l4-8|M1 1h4l2.68 13.39', 'shopping-cart'),
    (r'M6 2L3 6v14a2 2.*circle.*circle.*cart', 'shopping-cart'),

    # Bag/Shopping bag icons
    (r'M16 10a4 4 0 0 1-8 0.*M3.103 6.034.*bag', 'shopping-bag'),
    (r'M6 2L3 6v14.*M16 10a4 4', 'shopping-bag'),

    # Box/Package icons
    (r'M21 8a2 2.*M3.27 6.96.*box|package', 'box'),
    (r'M21 16V8a2 2.*M3.27 6.96', 'package'),

    # Truck/Delivery icons
    (r'M1 3h15v13H1.*M16 8h4l3 3v5h-7', 'truck'),

    # Building icons
    (r'M3 21h18.*M9 21V3h6v18|building', 'building'),
    (r'M6 10H4a2 2.*M6 21V5a2 2', 'building-2'),

    # Briefcase icons
    (r'M20 7H4a2 2.*M16 21V5a2 2.*briefcase', 'briefcase'),
    (r'M12 12h.01.*M16 6V4a2 2', 'briefcase'),

    # Layers icons
    (r'M12 2L2 7l10 5 10-5-10-5.*layers', 'layers'),
    (r'M2 17l10 5 10-5.*M2 12l10 5 10-5', 'layers'),

    # Grid icons
    (r'M10 3H3v7h7V3z.*M21 3h-7v7h7V3z.*grid', 'grid-3x3'),
    (r'M3 3h7v7H3.*M14 3h7v7h-7', 'grid-2x2'),

    # List icons
    (r'M8 6h13.*M8 12h13.*M8 18h13.*M3 6h.01', 'list'),

    # Filter icons
    (r'M22 3H2l8 9.46V19l4 2v-8.54L22 3', 'filter'),

    # Sliders icons
    (r'M4 21v-7.*M4 10V3.*M12 21v-9.*sliders', 'sliders'),

    # Target icons
    (r'M22 12h-4.*M6 12H2.*M12 6V2.*target', 'target'),
    (r'M12 22a10 10.*M12 18a6 6.*M12 14a2 2', 'target'),

    # Award/Badge icons
    (r'M12 15a3 3.*M19.4 15a1.65.*award', 'award'),

    # Gift icons
    (r'M20 12v10H4V12.*M2 7h20v5H2.*gift', 'gift'),

    # Key icons
    (r'M21 2l-2 2m-7.61 7.61.*key', 'key'),

    # Tag icons
    (r'M20.59 13.41l-7.17 7.17.*tag', 'tag'),

    # Bookmark icons
    (r'M19 21l-7-5-7 5V5a2 2.*bookmark', 'bookmark'),

    # Flag icons
    (r'M4 15s1-1 4-1.*M4 22v-7.*flag', 'flag'),

    # Pin/Location icons
    (r'M21 10c0 7-9 13-9 13s-9-6-9-13.*M12 2.*pin|location', 'map-pin'),
    (r'M20 10c0 6-8 12-8 12s-8-6-8-12', 'map-pin'),

    # Compass icons
    (r'M12 2a10 10.*polygon.*compass', 'compass'),

    # Send icons
    (r'M22 2L11 13.*M22 2l-7 20-4-9-9-4.*send', 'send'),

    # Share icons
    (r'M4 12v8a2 2.*M16 6l-4-4-4 4.*share', 'share'),
    (r'M18 8a3 3.*M6 15a3 3.*share', 'share-2'),

    # Rocket icons
    (r'M4.5 16.5c-1.5.*rocket', 'rocket'),

    # Sparkle/AI icons
    (r'M9.937 15.5A2.*sparkle', 'sparkles'),
    (r'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15', 'sparkles'),

    # CPU/Chip icons
    (r'M18 12h.01.*M6 12h.01.*M12 18.*cpu|chip', 'cpu'),

    # Server icons
    (r'M2 4h20v6H2z.*M2 14h20v6H2z.*server', 'server'),

    # Folder icons
    (r'M22 19a2 2.*M2 7a2 2.*folder', 'folder'),

    # Archive icons
    (r'M21 8v13H3V8.*M1 3h22v5H1.*archive', 'archive'),

    # Inbox icons
    (r'M22 12h-6.*inbox', 'inbox'),

    # Log out icons
    (r'M9 21H5a2 2.*M16 17l5-5-5-5.*logout|log-out', 'log-out'),

    # Log in icons
    (r'M15 3h4a2 2.*M10 17l5-5-5-5.*login|log-in', 'log-in'),

    # Dollar/Money icons
    (r'M12 8c-1.657.*M12 8V7m0 1v8.*dollar|money', 'dollar-sign'),
    (r'M12 2v20m5-17H9.5a3.5 3.5', 'dollar-sign'),

    # Percent icons
    (r'M19 5L5 19.*M6.5 9a2.5 2.5.*percent', 'percent'),

    # Trending up icons
    (r'M23 6l-9.5 9.5-5-5L1 18|M22 7l-8.5 8.5-5-5L2 17', 'trending-up'),

    # Trending down icons
    (r'M23 18l-9.5-9.5-5 5L1 6', 'trending-down'),

    # Help circle icons
    (r'M12 22a10 10.*M9.09 9a3 3.*M12 17h.01', 'help-circle'),

    # More horizontal icons
    (r'M12 12h.01.*M19 12h.01.*M5 12h.01', 'more-horizontal'),

    # More vertical icons
    (r'M12 5v.01.*M12 12v.01.*M12 19v.01', 'more-vertical'),

    # Maximize icons
    (r'M8 3H5a2 2.*M21 8V5a2 2.*maximize', 'maximize'),

    # Minimize icons
    (r'M8 3v3a2 2.*M21 8h-3a2 2.*minimize', 'minimize'),

    # Expand icons
    (r'M15 3h6v6.*M9 21H3v-6.*expand', 'expand'),

    # Shrink icons
    (r'M4 14h6v6.*M20 10h-6V4.*shrink', 'shrink'),

    # Sidebar icons
    (r'M3 3h18v18H3.*sidebar', 'panel-left'),

    # Layout icons
    (r'M19 3H5a2 2.*layout', 'layout'),

    # Columns icons
    (r'M12 3h7a2 2.*M5 3h7v18H5.*columns', 'columns'),

    # Table icons
    (r'M3 3h18v18H3.*M3 9h18.*M9 21V9.*table', 'table'),

    # Palette icons
    (r'M12 2.69l5.66 5.66.*palette', 'palette'),

    # Wand icons
    (r'M15 4V2.*M15 16v-2.*wand', 'wand-2'),

    # Scissors icons
    (r'M6 9a3 3.*M20 4L8.12 15.88.*scissors', 'scissors'),

    # Crop icons
    (r'M6.13 1L6 16a2 2.*crop', 'crop'),

    # Move icons
    (r'M5 9l-3 3 3 3.*M9 5l3-3 3 3.*move', 'move'),

    # Undo icons
    (r'M3 7v6h6.*M21 17a9 9.*undo', 'undo'),

    # Redo icons
    (r'M21 7v6h-6.*M3 17a9 9.*redo', 'redo'),

    # Corner icons
    (r'M9 4H4v5.*corner', 'corner-up-left'),

    # Workflow icons
    (r'M3 3h18v18H3.*workflow', 'workflow'),

    # Power icons
    (r'M18.36 6.64a9 9.*M12 2v10.*power', 'power'),

    # Repeat icons
    (r'M17 1l4 4-4 4.*M3 11V9a4 4.*repeat', 'repeat'),

    # Shuffle icons
    (r'M16 3h5v5.*M4 20L21 3.*shuffle', 'shuffle'),

    # Fast forward icons
    (r'M13 19l9-7-9-7v14z.*M2 19l9-7-9-7.*fast-forward', 'fast-forward'),

    # Rewind icons
    (r'M11 19l-9-7 9-7v14z.*M22 19l-9-7 9-7.*rewind', 'rewind'),

    # Skip forward icons
    (r'M5 4l10 8-10 8V4z.*M19 5v14.*skip', 'skip-forward'),

    # Skip back icons
    (r'M19 20L9 12l10-8v16z.*M5 19V5.*skip', 'skip-back'),

    # Support/Headset icons
    (r'M18.364 5.636.*M9.172 9.172.*support', 'life-buoy'),

    # Smile icons
    (r'M12 2a10 10.*M8 14s1.5 2 4 2.*smile', 'smile'),

    # Frown icons
    (r'M12 2a10 10.*M16 16s-1.5-2-4-2.*frown', 'frown'),

    # Meh icons
    (r'M12 2a10 10.*M8 15h8.*meh', 'meh'),

    # Thumbs up icons
    (r'M14 9V5a3 3.*M18 14h-2.*thumbs-up', 'thumbs-up'),

    # Thumbs down icons
    (r'M10 15v4a3 3.*thumbs-down', 'thumbs-down'),

    # Hand icons
    (r'M18 11V6a2 2.*hand', 'hand'),

    # Pointer icons
    (r'M22 14a8 8.*pointer', 'pointer'),

    # Mouse icons
    (r'M12 2a6 6.*M12 6v4.*mouse', 'mouse'),

    # Type icons
    (r'M4 7V4h16v3.*M9 20h6.*type', 'type'),

    # Bold icons
    (r'M6 4h8a4 4.*bold', 'bold'),

    # Italic icons
    (r'M19 4h-9.*M14 20H5.*italic', 'italic'),

    # Underline icons
    (r'M6 3v7a6 6.*underline', 'underline'),

    # Align icons
    (r'M21 10H3.*M21 6H3.*align', 'align-justify'),

    # Hash/Hashtag icons
    (r'M4 9h16.*M4 15h16.*M10 3v18.*hash', 'hash'),

    # At sign icons
    (r'M12 8a4 4.*M22 12a10 10.*at', 'at-sign'),

    # Paperclip icons
    (r'M21.44 11.05l-9.19 9.19.*paperclip|attach', 'paperclip'),

    # Bot/Robot icons
    (r'M12 8V4H8.*bot|robot', 'bot'),

    # Brain icons
    (r'M12 5a3 3.*brain', 'brain'),

    # Lightbulb icons
    (r'M12 2a7 7.*lightbulb', 'lightbulb'),

    # Puzzle icons
    (r'M19.439 7.85.*puzzle', 'puzzle'),

    # Network icons
    (r'M5 12h14.*network', 'network'),

    # API icons
    (r'M4 20h16.*api', 'webhook'),

    # Integration icons
    (r'M18 16.98h-5.99.*integration', 'puzzle'),
]

def get_lucide_icon(svg_content):
    """Match SVG content to Lucide icon name"""
    # Extract the path/content from SVG
    svg_lower = svg_content.lower()

    # Check each mapping pattern
    for pattern, icon_name in ICON_MAPPINGS:
        if re.search(pattern, svg_content, re.IGNORECASE | re.DOTALL):
            return icon_name

    # Default fallback based on keywords
    keywords = {
        'arrow': 'arrow-right',
        'check': 'check',
        'user': 'user',
        'phone': 'phone',
        'mail': 'mail',
        'home': 'home',
        'search': 'search',
        'menu': 'menu',
        'close': 'x',
        'globe': 'globe',
        'settings': 'settings',
        'chart': 'bar-chart-3',
        'star': 'star',
        'heart': 'heart',
        'bell': 'bell',
        'clock': 'clock',
        'calendar': 'calendar',
        'lock': 'lock',
        'eye': 'eye',
        'edit': 'pencil',
        'delete': 'trash-2',
        'add': 'plus',
        'remove': 'minus',
        'link': 'link',
        'share': 'share-2',
        'download': 'download',
        'upload': 'upload',
        'file': 'file',
        'folder': 'folder',
        'image': 'image',
        'video': 'video',
        'music': 'music',
        'mic': 'mic',
        'volume': 'volume-2',
        'play': 'play',
        'pause': 'pause',
        'stop': 'square',
        'refresh': 'refresh-cw',
        'zap': 'zap',
        'lightning': 'zap',
        'sun': 'sun',
        'moon': 'moon',
        'cloud': 'cloud',
        'database': 'database',
        'server': 'server',
        'code': 'code',
        'terminal': 'terminal',
        'cpu': 'cpu',
        'wifi': 'wifi',
        'bluetooth': 'bluetooth',
        'battery': 'battery',
        'credit': 'credit-card',
        'cart': 'shopping-cart',
        'bag': 'shopping-bag',
        'box': 'package',
        'truck': 'truck',
        'building': 'building-2',
        'briefcase': 'briefcase',
        'layers': 'layers',
        'grid': 'grid-3x3',
        'list': 'list',
        'filter': 'filter',
        'target': 'target',
        'award': 'award',
        'gift': 'gift',
        'key': 'key',
        'tag': 'tag',
        'bookmark': 'bookmark',
        'flag': 'flag',
        'pin': 'map-pin',
        'location': 'map-pin',
        'compass': 'compass',
        'send': 'send',
        'rocket': 'rocket',
        'sparkle': 'sparkles',
        'bot': 'bot',
        'brain': 'brain',
        'network': 'network',
        'help': 'help-circle',
        'info': 'info',
        'warning': 'alert-triangle',
        'error': 'x-circle',
        'success': 'check-circle',
    }

    for keyword, icon in keywords.items():
        if keyword in svg_lower:
            return icon

    return None

def extract_svg_classes(svg_tag):
    """Extract class attribute from SVG tag"""
    match = re.search(r'class="([^"]*)"', svg_tag)
    return match.group(1) if match else 'w-5 h-5'

def replace_svg_with_lucide(content):
    """Replace inline SVGs with Lucide icon elements"""
    # Pattern to match full SVG elements
    svg_pattern = r'<svg\s+([^>]*)>(.*?)</svg>'

    def replace_single_svg(match):
        full_svg = match.group(0)
        attrs = match.group(1)
        inner = match.group(2)

        # Get the icon name
        icon_name = get_lucide_icon(full_svg)
        if not icon_name:
            # Keep original if no match
            return full_svg

        # Extract classes
        classes = extract_svg_classes(full_svg)

        # Extract color classes
        color_match = re.search(r'text-(\w+)-(\d+)', classes)
        color_class = f'text-{color_match.group(1)}-{color_match.group(2)}' if color_match else ''

        # Build new Lucide icon element
        # Lucide uses stroke-width: 2 by default, so we adjust classes
        size_classes = re.findall(r'w-\d+|h-\d+', classes)
        size_str = ' '.join(size_classes) if size_classes else 'w-5 h-5'

        # Additional classes (margins, etc)
        other_classes = re.sub(r'w-\d+|h-\d+|text-\w+-\d+', '', classes).strip()
        other_classes = ' '.join(other_classes.split())

        all_classes = f'{size_str} {color_class} {other_classes}'.strip()
        all_classes = ' '.join(all_classes.split())

        return f'<i data-lucide="{icon_name}" class="{all_classes}"></i>'

    return re.sub(svg_pattern, replace_single_svg, content, flags=re.DOTALL)

def add_lucide_scripts(content):
    """Add Lucide CDN scripts to HTML if not already present"""
    if 'lucide' in content.lower():
        return content

    # Add before closing </body> tag
    if '</body>' in content:
        content = content.replace('</body>', f'{LUCIDE_SCRIPT}</body>')

    return content

def process_html_file(filepath):
    """Process a single HTML file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        # Replace SVGs with Lucide icons
        modified = replace_svg_with_lucide(original)

        # Add Lucide scripts
        modified = add_lucide_scripts(modified)

        if modified != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    # Find all HTML files
    html_files = []
    for pattern in ['*.html', '*/*.html', '*/*/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern)))

    print(f"Found {len(html_files)} HTML files")
    print("Modernizing icons with Lucide (2026 standard)...\n")

    modified_count = 0
    for filepath in sorted(html_files):
        rel_path = os.path.relpath(filepath, website_dir)
        if process_html_file(filepath):
            print(f"  Modernized: {rel_path}")
            modified_count += 1

    print(f"\n{'='*50}")
    print(f"Total: {modified_count} files modernized with Lucide icons")
    print(f"CDN: https://unpkg.com/lucide@latest")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
