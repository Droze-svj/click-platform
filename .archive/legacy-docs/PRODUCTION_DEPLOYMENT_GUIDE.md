# 🚀 Production Deployment Guide - Complete

**Last Updated**: Current  
**Status**: Ready for Production Deployment

---

## 📋 Pre-Deployment Checklist

### 1. Server Requirements
- [ ] Ubuntu 20.04+ or similar Linux distribution
- [ ] Minimum 2GB RAM (4GB+ recommended)
- [ ] Minimum 20GB disk space
- [ ] Root/sudo access
- [ ] Domain name configured with DNS

### 2. OAuth App Setup
- [ ] Twitter/X Developer Account created
- [ ] Twitter OAuth app created with callback URL
- [ ] LinkedIn Developer Account created
- [ ] LinkedIn OAuth app created with callback URL
- [ ] Facebook Developer Account created
- [ ] Facebook OAuth app created with callback URL
- [ ] Instagram Business account linked to Facebook page (if using Instagram)

### 3. Third-Party Services
- [ ] MongoDB Atlas account (or local MongoDB)
- [ ] AWS S3 bucket created (for file storage)
- [ ] Redis instance (optional but recommended)
- [ ] Sentry account (for error tracking)
- [ ] OpenAI API key (for AI features)
- [ ] Email service configured (SendGrid, Mailgun, etc.)

---

## 🔧 Step-by-Step Deployment

### Step 1: Server Initial Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Run automated setup script
sudo bash scripts/setup-production.sh
```

This script will:
- Update system packages
- Install Node.js 18
- Install PM2
- Install MongoDB
- Install Nginx
- Install Certbot (for SSL)
- Install FFmpeg
- Configure firewall
- Set up log rotation

**Time**: ~10-15 minutes

---

### Step 2: Configure Environment Variables

```bash
cd /var/www/click

# Copy template
cp env.production.template .env.production

# Edit with your values
nano .env.production
```

**Required Variables**:

```env
# Server
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com
APP_URL=https://your-domain.com

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/click

# Security
JWT_SECRET=<generate with: openssl rand -base64 32>

# OAuth - Twitter
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_CALLBACK_URL=https://your-domain.com/api/oauth/twitter/callback

# OAuth - LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_CALLBACK_URL=https://your-domain.com/api/oauth/linkedin/callback

# OAuth - Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=https://your-domain.com/api/oauth/facebook/callback

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

# OpenAI
OPENAI_API_KEY=sk-your-key
```

**Generate JWT Secret**:
```bash
openssl rand -base64 32
```

**Validate Configuration**:
```bash
npm run validate:production
```

---

### Step 3: Deploy Application Code

```bash
cd /var/www/click

# Option A: Clone from Git
git clone https://github.com/your-org/click.git .

# Option B: Upload code via SCP/SFTP
# Upload your code to /var/www/click

# Install dependencies
npm ci --production
cd client && npm ci && npm run build && cd ..
```

---

### Step 4: Configure Database

**Option A: MongoDB Atlas (Recommended)**
1. Create cluster on MongoDB Atlas
2. Whitelist server IP
3. Get connection string
4. Add to `MONGODB_URI` in `.env.production`

**Option B: Local MongoDB**
```bash
# MongoDB should already be installed by setup script
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database
mongosh
use click
db.createUser({user: "clickuser", pwd: "securepassword", roles: ["readWrite"]})
```

---

### Step 5: Configure Nginx

```bash
# Copy Nginx config
sudo cp nginx.conf /etc/nginx/sites-available/click

# Edit domain name
sudo nano /etc/nginx/sites-available/click
# Replace 'your-domain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### Step 6: Setup SSL Certificate

```bash
# Automated SSL setup
sudo bash scripts/setup-ssl.sh

# Or manual:
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**Verify SSL**:
```bash
curl -I https://your-domain.com
# Should show HTTP/2 200
```

---

### Step 7: Start Application with PM2

```bash
cd /var/www/click

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# Check status
pm2 list
pm2 logs click-api
```

---

### Step 8: Setup Monitoring

```bash
# Automated monitoring setup
sudo bash scripts/setup-monitoring.sh
```

This sets up:
- PM2 monitoring
- Log rotation
- Health check cron jobs
- Disk space monitoring
- Backup monitoring

---

### Step 9: Verify Deployment

```bash
# Run comprehensive verification
bash scripts/verify-deployment.sh
```

**Manual Checks**:
```bash
# Health endpoint
curl https://your-domain.com/api/health

# Frontend
curl https://your-domain.com

# PM2 status
pm2 list

# Application logs
pm2 logs click-api --lines 50
```

---

## 🔐 OAuth Configuration

### Twitter/X OAuth Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app
3. Go to **App Settings** → **User authentication settings**
4. Set **Callback URI**: `https://your-domain.com/api/oauth/twitter/callback`
5. Set **App permissions**: Read and write
6. Copy **Client ID** and **Client Secret**
7. Add to `.env.production`

### LinkedIn OAuth Setup

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app
3. Go to **Auth** tab
4. Add **Authorized redirect URLs**: `https://your-domain.com/api/oauth/linkedin/callback`
5. Request access to **Sign In with LinkedIn using OpenID Connect**
6. Copy **Client ID** and **Client Secret**
7. Add to `.env.production`

### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add **Facebook Login** product
4. Go to **Settings** → **Basic**
5. Add **App Domains**: `your-domain.com`
6. Go to **Facebook Login** → **Settings**
7. Add **Valid OAuth Redirect URIs**: `https://your-domain.com/api/oauth/facebook/callback`
8. Copy **App ID** and **App Secret**
9. Add to `.env.production`

### Instagram Setup (via Facebook)

1. Connect a Facebook Page to your Facebook app
2. Link Instagram Business account to the page
3. Instagram posting will work automatically after Facebook connection

---

## 🧪 Testing After Deployment

### 1. Test OAuth Flows

```bash
# Test Twitter OAuth
curl -X GET "https://your-domain.com/api/oauth/twitter/authorize" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test LinkedIn OAuth
curl -X GET "https://your-domain.com/api/oauth/linkedin/authorize" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Facebook OAuth
curl -X GET "https://your-domain.com/api/oauth/facebook/authorize" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test API Endpoints

```bash
# Health check
curl https://your-domain.com/api/health

# API docs
curl https://your-domain.com/api-docs
```

### 3. Test Frontend

1. Visit `https://your-domain.com`
2. Register a new account
3. Login
4. Navigate to Social Media page
5. Test OAuth connections
6. Test posting

---

## 📊 Monitoring & Maintenance

### Daily Checks

```bash
# Check PM2 status
pm2 list

# Check logs for errors
pm2 logs click-api --err --lines 50

# Check disk space
df -h

# Check memory usage
free -h
```

### Weekly Checks

```bash
# Verify backups
ls -lh /var/www/click/backups/

# Check SSL certificate
sudo certbot certificates

# Review error logs
pm2 logs click-api --lines 500 | grep -i error
```

### Monthly Checks

```bash
# Update dependencies (carefully)
npm audit
npm update

# Review performance metrics
pm2 monit

# Test backup restoration
# (Restore to staging environment)
```

---

## 🔄 Updates & Rollbacks

### Deploy Updates

```bash
cd /var/www/click

# Pull latest code
git pull origin main

# Install new dependencies
npm ci --production
cd client && npm ci && npm run build && cd ..

# Run migrations (if any)
npm run deploy:migrate

# Restart application
pm2 reload click-api

# Verify
bash scripts/verify-deployment.sh
```

### Rollback

```bash
# Quick rollback script
bash scripts/rollback-deployment.sh

# Or manual:
cd /var/www/click
git checkout <previous-commit>
npm ci --production
cd client && npm ci && npm run build && cd ..
pm2 reload click-api
```

---

## 🚨 Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs click-api --err

# Check environment
pm2 env 0

# Check if port is in use
sudo lsof -i :5001

# Restart
pm2 restart click-api
```

### Database Connection Failed

```bash
# Check MongoDB
sudo systemctl status mongod

# Test connection
mongosh

# Check connection string in .env
cat .env.production | grep MONGODB_URI
```

### OAuth Not Working

```bash
# Check OAuth configuration
cat .env.production | grep -E "TWITTER|LINKEDIN|FACEBOOK"

# Check OAuth endpoints
curl https://your-domain.com/api/oauth/twitter/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check logs for OAuth errors
pm2 logs click-api | grep -i oauth
```

### Nginx 502 Errors

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/click-error.log

# Check if app is running
pm2 list

# Check Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 📝 Post-Deployment Tasks

1. **Set up automated backups**
   ```bash
   # Add to crontab
   crontab -e
   # Add: 0 2 * * * /var/www/click/scripts/backup-database.sh
   ```

2. **Configure monitoring alerts**
   - Set up Sentry alerts
   - Configure uptime monitoring
   - Set up email alerts for errors

3. **Document deployment**
   - Document server IP
   - Document domain
   - Document OAuth app IDs
   - Document team access

4. **Security hardening**
   - Review firewall rules
   - Enable fail2ban
   - Set up intrusion detection
   - Review access logs

---

## ✅ Success Criteria

Your deployment is successful when:

- ✅ Application accessible via HTTPS
- ✅ Health endpoint returns 200
- ✅ Users can register and login
- ✅ OAuth connections work for all platforms
- ✅ File uploads work
- ✅ No critical errors in logs
- ✅ PM2 processes stable
- ✅ Database connected
- ✅ Monitoring active
- ✅ SSL certificate valid
- ✅ Backups configured

---

## 📞 Support & Resources

- **Documentation**: See `README.md` and other docs in `/docs`
- **OAuth Setup**: See `docs/OAUTH_SETUP.md`
- **Troubleshooting**: See `PRODUCTION_DEPLOYMENT.md`
- **Quick Start**: See `QUICK_START_PRODUCTION.md`

---

**Ready to deploy! Follow the steps above in order.** 🚀


