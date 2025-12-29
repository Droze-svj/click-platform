#!/bin/bash

# Monitoring Setup Script
# Sets up monitoring and alerting for production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Setting up Production Monitoring...${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

# 1. Setup PM2 monitoring
echo -e "${YELLOW}1. PM2 Monitoring${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "  ${GREEN}✅ PM2 is installed${NC}"
    
    # Install PM2 web monitoring (optional)
    read -p "  Install PM2 web monitoring? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 install pm2-server-monit
        echo -e "  ${GREEN}✅ PM2 monitoring installed${NC}"
    fi
else
    echo -e "  ${RED}❌ PM2 not found${NC}"
fi

# 2. Setup log rotation
echo -e "${YELLOW}2. Log Rotation${NC}"
if [ -f "/etc/logrotate.d/click" ]; then
    echo -e "  ${GREEN}✅ Log rotation already configured${NC}"
else
    cat > /etc/logrotate.d/click << 'EOF'
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
    echo -e "  ${GREEN}✅ Log rotation configured${NC}"
fi

# 3. Setup system monitoring
echo -e "${YELLOW}3. System Monitoring${NC}"

# Install htop for monitoring
if ! command -v htop &> /dev/null; then
    apt-get install -y htop
    echo -e "  ${GREEN}✅ htop installed${NC}"
fi

# Install netdata (optional comprehensive monitoring)
read -p "  Install Netdata for comprehensive monitoring? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash <(curl -Ss https://my-netdata.io/kickstart.sh) --non-interactive
    echo -e "  ${GREEN}✅ Netdata installed (access at http://your-server:19999)${NC}"
fi

# 4. Setup health check cron job
echo -e "${YELLOW}4. Automated Health Checks${NC}"
cat > /usr/local/bin/click-health-check.sh << 'HEALTHSCRIPT'
#!/bin/bash
HEALTH_URL="http://localhost:5001/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" != "200" ]; then
    echo "Health check failed: HTTP $RESPONSE" | mail -s "Click Health Check Failed" admin@your-domain.com
    pm2 restart click-api
fi
HEALTHSCRIPT

chmod +x /usr/local/bin/click-health-check.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null | grep -v "click-health-check"; echo "*/5 * * * * /usr/local/bin/click-health-check.sh") | crontab -

echo -e "  ${GREEN}✅ Health check cron job configured${NC}"

# 5. Setup disk space monitoring
echo -e "${YELLOW}5. Disk Space Monitoring${NC}"
cat > /usr/local/bin/check-disk-space.sh << 'DISKSCRIPT'
#!/bin/bash
THRESHOLD=80
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "Disk usage is ${USAGE}% (threshold: ${THRESHOLD}%)" | mail -s "Click Disk Space Warning" admin@your-domain.com
fi
DISKSCRIPT

chmod +x /usr/local/bin/check-disk-space.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null | grep -v "check-disk-space"; echo "0 2 * * * /usr/local/bin/check-disk-space.sh") | crontab -

echo -e "  ${GREEN}✅ Disk space monitoring configured${NC}"

# 6. Setup Sentry (if configured)
echo -e "${YELLOW}6. Error Tracking${NC}"
if grep -q "SENTRY_DSN" /var/www/click/.env.production 2>/dev/null; then
    echo -e "  ${GREEN}✅ Sentry DSN found in environment${NC}"
    echo -e "  ${BLUE}   Make sure Sentry is properly configured in your application${NC}"
else
    echo -e "  ${YELLOW}⚠️  Sentry DSN not found. Add SENTRY_DSN to .env.production${NC}"
fi

# 7. Setup backup monitoring
echo -e "${YELLOW}7. Backup Monitoring${NC}"
cat > /usr/local/bin/check-backups.sh << 'BACKUPSCRIPT'
#!/bin/bash
BACKUP_DIR="/var/www/click/backups"
LATEST_BACKUP=$(find $BACKUP_DIR -name "*.gz" -type f -mtime -1 | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "No backup found in the last 24 hours!" | mail -s "Click Backup Warning" admin@your-domain.com
fi
BACKUPSCRIPT

chmod +x /usr/local/bin/check-backups.sh

# Add to crontab (daily at 3 AM)
(crontab -l 2>/dev/null | grep -v "check-backups"; echo "0 3 * * * /usr/local/bin/check-backups.sh") | crontab -

echo -e "  ${GREEN}✅ Backup monitoring configured${NC}"

echo ""
echo -e "${GREEN}✅ Monitoring setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Monitoring Tools:${NC}"
echo "  • PM2: pm2 monit"
echo "  • System: htop"
if command -v netdata &> /dev/null; then
    echo "  • Netdata: http://your-server:19999"
fi
echo "  • Logs: pm2 logs click-api"
echo "  • Health: curl http://localhost:5001/api/health"



