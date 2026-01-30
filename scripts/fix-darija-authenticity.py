#!/usr/bin/env python3
"""
VocalIA Darija Fixer
Replaces MSA terms with Darija equivalents in JSON files.
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/mac/Desktop/VocalIA")
FILES_TO_FIX = [
    PROJECT_ROOT / "website/src/locales/ary.json",
    PROJECT_ROOT / "website/voice-assistant/lang/voice-ary.json",
    PROJECT_ROOT / "telephony/knowledge_base_ary.json"
]


import re


REPLACEMENTS = {
    "التي": "اللي",
    "الذي": "اللي",
    "إن": "راه",
    "أن": "بلي",
    "سوف": "غادي",
    "لماذا": "علاش",
    "هكذا": "هاكا",
    "جدا": "بزاف",
    "جداً": "بزاف",
    "أيضاً": "حتى هي",
    "أيضا": "حتى هي",
    "نحن": "حنا",
    "هل": "واش",
    "ماذا": "شنو"
}

def fix_text(text):
    words = text.split()
    fixed_words = []
    for word in words:
        # Strip punctuation to check the core word
        clean_word = word.strip('.,!؟:;"\'()[]{}')
        prefix = word[:word.find(clean_word)] if clean_word in word else ""
        suffix = word[word.find(clean_word)+len(clean_word):] if clean_word in word else ""
        
        if clean_word in REPLACEMENTS:
            fixed_words.append(prefix + REPLACEMENTS[clean_word] + suffix)
        else:
            fixed_words.append(word)
            
    return " ".join(fixed_words)



def process_data(data):
    if isinstance(data, dict):
        return {k: process_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [process_data(v) for v in data]
    elif isinstance(data, str):
        return fix_text(data)
    else:
        return data

if __name__ == "__main__":
    print("=== VocalIA Darija Fixer ===")
    
    for file_path in FILES_TO_FIX:
        if not file_path.exists():
            print(f"Skipping {file_path} (not found)")
            continue
            
        print(f"Fixing {file_path.name}...")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            fixed_data = process_data(data)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(fixed_data, f, indent=2, ensure_ascii=False)
                
            print(f"✅ Fixed {file_path.name}")
        except Exception as e:
            print(f"❌ Error fixing {file_path.name}: {e}")

    print("\nRun scripts/darija-validator.py to verify.")
