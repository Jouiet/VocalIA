#!/usr/bin/env python3
"""
Fix signup.html i18n - add data-i18n to all text elements.
Session 250.44
"""

import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# Text replacements for signup page
REPLACEMENTS = [
    # Plan features
    ('>Voice Widget illimité<', '><span data-i18n="signup_page.free_f1">Voice Widget illimité</span><'),
    ('>5 langues<', '><span data-i18n="signup_page.free_f2">5 langues</span><'),
    ('>Pas de téléphonie<', '><span data-i18n="signup_page.free_f3">Pas de téléphonie</span><'),
    ('>100 min téléphonie', '><span data-i18n="signup_page.starter_f1">100 min téléphonie</span>'),
    ('>15 personas métier', '><span data-i18n="signup_page.starter_f2">15 personas métier</span>'),
    ('>Email support', '><span data-i18n="signup_page.starter_f3">Email support</span>'),
    ('>500 min téléphonie', '><span data-i18n="signup_page.pro_f1">500 min téléphonie</span>'),
    ('>40 personas métier', '><span data-i18n="signup_page.pro_f2">40 personas métier</span>'),
    ('>Intégrations CRM', '><span data-i18n="signup_page.pro_f3">Intégrations CRM</span>'),

    # Form labels
    ('>Déjà un compte ?<', '><span data-i18n="signup_page.already_account">Déjà un compte ?</span><'),
    ('>8 caractères minimum<', '><span data-i18n="signup_page.password_hint">8 caractères minimum</span><'),

    # Buttons
    ('>Créer mon compte<', '><span data-i18n="signup_page.create_account">Créer mon compte</span><'),
    ('>Continuer avec Google<', '><span data-i18n="signup_page.google_login">Continuer avec Google</span><'),

    # Trust badges
    ('>RGPD Compliant<', '><span data-i18n="signup_page.gdpr">RGPD Compliant</span><'),
    ('>Paiement sécurisé<', '><span data-i18n="signup_page.secure_payment">Paiement sécurisé</span><'),
    ('>Sans engagement<', '><span data-i18n="signup_page.no_commitment">Sans engagement</span><'),

    # Price labels
    ('>0<span', '><span data-i18n="signup_page.free_price">0</span><span'),
    ('>/mois<', '><span data-i18n="signup_page.per_month">/mois</span><'),

    # Terms
    (">J'accepte les<", '><span data-i18n="signup_page.terms_agree">J\'accepte les</span><'),
    ('>CGU<', '><span data-i18n="signup_page.terms">CGU</span><'),
    ('>et la<', '><span data-i18n="signup_page.terms_and">et la</span><'),
    ('>politique de confidentialité<', '><span data-i18n="signup_page.privacy">politique de confidentialité</span><'),
]


def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR: {e}")
        return 0

    original = content
    changes = 0

    for old, new in REPLACEMENTS:
        if old in content and new.split('"')[1] not in content:
            content = content.replace(old, new)
            changes += 1

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return changes


def main():
    filepath = WEBSITE_DIR / "signup.html"
    changes = process_file(filepath)
    print(f"signup.html: {changes} changes")


if __name__ == "__main__":
    main()
