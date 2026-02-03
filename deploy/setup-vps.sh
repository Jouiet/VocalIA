#!/bin/bash
# VocalIA Voice Platform - VPS Setup Script
# Hostinger VPS (Ubuntu 22.04)
#
# Usage: sudo bash setup-vps.sh
#
# This script:
# 1. Installs Node.js 22.x (LTS)
# 2. Installs PM2 process manager
# 3. Configures Nginx reverse proxy
# 4. Sets up SSL with Let's Encrypt
# 5. Deploys VocalIA services

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════"
echo "       VocalIA Voice Platform - VPS Setup"
echo "═══════════════════════════════════════════════════════════"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (sudo bash setup-vps.sh)"
    exit 1
fi

# ==================
# 1. SYSTEM UPDATE
# ==================
echo ""
echo "📦 [1/7] Updating system packages..."
apt update && apt upgrade -y

# ==================
# 2. INSTALL NODE.JS 22.x LTS
# ==================
echo ""
echo "📦 [2/7] Installing Node.js 22.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

echo "   Node.js version: $(node --version)"
echo "   npm version: $(npm --version)"

# ==================
# 3. INSTALL PM2
# ==================
echo ""
echo "📦 [3/7] Installing PM2 process manager..."
npm install -g pm2

# Enable PM2 startup on boot
pm2 startup systemd -u vocalia --hp /home/vocalia

# ==================
# 4. INSTALL NGINX
# ==================
echo ""
echo "📦 [4/7] Installing Nginx..."

# Stop Apache if running (Hostinger default)
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

apt install -y nginx

# ==================
# 5. CONFIGURE FIREWALL
# ==================
echo ""
echo "🔒 [5/7] Configuring firewall..."
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "   Firewall status:"
ufw status

# ==================
# 6. SETUP SSL WITH LET'S ENCRYPT
# ==================
echo ""
echo "🔒 [6/7] Setting up SSL with Let's Encrypt..."
apt install -y certbot python3-certbot-nginx

# Note: Run this manually after DNS is configured
echo "   ⚠️ Run manually after DNS propagation:"
echo "   sudo certbot --nginx -d api.vocalia.ma"

# ==================
# 7. CREATE VOCALIA USER & DIRECTORIES
# ==================
echo ""
echo "👤 [7/7] Creating vocalia user and directories..."

# Create user if doesn't exist
id -u vocalia &>/dev/null || useradd -m -s /bin/bash vocalia

# Create directories
mkdir -p /var/www/vocalia
mkdir -p /var/log/vocalia

# Clone repository (or copy files)
if [ ! -d "/var/www/vocalia/.git" ]; then
    echo "   Cloning VocalIA repository..."
    git clone https://github.com/Jouiet/VoicalAI.git /var/www/vocalia
else
    echo "   Pulling latest changes..."
    cd /var/www/vocalia && git pull
fi

# Set permissions
chown -R vocalia:vocalia /var/www/vocalia
chown -R vocalia:vocalia /var/log/vocalia

# Install dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
cd /var/www/vocalia
sudo -u vocalia npm install --production

# ==================
# FINAL STEPS
# ==================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "       ✅ VPS Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Manual steps required:"
echo ""
echo "1. Copy Nginx config:"
echo "   cp /var/www/vocalia/deploy/nginx-vocalia-voice.conf /etc/nginx/sites-available/api.vocalia.ma"
echo "   ln -s /etc/nginx/sites-available/api.vocalia.ma /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "2. Configure DNS (Hostinger Panel):"
echo "   A record: api.vocalia.ma → VPS IP"
echo ""
echo "3. Setup SSL:"
echo "   sudo certbot --nginx -d api.vocalia.ma"
echo ""
echo "4. Create .env file:"
echo "   cp /var/www/vocalia/.env.example /var/www/vocalia/.env"
echo "   nano /var/www/vocalia/.env"
echo ""
echo "5. Start services:"
echo "   cd /var/www/vocalia"
echo "   sudo -u vocalia pm2 start deploy/ecosystem.config.cjs"
echo "   pm2 save"
echo ""
echo "6. Verify:"
echo "   curl https://api.vocalia.ma/health"
echo "   curl -X POST https://api.vocalia.ma/voice/inbound"
echo ""
echo "═══════════════════════════════════════════════════════════"
