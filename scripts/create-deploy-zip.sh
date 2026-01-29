#!/bin/bash
# VocalIA - Create Deploy ZIP for NindoHost cPanel
# Usage: bash scripts/create-deploy-zip.sh

set -e

echo "=== VocalIA Deploy ZIP Creator ==="
echo "Creating deployment package for NindoHost..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Create deploy directory
DEPLOY_DIR="deploy"
ZIP_NAME="vocalia-website-$(date +%Y%m%d-%H%M%S).zip"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy website files
echo "Copying website files..."
cp -r website/index.html "$DEPLOY_DIR/"
cp -r website/features.html "$DEPLOY_DIR/"
cp -r website/pricing.html "$DEPLOY_DIR/"
cp -r website/about.html "$DEPLOY_DIR/"
cp -r website/contact.html "$DEPLOY_DIR/"
cp -r website/docs.html "$DEPLOY_DIR/"
cp -r website/robots.txt "$DEPLOY_DIR/"
cp -r website/sitemap.xml "$DEPLOY_DIR/"
cp -r website/.htaccess "$DEPLOY_DIR/"

# Copy products directory
mkdir -p "$DEPLOY_DIR/products"
cp -r website/products/*.html "$DEPLOY_DIR/products/"

# Copy dashboard directory
mkdir -p "$DEPLOY_DIR/dashboard"
cp -r website/dashboard/*.html "$DEPLOY_DIR/dashboard/"

# Copy public assets (CSS, images)
echo "Copying public assets..."
cp -r website/public "$DEPLOY_DIR/"

# Copy src/lib (JS files)
echo "Copying JavaScript libraries..."
mkdir -p "$DEPLOY_DIR/src/lib"
cp website/src/lib/*.js "$DEPLOY_DIR/src/lib/" 2>/dev/null || true

# Copy locales
echo "Copying locales..."
mkdir -p "$DEPLOY_DIR/src/locales"
cp website/src/locales/*.json "$DEPLOY_DIR/src/locales/" 2>/dev/null || true

# Copy voice assistant
echo "Copying voice assistant..."
cp -r website/voice-assistant "$DEPLOY_DIR/" 2>/dev/null || true

# Create the ZIP
echo "Creating ZIP archive..."
cd "$DEPLOY_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" -x "*__MACOSX*"
cd ..

# Cleanup
rm -rf "$DEPLOY_DIR"

# Report
echo ""
echo "=== Deployment Package Created ==="
echo "File: $ZIP_NAME"
echo "Size: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""
echo "Next Steps:"
echo "1. Login to NindoHost cPanel"
echo "2. Open File Manager"
echo "3. Navigate to public_html"
echo "4. Upload $ZIP_NAME"
echo "5. Extract the ZIP"
echo "6. Delete the ZIP file"
echo "7. Visit www.vocalia.ma"
echo ""
