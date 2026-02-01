#!/usr/bin/env python3
"""
Add missing i18n keys to locale files.
Session 250.44
"""

import json
from pathlib import Path

LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"

# Missing keys to add
MISSING_KEYS = {
    "fr": {
        "products": {
            "voice_widget": "Voice Widget",
            "voice_telephony": "Voice Telephony"
        }
    },
    "en": {
        "products": {
            "voice_widget": "Voice Widget",
            "voice_telephony": "Voice Telephony"
        }
    },
    "es": {
        "products": {
            "voice_widget": "Voice Widget",
            "voice_telephony": "Voice Telephony"
        }
    },
    "ar": {
        "products": {
            "voice_widget": "أداة الصوت",
            "voice_telephony": "الهاتف الصوتي"
        }
    },
    "ary": {
        "products": {
            "voice_widget": "ويدجيت الصوت",
            "voice_telephony": "التيليفون الصوتي"
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

    # Check if products already exists
    if "products" in data and "voice_widget" in data.get("products", {}):
        return False

    # Merge missing keys
    deep_merge(data, MISSING_KEYS[locale_code])

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return True


def main():
    print("=== Adding Missing i18n Keys ===\n")

    modified = 0
    for locale in ['fr', 'en', 'es', 'ar', 'ary']:
        if process_locale(locale):
            print(f"  ✅ {locale}.json: added products section")
            modified += 1
        else:
            print(f"  ⏭️  {locale}.json: already has products or skipped")

    print(f"\n=== Summary ===")
    print(f"Files modified: {modified}")


if __name__ == "__main__":
    main()
