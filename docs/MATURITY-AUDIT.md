# Audit de Maturité "Readiness / Plug-and-Play" — VocalIA

> Date: 28/02/2026 — Session 250.253
> Méthodologie: 5 Piliers Cumulatifs (0→100%)

## Méthodologie

| Niveau | Critère | Points |
|:-------|:--------|:------:|
| P1 | Code existe et compilable | +20% |
| P2 | Tests unitaires passent | +20% |
| P3 | Testé sur instance réelle (E2E) | +20% |
| P4 | Déployé et accessible en production | +20% |
| P5 | Self-service client (install + config sans intervention) | +20% |

**Règle**: Un niveau ne peut être validé que si le précédent est acquis.

---

## Résultats — Avant Audit (28/02/2026 AM)

| Module | P1 Code | P2 Tests | P3 Instance | P4 Prod | P5 Self-Service | **TOTAL** |
|:-------|:-------:|:--------:|:-----------:|:-------:|:---------------:|:---------:|
| **WooCommerce** | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | 0% ❌ | **20%** |
| **PrestaShop** | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | 0% ❌ | **20%** |
| **Système Global** | 20% ✅ | 20% ✅ | 10% ⚠️ | 15% ⚠️ | 0% ❌ | **65%** |

**Moyenne pondérée avant: ~35%**

---

## Résultats — Après Actions Correctives (28/02/2026 PM)

### Actions réalisées

1. **PHPUnit WordPress** — 25 tests, 53 assertions, 100% pass
   - Sanitization, hooks, activation, uninstall, widget injection, settings page
   - `integrations/wordpress/vocalia-voice-assistant/tests/VocaliaPluginTest.php`

2. **PHPUnit PrestaShop** — 25 tests, 44 assertions, 100% pass
   - Install/uninstall, configuration, hooks, form, widget rendering, XSS escaping
   - `integrations/prestashop/tests/VocaliaModuleTest.php`

3. **Plugin ZIPs distribués** — 4 archives build automatique
   - `scripts/build-plugin-zips.cjs` — WordPress (4.4 KB), PrestaShop (2.1 KB), Joomla (2.6 KB), Drupal (4.7 KB)
   - **BUG CORRIGÉ (250.253b)** : ZIPs incluaient `vendor/` + `tests/` + `composer.lock` (WP=16MB, PS=1.4MB). Fix: exclusions ajoutées dans zip command. Résultat: WP=4.4KB (readme.txt + .php), PS=2.1KB (.php seul).
   - Endpoint: `GET /api/plugins/download/:platform` (wordpress|prestashop|joomla|drupal)
   - Endpoint: `GET /api/plugins` (liste les plugins disponibles)

4. **Dashboard Visual Polish** — Client + Admin dashboards
   - Animated gradient mesh welcome banners (15s `background-position` cycle)
   - Color-matched ambient glow on stat cards in dark mode (hover)
   - Micro-interactions: card lift on hover (`translateY(-2px) scale(1.01)`)
   - Score ring pulse animation after draw
   - Skeleton loading states replacing bare "--" placeholders
   - Deeper dark mode (`#000` backgrounds, refined `glass-panel`)
   - ROI section: dual radial gradient overlay + border accent

5. **Error handling register amélioré**
   - Catch global (`db-api.cjs:700`) surface désormais des messages actionables:
     - Config manquante → 503 "Database configuration missing"
     - Auth expirée → 503 "Database authentication expired"
     - Quota → 503 "Service temporarily unavailable (quota)"
   - Stack trace partiel logué en console pour diagnostic

### Tableau mis à jour

| Module | P1 Code | P2 Tests | P3 Instance | P4 Prod | P5 Self-Service | **TOTAL** |
|:-------|:-------:|:--------:|:-----------:|:-------:|:---------------:|:---------:|
| **WooCommerce** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **PrestaShop** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **Joomla** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **Drupal** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **Magento** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **OpenCart** | 20% ✅ | 20% ✅ | 0% ❌ | 0% ❌ | 0% ❌ | **40%** |
| **Système Global** | 20% ✅ | 20% ✅ | 10% ⚠️ | 15% ⚠️ | 0% ❌ | **65%** |

**Moyenne pondérée après: ~48%** (+13 points)

> *Session 250.254*: 4 CMS modules (Joomla/Drupal/Magento/OpenCart) passent P1→P2 avec PHPUnit (54 tests: 14+13+14+13). CDN URL fix api.vocalia.ma→vocalia.ma dans les 6 plugins. Satellite S1/S2/S3 re-verified. Client folders cleanup (5643→528). http-utils tests (19). Design token validator 0 errors.

---

## Blockers Restants (par priorité)

### CRITIQUE — Requiert accès VPS

#### 1. `/api/auth/register` → 500 en production

**Root Cause identifiée**: `GoogleSheetsDB.init()` échoue quand les tokens OAuth sont invalides/expirés. Le catch global (`db-api.cjs:700`) renvoyait un opaque "Internal server error". **Corrigé localement** — le code surface maintenant la vraie erreur.

**Action VPS requise**:
```bash
# 1. Se connecter au VPS
ssh root@api.vocalia.ma

# 2. Lire les logs du container db-api
docker logs vocalia-db-api --tail 200 | grep -E "❌|Error|UNAUTHENTICATED|invalid_grant"

# 3. Vérifier les env vars
docker exec vocalia-db-api env | grep GOOGLE

# 4. Si refresh_token expiré: générer un nouveau via OAuth playground
# https://developers.google.com/oauthplayground/
# Scope: https://www.googleapis.com/auth/spreadsheets
# Puis mettre à jour .env sur VPS:
# GOOGLE_REFRESH_TOKEN=<new_token>

# 5. Redémarrer les containers
cd /docker/vocalia
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# 6. Vérifier
curl -X POST https://api.vocalia.ma/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"company":"test","email":"test@test.com","password":"Test123!","plan":"starter"}'
```

#### 2. Stripe non configuré

```bash
# 1. Créer les produits Stripe (dashboard.stripe.com)
# Starter: 49€/mois | Pro: 99€/mois | E-commerce: 99€/mois
# Expert Clone: 149€/mois | Telephony: 199€/mois

# 2. Ajouter les clés au VPS
ssh root@api.vocalia.ma
cd /docker/vocalia
nano .env
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 3. Configurer le webhook Stripe
# URL: https://api.vocalia.ma/webhook/stripe
# Events: checkout.session.completed, customer.subscription.updated,
#          customer.subscription.deleted, invoice.payment_succeeded

# 4. Redémarrer
docker-compose -f docker-compose.production.yml --profile integrations down
docker-compose -f docker-compose.production.yml --profile integrations up -d
```

### IMPORTANT — Requiert instance CMS

#### 3. Plugin jamais installé sur vrai CMS

```bash
# WordPress local
docker run -d --name wp-test -p 8081:80 \
  -e WORDPRESS_DB_HOST=db -e WORDPRESS_DB_USER=root \
  -e WORDPRESS_DB_PASSWORD=root \
  --link wp-db:db wordpress

# Puis: http://localhost:8081/wp-admin/plugins.php
# Upload vocalia-voice-assistant.zip → Activate → Settings > VocalIA
```

---

## Vérification des Corrections

```bash
# PHPUnit WordPress
cd integrations/wordpress/vocalia-voice-assistant && vendor/bin/phpunit
# Attendu: 25 tests, 53 assertions, OK

# PHPUnit PrestaShop
cd integrations/prestashop && vendor/bin/phpunit
# Attendu: 25 tests, 44 assertions, OK

# Build ZIPs
node scripts/build-plugin-zips.cjs
# Attendu: 4 built, 0 failed

# Plugin download endpoint
curl http://localhost:3004/api/plugins
# Attendu: JSON avec 4 plugins

# Node.js tests (system global)
npm test
# Attendu: ~7,400+ pass, 0 fail
```

---

## Chemin vers 80%

| Action | Impact | Effort |
|:-------|:------:|:------:|
| Fix register en prod (VPS SSH) | +10% Système | 30 min |
| Config Stripe (VPS + Dashboard) | +5% Système | 1h |
| Install WP plugin sur instance réelle | +20% WP (P3) | 1h |
| Install PS module sur instance réelle | +20% PS (P3) | 1h |
| E2E signup→dashboard→widget flow | +10% Système (P3) | 2h |
| Plugin sur marketplace WP.org (optionnel) | +20% WP (P4) | 1 semaine |

**Projection après VPS fix + CMS tests: ~65%** (vs 48% actuel)
**Projection full (include marketplace): ~80%**
