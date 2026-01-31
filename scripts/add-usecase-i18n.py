#!/usr/bin/env python3
"""
Add i18n attributes to use-case pages
"""
import re

def add_i18n_to_ecommerce():
    with open('/Users/mac/Desktop/VocalIA/website/use-cases/e-commerce.html', 'r') as f:
        content = f.read()

    replacements = [
        # Badge
        ('E-commerce & Retail\n            </span>', '<span data-i18n="usecases_ecommerce_page.badge">E-commerce & Retail</span>\n            </span>'),
        # Breadcrumb
        ('>Accueil</a>', ' data-i18n="usecases_ecommerce_page.breadcrumb_home">Accueil</a>'),
        ("Cas d'usage</a></li>\n            <li><span class=\"mx-2\">/</span></li>\n            <li class=\"text-vocalia-400\">E-commerce",
         'Cas d\'usage</a></li>\n            <li><span class="mx-2">/</span></li>\n            <li class="text-vocalia-400" data-i18n="usecases_ecommerce_page.breadcrumb_current">E-commerce'),
        # CTAs
        ('>\n                Demander une démo\n              </a>\n              <a href="/docs"', ' data-i18n="usecases_ecommerce_page.cta_demo">\n                Demander une démo\n              </a>\n              <a href="/docs"'),
        ('>\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">', ' data-i18n="usecases_ecommerce_page.cta_docs">\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">'),
        # Problems section
        ('<h2 class="text-3xl font-bold mb-4">Les défis du support e-commerce</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_ecommerce_page.problems_title">Les défis du support e-commerce</h2>'),
        ('<p class="text-slate-400 max-w-2xl mx-auto">Les équipes support sont submergées par des questions répétitives</p>', '<p class="text-slate-400 max-w-2xl mx-auto" data-i18n="usecases_ecommerce_page.problems_subtitle">Les équipes support sont submergées par des questions répétitives</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Attente excessive</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.problem_wait_title">Attente excessive</h3>'),
        ('<p class="text-slate-400">Les clients attendent en moyenne 12 heures pour une réponse email, causant frustration et abandon de panier.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.problem_wait_desc">Les clients attendent en moyenne 12 heures pour une réponse email, causant frustration et abandon de panier.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Coûts RH élevés</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.problem_costs_title">Coûts RH élevés</h3>'),
        ('<p class="text-slate-400">Recruter et former des agents support multilingues coûte cher, surtout pour couvrir les pics saisonniers.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.problem_costs_desc">Recruter et former des agents support multilingues coûte cher, surtout pour couvrir les pics saisonniers.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Questions répétitives</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.problem_repetitive_title">Questions répétitives</h3>'),
        ('<p class="text-slate-400">80% des demandes concernent le suivi de commande, retours et disponibilité stock - automatisables.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.problem_repetitive_desc">80% des demandes concernent le suivi de commande, retours et disponibilité stock - automatisables.</p>'),
        # Solution section
        ('<h2 class="text-3xl font-bold mb-4">La solution VocalIA</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_ecommerce_page.solution_title">La solution VocalIA</h2>'),
        ('<p class="text-slate-400 max-w-2xl mx-auto">Un assistant vocal intelligent qui gère automatiquement les demandes courantes</p>', '<p class="text-slate-400 max-w-2xl mx-auto" data-i18n="usecases_ecommerce_page.solution_subtitle">Un assistant vocal intelligent qui gère automatiquement les demandes courantes</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Suivi de commande</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_tracking_title">Suivi de commande</h3>'),
        ('<p class="text-slate-400">Connexion directe à Shopify/WooCommerce pour donner le statut en temps réel.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_tracking_desc">Connexion directe à Shopify/WooCommerce pour donner le statut en temps réel.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Gestion des retours</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_returns_title">Gestion des retours</h3>'),
        ('<p class="text-slate-400">Initiation automatique des procédures de retour et remboursement.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_returns_desc">Initiation automatique des procédures de retour et remboursement.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Stock & disponibilité</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_stock_title">Stock & disponibilité</h3>'),
        ('<p class="text-slate-400">Vérification instantanée des stocks et alternatives produits.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_stock_desc">Vérification instantanée des stocks et alternatives produits.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Escalade intelligente</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_escalation_title">Escalade intelligente</h3>'),
        ('<p class="text-slate-400">Transfert automatique vers un agent humain pour les cas complexes.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_escalation_desc">Transfert automatique vers un agent humain pour les cas complexes.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Multilingue natif</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_multilingual_title">Multilingue natif</h3>'),
        ('<p class="text-slate-400">Support en FR, EN, ES, AR et Darija pour servir tous vos marchés.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_multilingual_desc">Support en FR, EN, ES, AR et Darija pour servir tous vos marchés.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Analytics détaillés</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_ecommerce_page.solution_analytics_title">Analytics détaillés</h3>'),
        ('<p class="text-slate-400">Dashboard temps réel des conversations, satisfaction et tendances.</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.solution_analytics_desc">Dashboard temps réel des conversations, satisfaction et tendances.</p>'),
        # Integrations
        ('<h2 class="text-3xl font-bold mb-4">Intégrations e-commerce</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_ecommerce_page.integrations_title">Intégrations e-commerce</h2>'),
        ('<p class="text-slate-400">Connectez VocalIA à votre stack en quelques clics</p>', '<p class="text-slate-400" data-i18n="usecases_ecommerce_page.integrations_subtitle">Connectez VocalIA à votre stack en quelques clics</p>'),
        # ROI
        ('<h2 class="text-3xl font-bold mb-6">Calculez votre ROI</h2>', '<h2 class="text-3xl font-bold mb-6" data-i18n="usecases_ecommerce_page.roi_title">Calculez votre ROI</h2>'),
        # CTA
        ('<h2 class="text-3xl font-bold mb-6">Prêt à automatiser votre support e-commerce?</h2>', '<h2 class="text-3xl font-bold mb-6" data-i18n="usecases_ecommerce_page.cta_title">Prêt à automatiser votre support e-commerce?</h2>'),
        ('<p class="text-xl text-slate-300 mb-8">\n          Déployez VocalIA en moins de 24h et commencez à économiser dès le premier jour.\n        </p>', '<p class="text-xl text-slate-300 mb-8" data-i18n="usecases_ecommerce_page.cta_subtitle">\n          Déployez VocalIA en moins de 24h et commencez à économiser dès le premier jour.\n        </p>'),
        ('>\n            Demander une démo gratuite\n          </a>\n          <a href="/pricing"', ' data-i18n="usecases_ecommerce_page.cta_primary">\n            Demander une démo gratuite\n          </a>\n          <a href="/pricing"'),
        ('>\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>', ' data-i18n="usecases_ecommerce_page.cta_secondary">\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open('/Users/mac/Desktop/VocalIA/website/use-cases/e-commerce.html', 'w') as f:
        f.write(content)

    print("e-commerce.html updated")

def add_i18n_to_support():
    with open('/Users/mac/Desktop/VocalIA/website/use-cases/customer-support.html', 'r') as f:
        content = f.read()

    replacements = [
        # Badge
        ('Support Client\n            </span>', '<span data-i18n="usecases_support_page.badge">Support Client</span>\n            </span>'),
        # Breadcrumb
        ('>Accueil</a>', ' data-i18n="usecases_support_page.breadcrumb_home">Accueil</a>'),
        ('<li class="text-vocalia-400">Service Client</li>', '<li class="text-vocalia-400" data-i18n="usecases_support_page.breadcrumb_current">Service Client</li>'),
        # CTAs
        ('>\n                Demander une démo\n              </a>\n              <a href="/docs"', ' data-i18n="usecases_support_page.cta_demo">\n                Demander une démo\n              </a>\n              <a href="/docs"'),
        ('>\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">', ' data-i18n="usecases_support_page.cta_docs">\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">'),
        # Problems
        ('<h2 class="text-3xl font-bold mb-4">Les défis du service client moderne</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_support_page.problems_title">Les défis du service client moderne</h2>'),
        ('<p class="text-slate-400 max-w-2xl mx-auto">Les attentes clients augmentent, les ressources restent limitées</p>', '<p class="text-slate-400 max-w-2xl mx-auto" data-i18n="usecases_support_page.problems_subtitle">Les attentes clients augmentent, les ressources restent limitées</p>'),
        ("<h3 class=\"text-lg font-semibold mb-2\">Temps d'attente inacceptable</h3>", '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.problem_wait_title">Temps d\'attente inacceptable</h3>'),
        ("<p class=\"text-slate-400\">Les clients s'attendent à une réponse en moins de 5 minutes. La moyenne actuelle: 12-24h par email, 10min par téléphone.</p>", '<p class="text-slate-400" data-i18n="usecases_support_page.problem_wait_desc">Les clients s\'attendent à une réponse en moins de 5 minutes. La moyenne actuelle: 12-24h par email, 10min par téléphone.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Coûts exponentiels</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.problem_costs_title">Coûts exponentiels</h3>'),
        ('<p class="text-slate-400">Chaque agent coûte 35-50K€/an. Pour un support 24/7 multilingue, comptez 10+ agents minimum.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.problem_costs_desc">Chaque agent coûte 35-50K€/an. Pour un support 24/7 multilingue, comptez 10+ agents minimum.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Qualité inconsistante</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.problem_quality_title">Qualité inconsistante</h3>'),
        ("<p class=\"text-slate-400\">La qualité varie selon l'agent, son humeur, sa formation. Impossible de garantir une expérience uniforme.</p>", '<p class="text-slate-400" data-i18n="usecases_support_page.problem_quality_desc">La qualité varie selon l\'agent, son humeur, sa formation. Impossible de garantir une expérience uniforme.</p>'),
        # Features
        ('<h2 class="text-3xl font-bold mb-4">Support client nouvelle génération</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_support_page.features_title">Support client nouvelle génération</h2>'),
        ('<p class="text-slate-400 max-w-2xl mx-auto">VocalIA combine IA conversationnelle et expertise métier pour un support irréprochable</p>', '<p class="text-slate-400 max-w-2xl mx-auto" data-i18n="usecases_support_page.features_subtitle">VocalIA combine IA conversationnelle et expertise métier pour un support irréprochable</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Conversations naturelles</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_conversations_title">Conversations naturelles</h3>'),
        ('<p class="text-slate-400">IA entraînée sur des millions de conversations support. Comprend le contexte, les nuances et les émotions.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_conversations_desc">IA entraînée sur des millions de conversations support. Comprend le contexte, les nuances et les émotions.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Base de connaissances IA</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_kb_title">Base de connaissances IA</h3>'),
        ('<p class="text-slate-400">Synchronisation automatique avec votre documentation, FAQ, et historique tickets pour des réponses toujours à jour.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_kb_desc">Synchronisation automatique avec votre documentation, FAQ, et historique tickets pour des réponses toujours à jour.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Escalade intelligente</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_escalation_title">Escalade intelligente</h3>'),
        ('<p class="text-slate-400">Détection automatique des cas complexes ou clients VIP. Transfert fluide vers agent humain avec contexte complet.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_escalation_desc">Détection automatique des cas complexes ou clients VIP. Transfert fluide vers agent humain avec contexte complet.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Analytics en temps réel</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_analytics_title">Analytics en temps réel</h3>'),
        ('<p class="text-slate-400">Dashboard avec métriques clés: volume, résolution, satisfaction, tendances. Insights actionables automatiques.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_analytics_desc">Dashboard avec métriques clés: volume, résolution, satisfaction, tendances. Insights actionables automatiques.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">5 langues natives</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_languages_title">5 langues natives</h3>'),
        ('<p class="text-slate-400">Français, Anglais, Espagnol, Arabe standard et Darija marocain. Détection automatique de la langue du client.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_languages_desc">Français, Anglais, Espagnol, Arabe standard et Darija marocain. Détection automatique de la langue du client.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Intégrations CRM</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_support_page.feature_crm_title">Intégrations CRM</h3>'),
        ('<p class="text-slate-400">Connexion native avec HubSpot, Salesforce, Zendesk, Freshdesk. Synchronisation bidirectionnelle des données client.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.feature_crm_desc">Connexion native avec HubSpot, Salesforce, Zendesk, Freshdesk. Synchronisation bidirectionnelle des données client.</p>'),
        # How it works
        ('<h2 class="text-3xl font-bold mb-4">Comment ça fonctionne</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_support_page.workflow_title">Comment ça fonctionne</h2>'),
        ('<p class="text-slate-400">Déploiement en 3 étapes simples</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.workflow_subtitle">Déploiement en 3 étapes simples</p>'),
        ('<h3 class="text-xl font-semibold mb-2">Connectez vos données</h3>', '<h3 class="text-xl font-semibold mb-2" data-i18n="usecases_support_page.workflow_step1_title">Connectez vos données</h3>'),
        ("<p class=\"text-slate-400\">Importez votre FAQ, documentation produit et historique de tickets. L'IA apprend votre métier en 24h.</p>", '<p class="text-slate-400" data-i18n="usecases_support_page.workflow_step1_desc">Importez votre FAQ, documentation produit et historique de tickets. L\'IA apprend votre métier en 24h.</p>'),
        ("<h3 class=\"text-xl font-semibold mb-2\">Personnalisez l'agent</h3>", '<h3 class="text-xl font-semibold mb-2" data-i18n="usecases_support_page.workflow_step2_title">Personnalisez l\'agent</h3>'),
        ("<p class=\"text-slate-400\">Choisissez parmi 40 personas métier ou créez le vôtre. Définissez le ton, les règles d'escalade.</p>", '<p class="text-slate-400" data-i18n="usecases_support_page.workflow_step2_desc">Choisissez parmi 40 personas métier ou créez le vôtre. Définissez le ton, les règles d\'escalade.</p>'),
        ('<h3 class="text-xl font-semibold mb-2">Déployez et optimisez</h3>', '<h3 class="text-xl font-semibold mb-2" data-i18n="usecases_support_page.workflow_step3_title">Déployez et optimisez</h3>'),
        ('<p class="text-slate-400">Widget web ou téléphonie. Suivez les performances en temps réel et affinez continuellement.</p>', '<p class="text-slate-400" data-i18n="usecases_support_page.workflow_step3_desc">Widget web ou téléphonie. Suivez les performances en temps réel et affinez continuellement.</p>'),
        # CTA
        ('<h2 class="text-3xl font-bold mb-6">Transformez votre service client</h2>', '<h2 class="text-3xl font-bold mb-6" data-i18n="usecases_support_page.cta_title">Transformez votre service client</h2>'),
        ('<p class="text-xl text-slate-300 mb-8">\n          Rejoignez les entreprises qui offrent un support exceptionnel sans exploser leur budget.\n        </p>', '<p class="text-xl text-slate-300 mb-8" data-i18n="usecases_support_page.cta_subtitle">\n          Rejoignez les entreprises qui offrent un support exceptionnel sans exploser leur budget.\n        </p>'),
        ('>\n            Planifier une démo\n          </a>\n          <a href="/pricing"', ' data-i18n="usecases_support_page.cta_primary">\n            Planifier une démo\n          </a>\n          <a href="/pricing"'),
        ('>\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>', ' data-i18n="usecases_support_page.cta_secondary">\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open('/Users/mac/Desktop/VocalIA/website/use-cases/customer-support.html', 'w') as f:
        f.write(content)

    print("customer-support.html updated")

def add_i18n_to_leads():
    with open('/Users/mac/Desktop/VocalIA/website/use-cases/lead-qualification.html', 'r') as f:
        content = f.read()

    replacements = [
        # Badge
        ('Sales & Marketing\n            </span>', '<span data-i18n="usecases_leads_page.badge">Sales & Marketing</span>\n            </span>'),
        # Breadcrumb
        ('>Accueil</a>', ' data-i18n="usecases_leads_page.breadcrumb_home">Accueil</a>'),
        ('<li class="text-vocalia-400">Qualification Leads</li>', '<li class="text-vocalia-400" data-i18n="usecases_leads_page.breadcrumb_current">Qualification Leads</li>'),
        # CTAs
        ('>\n                Demander une démo\n              </a>\n              <a href="/docs"', ' data-i18n="usecases_leads_page.cta_demo">\n                Demander une démo\n              </a>\n              <a href="/docs"'),
        ('>\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">', ' data-i18n="usecases_leads_page.cta_docs">\n                Documentation API\n              </a>\n            </div>\n          </div>\n          <div class="grid grid-cols-2 gap-4">'),
        # BANT
        ('<h2 class="text-3xl font-bold mb-4">Framework BANT automatisé</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_leads_page.bant_title">Framework BANT automatisé</h2>'),
        ("<p class=\"text-slate-400 max-w-2xl mx-auto\">L'IA évalue chaque lead selon 4 critères essentiels et génère un score de qualification</p>", '<p class="text-slate-400 max-w-2xl mx-auto" data-i18n="usecases_leads_page.bant_subtitle">L\'IA évalue chaque lead selon 4 critères essentiels et génère un score de qualification</p>'),
        ('<h3 class="text-xl font-bold mb-2">Budget</h3>', '<h3 class="text-xl font-bold mb-2" data-i18n="usecases_leads_page.bant_budget_title">Budget</h3>'),
        ('<h3 class="text-xl font-bold mb-2">Authority</h3>', '<h3 class="text-xl font-bold mb-2" data-i18n="usecases_leads_page.bant_authority_title">Authority</h3>'),
        ('<h3 class="text-xl font-bold mb-2">Need</h3>', '<h3 class="text-xl font-bold mb-2" data-i18n="usecases_leads_page.bant_need_title">Need</h3>'),
        ('<h3 class="text-xl font-bold mb-2">Timeline</h3>', '<h3 class="text-xl font-bold mb-2" data-i18n="usecases_leads_page.bant_timeline_title">Timeline</h3>'),
        # Score
        ('<h2 class="text-3xl font-bold mb-6">Score de qualification en temps réel</h2>', '<h2 class="text-3xl font-bold mb-6" data-i18n="usecases_leads_page.score_title">Score de qualification en temps réel</h2>'),
        ('<p class="text-slate-300 mb-6">\n              À la fin de chaque conversation, VocalIA génère un score BANT complet et une recommandation d\'action.\n            </p>', '<p class="text-slate-300 mb-6" data-i18n="usecases_leads_page.score_desc">\n              À la fin de chaque conversation, VocalIA génère un score BANT complet et une recommandation d\'action.\n            </p>'),
        # Features
        ('<h2 class="text-3xl font-bold mb-4">Fonctionnalités de qualification</h2>', '<h2 class="text-3xl font-bold mb-4" data-i18n="usecases_leads_page.features_title">Fonctionnalités de qualification</h2>'),
        ('<h3 class="text-lg font-semibold mb-2">Questionnaire adaptatif</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_adaptive_title">Questionnaire adaptatif</h3>'),
        ("<p class=\"text-slate-400\">Les questions s'adaptent en temps réel selon les réponses. Conversation naturelle, pas interrogatoire.</p>", '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_adaptive_desc">Les questions s\'adaptent en temps réel selon les réponses. Conversation naturelle, pas interrogatoire.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Transfert à chaud</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_transfer_title">Transfert à chaud</h3>'),
        ('<p class="text-slate-400">Lead qualifié? Transfert instantané au commercial disponible avec briefing contextuel complet.</p>', '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_transfer_desc">Lead qualifié? Transfert instantané au commercial disponible avec briefing contextuel complet.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">CRM sync</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_crm_title">CRM sync</h3>'),
        ('<p class="text-slate-400">Score et données enrichies synchronisés automatiquement avec HubSpot, Salesforce, Pipedrive.</p>', '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_crm_desc">Score et données enrichies synchronisés automatiquement avec HubSpot, Salesforce, Pipedrive.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Alertes temps réel</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_alerts_title">Alertes temps réel</h3>'),
        ('<p class="text-slate-400">Notification Slack/email immédiate pour chaque hot lead. Ne laissez plus refroidir vos prospects.</p>', '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_alerts_desc">Notification Slack/email immédiate pour chaque hot lead. Ne laissez plus refroidir vos prospects.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Analytics pipeline</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_analytics_title">Analytics pipeline</h3>'),
        ("<p class=\"text-slate-400\">Visualisez votre funnel, identifiez les goulots d'étranglement, optimisez votre processus de vente.</p>", '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_analytics_desc">Visualisez votre funnel, identifiez les goulots d\'étranglement, optimisez votre processus de vente.</p>'),
        ('<h3 class="text-lg font-semibold mb-2">Gestion objections</h3>', '<h3 class="text-lg font-semibold mb-2" data-i18n="usecases_leads_page.feature_objections_title">Gestion objections</h3>'),
        ("<p class=\"text-slate-400\">L'IA traite les objections courantes et relance les leads hésitants avec les bons arguments.</p>", '<p class="text-slate-400" data-i18n="usecases_leads_page.feature_objections_desc">L\'IA traite les objections courantes et relance les leads hésitants avec les bons arguments.</p>'),
        # CTA
        ('<h2 class="text-3xl font-bold mb-6">Transformez vos leads en clients</h2>', '<h2 class="text-3xl font-bold mb-6" data-i18n="usecases_leads_page.cta_title">Transformez vos leads en clients</h2>'),
        ('<p class="text-xl text-slate-300 mb-8">\n          Vos commerciaux méritent de parler à des prospects qualifiés. Laissez VocalIA faire le tri.\n        </p>', '<p class="text-xl text-slate-300 mb-8" data-i18n="usecases_leads_page.cta_subtitle">\n          Vos commerciaux méritent de parler à des prospects qualifiés. Laissez VocalIA faire le tri.\n        </p>'),
        ('>\n            Commencer gratuitement\n          </a>\n          <a href="/pricing"', ' data-i18n="usecases_leads_page.cta_primary">\n            Commencer gratuitement\n          </a>\n          <a href="/pricing"'),
        ('>\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>', ' data-i18n="usecases_leads_page.cta_secondary">\n            Voir les tarifs\n          </a>\n        </div>\n      </div>\n    </section>\n  </main>'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open('/Users/mac/Desktop/VocalIA/website/use-cases/lead-qualification.html', 'w') as f:
        f.write(content)

    print("lead-qualification.html updated")

if __name__ == '__main__':
    add_i18n_to_ecommerce()
    add_i18n_to_support()
    add_i18n_to_leads()
    print("All use-case pages updated with i18n attributes")
