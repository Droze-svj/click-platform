#!/bin/bash

# SSL Certificate Setup Script
# Automates SSL certificate installation with Let's Encrypt

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 SSL Certificate Setup${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Certbot...${NC}"
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Get domain name
read -p "Enter your domain name (e.g., example.com): " DOMAIN
read -p "Enter www subdomain? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    WWW_DOMAIN="www.$DOMAIN"
else
    WWW_DOMAIN=""
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx is not installed. Please install Nginx first.${NC}"
    exit 1
fi

# Check if Nginx config exists
NGINX_CONFIG="/etc/nginx/sites-available/click"
if [ ! -f "$NGINX_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  Nginx config not found. Creating basic config...${NC}"
    
    # Create basic Nginx config
    cat > "$NGINX_CONFIG" << EOF
server {
    listen 80;
    server_name $DOMAIN${WWW_DOMAIN:+ $WWW_DOMAIN};
    
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable site
    ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/click
    
    # Test and reload Nginx
    nginx -t
    systemctl reload nginx
fi

# Obtain SSL certificate
echo -e "${YELLOW}🔒 Obtaining SSL certificate...${NC}"

if [ -n "$WWW_DOMAIN" ]; then
    certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
fi

# Test auto-renewal
echo -e "${YELLOW}🧪 Testing certificate auto-renewal...${NC}"
certbot renew --dry-run

# Setup auto-renewal cron job (usually done automatically by certbot)
echo -e "${GREEN}✅ SSL certificate installed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Certificate Details:${NC}"
echo "  Domain: $DOMAIN"
if [ -n "$WWW_DOMAIN" ]; then
    echo "  WWW: $WWW_DOMAIN"
fi
echo "  Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  Private Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo -e "${GREEN}✅ SSL setup complete!${NC}"



