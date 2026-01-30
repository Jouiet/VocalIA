# VocalIA - Déploiement NindoHost (cPanel)

> **Version**: 2.1.0 | **Date**: 29/01/2026 | **Session**: 214
> **Status**: PRÊT À DÉPLOYER ✅

---

## INFORMATIONS NINDOHOST (FACTUELLES)

| Attribut | Valeur | Source |
|:---------|:-------|:-------|
| **Fondation** | 2006, Tanger (Maroc) | [nindohost.ma](https://nindohost.ma) |
| **Agrément** | ANRT (Maroc) | [lematin.ma](https://lematin.ma/hi-tech/nindohost-etend-ses-services-a-13-marches-africains/280356) |
| **Expérience** | 18 ans | nindohost.ma |
| **Clients** | 30,000+ | nindohost.ma |
| **Serveurs** | LiteSpeed | nindohost.ma |
| **Panel** | cPanel | [help.nindohost.com](https://help.nindohost.com/en-us/category/cpanel-1jfali9/) |
| **Datacenter** | Maroc | nindohost.ma/serveurs/cloud-maroc/ |
| **Clients notables** | Royal Air Maroc, Kitea, FRMF | lematin.ma |

### Services Inclus (Plan Mutualisé)

- Serveur LiteSpeed haute performance
- Certificat SSL gratuit (HTTPS à vie)
- Nom de domaine gratuit 1ère année
- Migration site gratuite
- Sauvegardes quotidiennes
- Support 24/7
- cPanel inclus
- Trafic illimité

**Prix:** À partir de 39 DH/mois (~3.50€)

---

## RÉSUMÉ EXÉCUTIF

| Élément | Valeur |
|:--------|:-------|
| **ZIP Prêt** | `vocalia-website-*.zip` (2.2MB) |
| **Pages** | 7 pages HTML |
| **CSS** | 103KB (style.css) |
| **Cible** | `www.vocalia.ma` |
| **Type** | Site Statique (Apache) |

---

## STRATÉGIE SPLIT-STACK

> [!WARNING]
> **RÉALITÉ TECHNIQUE**
> Les ports custom (3004, 3007, 3009) sont bloqués sur mutualisé cPanel.
> **Solution:** Séparer Frontend (statique) et Backend (API).

### Plan de Déploiement

| Entité | URL | Hébergement | Status |
|:-------|:----|:------------|:------:|
| **Frontend** | `www.vocalia.ma` | NindoHost cPanel (statique) | 🟢 PRÊT |
| **Backend** | `api.vocalia.ma` | VPS/Node.js (futur) | 🔴 Phase 2 |

---

## ÉTAPE 1: CRÉER LE ZIP (SAAS MODE ✅)

```bash
# Depuis le dossier VocalIA
bash scripts/create-deploy-zip.sh
```

**Résultat:** `vocalia-saas-20260130-170009.zip`

### Contenu du ZIP (SaaS Architecture)

1. **Frontend/Vitrine** (Racine): HTML/CSS/JS statique pour `/public_html`.
2. **Backend/Server** (`/server`):
    - `core/client-registry.cjs`: Registre Multi-Tenant.
    - `mcp-server/`: Build compilé du serveur MCP.

---

## ÉTAPE 2: UPLOAD NINDOHOST (SPLIT-STACK)

### 2.1 Frontend (cPanel)

1. **Extraire le contenu de la racine du ZIP** vers `public_html`.
2. Cela mettra en ligne la Vitrine (<www.vocalia.ma>).

### 2.2 Backend (Node.js)
>
> [!NOTE]
> Sur un hébergement cPanel standard, Node.js n'est pas toujours activé.
> **Si Node.js dispo:** Upload du dossier `/server` hors public_html.
> **Si VPS:** Transférer `/server` vers le VPS.

### 2.2 Gestionnaire de Fichiers

1. Cliquez sur **Gestionnaire de fichiers (File Manager)**
2. Naviguez vers **`public_html`**

### 2.3 Nettoyage (Si nécessaire)

Si `public_html` contient des fichiers existants:

1. Sélectionnez tout (sauf `.htaccess` si vous l'avez personnalisé)
2. Supprimez

### 2.4 Upload ZIP

1. Cliquez sur **Upload** (en haut)
2. Sélectionnez `vocalia-website-*.zip`
3. Attendez la fin du transfert

### 2.5 Extraction

1. Cliquez-droit sur le ZIP uploadé
2. Sélectionnez **Extract**
3. Confirmez extraction vers `public_html`

### 2.6 Nettoyage Post-Upload

1. Supprimez le fichier `.zip` (plus nécessaire)

---

## ÉTAPE 3: VÉRIFICATION

### 3.1 Test Immédiat

| URL | Attendu |
|:----|:--------|
| `www.vocalia.ma` | Homepage avec mega-menu |
| `www.vocalia.ma/features` | Page fonctionnalités |
| `www.vocalia.ma/pricing` | Page tarifs |
| `www.vocalia.ma/products/voice-widget` | Page Voice Widget |
| `www.vocalia.ma/products/voice-telephony` | Page Voice Telephony |
| `www.vocalia.ma/dashboard/client` | Dashboard client |

### 3.2 Checklist Visuelle

- [ ] CSS chargé (pas de page blanche/cassée)
- [ ] Images affichées (logo, hero images)
- [ ] Navigation mega-menu fonctionne
- [ ] Liens internes fonctionnent
- [ ] HTTPS actif (cadenas vert)

### 3.3 Test Mobile

- [ ] Site responsive sur smartphone
- [ ] Menu hamburger visible
- [ ] Pas de scroll horizontal

---

## STRUCTURE DÉPLOYÉE

```
public_html/
├── index.html                    # Homepage
├── features.html                 # Fonctionnalités
├── pricing.html                  # Tarifs
├── robots.txt                    # SEO
├── sitemap.xml                   # SEO (7 URLs)
├── .htaccess                     # Apache config + URLs propres
├── products/
│   ├── voice-widget.html         # Produit Widget
│   └── voice-telephony.html      # Produit Telephony
├── dashboard/
│   ├── client.html               # Dashboard Client
│   └── admin.html                # Dashboard Admin
├── public/
│   ├── css/
│   │   └── style.css             # Tailwind compilé (103KB)
│   └── images/
│       ├── favicon/              # Favicons
│       └── hero/                 # Images hero
├── src/
│   ├── lib/
│   │   ├── geo-detect.js         # Détection géo
│   │   ├── i18n.js               # Internationalisation
│   │   ├── card-tilt.js          # Effet 3D cartes
│   │   ├── voice-visualizer.js   # Visualiseur vocal
│   │   ├── gsap-animations.js    # Animations GSAP
│   │   └── dashboard-grid.js     # Grille dashboard
│   └── locales/
│       ├── fr.json               # Traductions FR
│       └── en.json               # Traductions EN
└── voice-assistant/
    ├── voice-widget.js           # Widget vocal
    └── lang/
        ├── voice-fr.json         # Phrases FR
        └── voice-en.json         # Phrases EN
```

---

## FONCTIONNALITÉS .HTACCESS

Le fichier `.htaccess` inclut:

| Feature | Description |
|:--------|:------------|
| **URLs propres** | `/features` au lieu de `/features.html` |
| **Sécurité** | Headers X-Frame-Options, CSP, XSS |
| **Cache** | CSS/JS: 1 mois, Images: 1 an, HTML: pas de cache |
| **Compression** | Gzip pour HTML, CSS, JS, SVG |
| **Dashboard redirect** | `/dashboard` → `/dashboard/client.html` |

---

## TROUBLESHOOTING

### Problème: Page blanche / CSS non chargé

**Cause:** Chemins relatifs incorrects
**Solution:** Vérifiez que le CSS est bien à `/public/css/style.css`

### Problème: URLs propres ne fonctionnent pas

**Cause:** mod_rewrite désactivé
**Solution:** Contactez NindoHost pour activer mod_rewrite

### Problème: Erreur 500

**Cause:** .htaccess mal formé
**Solution:** Renommez temporairement `.htaccess` en `.htaccess.bak`

### Problème: HTTPS non actif

**Solution:**

1. cPanel > SSL/TLS > Install SSL
2. Ou utilisez Let's Encrypt gratuit

---

## PHASE 2: BACKEND (FUTUR)

> [!NOTE]
> Pour l'instant, le site est **100% statique**. Les formulaires et l'IA nécessitent un backend.

### Options pour le Backend

| Option | Coût | Complexité |
|:-------|:-----|:-----------|
| **VPS Hostinger** | ~5€/mois | Moyenne |
| **Railway/Render** | Freemium | Faible |
| **Self-hosted** | Variable | Haute |

### Plan Backend (Session 215+)

1. Créer sous-domaine `api.vocalia.ma`
2. Déployer Node.js sur VPS
3. Configurer CORS
4. Connecter formulaires

---

## COMMANDES UTILES

```bash
# Recréer le ZIP
bash scripts/create-deploy-zip.sh

# Rebuild CSS (si modifications)
npm run build:css

# Vérifier santé du projet
node scripts/health-check.cjs
```

---

*Document mis à jour: 29/01/2026 - Session 214*
*Prochaine étape: Upload sur NindoHost*
