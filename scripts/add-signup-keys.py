#!/usr/bin/env python3
"""
Add missing signup_page i18n keys to all locale files.
Session 250.44
"""

import json
from pathlib import Path

LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"

# Missing keys for each locale
MISSING_KEYS = {
    "fr": {
        "signup_page": {
            "free_f1": "Voice Widget illimité",
            "free_f2": "5 langues",
            "free_f3": "Pas de téléphonie",
            "starter_f1": "100 min téléphonie",
            "starter_f2": "15 personas métier",
            "starter_f3": "Email support",
            "pro_f1": "500 min téléphonie",
            "pro_f2": "40 personas métier",
            "pro_f3": "Intégrations CRM",
            "free_price": "0",
            "per_month": "/mois",
            "password_hint": "8 caractères minimum",
            "google_login": "Continuer avec Google",
            "gdpr": "RGPD Compliant",
            "secure_payment": "Paiement sécurisé",
            "privacy": "politique de confidentialité"
        }
    },
    "en": {
        "signup_page": {
            "free_f1": "Unlimited Voice Widget",
            "free_f2": "5 languages",
            "free_f3": "No telephony",
            "starter_f1": "100 min telephony",
            "starter_f2": "15 business personas",
            "starter_f3": "Email support",
            "pro_f1": "500 min telephony",
            "pro_f2": "40 business personas",
            "pro_f3": "CRM Integrations",
            "free_price": "0",
            "per_month": "/month",
            "password_hint": "8 characters minimum",
            "google_login": "Continue with Google",
            "gdpr": "GDPR Compliant",
            "secure_payment": "Secure payment",
            "privacy": "privacy policy"
        }
    },
    "es": {
        "signup_page": {
            "free_f1": "Voice Widget ilimitado",
            "free_f2": "5 idiomas",
            "free_f3": "Sin telefonía",
            "starter_f1": "100 min telefonía",
            "starter_f2": "15 personas de negocio",
            "starter_f3": "Soporte por email",
            "pro_f1": "500 min telefonía",
            "pro_f2": "40 personas de negocio",
            "pro_f3": "Integraciones CRM",
            "free_price": "0",
            "per_month": "/mes",
            "password_hint": "8 caracteres mínimo",
            "google_login": "Continuar con Google",
            "gdpr": "Compatible RGPD",
            "secure_payment": "Pago seguro",
            "privacy": "política de privacidad"
        }
    },
    "ar": {
        "signup_page": {
            "free_f1": "Voice Widget غير محدود",
            "free_f2": "5 لغات",
            "free_f3": "بدون هاتف",
            "starter_f1": "100 دقيقة هاتف",
            "starter_f2": "15 شخصية مهنية",
            "starter_f3": "دعم عبر البريد",
            "pro_f1": "500 دقيقة هاتف",
            "pro_f2": "40 شخصية مهنية",
            "pro_f3": "تكامل CRM",
            "free_price": "0",
            "per_month": "/شهر",
            "password_hint": "8 أحرف على الأقل",
            "google_login": "المتابعة مع Google",
            "gdpr": "متوافق مع GDPR",
            "secure_payment": "دفع آمن",
            "privacy": "سياسة الخصوصية"
        }
    },
    "ary": {
        "signup_page": {
            "free_f1": "Voice Widget بلا حدود",
            "free_f2": "5 لغات",
            "free_f3": "بلا تيليفون",
            "starter_f1": "100 دقيقة تيليفون",
            "starter_f2": "15 شخصية ديال الخدمة",
            "starter_f3": "دعم بالإيميل",
            "pro_f1": "500 دقيقة تيليفون",
            "pro_f2": "40 شخصية ديال الخدمة",
            "pro_f3": "تكامل CRM",
            "free_price": "0",
            "per_month": "/شهر",
            "password_hint": "8 حروف على الأقل",
            "google_login": "كمل مع Google",
            "gdpr": "متوافق مع RGPD",
            "secure_payment": "خلاص آمن",
            "privacy": "سياسة الخصوصية"
        }
    }
}


def deep_merge(base, update):
    for key, value in update.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def process_locale(locale_code):
    filepath = LOCALES_DIR / f"{locale_code}.json"

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    if locale_code not in MISSING_KEYS:
        return False

    deep_merge(data, MISSING_KEYS[locale_code])

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return True


def main():
    print("=== Adding Signup Page Keys ===\n")

    modified = 0
    for locale in ['fr', 'en', 'es', 'ar', 'ary']:
        if process_locale(locale):
            print(f"  ✅ {locale}.json: added signup keys")
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
