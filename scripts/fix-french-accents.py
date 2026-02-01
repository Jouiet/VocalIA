#!/usr/bin/env python3
"""
Fix missing French accents in blog articles.
VocalIA - Marketing Copy Audit Session 250.39
"""

import os
import re
import sys

# Common French words with missing accents
ACCENT_FIXES = {
    # à sounds (context-aware)
    r' a Shopify': ' à Shopify',
    r' a Rabat': ' à Rabat',
    r' a Casablanca': ' à Casablanca',
    r' a Marrakech': ' à Marrakech',
    r' a votre': ' à votre',
    r' a vos': ' à vos',
    r' a ses': ' à ses',
    r' a nos': ' à nos',
    r' a leur': ' à leur',
    r' a son': ' à son',
    r' a sa': ' à sa',
    r' a la ': ' à la ',
    r'pas a pas': 'pas à pas',
    r'grace a': 'grâce à',
    r'Grace a': 'Grâce à',
    r'\bAcces\b': 'Accès',
    r'\bacces\b': 'accès',
    r'\bParametres\b': 'Paramètres',
    r'\bparametres\b': 'paramètres',
    r'\bDevelopper\b': 'Développer',
    r'\bdevelopper\b': 'développer',
    r'\breduit\b': 'réduit',
    r'\breduits\b': 'réduits',
    r'\baugmente\b': 'augmenté',
    r'\baugmentes\b': 'augmentés',
    r'\btransformé\b': 'transformé',
    r'\btransformes\b': 'transformés',
    r'\bamendes\b': 'amendes',
    r'\batteinte\b': 'atteinte',
    r'\bentraine\b': 'entraîne',
    r'\bentrainer\b': 'entraîner',
    r'\bsante\b': 'santé',
    r'\babandonne\b': 'abandonné',
    r'\babandonnee\b': 'abandonnée',
    r'\bpanier abandonne\b': 'panier abandonné',
    r'\bAu-dela\b': 'Au-delà',
    r'\bau-dela\b': 'au-delà',
    r'\breputation\b': 'réputation',
    r'\btransforme\b': 'transformé',
    r'\btransformes\b': 'transformés',
    r'\bdeployant\b': 'déployant',
    r'\bdifference\b': 'différence',
    r'\bdifferences\b': 'différences',
    r'\bDeploiement\b': 'Déploiement',
    r'\bdeploiement\b': 'déploiement',
    r'\brevolutionne\b': 'révolutionné',
    r'\bpreferences\b': 'préférences',
    r'\bpreference\b': 'préférence',
    r'\bVerifiez\b': 'Vérifiez',
    r'\bcopie\b': 'copié',
    r'\bregissant\b': 'régissant',
    r'\bnumero\b': 'numéro',
    r'\bNumero\b': 'Numéro',
    r'\blivree\b': 'livrée',
    r'\bestimee\b': 'estimée',
    r'\bDonnees\b': 'Données',
    r'\bNecessaire\b': 'Nécessaire',
    r'\bnecessaire\b': 'nécessaire',
    r'\borthographie\b': 'orthographié',
    r'\binstantanee\b': 'instantanée',
    r'\bcaptes\b': 'captés',
    r'\bdefaut\b': 'défaut',
    r'\boperateur\b': 'opérateur',
    r'\bHebergement\b': 'Hébergement',
    r'\bhebergement\b': 'hébergement',
    r'\bpreparer\b': 'préparer',
    r'\bPreparez\b': 'Préparez',
    r'\bpreparez\b': 'préparez',
    r'\bAuditez\b': 'Auditez',
    r'\bEtats-Unis\b': 'États-Unis',
    r'\beffectue\b': 'effectué',

    # é sounds
    r'\betude\b': 'étude',
    r'\bEtude\b': 'Étude',
    r'\betudes\b': 'études',
    r'\bsysteme\b': 'système',
    r'\bsystemes\b': 'systèmes',
    r'\bdeploye\b': 'déployé',
    r'\bdeployer\b': 'déployer',
    r'\breponse\b': 'réponse',
    r'\breponses\b': 'réponses',
    r'\bprobleme\b': 'problème',
    r'\bproblemes\b': 'problèmes',
    r'\bDecouvrez\b': 'Découvrez',
    r'\bdecouvrez\b': 'découvrez',
    r'\bintegrer\b': 'intégrer',
    r'\bIntegrer\b': 'Intégrer',
    r'\bintegre\b': 'intégré',
    r'\bintegres\b': 'intégrés',
    r'\bintegree\b': 'intégrée',
    r'\bcreer\b': 'créer',
    r'\bCreer\b': 'Créer',
    r'\bcree\b': 'crée',
    r'\bcrees\b': 'crées',
    r'\bregle\b': 'règle',
    r'\bregles\b': 'règles',
    r'\bredefinit\b': 'redéfinit',
    r'\bbasee\b': 'basée',
    r'\bbases\b': 'basés',
    r'\bcategorie\b': 'catégorie',
    r'\bcategories\b': 'catégories',
    r'\beleve\b': 'élevé',
    r'\beleves\b': 'élevés',
    r'\belevee\b': 'élevée',
    r'\bSecurite\b': 'Sécurité',
    r'\bsecurite\b': 'sécurité',
    r'\bresilience\b': 'résilience',
    r'\bequipe\b': 'équipe',
    r'\bconformite\b': 'conformité',
    r'\bdonnees\b': 'données',
    r'\bverifiez\b': 'vérifiez',
    r'\bEtape\b': 'Étape',
    r'\betape\b': 'étape',
    r'\betapes\b': 'étapes',
    r'\bcoutent\b': 'coûtent',
    r'\bfleau\b': 'fléau',
    r'\bdecrochent\b': 'décrochent',
    r'\bdecisifs\b': 'décisifs',
    r'\bseche\b': 'sèche',
    r'\bsituee\b': 'située',
    r'\brepresentent\b': 'représentent',
    r'\breactivite\b': 'réactivité',
    r'\bimmobiliere\b': 'immobilière',
    r'\bimmobilieres\b': 'immobilières',
    r'\bgenere\b': 'génère',
    r'\bgenerent\b': 'génèrent',
    r'\bretait\b': 'était',
    r'\betait\b': 'était',
    r'\brepondre\b': 'répondre',
    r'\brepond\b': 'répond',
    r'\brepondent\b': 'répondent',
    r'\bgerer\b': 'gérer',
    r'\bmanques\b': 'manqués',
    r'\bdelais\b': 'délais',
    r'\bdelai\b': 'délai',
    r'\bevaporent\b': 'évaporent',
    r'\bretude\b': 'étude',
    r'\bspecifique\b': 'spécifique',
    r'\bspecifiques\b': 'spécifiques',
    r'\bspecifiquement\b': 'spécifiquement',
    r'\bconcu\b': 'conçu',
    r'\bcles\b': 'clés',
    r'\bimmediatement\b': 'immédiatement',
    r'\binspiree\b': 'inspirée',
    r'\brevolutione\b': 'révolutionne',
    r'\brevolutionne\b': 'révolutionne',
    r'\bretabli\b': 'rétabli',
    r'\bretablis\b': 'rétablis',
    r'\betabli\b': 'établi',
    r'\betablissement\b': 'établissement',
    r'\betablissements\b': 'établissements',
    r'\brevele\b': 'révèle',
    r'\bpresentent\b': 'présentent',
    r'\bpresente\b': 'présente',
    r'\beuropeen\b': 'européen',
    r'\beuropeenne\b': 'européenne',
    r'\beuropeens\b': 'européens',
    r'\bcomplete\b': 'complète',
    r'\brepondeur\b': 'répondeur',
    r'\bmeme\b': 'même',
    r'\bellesmemes\b': 'elles-mêmes',
    r'\belles-memes\b': 'elles-mêmes',
}

def fix_accents(content):
    """Apply accent fixes to content."""
    fixed = content
    changes = []

    for pattern, replacement in ACCENT_FIXES.items():
        # Count matches before replacement
        matches = len(re.findall(pattern, fixed, re.IGNORECASE))
        if matches > 0:
            # Apply case-sensitive replacement
            fixed = re.sub(pattern, replacement, fixed)
            changes.append(f"  {pattern} → {replacement} ({matches}x)")

    return fixed, changes

def process_file(filepath):
    """Process a single HTML file."""
    print(f"\nProcessing: {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    fixed_content, changes = fix_accents(content)

    if changes:
        print(f"  Fixed {len(changes)} patterns:")
        for change in changes[:10]:  # Show first 10
            print(change)
        if len(changes) > 10:
            print(f"  ... and {len(changes) - 10} more")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)

        return len(changes)
    else:
        print("  No fixes needed")
        return 0

def main():
    blog_dir = '/Users/mac/Desktop/VocalIA/website/blog/articles'

    if not os.path.exists(blog_dir):
        print(f"Error: Directory not found: {blog_dir}")
        sys.exit(1)

    total_fixes = 0
    files_fixed = 0

    for filename in os.listdir(blog_dir):
        if filename.endswith('.html'):
            filepath = os.path.join(blog_dir, filename)
            fixes = process_file(filepath)
            if fixes > 0:
                total_fixes += fixes
                files_fixed += 1

    print(f"\n{'='*50}")
    print(f"Summary: {total_fixes} fixes applied in {files_fixed} files")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
