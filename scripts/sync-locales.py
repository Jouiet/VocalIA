#!/usr/bin/env python3
"""
VocalIA - Locale Synchronization Script v2.0
=============================================
FR is the SOURCE OF TRUTH. All other locales MUST follow.

Usage:
  python3 scripts/sync-locales.py --check      # Validate only (CI mode)
  python3 scripts/sync-locales.py --sync       # Sync all locales to FR
  python3 scripts/sync-locales.py --dry-run    # Preview sync without changes
  python3 scripts/sync-locales.py --report     # Generate detailed report
  python3 scripts/sync-locales.py --find-untranslated  # Find FR placeholders

Rules:
  1. FR.json is the master - all keys MUST exist there first
  2. EN/ES/AR/ARY must have EXACTLY the same keys as FR
  3. Extra keys in other locales are REMOVED (enforced)
  4. Missing keys in other locales are copied from FR as placeholders
  5. Key ORDER is preserved from FR (prevents git diff churn)
"""

import json
import os
import sys
import argparse
import shutil
from pathlib import Path
from datetime import datetime
from collections import OrderedDict

LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"
BACKUP_DIR = Path(__file__).parent.parent / ".locale-backups"
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
            obj[k] = OrderedDict()
        obj = obj[k]
    obj[keys[-1]] = value


def rebuild_with_fr_order(target_data, fr_data):
    """
    Rebuild target data structure to match FR key order.
    This prevents git diff churn when keys are in different order.
    """
    if not isinstance(fr_data, dict):
        return target_data

    result = OrderedDict()
    for key in fr_data.keys():
        if key in target_data:
            if isinstance(fr_data[key], dict):
                result[key] = rebuild_with_fr_order(target_data[key], fr_data[key])
            else:
                result[key] = target_data[key]
    return result


def load_locale(locale):
    """Load a locale JSON file with OrderedDict to preserve order."""
    path = LOCALES_DIR / f"{locale}.json"
    if not path.exists():
        print(f"❌ ERROR: {path} not found")
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def save_locale(locale, data, dry_run=False):
    """Save a locale JSON file."""
    path = LOCALES_DIR / f"{locale}.json"
    if dry_run:
        print(f"  🔍 DRY-RUN: Would save {path}")
        return
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')  # Trailing newline
    print(f"  ✅ Saved: {path}")


def create_backup():
    """Create backup of all locale files before sync."""
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / timestamp
    backup_path.mkdir()

    for locale in ALL_LOCALES:
        src = LOCALES_DIR / f"{locale}.json"
        dst = backup_path / f"{locale}.json"
        shutil.copy2(src, dst)

    print(f"📦 Backup created: {backup_path}")
    return backup_path


def check_locales():
    """
    Check mode: Validate all locales against FR.
    Returns True if all locales are in sync, False otherwise.
    For CI usage - exits with code 1 if not in sync.
    """
    print("=" * 60)
    print("VocalIA Locale Validation (v2.0)")
    print(f"Source of Truth: {SOURCE_LOCALE}.json")
    print("=" * 60)

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    print(f"\n📊 {SOURCE_LOCALE}.json: {len(fr_keys)} keys (MASTER)\n")

    all_valid = True
    issues = []

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
            issues.append(f"{locale}: {len(missing)} missing keys")

        if extra:
            print(f"   ⚠️  Extra {len(extra)} keys NOT in FR (will be removed):")
            for k in sorted(extra)[:5]:
                print(f"      + {k}")
            if len(extra) > 5:
                print(f"      ... and {len(extra)-5} more")
            all_valid = False
            issues.append(f"{locale}: {len(extra)} extra keys")

    print("\n" + "=" * 60)
    if all_valid:
        print("✅ ALL LOCALES IN SYNC WITH FR")
        print("=" * 60)
        return True
    else:
        print("❌ LOCALES OUT OF SYNC")
        print("   Issues found:")
        for issue in issues:
            print(f"   • {issue}")
        print("\n   Run with --sync to fix (or --dry-run to preview)")
        print("=" * 60)
        return False


def sync_locales(dry_run=False):
    """
    Sync mode: Synchronize all locales to match FR structure.
    - Remove extra keys
    - Add missing keys (copy FR value as placeholder)
    - Preserve key order from FR
    """
    mode = "DRY-RUN" if dry_run else "SYNC"
    print("=" * 60)
    print(f"VocalIA Locale Synchronization ({mode})")
    print(f"Source of Truth: {SOURCE_LOCALE}.json")
    print("=" * 60)

    # Create backup before actual sync
    if not dry_run:
        create_backup()

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    print(f"\n📊 {SOURCE_LOCALE}.json: {len(fr_keys)} keys (MASTER)\n")

    for locale in TARGET_LOCALES:
        data = load_locale(locale)
        data_keys = get_all_keys(data)

        missing = fr_keys - data_keys
        extra = data_keys - fr_keys

        print(f"\n📝 Processing {locale}.json...")

        changes_made = False

        # Add missing keys (copy from FR as placeholder)
        if missing:
            print(f"   ➕ Adding {len(missing)} missing keys (FR values as placeholders)")
            for key in sorted(missing):
                fr_value = get_nested_value(fr, key)
                set_nested_value(data, key, fr_value)
                # Show what's being added
                if isinstance(fr_value, str):
                    preview = fr_value[:35] + '...' if len(fr_value) > 35 else fr_value
                    print(f"      ⚠️  {key}: '{preview}' (needs {locale} translation)")
            changes_made = True

        # Remove extra keys (not in FR)
        if extra:
            print(f"   🗑️  Removing {len(extra)} extra keys (not in FR)")
            for key in sorted(extra):
                # Note: We'll rebuild the structure anyway, so just log
                print(f"      - {key}")
            changes_made = True

        # Rebuild data with FR key order (critical for git diff stability)
        if changes_made or True:  # Always rebuild to ensure order
            data = rebuild_with_fr_order(data, fr)

        # Save
        save_locale(locale, data, dry_run=dry_run)

    # Final verification
    print("\n" + "=" * 60)
    print("Final Verification:")
    for locale in ALL_LOCALES:
        data = load_locale(locale)
        count = len(get_all_keys(data))
        print(f"  {locale}.json: {count} keys")
    print("=" * 60)

    if dry_run:
        print("🔍 DRY-RUN COMPLETE - No files were modified")
        print("   Run with --sync to apply changes")
    else:
        print("✅ SYNC COMPLETE - All locales now match FR structure")
        print("⚠️  NOTE: Missing translations have FR values as placeholders")
        print("   Run --find-untranslated to identify them")
    print("=" * 60)


def find_untranslated():
    """Find keys where target locale still has FR value (untranslated)."""
    print("=" * 60)
    print("VocalIA - Find Untranslated Keys")
    print("=" * 60)

    fr = load_locale(SOURCE_LOCALE)
    fr_keys = get_all_keys(fr)

    for locale in TARGET_LOCALES:
        data = load_locale(locale)
        untranslated = []

        for key in fr_keys:
            fr_val = get_nested_value(fr, key)
            loc_val = get_nested_value(data, key)

            # If locale value equals FR value, it's likely untranslated
            if isinstance(fr_val, str) and fr_val == loc_val:
                untranslated.append(key)

        if untranslated:
            print(f"\n⚠️  {locale}.json: {len(untranslated)} potentially untranslated keys")
            for k in untranslated[:10]:
                print(f"   • {k}")
            if len(untranslated) > 10:
                print(f"   ... and {len(untranslated)-10} more")
        else:
            print(f"\n✅ {locale}.json: All keys appear translated")

    print("\n" + "=" * 60)


def generate_report():
    """Generate a detailed translation report."""
    print("=" * 60)
    print("VocalIA Translation Report (v2.0)")
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
        description="VocalIA Locale Sync v2.0 - FR is the source of truth",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/sync-locales.py --check           # CI validation
  python3 scripts/sync-locales.py --dry-run         # Preview sync
  python3 scripts/sync-locales.py --sync            # Apply sync
  python3 scripts/sync-locales.py --find-untranslated  # Find FR placeholders
        """
    )
    parser.add_argument('--check', action='store_true',
                        help='Validate only (CI mode, exit 1 if out of sync)')
    parser.add_argument('--sync', action='store_true',
                        help='Sync all locales to FR (creates backup)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview sync without modifying files')
    parser.add_argument('--report', action='store_true',
                        help='Generate detailed report')
    parser.add_argument('--find-untranslated', action='store_true',
                        help='Find keys still using FR values')

    args = parser.parse_args()

    if not any([args.check, args.sync, args.dry_run, args.report, args.find_untranslated]):
        # Default: check
        args.check = True

    if args.find_untranslated:
        find_untranslated()
    elif args.report:
        generate_report()
    elif args.dry_run:
        sync_locales(dry_run=True)
    elif args.sync:
        sync_locales(dry_run=False)
    elif args.check:
        if not check_locales():
            sys.exit(1)


if __name__ == "__main__":
    main()
