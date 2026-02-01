#!/usr/bin/env python3
"""
Add missing footer i18n keys to all locale files.
Session 250.44
"""

import json
from pathlib import Path

LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"

# Missing keys to add for each locale
MISSING_KEYS = {
    "fr": {
        "footer": {
            "product": "Produit",
            "solutions": "Solutions",
            "resources": "Ressources",
            "links": {
                "use_cases": "Cas d'Usage",
                "industries": "Par Industrie",
                "academy": "Académie Business",
                "investors": "Investisseurs"
            }
        }
    },
    "en": {
        "footer": {
            "product": "Product",
            "solutions": "Solutions",
            "resources": "Resources",
            "links": {
                "use_cases": "Use Cases",
                "industries": "By Industry",
                "academy": "Business Academy",
                "investors": "Investors"
            }
        }
    },
    "es": {
        "footer": {
            "product": "Producto",
            "solutions": "Soluciones",
            "resources": "Recursos",
            "links": {
                "use_cases": "Casos de Uso",
                "industries": "Por Industria",
                "academy": "Academia de Negocios",
                "investors": "Inversores"
            }
        }
    },
    "ar": {
        "footer": {
            "product": "المنتج",
            "solutions": "الحلول",
            "resources": "الموارد",
            "links": {
                "use_cases": "حالات الاستخدام",
                "industries": "حسب القطاع",
                "academy": "أكاديمية الأعمال",
                "investors": "المستثمرون"
            }
        }
    },
    "ary": {
        "footer": {
            "product": "المنتوج",
            "solutions": "الحلول",
            "resources": "الموارد",
            "links": {
                "use_cases": "حالات الإستعمال",
                "industries": "حسب القطاع",
                "academy": "أكاديمية البزنس",
                "investors": "المستثمرين"
            }
        }
    }
}


def deep_merge(base, update):
    """Deep merge update into base."""
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

    # Merge missing keys
    deep_merge(data, MISSING_KEYS[locale_code])

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return True


def main():
    print("=== Adding Missing Footer i18n Keys ===\n")

    modified = 0
    for locale in ['fr', 'en', 'es', 'ar', 'ary']:
        if process_locale(locale):
            print(f"  ✅ {locale}.json: added footer keys")
            modified += 1

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
