#!/usr/bin/env python3
"""
Fix French contamination in en.json
Session 250.86 - DEEP CLEANUP
139 French entries → English translations
"""

import json
import re

# Translation mapping: French → English
TRANSLATIONS = {
    # Solution titles
    "solution_tracking_title": "Order Tracking",
    "solution_returns_title": "Returns Management",
    "feature_kb_title": "AI Knowledge Base",
    "breadcrumb_current": "Appointment Booking",
    "feature_outbound_desc": "Proactive callback campaigns to re-engage inactive customers or confirm appointments.",
    "bant_budget_q2": "How are you financing this project?",

    # Deployment
    "dploiement_en_5_4": "Deployment in 5 minutes",

    # Privacy/Session
    "identifiants_de_session_4": "Session identifiers",
    "type_de_navigateur_5": "Browser type and device",
    "transcriptions_des_conversations_9": "Voice conversation transcripts (with consent)",
    "nom_de_lentreprise_11": "Company name and role",
    "politique_de_confidentialit_19": "Privacy Policy",
    "politique_de_confidentialit_43": "Privacy Policy - VoiceIA",
    "des_contenus_haineux_12": "Hateful, discriminatory or violent content",
    "fournir_un_support_23": "Provide technical support according to subscription level",
    "dashboard_de_suivi_28": "Tracking dashboard and analytics",
    "support_de_5_30": "Support for 5 languages (FR, EN, ES, AR, Darija)",
    "politique_de_confidentialit_2": "Privacy Policy",
    "cookies_de_prfrences_4": "Preference cookies",
    "trackers_de_rseaux_9": "Social network trackers",
    "pas_de_fingerprinting_16": "No fingerprinting",
    "pas_de_cookies_18": "No tracking cookies",
    "politique_des_cookies_31": "Cookie Policy",
    "politique_des_cookies_32": "Cookie Policy",
    "politique_des_cookies_35": "Cookie Policy - VoiceIA",
    "cookie_de_tracking_31": "Tracking cookie",

    # Features
    "liens_de_paiement_27": "Payment links",
    "gestion_des_objections_35": "Objection handling",
    "exemples_de_code_32": "Code Examples",
    "headers_de_rate_15": "Rate limit headers",
    "exemple_de_payload_56": "Webhook payload example",
    "transcription_en_temps_60": "Real-time transcription (partial and final).",
    "date_de_fin_74": "End date (ISO 8601)",
    "offset_pour_pagination_78": "Offset for pagination",
    "lister_les_appels_161": "List calls",
    "crer_un_appel_163": "Create a call",
    "ajouter_un_client_14": "Add a client",
    "liste_des_tenants_46": "Active tenants list",
    "mesures_de_scurit_15": "Security measures",
    "pas_de_stockage_11": "No audio storage",
    "types_de_biens_19": "Property Types",

    # Getting started
    "comment_dmarrer_10": "How to Get Started",
    "avec_vocalia_11": "With VoiceIA",
    "formule_de_base_14": "Basic plan",
    "comment_choisir_son_34": "How to choose your persona",
    "les_2_produits_97": "The 2 VoiceIA products",
    "sondages_de_satisfaction_5": "Post-visit satisfaction surveys",
    "rappels_de_visites_6": "Scheduled visit reminders (D-1)",
    "temps_de_rponse_17": "Response time",
    "les_resultats_apres_19": "Results after 4 months",
    "implementation_en_3_20": "Implementation in 3 phases",
    "comment_vocalia_se_15": "How VoiceIA prepares",
    "produisent_des_resultats_18": "Produce results used in the EU",
    "ont_des_utilisateurs_19": "Have users in the EU",
    "impact_pour_les_21": "Impact for Moroccan companies",
    "violation_des_interdictions_26": "Violation of prohibitions",
    "les_sanctions_prevues_28": "Expected penalties",
    "gouvernance_des_donnes_33": "Data governance",
    "ce_que_lai_40": "What the AI Act requires from Voice AI providers",
    "obligations_de_gouvernance_45": "Governance obligations",
    "les_4_niveaux_68": "The 4 risk levels",
    "les_rappels_sontils_4": "Are reminders customizable?",
    "que_se_passetil_6": "What happens if the patient doesn't understand the AI?",
    "configuration_du_persona_12": "Persona configuration",
    "audit_du_flux_14": "Current flow audit",
    "avec_vocalia_8_26": "With VoiceIA (8% × 100 × 300 MAD)",
    "exemple_de_rappel_28": "D-1 voice reminder example",

    # Satisfaction
    "politesse_et_professionnalisme_28": "Politeness and professionalism",
    "facteurs_de_satisfaction_29": "Satisfaction factors",
    "avant_vocalia_34": "Before VoiceIA",
    "audit_et_configuration_62": "Audit and configuration",
    "calendrier_du_projet_64": "Project timeline",
    "rappel_de_courtoisie_66": "Courtesy reminder",
    "rappel_de_confirmation_67": "Confirmation reminder",
    "avantages_des_rappels_86": "Advantages of voice reminders vs SMS",
    "les_noshows_en_100": "No-shows in numbers",
    "avant_de_signer_13": "Before signing",
    "pas_de_support_15": "No local support",
    "temps_de_rponse_26": "Guaranteed response time",
    "support_et_onboarding_46": "Support and onboarding",
    "analytics_et_reporting_47": "Analytics and reporting",
    "personnalisation_du_persona_49": "Persona customization",
    "latence_de_rponse_55": "Response latency",

    # BANT qualification
    "flux_de_conversation_13": "Automatic conversation flow",
    "configuration_du_scoring_14": "Scoring configuration in VoiceIA",
    "matrice_de_qualification_19": "Qualification matrix",
    "questions_de_qualification_34": "Timeline qualification questions",
    "niveau_de_besoin_40": "Need level",
    "typologie_des_interlocuteurs_56": "Types of stakeholders",
    "questions_de_qualification_57": "Authority qualification questions",
    "pas_de_budget_59": "No budget or out of range",
    "budget_en_cours_63": "Budget being validated",
    "questions_de_qualification_71": "Budget qualification questions",

    # Shopify integration
    "suivi_de_commande_17": "Order tracking",
    "tester_la_connexion_18": "Test the connection",
    "crer_une_application_22": "Create an application",
    "initiation_et_suivi_23": "Initiation and tracking of product returns",
    "suivi_de_commandes_30": "Order tracking",
    "ce_que_vocalia_31": "What VoiceIA can do with Shopify",
    "temps_de_rponse_16": "Response time",
    "configuration_du_persona_29": "Persona configuration (2-3 days)",
    "audit_des_interactions_30": "Interaction audit (1 week)",
    "avec_vocalia_60_52": "With VoiceIA (60% automated)",
    "temps_de_rponse_75": "Response time",

    # GDPR compliance
    "pour_manquements_mineurs_5": "For minor violations",
    "sanctions_en_cas_7": "Penalties for non-compliance",
    "registre_des_traitements_8": "Updated processing register",
    "contrat_de_soustraitance_9": "Subcontracting agreement with your provider",
    "durees_de_conservation_10": "Defined and applied retention periods",
    "politique_de_confidentialite_11": "Accessible privacy policy",
    "option_pour_parler_12": "Option to speak to a human",
    "possibilite_de_refuser_13": "Ability to refuse recording",
    "checklist_de_conformit_15": "GDPR compliance checklist",
    "droit_de_rectification_22": "Right to rectification",
    "droits_des_personnes_24": "Data subject rights",
    "exemple_de_message_29": "Compliant welcome message example",
    "execution_du_contrat_30": "Contract execution",
    "interet_de_lentreprise_33": "Business interest balanced with rights",
    "exercice_de_lautorite_34": "Exercise of public authority",
    "protection_de_la_35": "Protection of life (medical emergencies)",
    "les_donnes_traitees_45": "Data processed by a voice agent",
    "guide_de_conformit_48": "2026 compliance guide",

    # Darija
    "scoring_en_temps_79": "Real-time scoring",
    "testez_le_darija_4": "Test Darija now",
    "personnalisez_le_persona_20": "Customize the persona",
    "configurez_la_dtection_22": "Configure automatic detection",
    "activez_le_darija_23": "Enable Darija in your dashboard",
    "temps_de_traitement_29": "Processing time",
    "chiffres_et_dates_46": "Numbers and dates",
    "registres_de_politesse_47": "Politeness registers",
    "pourquoi_le_darija_63": "Why Darija is essential",
    "testez_la_voice_10": "Test VoiceIA Voice AI",
    "quand_le_chatbot_28": "When chatbot remains the best choice",
    "chronologie_de_lautomatisation_59": "Customer automation timeline",
    "les_attentes_clients_60": "Customer expectations",
    "comment_choisir_64": "How to choose?",
    "quand_le_chatbot_67": "When chatbot remains relevant",
    "les_7_avantages_68": "The 7 advantages of Voice AI",

    # User feedback entries
    "formation_initiale_3_98": "Initial training (3 weeks)",
    "charges_sociales_42_99": "Social charges (42%)",
    "satisfaction_client_csat_49": "Customer satisfaction (CSAT)",
    "gagnant_52": "Winner",
    "entreprises_marocaines_en_55": "Moroccan companies in digitalization",

    # Additional entries found
    "solution_escalation_desc": "Automatic transfer to a human agent for complex cases.",
    "roi_detail": "by automating 70% of their support requests.",
    "tier2_logistician_desc": "Bulk orders, B2B deliveries",
    "solution1_desc": "Voice biometrics for secure authentication without codes or passwords.",
    "sassurer_du_consentement_19": "Ensure required consent for conversation recording",
    "informer_lutilisateur_de_24": "Inform the user of any substantial modification to the Services",
    "plan_moyen_des_22": "Average referral plan",
    "codes_derreur_30": "Error codes",
    "codes_derreur_153": "Error codes",
    "relance_automatique_des_7": "Automatic follow-up for dormant leads (no news for 30 days)",
    "prochaines_tapes_pour_8": "Next steps for Immo Plus",
    "mesures_de_scurit_bancaire_15": "Banking security measures",
    "besoin_daide_pour_4": "Need help with integration?",
    "permissions_insuffisantes_pour_26": "Insufficient permissions for this action",
    "roi_pendant_les_48": "ROI during peaks",
    "regles_dentreprise_contraignantes_17": "Binding corporate rules",
    "clauses_contractuelles_types_19": "Standard contractual clauses",
    "rappel_final_avec_30": "Final reminder with address and instructions",
    "rsultats_avec_vocalia_43": "Results with VoiceIA",
    "y_atil_une_6": "Is there a latency difference with Darija?",
    "testez_avec_des_18": "Test with real calls",
    "le_darija_reste_11": "Darija remains 60% cheaper than the competition for standard Arabic.",
    "chatbot_pour_le_11": "Chatbot for self-service, Voice AI for customer relations",
    "quelle_base_pour_32": "What basis for your voice agent?",
    "impose_par_la_36": "Required by law (rare for Voice AI)",
}

def fix_en_json():
    """Fix all French contamination in en.json"""
    with open('/Users/mac/Desktop/VocalIA/website/src/locales/en.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    fixed_count = 0

    def fix_value(obj, path=""):
        nonlocal fixed_count
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                if isinstance(value, str):
                    # Check if key matches our translation mapping
                    if key in TRANSLATIONS:
                        if value != TRANSLATIONS[key]:
                            print(f"FIXING: {key}")
                            print(f"  FROM: {value}")
                            print(f"  TO:   {TRANSLATIONS[key]}")
                            obj[key] = TRANSLATIONS[key]
                            fixed_count += 1
                elif isinstance(value, dict):
                    fix_value(value, current_path)
                elif isinstance(value, list):
                    for i, item in enumerate(value):
                        fix_value(item, f"{current_path}[{i}]")
        return obj

    data = fix_value(data)

    with open('/Users/mac/Desktop/VocalIA/website/src/locales/en.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Fixed {fixed_count} French contamination entries in en.json")
    return fixed_count

if __name__ == "__main__":
    fix_en_json()
