#!/usr/bin/env python3
"""
VocalIA - Propagate Footer i18n Keys to All Pages
Session 238 - 30/01/2026
"""

import os
import re
from pathlib import Path

WEBSITE_DIR = Path(__file__).parent.parent / "website"

# The standardized footer HTML with all data-i18n attributes
FOOTER_HTML = '''  <footer class="bg-slate-900 border-t border-slate-800">

    <!-- Main Footer -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Brand Section -->
      <div class="mb-10">
          <a href="/" class="flex items-center space-x-2 mb-4">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center">
              <i data-lucide="mic" class="w-6 h-6 text-white"></i>
            </div>
            <span class="text-xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-300 bg-clip-text text-transparent">VocalIA</span>
          </a>
          <p class="text-zinc-400 mb-4 text-sm" data-i18n="footer.tagline">Agents Vocaux IA pour Entreprises</p>
          <!-- Contact Info -->
          <div class="space-y-2 text-sm text-zinc-400 mb-4">
            <a href="mailto:contact@vocalia.ma" class="flex items-center gap-2 hover:text-white transition">
              <i data-lucide="mail" class="w-4 h-4"></i>
              contact@vocalia.ma
            </a>
            <a href="tel:+212520000000" class="flex items-center gap-2 hover:text-white transition">
              <i data-lucide="phone" class="w-4 h-4"></i>
              +212 5 20 00 00 00
            </a>
          </div>
          <!-- Social Links -->
          <div class="flex space-x-3">
            <a href="https://twitter.com/vocalia_ma" class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-zinc-400 hover:text-white transition" aria-label="Twitter">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
            </a>
            <a href="https://linkedin.com/company/vocalia" class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-zinc-400 hover:text-white transition" aria-label="LinkedIn">
              <i data-lucide="linkedin" class="w-4 h-4"></i>
            </a>
            <a href="https://github.com/Jouiet/VocalIA" class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-zinc-400 hover:text-white transition" aria-label="GitHub">
              <i data-lucide="github" class="w-4 h-4"></i>
            </a>
            <a href="https://youtube.com/@vocalia" class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-zinc-400 hover:text-white transition" aria-label="YouTube">
              <i data-lucide="youtube" class="w-4 h-4"></i>
            </a>
          </div>
        </div>

      <!-- Categories Row - Inline with proper spacing -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 lg:gap-16 mb-10">
        <!-- Product -->
        <div>
          <h4 class="font-semibold text-white text-base mb-4" data-i18n="footer.product">Produit</h4>
          <ul class="space-y-3 text-sm text-zinc-400">
            <li><a href="/features" class="hover:text-white transition" data-i18n="footer.links.features">Fonctionnalités</a></li>
            <li><a href="/pricing" class="hover:text-white transition" data-i18n="footer.links.pricing">Tarifs</a></li>
            <li><a href="/products/voice-widget" class="hover:text-white transition" data-i18n="footer.links.voice_widget">Voice Widget</a></li>
            <li><a href="/products/voice-telephony" class="hover:text-white transition" data-i18n="footer.links.voice_telephony">Voice Telephony</a></li>
            <li><a href="/integrations" class="hover:text-white transition" data-i18n="footer.links.integrations">Intégrations</a></li>
          </ul>
        </div>

        <!-- Solutions -->
        <div>
          <h4 class="font-semibold text-white text-base mb-4" data-i18n="footer.solutions">Solutions</h4>
          <ul class="space-y-3 text-sm text-zinc-400">
            <li><a href="/use-cases/e-commerce" class="hover:text-white transition" data-i18n="footer.links.ecommerce">E-commerce</a></li>
            <li><a href="/use-cases/customer-support" class="hover:text-white transition" data-i18n="footer.links.customer_support">Service Client</a></li>
            <li><a href="/industries/healthcare" class="hover:text-white transition" data-i18n="footer.links.healthcare">Santé</a></li>
            <li><a href="/industries/real-estate" class="hover:text-white transition" data-i18n="footer.links.real_estate">Immobilier</a></li>
            <li><a href="/solutions/darija" class="hover:text-white transition" data-i18n="footer.links.darija_ai">Darija AI</a></li>
          </ul>
        </div>

        <!-- Ressources -->
        <div>
          <h4 class="font-semibold text-white text-base mb-4" data-i18n="footer.resources">Ressources</h4>
          <ul class="space-y-3 text-sm text-zinc-400">
            <li><a href="/docs" class="hover:text-white transition" data-i18n="footer.links.docs">Documentation</a></li>
            <li><a href="/docs/api" class="hover:text-white transition" data-i18n="footer.links.api">API Reference</a></li>
            <li><a href="/blog" class="hover:text-white transition" data-i18n="footer.links.blog">Blog</a></li>
            <li><a href="/status" class="hover:text-white transition" data-i18n="footer.links.status">Status</a></li>
          </ul>
        </div>

        <!-- Entreprise -->
        <div>
          <h4 class="font-semibold text-white text-base mb-4" data-i18n="footer.company">Entreprise</h4>
          <ul class="space-y-3 text-sm text-zinc-400">
            <li><a href="/about" class="hover:text-white transition" data-i18n="footer.links.about">À propos</a></li>
            <li><a href="/careers" class="hover:text-white transition" data-i18n="footer.links.careers">Carrières</a></li>
            <li><a href="/contact" class="hover:text-white transition" data-i18n="footer.links.contact">Contact</a></li>
            <li><a href="/privacy" class="hover:text-white transition" data-i18n="footer.links.privacy">Confidentialité</a></li>
            <li><a href="/terms" class="hover:text-white transition" data-i18n="footer.links.terms">CGU</a></li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="border-t border-slate-800 mt-8 pt-8">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <p class="text-zinc-500 text-sm" data-i18n="footer.copyright">© 2026 VocalIA. Tous droits réservés.</p>

          <!-- Trust Badges -->
          <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
              <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
              <span data-i18n="footer.trust.gdpr">RGPD</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
              <i data-lucide="cpu" class="w-4 h-4 text-indigo-400"></i>
              <span data-i18n="footer.trust.ai_act">AI Act Ready</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
              <i data-lucide="lock" class="w-4 h-4 text-amber-400"></i>
              <span data-i18n="footer.trust.security">AES-256</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
              <i data-lucide="globe" class="w-4 h-4 text-sky-400"></i>
              <span data-i18n="footer.trust.languages">5 Langues</span>
            </div>
            <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
              <i data-lucide="activity" class="w-4 h-4 text-rose-400"></i>
              <span data-i18n="footer.trust.reliability">99.9% Uptime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </footer>'''

# Pages to update (excluding dashboards, components, index.html which is already done)
PAGES = [
    "about.html",
    "contact.html",
    "features.html",
    "integrations.html",
    "pricing.html",
    "privacy.html",
    "terms.html",
    "blog/index.html",
    "docs/index.html",
    "docs/api.html",
    "industries/index.html",
    "industries/finance.html",
    "industries/healthcare.html",
    "industries/real-estate.html",
    "industries/retail.html",
    "products/voice-widget.html",
    "products/voice-telephony.html",
    "use-cases/appointments.html",
    "use-cases/customer-support.html",
    "use-cases/e-commerce.html",
    "use-cases/lead-qualification.html",
    # Blog articles
    "blog/articles/agence-immo-plus-conversion.html",
    "blog/articles/ai-act-europe-voice-ai.html",
    "blog/articles/clinique-amal-rappels-vocaux.html",
    "blog/articles/integrer-vocalia-shopify.html",
    "blog/articles/reduire-couts-support-voice-ai.html",
    "blog/articles/rgpd-voice-ai-guide-2026.html",
    "blog/articles/vocalia-lance-support-darija.html",
]

def update_footer(filepath):
    """Replace the entire footer section with the standardized i18n footer."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if file has a footer
        if '<footer' not in content:
            print(f"  SKIP: {filepath.name} (no footer)")
            return False

        # Replace footer section (from <footer to </footer>)
        pattern = r'<footer[^>]*>.*?</footer>'
        new_content = re.sub(pattern, FOOTER_HTML, content, flags=re.DOTALL)

        if new_content == content:
            print(f"  SAME: {filepath.name}")
            return False

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"  OK: {filepath.name}")
        return True

    except Exception as e:
        print(f"  ERR: {filepath.name} - {e}")
        return False

def main():
    print("VocalIA - Propagate Footer i18n Keys")
    print("=" * 45)

    updated = 0
    for relpath in PAGES:
        filepath = WEBSITE_DIR / relpath
        if filepath.exists():
            if update_footer(filepath):
                updated += 1
        else:
            print(f"  MISS: {relpath}")

    print(f"\nTotal: {updated} files updated")

if __name__ == "__main__":
    main()
