#!/bin/bash
# VocalIA - Create Deploy ZIP for Hostinger (Static Website)
# Usage: bash scripts/create-deploy-zip.sh
# Version: 264 (Full website rsync)

set -e

echo "=== VocalIA Website Deploy ZIP Creator ==="
echo "Creating deployment package for Hostinger..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Create deploy directory
DEPLOY_DIR="deploy_website"
ZIP_NAME="vocalia-website-$(date +%Y%m%d-%H%M%S).zip"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# --- FRONTEND (Full Static Website) ---
echo "1. Copying website files..."

# Copy entire website directory, excluding dev files
rsync -a --exclude='node_modules' \
         --exclude='src/config' \
         --exclude='src/input.css' \
         --exclude='package.json' \
         --exclude='package-lock.json' \
         --exclude='tailwind.config.js' \
         --exclude='postcss.config.js' \
         --exclude='.DS_Store' \
         --exclude='__MACOSX' \
         website/ "$DEPLOY_DIR/"

echo "   Files copied: $(find "$DEPLOY_DIR" -type f | wc -l)"

# Verify critical files exist
echo ""
echo "2. Verifying critical files..."
MISSING=0
for f in index.html pricing.html features.html about.html contact.html \
         robots.txt sitemap.xml llms.txt llms-full.txt .htaccess \
         blog/index.html booking.html signup.html login.html \
         referral.html expert-clone.html cookie-policy.html \
         privacy.html terms.html 404.html \
         products/voice-widget.html products/voice-widget-b2b.html \
         products/voice-widget-b2c.html products/voice-widget-ecommerce.html \
         products/voice-telephony.html \
         industries/index.html use-cases/index.html \
         docs/index.html docs/api.html \
         academie-business/index.html \
         public/css/style.css; do
  if [ ! -f "$DEPLOY_DIR/$f" ]; then
    echo "   MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "   All critical files present."
else
  echo "   WARNING: $MISSING critical files missing!"
fi

# Count pages
HTML_COUNT=$(find "$DEPLOY_DIR" -name "*.html" | wc -l | tr -d ' ')
echo "   HTML pages: $HTML_COUNT"

# --- ZIP ---
echo ""
echo "3. Creating ZIP archive..."
cd "$DEPLOY_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" -x "*__MACOSX*" -x "*.git*" -q
cd ..

ZIP_SIZE=$(du -sh "$ZIP_NAME" | cut -f1)

# Cleanup
rm -rf "$DEPLOY_DIR"

# Report
echo ""
echo "=== Website Deployment Package Created ==="
echo "File: $ZIP_NAME ($ZIP_SIZE)"
echo "Pages: $HTML_COUNT HTML files"
echo ""
echo "Deploy: Upload to Hostinger hPanel → File Manager → public_html"
echo ""
