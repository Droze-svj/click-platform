#!/bin/bash

# Production Server Setup Script
# Run this on a fresh server to set up the production environment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting production server setup...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install Node.js 18
echo -e "${YELLOW}📦 Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
echo -e "${YELLOW}📦 Installing PM2...${NC}"
npm install -g pm2

# Install MongoDB
echo -e "${YELLOW}📦 Installing MongoDB...${NC}"
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org
systemctl enable mongod
systemctl start mongod

# Install Nginx
echo -e "${YELLOW}📦 Installing Nginx...${NC}"
apt-get install -y nginx

# Install Certbot for SSL
echo -e "${YELLOW}📦 Installing Certbot...${NC}"
apt-get install -y certbot python3-certbot-nginx

# Install FFmpeg
echo -e "${YELLOW}📦 Installing FFmpeg...${NC}"
apt-get install -y ffmpeg

# Install Redis (optional)
read -p "Install Redis? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📦 Installing Redis...${NC}"
    apt-get install -y redis-server
    systemctl enable redis-server
    systemctl start redis-server
fi

# Create application user
echo -e "${YELLOW}👤 Creating application user...${NC}"
useradd -m -s /bin/bash deploy || true
usermod -aG sudo deploy

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
mkdir -p /var/www/click
mkdir -p /var/www/click/logs
mkdir -p /var/www/click/backups
mkdir -p /var/www/click/releases
chown -R deploy:deploy /var/www/click

# Setup firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Setup log rotation
echo -e "${YELLOW}📝 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/click << EOF
/var/www/click/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Setup PM2 startup
echo -e "${YELLOW}⚙️  Setting up PM2 startup...${NC}"
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy
sudo -u deploy pm2 save

echo -e "${GREEN}✅ Production server setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "  1. Copy your application code to /var/www/click"
echo "  2. Set up environment variables in /var/www/click/.env.production"
echo "  3. Configure Nginx (copy nginx.conf to /etc/nginx/sites-available/click)"
echo "  4. Set up SSL certificates: certbot --nginx -d your-domain.com"
echo "  5. Start application: cd /var/www/click && pm2 start ecosystem.config.js"



