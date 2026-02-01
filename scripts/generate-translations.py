#!/usr/bin/env python3
"""
Phase 2: Generate translations for all 5 languages.
Session 250.44

Uses pattern-based translation for common terms.
Technical terms remain unchanged across languages.
"""

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"

# Technical terms that stay the same in all languages
TECH_TERMS = {
    'API', 'REST', 'PSTN', 'CRM', 'SaaS', 'SDK', 'OAuth', 'SSO', 'SSL', 'TLS',
    'JSON', 'XML', 'HTTP', 'HTTPS', 'WebSocket', 'JWT', 'RGPD', 'GDPR', 'AI',
    'VocalIA', 'Voice Widget', 'Voice Telephony', 'Webhook', 'Endpoint',
    'Dashboard', 'Analytics', 'Widget', 'Plugin', 'RAG', 'HITL', 'GPU',
    'Canvas', 'Audio', 'Web Speech API', 'AES-256', 'AI Act', 'Enterprise',
    'Starter', 'Pro', 'Free', 'Google', 'GitHub', 'Stripe', 'Shopify',
    'WooCommerce', 'Magento', 'HubSpot', 'Pipedrive', 'Zendesk', 'Freshdesk',
    'Slack', 'Zapier', 'Make', 'Calendly', 'Twilio', 'SMS', 'WhatsApp',
    'OAuth 2.0', 'Multi-tenant', 'B2B', 'ROI', 'KPI', 'SLA', 'MRR', 'NPS'
}

# Common French to English translations
FR_TO_EN = {
    'Accueil': 'Home',
    'Tarifs': 'Pricing',
    'Fonctionnalités': 'Features',
    'Intégrations': 'Integrations',
    'Documentation': 'Documentation',
    'Connexion': 'Login',
    'Inscription': 'Sign Up',
    'Déconnexion': 'Logout',
    'Tableau de bord': 'Dashboard',
    'Paramètres': 'Settings',
    'Profil': 'Profile',
    'Entreprise': 'Company',
    'Contact': 'Contact',
    'À propos': 'About',
    'Blog': 'Blog',
    'Ressources': 'Resources',
    'Solutions': 'Solutions',
    'Produits': 'Products',
    'Clients': 'Customers',
    'Témoignages': 'Testimonials',
    'Cas d\'usage': 'Use Cases',
    'Industries': 'Industries',
    'Santé': 'Healthcare',
    'Immobilier': 'Real Estate',
    'Finance': 'Finance',
    'E-commerce': 'E-commerce',
    'Retail': 'Retail',
    'Support': 'Support',
    'Aide': 'Help',
    'FAQ': 'FAQ',
    'Guide': 'Guide',
    'Tutoriel': 'Tutorial',
    'Démarrer': 'Get Started',
    'Commencer': 'Start',
    'Essayer': 'Try',
    'Gratuit': 'Free',
    'Mois': 'Month',
    'Année': 'Year',
    'Jour': 'Day',
    'Minute': 'Minute',
    'Heure': 'Hour',
    'Appel': 'Call',
    'Appels': 'Calls',
    'Message': 'Message',
    'Messages': 'Messages',
    'Utilisateur': 'User',
    'Utilisateurs': 'Users',
    'Client': 'Customer',
    'Agent': 'Agent',
    'Agents': 'Agents',
    'Vocal': 'Voice',
    'Vocaux': 'Voice',
    'Téléphonie': 'Telephony',
    'Qualification': 'Qualification',
    'Leads': 'Leads',
    'Conversion': 'Conversion',
    'Automatisation': 'Automation',
    'Intelligence': 'Intelligence',
    'Artificielle': 'Artificial',
    'Personnalisation': 'Personalization',
    'Configuration': 'Configuration',
    'Installation': 'Installation',
    'Déploiement': 'Deployment',
    'Sécurité': 'Security',
    'Confidentialité': 'Privacy',
    'Conditions': 'Terms',
    'Politique': 'Policy',
    'Cookies': 'Cookies',
    'Investisseurs': 'Investors',
    'Parrainage': 'Referral',
    'Partenaires': 'Partners',
    'Équipe': 'Team',
    'Carrières': 'Careers',
    'Presse': 'Press',
    'Légal': 'Legal',
    'Mentions': 'Legal Notice',
    'Copyright': 'Copyright',
    'Tous droits réservés': 'All rights reserved',
    'Voir plus': 'See more',
    'En savoir plus': 'Learn more',
    'Découvrir': 'Discover',
    'Explorer': 'Explore',
    'Télécharger': 'Download',
    'Copier': 'Copy',
    'Coller': 'Paste',
    'Envoyer': 'Send',
    'Soumettre': 'Submit',
    'Annuler': 'Cancel',
    'Confirmer': 'Confirm',
    'Supprimer': 'Delete',
    'Modifier': 'Edit',
    'Ajouter': 'Add',
    'Créer': 'Create',
    'Sauvegarder': 'Save',
    'Rechercher': 'Search',
    'Filtrer': 'Filter',
    'Trier': 'Sort',
    'Exporter': 'Export',
    'Importer': 'Import',
    'Activer': 'Enable',
    'Désactiver': 'Disable',
    'Oui': 'Yes',
    'Non': 'No',
    'Ou': 'Or',
    'Et': 'And',
    'Tout': 'All',
    'Aucun': 'None',
    'Nouveau': 'New',
    'Ancien': 'Old',
    'Actif': 'Active',
    'Inactif': 'Inactive',
    'En cours': 'In Progress',
    'Terminé': 'Completed',
    'En attente': 'Pending',
    'Erreur': 'Error',
    'Succès': 'Success',
    'Avertissement': 'Warning',
    'Information': 'Information',
    'minutes': 'minutes',
    'secondes': 'seconds',
    'heures': 'hours',
    'jours': 'days',
    'semaines': 'weeks',
    'mois': 'months',
    'ans': 'years',
}

# French to Spanish
FR_TO_ES = {
    'Accueil': 'Inicio',
    'Tarifs': 'Precios',
    'Fonctionnalités': 'Funcionalidades',
    'Intégrations': 'Integraciones',
    'Documentation': 'Documentación',
    'Connexion': 'Iniciar sesión',
    'Inscription': 'Registrarse',
    'Tableau de bord': 'Panel de control',
    'Paramètres': 'Configuración',
    'Entreprise': 'Empresa',
    'Contact': 'Contacto',
    'À propos': 'Acerca de',
    'Ressources': 'Recursos',
    'Solutions': 'Soluciones',
    'Produits': 'Productos',
    'Clients': 'Clientes',
    'Industries': 'Industrias',
    'Santé': 'Salud',
    'Immobilier': 'Inmobiliaria',
    'Finance': 'Finanzas',
    'Support': 'Soporte',
    'Aide': 'Ayuda',
    'Guide': 'Guía',
    'Démarrer': 'Comenzar',
    'Gratuit': 'Gratis',
    'Mois': 'Mes',
    'Appel': 'Llamada',
    'Appels': 'Llamadas',
    'Message': 'Mensaje',
    'Utilisateur': 'Usuario',
    'Client': 'Cliente',
    'Agent': 'Agente',
    'Vocal': 'Voz',
    'Téléphonie': 'Telefonía',
    'Sécurité': 'Seguridad',
    'Confidentialité': 'Privacidad',
    'Conditions': 'Términos',
    'Investisseurs': 'Inversores',
    'Équipe': 'Equipo',
    'Voir plus': 'Ver más',
    'En savoir plus': 'Saber más',
    'Envoyer': 'Enviar',
    'Annuler': 'Cancelar',
    'Confirmer': 'Confirmar',
    'Supprimer': 'Eliminar',
    'Modifier': 'Editar',
    'Ajouter': 'Añadir',
    'Créer': 'Crear',
    'Rechercher': 'Buscar',
    'Oui': 'Sí',
    'Non': 'No',
    'Tout': 'Todo',
    'Nouveau': 'Nuevo',
    'Actif': 'Activo',
    'Erreur': 'Error',
    'Succès': 'Éxito',
    'minutes': 'minutos',
    'heures': 'horas',
    'jours': 'días',
}

# French to Arabic (MSA)
FR_TO_AR = {
    'Accueil': 'الرئيسية',
    'Tarifs': 'الأسعار',
    'Fonctionnalités': 'المميزات',
    'Intégrations': 'التكاملات',
    'Documentation': 'الوثائق',
    'Connexion': 'تسجيل الدخول',
    'Inscription': 'التسجيل',
    'Tableau de bord': 'لوحة التحكم',
    'Paramètres': 'الإعدادات',
    'Entreprise': 'الشركة',
    'Contact': 'اتصل بنا',
    'À propos': 'من نحن',
    'Ressources': 'الموارد',
    'Solutions': 'الحلول',
    'Produits': 'المنتجات',
    'Clients': 'العملاء',
    'Industries': 'القطاعات',
    'Santé': 'الصحة',
    'Immobilier': 'العقارات',
    'Finance': 'المالية',
    'Support': 'الدعم',
    'Aide': 'المساعدة',
    'Guide': 'الدليل',
    'Démarrer': 'ابدأ',
    'Gratuit': 'مجاني',
    'Mois': 'شهر',
    'Appel': 'مكالمة',
    'Appels': 'مكالمات',
    'Message': 'رسالة',
    'Utilisateur': 'مستخدم',
    'Client': 'عميل',
    'Agent': 'وكيل',
    'Vocal': 'صوتي',
    'Téléphonie': 'الهاتف',
    'Sécurité': 'الأمان',
    'Confidentialité': 'الخصوصية',
    'Conditions': 'الشروط',
    'Investisseurs': 'المستثمرون',
    'Équipe': 'الفريق',
    'Voir plus': 'عرض المزيد',
    'En savoir plus': 'اعرف المزيد',
    'Envoyer': 'إرسال',
    'Annuler': 'إلغاء',
    'Confirmer': 'تأكيد',
    'Supprimer': 'حذف',
    'Modifier': 'تعديل',
    'Ajouter': 'إضافة',
    'Créer': 'إنشاء',
    'Rechercher': 'بحث',
    'Oui': 'نعم',
    'Non': 'لا',
    'Tout': 'الكل',
    'Nouveau': 'جديد',
    'Actif': 'نشط',
    'Erreur': 'خطأ',
    'Succès': 'نجاح',
    'minutes': 'دقائق',
    'heures': 'ساعات',
    'jours': 'أيام',
}

# French to Darija (Moroccan Arabic)
FR_TO_ARY = {
    'Accueil': 'الصفحة الرئيسية',
    'Tarifs': 'الأثمان',
    'Fonctionnalités': 'المميزات',
    'Intégrations': 'التكاملات',
    'Documentation': 'الوثائق',
    'Connexion': 'الدخول',
    'Inscription': 'التسجيل',
    'Tableau de bord': 'لوحة التحكم',
    'Paramètres': 'الإعدادات',
    'Entreprise': 'الشركة',
    'Contact': 'تواصل معانا',
    'À propos': 'على الشركة',
    'Ressources': 'الموارد',
    'Solutions': 'الحلول',
    'Produits': 'المنتوجات',
    'Clients': 'الكليان',
    'Industries': 'القطاعات',
    'Santé': 'الصحة',
    'Immobilier': 'العقار',
    'Finance': 'المال',
    'Support': 'الدعم',
    'Aide': 'المساعدة',
    'Guide': 'الدليل',
    'Démarrer': 'بدا',
    'Gratuit': 'مجاني',
    'Mois': 'شهر',
    'Appel': 'مكالمة',
    'Appels': 'المكالمات',
    'Message': 'رسالة',
    'Utilisateur': 'المستخدم',
    'Client': 'الكليان',
    'Agent': 'الوكيل',
    'Vocal': 'صوتي',
    'Téléphonie': 'التيليفون',
    'Sécurité': 'الأمان',
    'Confidentialité': 'الخصوصية',
    'Conditions': 'الشروط',
    'Investisseurs': 'المستثمرين',
    'Équipe': 'الفريق',
    'Voir plus': 'شوف أكثر',
    'En savoir plus': 'عرف أكثر',
    'Envoyer': 'صيفط',
    'Annuler': 'لغي',
    'Confirmer': 'أكد',
    'Supprimer': 'حيد',
    'Modifier': 'بدل',
    'Ajouter': 'زيد',
    'Créer': 'خلق',
    'Rechercher': 'قلب',
    'Oui': 'آه',
    'Non': 'لا',
    'Tout': 'كلشي',
    'Nouveau': 'جديد',
    'Actif': 'نشيط',
    'Erreur': 'غلط',
    'Succès': 'نجاح',
    'minutes': 'دقايق',
    'heures': 'سوايع',
    'jours': 'يامات',
}


def translate_text(text, lang):
    """Translate French text to target language."""
    if lang == 'fr':
        return text

    # Check if it's a tech term (keep as-is)
    for term in TECH_TERMS:
        if term.lower() == text.lower():
            return text

    # Get the appropriate dictionary
    trans_dict = {
        'en': FR_TO_EN,
        'es': FR_TO_ES,
        'ar': FR_TO_AR,
        'ary': FR_TO_ARY
    }.get(lang, {})

    # Try exact match first
    if text in trans_dict:
        return trans_dict[text]

    # Try case-insensitive match
    for fr, trans in trans_dict.items():
        if fr.lower() == text.lower():
            return trans

    # Try partial replacement for common patterns
    result = text
    for fr, trans in trans_dict.items():
        if fr in result:
            result = result.replace(fr, trans)

    # If no translation found, return original with language marker
    if result == text:
        # For tech/product content, keep French but could add marker
        return text  # Keep original for review

    return result


def main():
    print("=== Phase 2: Generating Translations ===\n")

    # Load French keys
    keys_file = DATA_DIR / "new_i18n_keys.json"
    with open(keys_file, 'r', encoding='utf-8') as f:
        fr_keys = json.load(f)

    print(f"Loaded {len(fr_keys)} French keys\n")

    # Generate translations for each language
    translations = {
        'fr': fr_keys,
        'en': {},
        'es': {},
        'ar': {},
        'ary': {}
    }

    for key, fr_text in fr_keys.items():
        for lang in ['en', 'es', 'ar', 'ary']:
            translations[lang][key] = translate_text(fr_text, lang)

    # Load existing locale files and merge
    for lang in ['fr', 'en', 'es', 'ar', 'ary']:
        locale_file = LOCALES_DIR / f"{lang}.json"

        try:
            with open(locale_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except:
            existing = {}

        # Merge new translations
        for key, value in translations[lang].items():
            # Parse nested key (e.g., "home.title_0" -> {"home": {"title_0": value}})
            parts = key.split('.', 1)
            if len(parts) == 2:
                section, subkey = parts
                if section not in existing:
                    existing[section] = {}
                if isinstance(existing[section], dict):
                    existing[section][subkey] = value
            else:
                existing[key] = value

        # Save updated locale
        with open(locale_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        print(f"  ✅ {lang}.json: {len(translations[lang])} keys added")

    print("\n=== Phase 2 Complete ===")
    print(f"Total keys per language: {len(fr_keys)}")


if __name__ == "__main__":
    main()
