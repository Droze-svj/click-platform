# 🚀 Quick Start - Production Deployment

**Date**: Current  
**Purpose**: Fast-track guide to get Click deployed to production

---

## ⚡ 5-Minute Overview

This guide will get you from zero to production in the fastest way possible. Follow these steps in order.

---

## Step 1: Infrastructure Setup (30-60 minutes)

### 1.1 Choose Hosting Provider

**Recommended**: DigitalOcean (easiest) or AWS EC2 (most scalable)

**Quick Setup**:
1. Create account at https://www.digitalocean.com/
2. Create droplet: Ubuntu 22.04, $12/month minimum
3. Note your server IP address

### 1.2 Setup Server

```bash
# SSH into server
ssh root@your-server-ip

# Run automated setup
git clone https://github.com/your-org/click.git /var/www/click
cd /var/www/click
sudo bash scripts/setup-production.sh
```

**See**: `INFRASTRUCTURE_SETUP_GUIDE.md` for detailed instructions

### 1.3 Setup Domain & SSL

1. **Point domain to server**:
   - Add A record: `@` → `YOUR_SERVER_IP`
2. **Get SSL certificate**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

---

## Step 2: Configure Services (30-60 minutes)

### 2.1 Database (MongoDB Atlas - Recommended)

1. **Create account**: https://www.mongodb.com/cloud/atlas
2. **Create cluster**: Free tier (M0) is fine
3. **Get connection string**: Copy from dashboard
4. **Whitelist IP**: Add `0.0.0.0/0` or your server IP

### 2.2 Redis (Optional but Recommended)

1. **Create account**: https://redis.com/try-free/
2. **Create database**: Free tier (30MB)
3. **Get connection string**: Copy from dashboard

### 2.3 AWS S3 (For File Storage)

1. **Create account**: https://aws.amazon.com/
2. **Create S3 bucket**: Name it `click-production`
3. **Create IAM user**: With S3 access
4. **Save credentials**: Access Key ID and Secret

**See**: `INFRASTRUCTURE_SETUP_GUIDE.md` for detailed instructions

---

## Step 3: Configure OAuth Apps (60-90 minutes)

### 3.1 Create OAuth Apps

Follow the guide for each platform:

1. **LinkedIn**: https://www.linkedin.com/developers/ (~15 min)
2. **Facebook**: https://developers.facebook.com/ (~20 min)
3. **TikTok**: https://developers.tiktok.com/ (~20 min + review)
4. **YouTube**: https://console.cloud.google.com/ (~20 min)
5. **Twitter**: https://developer.twitter.com/ (~15 min + approval)

**See**: `OAUTH_APPS_SETUP_GUIDE.md` for step-by-step instructions

### 3.2 Get All Credentials

Save all OAuth credentials:
- Client IDs / App IDs
- Client Secrets / App Secrets
- Callback URLs (format: `https://your-domain.com/api/oauth/{platform}/callback`)

---

## Step 4: Configure Environment (5 minutes)

### 4.1 Run Interactive Setup

```bash
# On your local machine or server
cd /path/to/click
bash scripts/setup-production-interactive.sh
```

This will:
- Prompt for all configuration values
- Generate `.env.production` file
- Validate configuration

**Or manually**: Copy `env.production.template` to `.env.production` and fill in values

### 4.2 Verify Configuration

```bash
# Validate environment
npm run validate:production

# Test OAuth configuration
npm run test:oauth:all
```

---

## Step 5: Deploy Application (15-30 minutes)

### 5.1 Build Application

```bash
# On server
cd /var/www/click

# Install dependencies
npm ci

# Build frontend
cd client && npm ci && npm run build && cd ..

# Copy environment file
cp .env.production .env
```

### 5.2 Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 5.3 Configure Nginx

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/click
sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: Verify Deployment (5 minutes)

### 6.1 Health Checks

```bash
# Test API health
curl https://your-domain.com/api/health

# Test frontend
curl https://your-domain.com

# Check PM2 status
pm2 status

# Check logs
pm2 logs
```

### 6.2 Run Verification

```bash
npm run deploy:verify
```

---

## ✅ Quick Checklist

### Infrastructure
- [ ] Hosting provider account created
- [ ] Server instance created
- [ ] Domain configured
- [ ] SSL certificate installed
- [ ] Server setup script run

### Services
- [ ] MongoDB Atlas account created
- [ ] Database connection string obtained
- [ ] Redis account created (optional)
- [ ] Redis connection string obtained
- [ ] AWS S3 bucket created
- [ ] AWS credentials obtained

### OAuth Apps
- [ ] LinkedIn app created
- [ ] Facebook app created
- [ ] TikTok app created
- [ ] YouTube OAuth client created
- [ ] Twitter app created
- [ ] All credentials saved

### Configuration
- [ ] `.env.production` file created
- [ ] All environment variables configured
- [ ] Configuration validated
- [ ] OAuth configuration tested

### Deployment
- [ ] Application built
- [ ] PM2 configured
- [ ] Nginx configured
- [ ] Application running
- [ ] Health checks passing

---

## 🎯 Expected Timeline

| Task | Time |
|------|------|
| Infrastructure Setup | 30-60 min |
| Services Setup | 30-60 min |
| OAuth Apps Setup | 60-90 min |
| Configuration | 5-10 min |
| Deployment | 15-30 min |
| Verification | 5 min |
| **Total** | **2-4 hours** |

---

## 🆘 Quick Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs

# Check environment
cat .env

# Check port
netstat -tulpn | grep 5001
```

### OAuth not working
```bash
# Test OAuth configuration
npm run test:oauth:all

# Check callback URLs match
# Verify credentials are correct
```

### Database connection fails
```bash
# Test connection string
mongosh "your-connection-string"

# Check IP whitelist in MongoDB Atlas
```

---

## 📚 Detailed Guides

For more detailed instructions, see:

1. **Infrastructure Setup**: `INFRASTRUCTURE_SETUP_GUIDE.md`
2. **OAuth Apps Setup**: `OAUTH_APPS_SETUP_GUIDE.md`
3. **Production Deployment**: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
4. **OAuth Verification**: `OAUTH_VERIFICATION_REPORT.md`

---

## 🎉 You're Done!

Once all steps are complete:

1. ✅ Your application is live at `https://your-domain.com`
2. ✅ API is accessible at `https://your-domain.com/api`
3. ✅ OAuth integrations are configured
4. ✅ Monitoring is set up

**Next Steps**:
- Set up monitoring alerts
- Configure backups
- Review security settings
- Test all features

---

**Last Updated**: Current  
**Status**: Ready to Use
