#!/usr/bin/env python3
"""
VocalIA Truncation Fixer
Fixes critical truncated translations in ARY, AR, EN, ES files.
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/mac/Desktop/VocalIA")
LOCALES_DIR = PROJECT_ROOT / "website/src/locales"

# Critical fixes for Darija (ARY) - Based on report
ARY_FIXES = {
    "usecases_leads_page.cta_subtitle": "الكوميرسيال ديالك كيستاهلو يهضرو مع كليان مؤهلين. خلي VocalIA دير الفرز.",
    "usecases_leads_page.hero_subtitle": "أهّل الكليان ديالك أوتوماتيكياً بإطار BANT. سكورينغ وتزامُن CRM فالوقت الحقيقي.",
    "usecases_leads_page.challenges_subtitle": "بزاف ديال اللييدز ماشي مؤهلين كيضيعو الوقت ديال الكوميرسيال.",
    "footer.links.features": "المميزات والوظائف",
    "nav.features": "المميزات",
    "privacy_page.hero_title": "سياسة ديال",
    "privacy_page.hero_title_accent": "الخصوصية وحماية المعلومات",
    "terms_page.hero_title": "الشروط العامة",
    "integrations_page.cta_request": "طلب اندماج جديد",
    "investor.funds_subtitle": "استثمار مركز باش نسرّعو النمو واختراق السوق بشكل قوي.",
    "investor.tech_rag_desc": "قاعدة معرفة ذكية ومتقدمة",
    "usecases_appointments_page.cta_subtitle": "كل مكالمة دازت هي فرصة ضاعت. VocalIA كيجاوب 24/7 وكيحول المتصلين لمواعيد مؤكدة.",
    "usecases_support_page.cta_subtitle": "نضم للشركات اللي كتقدم دعم استثنائي بلا ما تفرقع الميزانية."
}

# Critical fixes for English (EN)
EN_FIXES = {
    "nav.features": "Platform Features",
    "nav.login": "Client Login",
    "nav.logout": "Log Out",
    "hero.badge": "Next-Gen Voice AI Platform",
    "hero.trusted": "Trusted by Industry Leaders",
    "pricing_page.free_cta": "Start Required Free Trial",
    "about_page.mission_savings": "Save 60%+ on Costs",
    "about_page.values_title": "What Defines Us",
    "features_page.title": "All Platform",
    "features_page.title_highlight": "Capabilities & Features",
    "usecases_support_page.cta_subtitle": "Join companies delivering exceptional support without breaking the budget.",
    "usecases_appointments_page.cta_subtitle": "Every missed call is a missed opportunity. VocalIA answers 24/7 and converts callers into confirmed appointments.",
    "privacy_page.hero_title": "Privacy",
    "privacy_page.hero_title_accent": "Policy & Data Protection"
}

# Critical fixes for Spanish (ES)
ES_FIXES = {
    "nav.features": "Funcionalidades",
    "usecases_ecommerce_page.hero_title": "Soporte E-commerce con Voice AI",
    "usecases_ecommerce_page.hero_title_accent": "Automatizado por IA Vocal",
    "usecases_appointments_page.hero_title_accent": "Automatizada por IA",
    "usecases_leads_page.cta_subtitle": "Sus comerciales merecen hablar con prospectos cualificados. Deje que VocalIA haga el triaje."
}

# Critical fixes for Arabic (AR)
AR_FIXES = {
    "nav.features": "المميزات والوظائف",
    "dashboard.header.status": "النظام يعمل بكفاءة",
    "dashboard.header.refresh": "تحديث البيانات",
    "usecases_leads_page.cta_subtitle": "يستحق مندوبو المبيعات لديك التحدث مع عملاء مؤهلين. دع VocalIA يقوم بالفرز."
}

def apply_fixes(locale, fixes):
    file_path = LOCALES_DIR / f"{locale}.json"
    if not file_path.exists():
        print(f"Skipping {locale} (not found)")
        return

    print(f"Fixing {locale} ({len(fixes)} keys)...")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        count = 0
        for key, value in fixes.items():
            # Update nested keys
            parts = key.split('.')
            target = data
            for i, part in enumerate(parts[:-1]):
                if part in target:
                    target = target[part]
                else:
                    break
            else:
                if parts[-1] in target:
                    target[parts[-1]] = value
                    count += 1
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Applied {count} fixes to {locale}")
    except Exception as e:
        print(f"❌ Error fixing {locale}: {e}")

if __name__ == "__main__":
    print("=== VocalIA Truncation Fixer ===")
    
    apply_fixes("ary", ARY_FIXES)
    apply_fixes("en", EN_FIXES)
    apply_fixes("es", ES_FIXES)
    apply_fixes("ar", AR_FIXES)
    
    print("\nRun scripts/translation-quality-check.py to verify.")
