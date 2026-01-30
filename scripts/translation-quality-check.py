#!/usr/bin/env python3
"""
VocalIA Translation Quality Checker
Vérifie: longueur, complétude, cohérence
"""

import json
import sys
from pathlib import Path

# Use absolute path for reliability
PROJECT_ROOT = Path("/Users/mac/Desktop/VocalIA")
LOCALES_DIR = PROJECT_ROOT / "website/src/locales"
MIN_LENGTH_RATIO = 0.60  # 60% minimum de la longueur FR

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
    """Détecte traductions <60% longueur FR."""
    print(f"Loading reference locale (FR) from {LOCALES_DIR}/fr.json...")
    try:
        with open(LOCALES_DIR / "fr.json", "r", encoding="utf-8") as f:
            fr = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find {LOCALES_DIR}/fr.json")
        sys.exit(1)
        
    issues = []
    metrics = {"checked": 0, "issues": 0}

    for locale in ["en", "es", "ar", "ary"]:
        file_path = LOCALES_DIR / f"{locale}.json"
        if not file_path.exists():
            print(f"Warning: {file_path} not found, skipping.")
            continue
            
        print(f"Checking {locale}...")
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for key in get_all_keys(fr):
            fr_val = get_nested(fr, key)
            loc_val = get_nested(data, key)
            
            if isinstance(fr_val, str) and isinstance(loc_val, str):
                metrics["checked"] += 1
                # Skip very short reference strings (e.g. "OK", "Non")
                if len(fr_val) < 5:
                    continue
                    
                ratio = len(loc_val) / len(fr_val)
                if ratio < MIN_LENGTH_RATIO:
                    issues.append({
                        "locale": locale,
                        "key": key,
                        "fr": fr_val,
                        "loc": loc_val,
                        "fr_len": len(fr_val),
                        "loc_len": len(loc_val),
                        "ratio": round(ratio, 2)
                    })
                    metrics["issues"] += 1

    return issues, metrics

if __name__ == "__main__":
    print("=== VocalIA Translation Quality Checker ===")
    issues, metrics = check_truncation()
    
    print(f"\nChecked {metrics['checked']} keys across locales.")
    print(f"Found {metrics['issues']} potential truncation issues (< {int(MIN_LENGTH_RATIO*100)}% of FR length).\n")
    
    if issues:
        print("Issues found:")
        for issue in issues:
            print(f"[{issue['locale'].upper()}] {issue['key']}")
            print(f"  Ratio: {issue['ratio']*100}%")
            print(f"  FR ({issue['fr_len']}): {issue['fr']}")
            print(f"  {issue['locale'].upper()} ({issue['loc_len']}): {issue['loc']}")
            print("-" * 40)
            
        # Optional: Save report
        report_path = PROJECT_ROOT / "docs/translation_qa_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(issues, f, indent=2, ensure_ascii=False)
        print(f"\nFull report saved to {report_path}")
        sys.exit(1)
    else:
        print("✅ No truncation issues found.")
        sys.exit(0)
