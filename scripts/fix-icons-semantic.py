#!/usr/bin/env python3
"""
VocalIA - Semantic Icon Fix Script
Session 228.2 - Replace 'package' fallback icons with correct semantic icons

FORENSIC AUDIT RESULT:
- 904 icons incorrectly showing as 'package'
- Need context-aware replacement with semantic icons
"""

import os
import re
import glob

# Semantic icon replacements based on context
# Format: (context_pattern, old_icon, new_icon)
SEMANTIC_FIXES = [
    # Header/Navigation
    (r'Produits|Products', 'package', 'box'),
    (r'Solutions', 'package', 'lightbulb'),
    (r'Ressources|Resources', 'package', 'book-open'),
    (r'Documentation|Docs', 'package', 'file-text'),
    (r'API', 'package', 'code'),
    (r'Blog', 'package', 'newspaper'),
    (r'Contact', 'package', 'mail'),
    (r'Login|Connexion', 'package', 'log-in'),
    (r'Dashboard', 'package', 'layout-dashboard'),

    # Industries
    (r'Santé|Healthcare|Medical|Clinique|Dentiste', 'package', 'heart-pulse'),
    (r'Immobilier|Real Estate|Property', 'package', 'building-2'),
    (r'Finance|Banque|Bank', 'package', 'landmark'),
    (r'Retail|Commerce|E-commerce|Boutique', 'package', 'shopping-bag'),
    (r'Hôtel|Hotel|Hospitality', 'package', 'bed'),
    (r'Restaurant|Food', 'package', 'utensils'),
    (r'Education|École', 'package', 'graduation-cap'),
    (r'Transport|Logistics', 'package', 'truck'),
    (r'Assurance|Insurance', 'package', 'shield'),
    (r'Juridique|Legal|Avocat', 'package', 'scale'),
    (r'Tech|Software|IT', 'package', 'cpu'),
    (r'Telecom', 'package', 'radio'),
    (r'Manufacturing|Industrie', 'package', 'factory'),
    (r'Agriculture', 'package', 'leaf'),
    (r'Energie|Energy', 'package', 'zap'),
    (r'Tourisme|Travel', 'package', 'plane'),

    # Features
    (r'Widget|Embed', 'package', 'layout'),
    (r'Téléphonie|Telephony|PSTN|Call', 'package', 'phone-call'),
    (r'Voice|Vocal|Voix', 'package', 'mic'),
    (r'AI|IA|Intelligence', 'package', 'brain'),
    (r'Integration|Connecteur', 'package', 'plug'),
    (r'Analytics|Analyse|Stats', 'package', 'bar-chart-3'),
    (r'Support|Assistance', 'package', 'headphones'),
    (r'Security|Sécurité|RGPD', 'package', 'shield-check'),
    (r'Performance|Speed|Latence', 'package', 'gauge'),
    (r'Multi-langue|Language|Langue', 'package', 'languages'),
    (r'Knowledge Base|KB|RAG', 'package', 'database'),
    (r'Automation|Automatisation', 'package', 'cog'),
    (r'Lead|Prospect', 'package', 'target'),
    (r'Booking|RDV|Appointment', 'package', 'calendar-check'),
    (r'Webhook|API', 'package', 'webhook'),
    (r'CRM|HubSpot|Salesforce', 'package', 'users'),
    (r'Slack', 'package', 'message-square'),
    (r'Email|Mail', 'package', 'mail'),

    # Pricing
    (r'Gratuit|Free|Widget', 'package', 'gift'),
    (r'Starter|Basic', 'package', 'rocket'),
    (r'Pro|Professional', 'package', 'star'),
    (r'Enterprise|Business', 'package', 'building'),
    (r'Prix|Tarif|Pricing', 'package', 'credit-card'),

    # Actions/CTAs
    (r'Essai|Trial|Demo', 'package', 'play-circle'),
    (r'Démarrer|Start|Begin', 'package', 'arrow-right'),
    (r'Télécharger|Download', 'package', 'download'),
    (r'Installer|Install', 'package', 'download-cloud'),
    (r'Configurer|Configure|Setup', 'package', 'settings'),

    # Dashboard specific
    (r'Appels|Calls|Minutes', 'package', 'phone-incoming'),
    (r'Utilisateurs|Users|Clients', 'package', 'users'),
    (r'Revenus|Revenue|Earnings', 'package', 'dollar-sign'),
    (r'Tickets|Issues', 'package', 'ticket'),
    (r'Agents|Bots', 'package', 'bot'),
    (r'Logs|Historique', 'package', 'scroll-text'),
    (r'Status|Statut|Health', 'package', 'activity'),
    (r'Settings|Paramètres', 'package', 'settings'),
    (r'Profile|Profil', 'package', 'user'),
    (r'Billing|Facturation', 'package', 'receipt'),
    (r'Notifications', 'package', 'bell'),
    (r'Search|Recherche', 'package', 'search'),
    (r'Filter|Filtre', 'package', 'filter'),
    (r'Export', 'package', 'download'),
    (r'Import', 'package', 'upload'),
    (r'Refresh|Actualiser', 'package', 'refresh-cw'),
    (r'Edit|Modifier', 'package', 'pencil'),
    (r'Delete|Supprimer', 'package', 'trash-2'),
    (r'Add|Ajouter|Create', 'package', 'plus'),
    (r'Save|Sauvegarder', 'package', 'save'),
    (r'Cancel|Annuler', 'package', 'x'),
    (r'Back|Retour', 'package', 'arrow-left'),
    (r'Next|Suivant', 'package', 'arrow-right'),
    (r'Previous|Précédent', 'package', 'arrow-left'),

    # Footer/Social
    (r'Twitter|X\s', 'package', 'twitter'),
    (r'LinkedIn', 'package', 'linkedin'),
    (r'GitHub', 'package', 'github'),
    (r'YouTube', 'package', 'youtube'),
    (r'Facebook', 'package', 'facebook'),
    (r'Instagram', 'package', 'instagram'),

    # Misc
    (r'Uptime|Disponibilité', 'package', 'activity'),
    (r'Certification|Badge', 'package', 'badge-check'),
    (r'Encryption|Chiffrement', 'package', 'lock'),
    (r'Cloud', 'package', 'cloud'),
    (r'Server|Serveur', 'package', 'server'),
    (r'Network|Réseau', 'package', 'network'),
    (r'Mobile|App', 'package', 'smartphone'),
    (r'Desktop', 'package', 'monitor'),
    (r'Code|Développeur', 'package', 'code-2'),
    (r'Copy|Copier', 'package', 'copy'),
    (r'Link|Lien', 'package', 'link'),
    (r'External', 'package', 'external-link'),
    (r'Info|Information', 'package', 'info'),
    (r'Warning|Attention', 'package', 'alert-triangle'),
    (r'Error|Erreur', 'package', 'x-circle'),
    (r'Success|Succès', 'package', 'check-circle'),
    (r'Time|Temps|Durée', 'package', 'clock'),
    (r'Date', 'package', 'calendar'),
    (r'Location|Lieu|Adresse', 'package', 'map-pin'),
    (r'Global|Mondial|International', 'package', 'globe'),
    (r'Local|Regional', 'package', 'map'),
    (r'Team|Équipe', 'package', 'users'),
    (r'Company|Entreprise|Société', 'package', 'building'),
    (r'Career|Carrière|Job', 'package', 'briefcase'),
    (r'About|À propos', 'package', 'info'),
    (r'Privacy|Confidentialité', 'package', 'eye-off'),
    (r'Terms|CGU|Conditions', 'package', 'file-text'),
    (r'FAQ|Questions', 'package', 'help-circle'),
    (r'Tutorial|Guide', 'package', 'book'),
    (r'Video', 'package', 'video'),
    (r'Audio|Sound', 'package', 'volume-2'),
    (r'Image|Photo', 'package', 'image'),
    (r'File|Fichier', 'package', 'file'),
    (r'Folder|Dossier', 'package', 'folder'),
    (r'Archive', 'package', 'archive'),
    (r'Trash|Corbeille', 'package', 'trash'),
    (r'Print|Imprimer', 'package', 'printer'),
    (r'Share|Partager', 'package', 'share-2'),
    (r'Bookmark|Favori', 'package', 'bookmark'),
    (r'Tag|Étiquette', 'package', 'tag'),
    (r'Comment|Commentaire', 'package', 'message-circle'),
    (r'Like|J\'aime', 'package', 'heart'),
    (r'Rating|Note', 'package', 'star'),
    (r'Review|Avis', 'package', 'message-square'),
]

def get_context_around_icon(content, pos, window=200):
    """Get text context around an icon position"""
    start = max(0, pos - window)
    end = min(len(content), pos + window)
    return content[start:end]

def find_best_icon_for_context(context):
    """Find the best semantic icon based on surrounding context"""
    context_lower = context.lower()

    for pattern, old_icon, new_icon in SEMANTIC_FIXES:
        if re.search(pattern, context, re.IGNORECASE):
            return new_icon

    # Default fallbacks based on common patterns
    if 'feature' in context_lower or 'fonctionnalité' in context_lower:
        return 'sparkles'
    if 'benefit' in context_lower or 'avantage' in context_lower:
        return 'check-circle'
    if 'step' in context_lower or 'étape' in context_lower:
        return 'circle-dot'
    if 'list' in context_lower or 'point' in context_lower:
        return 'circle'

    # Ultimate fallback - better than package
    return 'circle-dot'

def fix_icons_in_file(filepath):
    """Fix package icons in a single file with semantic replacements"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'data-lucide="package"' not in content:
            return 0

        # Find all package icons and their positions
        pattern = r'<i data-lucide="package"([^>]*)></i>'

        def replace_icon(match):
            full_match = match.group(0)
            attrs = match.group(1)
            pos = match.start()

            # Get context around this icon
            context = get_context_around_icon(content, pos)

            # Find best semantic icon
            new_icon = find_best_icon_for_context(context)

            return f'<i data-lucide="{new_icon}"{attrs}></i>'

        new_content = re.sub(pattern, replace_icon, content)

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)

            # Count replacements
            old_count = content.count('data-lucide="package"')
            new_count = new_content.count('data-lucide="package"')
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
    print("FORENSIC ICON FIX - Replacing 'package' with semantic icons")
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
    print(f"TOTAL: {total_fixed} 'package' icons replaced with semantic icons")
    print("=" * 60)

if __name__ == '__main__':
    main()
