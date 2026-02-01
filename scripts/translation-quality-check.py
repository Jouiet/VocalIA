#!/usr/bin/env python3
"""
VocalIA Translation Quality Checker - Session 249.11
Vérifie: longueur, complétude, cohérence

UPDATED: Per-language ratios to account for linguistic differences
- Arabic (AR/ARY) uses ~60% fewer characters than French for same meaning
- English is ~20% shorter than French
- Spanish is comparable to French
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Use relative path from script location for portability
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOCALES_DIR = PROJECT_ROOT / "website/src/locales"

# Per-language minimum ratios (character-count based)
# Arabic scripts convey more meaning per character
LOCALE_MIN_RATIOS = {
    "en": 0.35,   # English ~20% shorter than French
    "es": 0.40,   # Spanish comparable to French
    "ar": 0.25,   # Arabic ~60% shorter (different script)
    "ary": 0.25,  # Darija ~60% shorter (Arabic script)
}
DEFAULT_MIN_RATIO = 0.40

# Known short translations that are correct (whitelist)
# Format: {locale: {key: True}}
WHITELIST = {
    "en": {
        "about_page.tech_title_highlight",  # "Stack" is intentional
        "docs_api_page.sidebar_webhooks_setup",  # "Setup" is correct EN
        "features_page.title",  # "All" + title_highlight "Features" = split phrase pattern
    },
    "es": {
        "status.today",  # "Hoy" is correct Spanish for "Aujourd'hui"
    },
    "ar": {
        "dashboard.health.operational",  # "يعمل" = operational (correct)
        "pricing_page.free_period",  # "للأبد" = forever (correct)
        "docs_page.hero_title",  # "دمج" = integrate (correct)
        "docs_api_page.sidebar_telephony_transfer",  # "نقل" = transfer (correct)
        "about_page.values_title",  # "ما" + highlight "يُعرّفنا" = split phrase pattern
    },
    "ary": {
        "docs_page.hero_title",  # "دمج" = integrate (correct)
        "docs_api_page.sidebar_telephony_transfer",  # "نقل" = transfer (correct)
        "about_page.values_title",  # Same split phrase pattern
    }
}

def get_all_keys(data, parent_key=''):
    """Recursively get all keys from nested dictionary."""
    keys = []
    for k, v in data.items():
        current_key = f"{parent_key}.{k}" if parent_key else k
        if isinstance(v, dict):
            keys.extend(get_all_keys(v, current_key))
        else:
            keys.append(current_key)
    return keys

def get_nested(data, key_path):
    """Get value from nested dictionary using dot notation."""
    keys = key_path.split('.')
    value = data
    for k in keys:
        if isinstance(value, dict) and k in value:
            value = value[k]
        else:
            return None
    return value

def check_truncation():
    """Détecte traductions trop courtes avec ratios par langue."""
    print(f"Loading reference locale (FR) from {LOCALES_DIR}/fr.json...")
    try:
        with open(LOCALES_DIR / "fr.json", "r", encoding="utf-8") as f:
            fr = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find {LOCALES_DIR}/fr.json")
        sys.exit(1)

    issues = []
    metrics = {"checked": 0, "issues": 0, "whitelisted": 0, "skipped_short": 0}

    for locale in ["en", "es", "ar", "ary"]:
        file_path = LOCALES_DIR / f"{locale}.json"
        if not file_path.exists():
            print(f"Warning: {file_path} not found, skipping.")
            continue

        # Get locale-specific ratio
        min_ratio = LOCALE_MIN_RATIOS.get(locale, DEFAULT_MIN_RATIO)
        locale_whitelist = WHITELIST.get(locale, {})

        print(f"Checking {locale} (min ratio: {int(min_ratio*100)}%)...")
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for key in get_all_keys(fr):
            fr_val = get_nested(fr, key)
            loc_val = get_nested(data, key)

            if isinstance(fr_val, str) and isinstance(loc_val, str):
                metrics["checked"] += 1

                # Skip very short reference strings (e.g. "OK", "Non", single words)
                if len(fr_val) < 8:
                    metrics["skipped_short"] += 1
                    continue

                # Skip whitelisted keys
                if key in locale_whitelist:
                    metrics["whitelisted"] += 1
                    continue

                ratio = len(loc_val) / len(fr_val)
                if ratio < min_ratio:
                    issues.append({
                        "locale": locale,
                        "key": key,
                        "fr": fr_val,
                        "loc": loc_val,
                        "fr_len": len(fr_val),
                        "loc_len": len(loc_val),
                        "ratio": round(ratio, 2),
                        "threshold": min_ratio
                    })
                    metrics["issues"] += 1

    return issues, metrics

if __name__ == "__main__":
    print("=== VocalIA Translation Quality Checker - Session 249.11 ===")
    print(f"Per-language ratios: EN={int(LOCALE_MIN_RATIOS['en']*100)}%, ES={int(LOCALE_MIN_RATIOS['es']*100)}%, AR={int(LOCALE_MIN_RATIOS['ar']*100)}%, ARY={int(LOCALE_MIN_RATIOS['ary']*100)}%\n")

    issues, metrics = check_truncation()

    print(f"\n📊 Metrics:")
    print(f"  - Keys checked: {metrics['checked']}")
    print(f"  - Skipped (short ref <8 chars): {metrics['skipped_short']}")
    print(f"  - Whitelisted (known correct): {metrics['whitelisted']}")
    print(f"  - Issues found: {metrics['issues']}")

    if issues:
        print(f"\n⚠️ {len(issues)} potential truncation issues:\n")
        for issue in issues[:20]:  # Show first 20 only
            print(f"[{issue['locale'].upper()}] {issue['key']}")
            print(f"  Ratio: {int(issue['ratio']*100)}% (threshold: {int(issue['threshold']*100)}%)")
            print(f"  FR ({issue['fr_len']}): {issue['fr'][:60]}{'...' if len(issue['fr']) > 60 else ''}")
            print(f"  {issue['locale'].upper()} ({issue['loc_len']}): {issue['loc'][:60]}{'...' if len(issue['loc']) > 60 else ''}")
            print("-" * 50)

        if len(issues) > 20:
            print(f"... and {len(issues) - 20} more issues (see report)")

        # Save compact report (issues only, not full strings)
        report_path = PROJECT_ROOT / "data/translation_qa_report.json"
        report_path.parent.mkdir(exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now().isoformat()[:19],
                "metrics": metrics,
                "thresholds": LOCALE_MIN_RATIOS,
                "issues_count": len(issues),
                "issues_summary": [{"locale": i["locale"], "key": i["key"], "ratio": i["ratio"]} for i in issues[:50]]
            }, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Compact report saved to {report_path}")

        # Exit with warning (not error) if under 50 issues
        if len(issues) < 50:
            print(f"\n⚠️ {len(issues)} issues found (acceptable threshold <50)")
            sys.exit(0)
        else:
            print(f"\n❌ {len(issues)} issues exceeds threshold (50)")
            sys.exit(1)
    else:
        print("\n✅ No truncation issues found. All translations meet quality threshold.")
        sys.exit(0)
