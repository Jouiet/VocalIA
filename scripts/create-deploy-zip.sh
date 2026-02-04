#!/bin/bash
# VocalIA - Create Deploy ZIP for NindoHost cPanel (SaaS Ready)
# Usage: bash scripts/create-deploy-zip.sh
# Version: 246 (Multi-Tenant)

set -e

echo "=== VocalIA SaaS Deploy ZIP Creator ==="
echo "Creating deployment package for NindoHost..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Create deploy directory
DEPLOY_DIR="deploy_saas"
ZIP_NAME="vocalia-saas-$(date +%Y%m%d-%H%M%S).zip"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# --- FRONTEND (Static Vitrine) ---
echo "1. Copying Frontend (Vitrine)..."
cp -r website/index.html "$DEPLOY_DIR/"
cp -r website/features.html "$DEPLOY_DIR/"
cp -r website/pricing.html "$DEPLOY_DIR/"
cp -r website/about.html "$DEPLOY_DIR/"
cp -r website/contact.html "$DEPLOY_DIR/"
cp -r website/privacy.html "$DEPLOY_DIR/"
cp -r website/terms.html "$DEPLOY_DIR/"
cp -r website/integrations.html "$DEPLOY_DIR/"
cp -r website/robots.txt "$DEPLOY_DIR/"
cp -r website/sitemap.xml "$DEPLOY_DIR/"
cp -r website/.htaccess "$DEPLOY_DIR/"

mkdir -p "$DEPLOY_DIR/products"
cp -r website/products/*.html "$DEPLOY_DIR/products/"

mkdir -p "$DEPLOY_DIR/dashboard"
cp -r website/dashboard/*.html "$DEPLOY_DIR/dashboard/"

mkdir -p "$DEPLOY_DIR/public"
cp -r website/public/* "$DEPLOY_DIR/public/"

mkdir -p "$DEPLOY_DIR/src/lib"
cp website/src/lib/*.js "$DEPLOY_DIR/src/lib/"

mkdir -p "$DEPLOY_DIR/src/locales"
cp website/src/locales/*.json "$DEPLOY_DIR/src/locales/"

echo "   Copying Voice Assistant..."
mkdir -p "$DEPLOY_DIR/voice-assistant"
cp -r website/voice-assistant/* "$DEPLOY_DIR/voice-assistant/"

# --- BACKEND (MCP Server + Core) ---
# NOTE: NindoHost cPanel is shared hosting (Node.js app support varies).
# Ideally, this should go to a VPS. But we package it for potential Node deployment.
echo "2. Copying Backend (Server)..."
mkdir -p "$DEPLOY_DIR/server"
mkdir -p "$DEPLOY_DIR/server/core"
mkdir -p "$DEPLOY_DIR/server/mcp-server"

# Core: Registry
# CHANGED: Copying FULL Core for Voice API
cp -r core/* "$DEPLOY_DIR/server/core/"

# Copying Backend Dependencies
mkdir -p "$DEPLOY_DIR/server/lib"
cp -r lib/* "$DEPLOY_DIR/server/lib/" 2>/dev/null || true

mkdir -p "$DEPLOY_DIR/server/integrations"
cp -r integrations/* "$DEPLOY_DIR/server/integrations/" 2>/dev/null || true

mkdir -p "$DEPLOY_DIR/server/personas"
cp -r personas/* "$DEPLOY_DIR/server/personas/" 2>/dev/null || true

# MCA Server: Build & Dist
echo "   Building MCP Server..."
cd mcp-server
npm run build
cd ..

cp -r mcp-server/dist "$DEPLOY_DIR/server/mcp-server/"
cp mcp-server/package.json "$DEPLOY_DIR/server/mcp-server/"

# --- ZIP ---
echo "Creating ZIP archive..."
cd "$DEPLOY_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" -x "*__MACOSX*" -x "*.git*"
cd ..

# Cleanup
rm -rf "$DEPLOY_DIR"

# Report
echo ""
echo "=== SaaS Deployment Package Created ==="
echo "File: $ZIP_NAME"
echo "Contents:"
echo "  - / (Static Frontend)"
echo "  - /server (Node.js Backend & Registry)"
echo ""
