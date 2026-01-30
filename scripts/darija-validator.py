#!/usr/bin/env python3
"""
VocalIA Darija Authenticity Checker
Détecte contamination MSA dans Darija
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/mac/Desktop/VocalIA")
LOCALES_DIR = PROJECT_ROOT / "website/src/locales"
VOICE_LANG_DIR = PROJECT_ROOT / "website/voice-assistant/lang"
KB_DIR = PROJECT_ROOT / "telephony"

MSA_FORMAL = ['التي', 'الذي', 'لذلك', 'وبالتالي', 'إن', 'أن', 'سوف', 'لماذا', 'هكذا']
DARIJA_MARKERS = ['واش', 'ديال', 'كاين', 'بزاف', 'دابا', 'شنو', 'فين', 'علاش', 'تال', 'بلاش', 'غادي', 'كنت']

def get_all_values(data):
    """Recursively get all string values from nested dictionary."""
    values = []
    if isinstance(data, dict):
        for v in data.values():
            values.extend(get_all_values(v))
    elif isinstance(data, list):
        for v in data:
            values.extend(get_all_values(v))
    elif isinstance(data, str):
        values.append(data)
    return values


def check_darija_authenticity(text, context=""):
    """
    Score: +1 pour chaque marqueur Darija, -2 pour chaque MSA formel
    """
    score = 0
    issues = []
    markers_found = []
    
    # Simple tokenization by splitting on whitespace and stripping punctuation
    # This acts as a robust word boundary check for Arabic script
    words = [w.strip('.,!؟:;"\'()[]{}') for w in text.split()]
    
    for marker in DARIJA_MARKERS:
        if marker in words:
            score += 1
            markers_found.append(marker)

    for msa in MSA_FORMAL:
        if msa in words:
            score -= 2
            issues.append(f"MSA detected: '{msa}' in '{text[:50]}...' ({context})")

    return score, issues, markers_found


def scan_file(file_path):
    print(f"Scanning {file_path}...")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
        return 0, []

    total_score = 0
    all_issues = []
    
    values = get_all_values(data)
    for val in values:
        score, issues, _ = check_darija_authenticity(val, context=file_path.name)
        total_score += score
        all_issues.extend(issues)
        
    return total_score, all_issues

if __name__ == "__main__":
    print("=== VocalIA Darija Authenticity Checker ===\n")
    
    files_to_check = [
        LOCALES_DIR / "ary.json",
        VOICE_LANG_DIR / "voice-ary.json",
        KB_DIR / "knowledge_base_ary.json"
    ]
    
    global_score = 0
    global_issues = []
    
    for file_path in files_to_check:
        if not file_path.exists():
            print(f"Warning: {file_path} does not exist.")
            continue
            
        score, issues = scan_file(file_path)
        global_score += score
        global_issues.extend(issues)
        print(f"  Score for {file_path.name}: {score}")
        
    print(f"\nGlobal Authenticity Score: {global_score}")
    
    if global_issues:
        print(f"\n❌ Found {len(global_issues)} MSA Contamination Issues:")
        for issue in global_issues:
            print(f"  - {issue}")
        sys.exit(1)
    else:
        print("\n✅ No MSA contamination detected. Content appears authentic.")
        sys.exit(0)
