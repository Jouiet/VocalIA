#!/usr/bin/env python3
"""
VocalIA Darija Authenticity Validator
======================================
Detects MSA (Modern Standard Arabic) contamination in Darija translations.

Darija (Moroccan Arabic) should use colloquial vocabulary and grammar,
NOT formal MSA constructs that would sound unnatural in speech.

Usage:
    python3 scripts/darija-validator.py [--strict] [--verbose] [--file FILE]

Arguments:
    --strict    Exit with code 1 if MSA contamination found (for CI/CD)
    --verbose   Show all texts with their authenticity scores
    --file      Check specific file (default: all Darija files)

Reference Markers:
    DARIJA markers: words/patterns that indicate authentic Moroccan Arabic
    MSA markers: formal constructs that indicate Standard Arabic contamination

Created: 30/01/2026 - Session 241
Author: Claude Opus 4.5
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Configuration
LOCALES_DIR = Path(__file__).parent.parent / "website" / "src" / "locales"
VOICE_LANG_DIR = Path(__file__).parent.parent / "website" / "voice-assistant" / "lang"
TELEPHONY_DIR = Path(__file__).parent.parent / "telephony"

# Darija authenticity markers (Moroccan colloquial)
DARIJA_MARKERS = [
    "واش",      # wash - question marker (vs هل in MSA)
    "ديال",     # dyal - possession (vs ل or من in MSA)
    "كاين",     # kayn - there is (vs يوجد in MSA)
    "بزاف",     # bzaf - a lot (vs كثير in MSA)
    "دابا",     # daba - now (vs الآن in MSA)
    "كنت",      # kunt - I was (Darija conjugation)
    "كيف",      # kif - how (colloquial usage)
    "علاش",     # 3lash - why (vs لماذا in MSA)
    "فين",      # fin - where (vs أين in MSA)
    "شنو",      # shnu - what (vs ماذا in MSA)
    "تال",      # tal - until (Darija specific)
    "بلاش",     # blash - without/free (Darija specific)
    "شي",       # shi - some/any (colloquial)
    "غادي",     # ghadi - going to (future marker)
    "كتبان",    # ktban - it seems (Darija form)
    "كتبدا",    # ktbda - starts (Darija conjugation)
    "ملي",      # mli - when (colloquial)
    "باش",      # bash - so that (vs لكي in MSA)
    "معا",      # m3a - with (colloquial spelling)
    "ولا",      # wla - or (colloquial)
    "بحال",     # bhal - like (vs مثل in MSA)
]

# MSA formal markers (to detect contamination)
# These are checked as standalone words using word boundary patterns
MSA_FORMAL_MARKERS_RAW = [
    "التي",     # allati - feminine relative pronoun (formal)
    "الذي",     # alladhi - masculine relative pronoun (formal)
    "لذلك",     # lidhaalik - therefore (formal)
    "وبالتالي", # wabittaali - consequently (formal)
    "حيث",      # haythu - where/whereas (formal)
    "إذ",       # idh - since/as (formal)
    "أنّ",      # anna - that (emphatic, formal)
    "إنّ",      # inna - indeed (emphatic, formal)
    "لأنّ",     # li'anna - because (formal)
    "بينما",    # baynama - while/whereas (formal)
    "كذلك",     # kadhalik - likewise (formal)
    "علاوة",    # 3ilawatan - furthermore (formal)
    "فضلا",     # fadlan - in addition (formal)
    "مما",      # mimma - from which (formal)
]

# Create regex patterns for word boundary matching
# Arabic word boundaries: space, punctuation, or start/end of string
MSA_PATTERNS = []
for marker in MSA_FORMAL_MARKERS_RAW:
    # Match marker at word boundaries (not inside words like المكالمات)
    pattern = re.compile(rf'(?:^|[\s،.؟!:])({re.escape(marker)})(?:[\s،.؟!:]|$)')
    MSA_PATTERNS.append((marker, pattern))

# Acceptable formal terms (business/technical context)
ACCEPTABLE_FORMAL = [
    "التوصيل",  # delivery - acceptable for business
    "الخدمة",   # service
    "المنتج",   # product
    "الطلب",    # order
    "التواصل",  # communication
    "المساعدة", # assistance
]


def get_all_texts(obj: Dict, prefix: str = "") -> List[Tuple[str, str]]:
    """Recursively get all string values with their keys."""
    texts = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                texts.extend(get_all_texts(v, new_prefix))
            elif isinstance(v, str) and v.strip():
                texts.append((new_prefix, v))
    return texts


def score_darija_authenticity(text: str) -> Dict[str, Any]:
    """
    Score text for Darija authenticity.

    Returns:
        score: positive = Darija authentic, negative = MSA contaminated
        darija_found: list of Darija markers found
        msa_found: list of MSA markers found (issues)
    """
    darija_found = []
    msa_found = []

    # Check for Darija markers (+1 each)
    for marker in DARIJA_MARKERS:
        if marker in text:
            darija_found.append(marker)

    # Check for MSA markers (-2 each, unless acceptable)
    # Use regex patterns for accurate word boundary detection
    for marker, pattern in MSA_PATTERNS:
        if pattern.search(text):
            # Check if it's in an acceptable context
            is_acceptable = any(acc in text for acc in ACCEPTABLE_FORMAL)
            if not is_acceptable:
                msa_found.append(marker)

    score = len(darija_found) - (2 * len(msa_found))

    return {
        "score": score,
        "darija_found": darija_found,
        "msa_found": msa_found,
        "is_authentic": len(msa_found) == 0
    }


def analyze_file(filepath: Path) -> List[Dict]:
    """Analyze a single JSON file for Darija authenticity."""
    issues = []

    try:
        data = json.load(open(filepath, encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [{"error": f"Invalid JSON: {e}"}]

    texts = get_all_texts(data)

    for key, text in texts:
        # Skip very short texts
        if len(text) < 10:
            continue

        result = score_darija_authenticity(text)

        if result["msa_found"]:
            issues.append({
                "file": filepath.name,
                "key": key,
                "text_preview": text[:100] + "..." if len(text) > 100 else text,
                "msa_markers": result["msa_found"],
                "darija_markers": result["darija_found"],
                "score": result["score"]
            })

    return issues


def main():
    verbose = "--verbose" in sys.argv
    strict = "--strict" in sys.argv

    print("=" * 70)
    print("VocalIA Darija Authenticity Validator")
    print("=" * 70)

    # Files to check
    files_to_check = []

    # Website locale
    ary_locale = LOCALES_DIR / "ary.json"
    if ary_locale.exists():
        files_to_check.append(ary_locale)

    # Voice assistant lang
    voice_ary = VOICE_LANG_DIR / "voice-ary.json"
    if voice_ary.exists():
        files_to_check.append(voice_ary)

    # Telephony knowledge base
    kb_ary = TELEPHONY_DIR / "knowledge_base_ary.json"
    if kb_ary.exists():
        files_to_check.append(kb_ary)

    if not files_to_check:
        print("No Darija files found to check.")
        sys.exit(0)

    print(f"\nChecking {len(files_to_check)} files...")

    all_issues = []
    all_stats = []

    for filepath in files_to_check:
        print(f"\n--- {filepath.name} ---")

        data = json.load(open(filepath, encoding="utf-8"))
        texts = get_all_texts(data)

        file_issues = analyze_file(filepath)
        all_issues.extend(file_issues)

        # Calculate statistics
        total_texts = len(texts)
        authentic_count = 0
        total_darija_markers = 0
        total_msa_markers = 0

        for key, text in texts:
            if len(text) < 10:
                continue
            result = score_darija_authenticity(text)
            if result["is_authentic"]:
                authentic_count += 1
            total_darija_markers += len(result["darija_found"])
            total_msa_markers += len(result["msa_found"])

        authenticity_rate = (authentic_count / total_texts * 100) if total_texts > 0 else 0

        stats = {
            "file": filepath.name,
            "total_texts": total_texts,
            "authentic": authentic_count,
            "authenticity_rate": round(authenticity_rate, 1),
            "darija_markers": total_darija_markers,
            "msa_contamination": total_msa_markers
        }
        all_stats.append(stats)

        print(f"  Total texts: {total_texts}")
        print(f"  Authentic: {authentic_count} ({authenticity_rate:.1f}%)")
        print(f"  Darija markers found: {total_darija_markers}")
        print(f"  MSA contamination: {total_msa_markers}")

        if verbose and file_issues:
            print("\n  Issues found:")
            for issue in file_issues[:5]:
                print(f"    - {issue['key']}")
                print(f"      MSA: {', '.join(issue['msa_markers'])}")
                print(f"      Text: {issue['text_preview']}")

    # Final summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total_issues = len(all_issues)
    total_msa = sum(s["msa_contamination"] for s in all_stats)
    total_darija = sum(s["darija_markers"] for s in all_stats)

    print(f"\nFiles analyzed: {len(files_to_check)}")
    print(f"Total MSA contamination: {total_msa} markers")
    print(f"Total Darija markers: {total_darija} markers")
    print(f"Keys with issues: {total_issues}")

    # Verdict
    if total_issues == 0:
        print("\nVERDICT: EXCELLENT - No MSA contamination detected")
    elif total_issues < 5:
        print(f"\nVERDICT: GOOD - Minor contamination ({total_issues} keys)")
    elif total_issues < 20:
        print(f"\nVERDICT: ACCEPTABLE - Some contamination ({total_issues} keys)")
    else:
        print(f"\nVERDICT: NEEDS REVIEW - Significant contamination ({total_issues} keys)")

    # Generate report
    report_path = LOCALES_DIR / "darija-qa-report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated": "2026-01-30",
            "total_issues": total_issues,
            "total_msa_markers": total_msa,
            "total_darija_markers": total_darija,
            "files_stats": all_stats,
            "issues": all_issues
        }, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to: {report_path}")

    # Exit code for CI/CD
    if strict and total_issues > 0:
        print(f"\nSTRICT MODE: Exiting with code 1 ({total_issues} issues)")
        sys.exit(1)

    print("\nDone.")


if __name__ == "__main__":
    main()
