#!/usr/bin/env python3
"""
VocalIA - Brand/Service Specific Icon Fix
Session 228.3 - Replace generic icons with brand-appropriate icons
"""

import os
import re
import glob

# Brand/Service specific icon mappings
# Each tuple: (service_name_pattern, wrong_icon, correct_icon)
BRAND_ICONS = [
    # Voice/Widget specific
    (r'Voice Widget', 'cpu', 'mic'),
    (r'Widget', 'cpu', 'layout'),

    # CRM
    (r'HubSpot', 'cpu', 'database'),
    (r'Salesforce', 'cpu', 'cloud'),
    (r'Zoho', 'cpu', 'database'),
    (r'Pipedrive', 'cpu', 'target'),

    # E-commerce
    (r'PrestaShop', 'cpu', 'shopping-cart'),
    (r'Magento', 'cpu', 'shopping-bag'),

    # Marketing/Email
    (r'Klaviyo', 'cpu', 'mail'),
    (r'Mailchimp', 'cpu', 'mail'),
    (r'SendGrid', 'cpu', 'send'),
    (r'Brevo', 'cpu', 'mail'),

    # Communication
    (r'Téléphonie|Telephony', 'cpu', 'phone'),
    (r'Slack', 'cpu', 'message-square'),
    (r'Discord', 'cpu', 'message-circle'),
    (r'Teams', 'cpu', 'users'),
    (r'WhatsApp', 'cpu', 'message-circle'),
    (r'Intercom', 'cpu', 'headphones'),
    (r'Zendesk', 'cpu', 'headphones'),
    (r'Freshdesk', 'cpu', 'headphones'),

    # Automation
    (r'Make', 'cpu', 'workflow'),
    (r'n8n', 'cpu', 'workflow'),
    (r'Integromat', 'cpu', 'workflow'),
    (r'IFTTT', 'cpu', 'zap'),

    # Calendar
    (r'Google Calendar', 'cpu', 'calendar'),
    (r'Outlook', 'cpu', 'calendar'),
    (r'Cal\.com', 'cpu', 'calendar'),

    # Productivity
    (r'Notion', 'cpu', 'file-text'),
    (r'Airtable', 'cpu', 'table'),
    (r'Trello', 'cpu', 'layout'),
    (r'Asana', 'cpu', 'check-square'),
    (r'Monday', 'cpu', 'layout'),
    (r'ClickUp', 'cpu', 'check-square'),
    (r'Jira', 'cpu', 'ticket'),

    # Analytics
    (r'Google Analytics', 'cpu', 'bar-chart-3'),
    (r'Mixpanel', 'cpu', 'activity'),
    (r'Amplitude', 'cpu', 'trending-up'),
    (r'Segment', 'cpu', 'git-branch'),

    # Payment
    (r'Stripe', 'cpu', 'credit-card'),
    (r'PayPal', 'cpu', 'credit-card'),
    (r'Square', 'cpu', 'credit-card'),

    # Storage/Cloud
    (r'AWS', 'cpu', 'cloud'),
    (r'Google Cloud', 'cpu', 'cloud'),
    (r'Azure', 'cpu', 'cloud'),
    (r'Dropbox', 'cpu', 'folder'),
    (r'Google Drive', 'cpu', 'folder'),

    # Developer
    (r'GitHub', 'cpu', 'github'),
    (r'GitLab', 'cpu', 'git-branch'),
    (r'Bitbucket', 'cpu', 'git-branch'),
    (r'Vercel', 'cpu', 'triangle'),
    (r'Netlify', 'cpu', 'globe'),
    (r'Heroku', 'cpu', 'server'),

    # Social
    (r'Twitter|X\s', 'cpu', 'twitter'),
    (r'LinkedIn', 'cpu', 'linkedin'),
    (r'Facebook', 'cpu', 'facebook'),
    (r'Instagram', 'cpu', 'instagram'),
    (r'YouTube', 'cpu', 'youtube'),
    (r'TikTok', 'cpu', 'music'),

    # Voice/AI specific
    (r'Grok', 'cpu', 'brain'),
    (r'Claude', 'cpu', 'sparkles'),
    (r'GPT|OpenAI', 'cpu', 'bot'),
    (r'Gemini', 'cpu', 'sparkles'),
    (r'Whisper', 'cpu', 'mic'),
    (r'ElevenLabs', 'cpu', 'volume-2'),
    (r'Deepgram', 'cpu', 'audio-lines'),

    # Dashboard items
    (r'Overview|Vue d\'ensemble', 'cpu', 'layout-dashboard'),
    (r'Analytics|Statistiques', 'cpu', 'bar-chart-3'),
    (r'Calls|Appels', 'cpu', 'phone-incoming'),
    (r'Agents|Bots', 'cpu', 'bot'),
    (r'Knowledge|KB', 'cpu', 'database'),
    (r'Settings|Paramètres', 'cpu', 'settings'),
    (r'Billing|Facturation', 'cpu', 'receipt'),
    (r'Team|Équipe', 'cpu', 'users'),
    (r'API Keys', 'cpu', 'key'),
    (r'Webhooks', 'cpu', 'webhook'),
    (r'Logs', 'cpu', 'scroll-text'),
    (r'Health|Status', 'cpu', 'activity'),
    (r'Security|Sécurité', 'cpu', 'shield'),
    (r'Tenants|Clients', 'cpu', 'building'),
    (r'Users|Utilisateurs', 'cpu', 'users'),
    (r'Revenue|Revenus', 'cpu', 'trending-up'),
    (r'Minutes', 'cpu', 'clock'),

    # Feature cards
    (r'Multi-Provider|Fallback', 'cpu', 'git-branch'),
    (r'HITL|Human', 'cpu', 'user-check'),
    (r'RAG', 'cpu', 'database'),
    (r'Real-time|Temps réel', 'cpu', 'zap'),
    (r'24/7', 'cpu', 'clock'),
    (r'Multilingue|Language', 'cpu', 'languages'),
    (r'RGPD|GDPR|Privacy', 'cpu', 'shield-check'),
    (r'AI Act', 'cpu', 'scale'),
    (r'AES-256|Encryption', 'cpu', 'lock'),
    (r'Uptime|SLA', 'cpu', 'activity'),
    (r'Latence|Latency', 'cpu', 'gauge'),
    (r'Personas', 'cpu', 'users'),

    # Generic context-based
    (r'Produits|Products', 'cpu', 'box'),
    (r'Solutions', 'cpu', 'lightbulb'),
    (r'Ressources|Resources', 'cpu', 'book-open'),
    (r'Fonctionnalités|Features', 'cpu', 'sparkles'),
]

def fix_brand_icon(content, service_pattern, old_icon, new_icon):
    """Fix a specific brand icon based on nearby text context"""

    # Pattern to find icon followed by the service name within 100 chars
    pattern = rf'<i data-lucide="{old_icon}"([^>]*)></i>(\s*{service_pattern})'

    def replace_fn(match):
        attrs = match.group(1)
        rest = match.group(2)
        return f'<i data-lucide="{new_icon}"{attrs}></i>{rest}'

    content = re.sub(pattern, replace_fn, content, flags=re.IGNORECASE)

    # Also try: service name then icon nearby
    pattern2 = rf'({service_pattern}[^<]{{0,50}})<i data-lucide="{old_icon}"([^>]*)></i>'

    def replace_fn2(match):
        prefix = match.group(1)
        attrs = match.group(2)
        return f'{prefix}<i data-lucide="{new_icon}"{attrs}></i>'

    content = re.sub(pattern2, replace_fn2, content, flags=re.IGNORECASE)

    return content

def fix_icons_in_file(filepath):
    """Fix brand icons in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()

        content = original
        for service_pattern, old_icon, new_icon in BRAND_ICONS:
            content = fix_brand_icon(content, service_pattern, old_icon, new_icon)

        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

            old_count = original.count('data-lucide="cpu"')
            new_count = content.count('data-lucide="cpu"')
            return old_count - new_count

        return 0
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0

def main():
    website_dir = '/Users/mac/Desktop/VocalIA/website'

    html_files = []
    for pattern in ['*.html', '*/*.html', '*/*/*.html']:
        html_files.extend(glob.glob(os.path.join(website_dir, pattern)))

    print("=" * 60)
    print("BRAND ICON FIX - Replacing 'cpu' with service-specific icons")
    print("=" * 60)
    print(f"\nFound {len(html_files)} HTML files\n")

    total_fixed = 0
    for filepath in sorted(html_files):
        rel_path = os.path.relpath(filepath, website_dir)
        fixed = fix_icons_in_file(filepath)
        if fixed > 0:
            print(f"  Fixed {fixed:3d} icons: {rel_path}")
            total_fixed += fixed

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {total_fixed} brand icons fixed")
    print("=" * 60)

if __name__ == '__main__':
    main()
