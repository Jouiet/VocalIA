#!/usr/bin/env python3
"""
VocalIA - Locale Synchronization Script
========================================
FR is the SOURCE OF TRUTH. All other locales MUST follow.

Usage:
  python3 scripts/sync-locales.py --check     # Validate only (CI mode)
  python3 scripts/sync-locales.py --sync      # Add missing keys with FR values
  python3 scripts/sync-locales.py --report    # Generate detailed report

Rules:
  1. FR.json is the master - all keys MUST exist there first
  2. EN/ES/AR/ARY must have EXACTLY the same keys as FR
  3. Extra keys in other locales are REMOVED (enforced)
  4. Missing keys in other locales are flagged or copied from FR
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"
SOURCE_LOCALE = "fr"
TARGET_LOCALES = ["en", "es", "ar", "ary"]
ALL_LOCALES = [SOURCE_LOCALE] + TARGET_LOCALES


def get_all_keys(obj, prefix=''):
    """Recursively get all leaf keys with dot notation."""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(get_all_keys(v, new_prefix))
            else:
                keys.add(new_prefix)
    return keys


def get_nested_value(obj, key_path):
    """Get value from nested dict using dot notation."""
    keys = key_path.split('.')
    val = obj
    for k in keys:
        if isinstance(val, dict) and k in val:
            val = val[k]
        else:
            return None
    return val


def set_nested_value(obj, key_path, value):
    """Set value in nested dict using dot notation."""
    keys = key_path.split('.')
    for k in keys[:-1]:
        if k not in obj:
            obj[k] = {}
        obj = obj[k]
    obj[keys[-1]] = value


def remove_nested_key(obj, key_path):
    """Remove key from nested dict using dot notation."""
    keys = key_path.split('.')
    parent = obj
    for k in keys[:-1]:
        if isinstance(parent, dict) and k in parent:
            parent = parent[k]
        else:
            return False
    if isinstance(parent, dict) and keys[-1] in parent:
        del parent[keys[-1]]
        return True
    return False


def clean_empty_dicts(obj):
    """Recursively remove empty dicts."""
    if not isinstance(obj, dict):
        return obj
    cleaned = {}
    for k, v in obj.items():
        if isinstance(v, dict):
            v = clean_empty_dicts(v)
            if v:  # Only keep non-empty dicts
                cleaned[k] = v
        else:
            cleaned[k] = v
    return cleaned


def load_locale(locale):
    """Load a locale JSON file."""
    path = LOCALES_DIR / f"{locale}.json"
    if not path.exists():
        print(f"❌ ERROR: {path} not found")
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_locale(locale, data):
    """Save a locale JSON file."""
    path = LOCALES_DIR / f"{locale}.json"
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Saved: {path}")


def check_locales():
    """
    Check mode: Validate all locales against FR.
    Returns True if all locales are in sync, False otherwise.
    For CI usage - exits with code 1 if not in sync.
    """
    print("=" * 60)
    print("VocalIA Locale Validation")
    print(f"Source of Truth: {SOURCE_LOCALE}.json")
    print("=" * 60)

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    print(f"\n📊 {SOURCE_LOCALE}.json: {len(fr_keys)} keys (MASTER)\n")

    all_valid = True

    for locale in TARGET_LOCALES:
        data = load_locale(locale)
        data_keys = get_all_keys(data)

        missing = fr_keys - data_keys
        extra = data_keys - fr_keys

        status = "✅" if not missing and not extra else "❌"
        print(f"{status} {locale}.json: {len(data_keys)} keys")

        if missing:
            print(f"   ⚠️  Missing {len(missing)} keys from FR:")
            for k in sorted(missing)[:5]:
                print(f"      - {k}")
            if len(missing) > 5:
                print(f"      ... and {len(missing)-5} more")
            all_valid = False

        if extra:
            print(f"   ⚠️  Extra {len(extra)} keys NOT in FR (will be removed):")
            for k in sorted(extra)[:5]:
                print(f"      + {k}")
            if len(extra) > 5:
                print(f"      ... and {len(extra)-5} more")
            all_valid = False

    print("\n" + "=" * 60)
    if all_valid:
        print("✅ ALL LOCALES IN SYNC WITH FR")
        print("=" * 60)
        return True
    else:
        print("❌ LOCALES OUT OF SYNC - Run with --sync to fix")
        print("=" * 60)
        return False


def sync_locales():
    """
    Sync mode: Synchronize all locales to match FR structure.
    - Remove extra keys
    - Add missing keys (copy FR value as placeholder)
    """
    print("=" * 60)
    print("VocalIA Locale Synchronization")
    print(f"Source of Truth: {SOURCE_LOCALE}.json")
    print("=" * 60)

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    print(f"\n📊 {SOURCE_LOCALE}.json: {len(fr_keys)} keys (MASTER)\n")

    for locale in TARGET_LOCALES:
        data = load_locale(locale)
        data_keys = get_all_keys(data)

        missing = fr_keys - data_keys
        extra = data_keys - fr_keys

        print(f"\n📝 Processing {locale}.json...")

        # Remove extra keys
        if extra:
            print(f"   🗑️  Removing {len(extra)} extra keys")
            for key in extra:
                remove_nested_key(data, key)
            data = clean_empty_dicts(data)

        # Add missing keys (copy from FR as placeholder)
        if missing:
            print(f"   ➕ Adding {len(missing)} missing keys (FR values as placeholders)")
            for key in missing:
                fr_value = get_nested_value(fr, key)
                set_nested_value(data, key, fr_value)
                # Mark as needing translation
                if isinstance(fr_value, str) and locale != 'en':
                    print(f"      ⚠️  {key}: '{fr_value[:40]}...' (needs {locale} translation)")

        # Save
        save_locale(locale, data)

    # Final verification
    print("\n" + "=" * 60)
    print("Final Verification:")
    for locale in ALL_LOCALES:
        data = load_locale(locale)
        count = len(get_all_keys(data))
        print(f"  {locale}.json: {count} keys")
    print("=" * 60)
    print("✅ SYNC COMPLETE - All locales now match FR structure")
    print("⚠️  NOTE: Missing translations have FR values as placeholders")
    print("=" * 60)


def generate_report():
    """Generate a detailed translation report."""
    print("=" * 60)
    print("VocalIA Translation Report")
    print(f"Generated: {datetime.now().isoformat()}")
    print("=" * 60)

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    print(f"\n📊 Total Keys: {len(fr_keys)}")
    print(f"📊 Languages: {len(ALL_LOCALES)}")
    print(f"📊 Total Translations: {len(fr_keys) * len(ALL_LOCALES)}")

    # Group by section
    sections = {}
    for key in fr_keys:
        section = key.split('.')[0]
        if section not in sections:
            sections[section] = 0
        sections[section] += 1

    print(f"\n📂 Keys by Section:")
    for section, count in sorted(sections.items(), key=lambda x: -x[1]):
        print(f"   {section}: {count}")

    # Check translation completeness
    print(f"\n🌍 Translation Status:")
    for locale in ALL_LOCALES:
        data = load_locale(locale)
        data_keys = get_all_keys(data)
        coverage = len(data_keys) / len(fr_keys) * 100 if fr_keys else 0
        status = "✅" if coverage == 100 else "⚠️"
        print(f"   {status} {locale}: {len(data_keys)}/{len(fr_keys)} ({coverage:.1f}%)")


def main():
    parser = argparse.ArgumentParser(
        description="VocalIA Locale Sync - FR is the source of truth"
    )
    parser.add_argument('--check', action='store_true', help='Validate only (CI mode)')
    parser.add_argument('--sync', action='store_true', help='Sync all locales to FR')
    parser.add_argument('--report', action='store_true', help='Generate report')

    args = parser.parse_args()

    if not any([args.check, args.sync, args.report]):
        # Default: check
        args.check = True

    if args.report:
        generate_report()
    elif args.sync:
        sync_locales()
    elif args.check:
        if not check_locales():
            sys.exit(1)


if __name__ == "__main__":
    main()
