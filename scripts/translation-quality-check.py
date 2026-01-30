#!/usr/bin/env python3
"""
VocalIA Translation Quality Checker
=====================================
Detects translation quality issues:
- Truncated translations (<60% of FR reference length)
- Identical translations (copied from FR without translation)
- Empty or placeholder values

Usage:
    python3 scripts/translation-quality-check.py [--fix] [--verbose] [--strict]

Arguments:
    --fix       Auto-mark truncated keys for review (creates report file)
    --verbose   Show all issues with full context
    --strict    Exit with code 1 if any issues found (for CI/CD)

Created: 30/01/2026 - Session 241
Author: Claude Opus 4.5
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Configuration
LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"
MIN_LENGTH_RATIO = 0.60  # 60% minimum of FR length
IGNORED_KEYS = {"meta.title", "meta.description"}  # Keys that may legitimately differ

# RTL languages may have different length characteristics
RTL_LANGUAGES = ["ar", "ary"]
RTL_LENGTH_RATIO = 0.50  # More lenient for Arabic scripts


def get_all_keys(obj: Dict, prefix: str = "") -> List[str]:
    """Recursively get all terminal keys from nested dict."""
    keys = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.extend(get_all_keys(v, new_prefix))
            else:
                keys.append(new_prefix)
    return keys


def get_nested(obj: Dict, key: str) -> Any:
    """Get value from nested dict using dot notation."""
    parts = key.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def check_truncation(fr_data: Dict, locale: str, loc_data: Dict) -> List[Dict]:
    """Detect translations <60% (or 50% for RTL) of FR length."""
    issues = []
    threshold = RTL_LENGTH_RATIO if locale in RTL_LANGUAGES else MIN_LENGTH_RATIO

    for key in get_all_keys(fr_data):
        if key in IGNORED_KEYS:
            continue

        fr_val = get_nested(fr_data, key)
        loc_val = get_nested(loc_data, key)

        if isinstance(fr_val, str) and isinstance(loc_val, str):
            fr_len = len(fr_val.strip())
            loc_len = len(loc_val.strip())

            # Skip very short strings (less than 10 chars in FR)
            if fr_len < 10:
                continue

            if fr_len > 0 and loc_len < fr_len * threshold:
                ratio = loc_len / fr_len if fr_len > 0 else 0
                issues.append({
                    "type": "truncated",
                    "locale": locale,
                    "key": key,
                    "fr_len": fr_len,
                    "loc_len": loc_len,
                    "ratio": round(ratio * 100, 1),
                    "fr_preview": fr_val[:80] + "..." if len(fr_val) > 80 else fr_val,
                    "loc_preview": loc_val[:80] + "..." if len(loc_val) > 80 else loc_val
                })

    return issues


def check_identical(fr_data: Dict, locale: str, loc_data: Dict) -> List[Dict]:
    """Detect translations that are identical to FR (not translated)."""
    issues = []

    for key in get_all_keys(fr_data):
        fr_val = get_nested(fr_data, key)
        loc_val = get_nested(loc_data, key)

        if isinstance(fr_val, str) and isinstance(loc_val, str):
            # Skip very short strings or technical values
            if len(fr_val) < 15 or fr_val.startswith("http") or "@" in fr_val:
                continue

            # Check if identical (exact copy)
            if fr_val == loc_val and locale not in ["fr"]:
                issues.append({
                    "type": "identical",
                    "locale": locale,
                    "key": key,
                    "value": fr_val[:80] + "..." if len(fr_val) > 80 else fr_val
                })

    return issues


def check_empty_or_placeholder(loc_data: Dict, locale: str) -> List[Dict]:
    """Detect empty or placeholder values."""
    issues = []
    # Only check for actual placeholder patterns (full word, not Spanish "todo")
    placeholders = ["[TODO]", "[TBD]", "XXX", "FIXME", "PLACEHOLDER", "{{TODO}}", "TBD:"]

    for key in get_all_keys(loc_data):
        val = get_nested(loc_data, key)

        if isinstance(val, str):
            val_stripped = val.strip()

            if not val_stripped:
                issues.append({
                    "type": "empty",
                    "locale": locale,
                    "key": key
                })
            elif any(ph in val_stripped.upper() for ph in placeholders):
                issues.append({
                    "type": "placeholder",
                    "locale": locale,
                    "key": key,
                    "value": val_stripped
                })

    return issues


def main():
    verbose = "--verbose" in sys.argv
    strict = "--strict" in sys.argv
    fix_mode = "--fix" in sys.argv

    print("=" * 70)
    print("VocalIA Translation Quality Checker")
    print("=" * 70)

    # Load FR as reference
    fr_path = LOCALES_DIR / "fr.json"
    if not fr_path.exists():
        print(f"ERROR: FR locale not found at {fr_path}")
        sys.exit(1)

    fr_data = json.load(open(fr_path, encoding="utf-8"))
    fr_keys = get_all_keys(fr_data)
    print(f"\nReference: FR ({len(fr_keys)} keys)")

    all_issues = []

    # Check each locale
    for locale in ["en", "es", "ar", "ary"]:
        loc_path = LOCALES_DIR / f"{locale}.json"
        if not loc_path.exists():
            print(f"WARNING: {locale}.json not found")
            continue

        loc_data = json.load(open(loc_path, encoding="utf-8"))
        loc_keys = get_all_keys(loc_data)

        print(f"\n--- {locale.upper()} ({len(loc_keys)} keys) ---")

        # Run checks
        truncated = check_truncation(fr_data, locale, loc_data)
        identical = check_identical(fr_data, locale, loc_data)
        empty_ph = check_empty_or_placeholder(loc_data, locale)

        locale_issues = truncated + identical + empty_ph
        all_issues.extend(locale_issues)

        # Summary per locale
        print(f"  Truncated (<{MIN_LENGTH_RATIO*100:.0f}% FR): {len(truncated)}")
        print(f"  Identical to FR: {len(identical)}")
        print(f"  Empty/Placeholder: {len(empty_ph)}")

        # Verbose output
        if verbose and truncated:
            print("\n  Top truncated keys:")
            for issue in sorted(truncated, key=lambda x: x["ratio"])[:5]:
                print(f"    - {issue['key']}: {issue['ratio']}% ({issue['loc_len']}/{issue['fr_len']} chars)")
                print(f"      FR: {issue['fr_preview']}")
                print(f"      {locale.upper()}: {issue['loc_preview']}")

    # Final summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    by_type = {}
    for issue in all_issues:
        t = issue["type"]
        by_type[t] = by_type.get(t, 0) + 1

    total = len(all_issues)
    print(f"\nTotal issues: {total}")
    for t, count in sorted(by_type.items()):
        print(f"  - {t}: {count}")

    # Generate report file if --fix
    if fix_mode and all_issues:
        report_path = LOCALES_DIR / "translation-qa-report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "generated": "2026-01-30",
                "total_issues": total,
                "by_type": by_type,
                "issues": all_issues
            }, f, indent=2, ensure_ascii=False)
        print(f"\nReport saved to: {report_path}")

    # Exit code for CI/CD
    if strict and total > 0:
        print(f"\nSTRICT MODE: Exiting with code 1 ({total} issues)")
        sys.exit(1)

    print("\nDone.")


if __name__ == "__main__":
    main()
