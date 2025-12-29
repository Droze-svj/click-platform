# 🚀 Production Deployment - Action Plan

**Date**: December 29, 2025  
**Status**: Ready to Deploy  
**Estimated Time**: 2-3 hours for complete setup

---

## 📋 Overview

This guide will help you deploy Click to production. We'll cover:
- **Option 1**: Render.com (Recommended - Easiest, 10-15 minutes)
- **Option 2**: Railway (Alternative - 15-20 minutes)
- **Option 3**: Self-hosted VPS (Advanced - 1-2 hours)

---

## 🎯 Quick Decision Matrix

| Platform | Time | Cost | Difficulty | Best For |
|----------|------|------|-----------|----------|
| **Render.com** | 10-15 min | $0-25/mo | ⭐ Easy | Quick deployment, managed |
| **Railway** | 15-20 min | $5-20/mo | ⭐ Easy | Simple, good DX |
| **VPS (DigitalOcean)** | 1-2 hours | $6-12/mo | ⭐⭐⭐ Advanced | Full control |

**Recommendation**: Start with **Render.com** for fastest deployment.

---

## 🚀 Option 1: Render.com Deployment (Recommended)

### Prerequisites
- [ ] Render.com account (free tier available)
- [ ] GitHub repository with your code
- [ ] MongoDB Atlas account (free tier)
- [ ] Domain name (optional, can use Render subdomain)

### Step 1: Deploy to Render (10 minutes)

1. **Sign up for Render**
   - Go to: https://render.com
   - Sign up with GitHub (easiest)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure Service**
   ```
   Name: click-platform
   Environment: Node
   Build Command: npm install && cd client && npm install && npm run build
   Start Command: npm start
   ```

4. **Set Environment Variables**
   - Click "Environment" tab
   - Add all variables from `env.production.template`
   - **Minimum required**:
     ```
     NODE_ENV=production
     PORT=5001
     MONGODB_URI=your-mongodb-atlas-uri
     JWT_SECRET=generate-with-openssl-rand-base64-32
     FRONTEND_URL=https://your-app.onrender.com
     ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)

### Step 2: Set Up MongoDB Atlas (5 minutes)

1. **Create Account**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Sign up (free tier available)

2. **Create Cluster**
   - Choose free tier (M0)
   - Select region closest to you
   - Create cluster

3. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database password
   - Add to Render environment variables as `MONGODB_URI`

4. **Configure Network Access**
   - Add `0.0.0.0/0` to allow all IPs (or Render's IPs)
   - Or add specific Render IPs

### Step 3: Verify Deployment (2 minutes)

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.onrender.com/api/health
   ```

2. **Test OAuth**
   - Visit: `https://your-app.onrender.com/api/oauth/youtube/status`
   - Should return connection status

3. **Check Logs**
   - In Render dashboard, check "Logs" tab
   - Look for any errors

---

## 🚂 Option 2: Railway Deployment

### Step 1: Deploy to Railway (15 minutes)

1. **Sign up for Railway**
   - Go to: https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Service**
   - Railway auto-detects Node.js
   - Set start command: `npm start`
   - Set build command: `npm install && cd client && npm install && npm run build`

4. **Add Environment Variables**
   - Go to "Variables" tab
   - Add all from `env.production.template`

5. **Deploy**
   - Railway auto-deploys on push
   - Or click "Deploy" manually

### Step 2: Set Up Database

Railway offers MongoDB as a service:
- Click "New" → "Database" → "MongoDB"
- Railway provides connection string automatically
- Add to environment variables

---

## 🖥️ Option 3: Self-Hosted VPS (DigitalOcean/AWS)

### Prerequisites
- [ ] VPS server (Ubuntu 20.04+)
- [ ] SSH access
- [ ] Domain name (optional)
- [ ] Root/sudo access

### Step 1: Server Setup (30 minutes)

1. **Run Setup Script**
   ```bash
   ssh root@your-server-ip
   git clone https://github.com/your-org/click.git /var/www/click
   cd /var/www/click
   sudo bash scripts/setup-production.sh
   ```

2. **Configure Environment**
   ```bash
   cp env.production.template .env.production
   nano .env.production
   # Fill in all values
   ```

3. **Deploy Application**
   ```bash
   npm ci --production
   cd client && npm ci && npm run build && cd ..
   npm run deploy:migrate
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

4. **Set Up Nginx**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/click
   sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Set Up SSL**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

---

## 📋 Pre-Deployment Checklist

### Infrastructure
- [ ] Hosting platform chosen (Render/Railway/VPS)
- [ ] MongoDB Atlas account created
- [ ] Database cluster created
- [ ] Connection string obtained
- [ ] Redis instance (optional but recommended)

### OAuth Setup
- [ ] YouTube OAuth configured ✅ (Already done)
- [ ] Twitter OAuth app created (if using)
- [ ] LinkedIn OAuth app created (if using)
- [ ] Facebook OAuth app created (if using)
- [ ] All callback URLs updated for production domain

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` set
- [ ] `JWT_SECRET` generated (use: `openssl rand -base64 32`)
- [ ] `FRONTEND_URL` set to production domain
- [ ] All OAuth credentials added
- [ ] `OPENAI_API_KEY` set (if using AI features)
- [ ] AWS credentials (if using S3)

### Security
- [ ] Strong JWT secret generated
- [ ] Database password is strong
- [ ] OAuth secrets are secure
- [ ] Environment variables not committed to git
- [ ] SSL/HTTPS configured

---

## 🔧 Post-Deployment Steps

### 1. Verify Deployment
```bash
# Health check
curl https://your-domain.com/api/health

# OAuth status
curl https://your-domain.com/api/oauth/youtube/status
```

### 2. Set Up Monitoring
- [ ] Configure Sentry (error tracking)
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure log aggregation
- [ ] Set up alerts

### 3. Configure Backups
- [ ] MongoDB Atlas backups (automatic on paid tier)
- [ ] Database backup script scheduled
- [ ] File storage backups (S3)

### 4. Update OAuth Callback URLs
Update all OAuth apps with production callback URLs:
- Twitter: `https://your-domain.com/api/oauth/twitter/callback`
- LinkedIn: `https://your-domain.com/api/oauth/linkedin/callback`
- Facebook: `https://your-domain.com/api/oauth/facebook/callback`
- YouTube: `https://your-domain.com/api/oauth/youtube/callback`
- TikTok: `https://your-domain.com/api/oauth/tiktok/callback`

---

## 🧪 Testing Production Deployment

### 1. API Health Check
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "production"
}
```

### 2. OAuth Flow Test
1. Visit: `https://your-domain.com/api/oauth/youtube/authorize`
2. Complete OAuth flow
3. Verify callback works
4. Check connection status

### 3. Frontend Test
1. Visit production URL
2. Test registration/login
3. Test content creation
4. Test OAuth connections

---

## 🆘 Troubleshooting

### Deployment Fails
- Check build logs in platform dashboard
- Verify all environment variables are set
- Check Node.js version compatibility
- Review error logs

### Database Connection Issues
- Verify MongoDB Atlas network access allows your IP
- Check connection string format
- Verify credentials are correct
- Check MongoDB Atlas cluster status

### OAuth Not Working
- Verify callback URLs match exactly
- Check OAuth credentials in environment variables
- Verify OAuth apps are in production mode (not development)
- Check OAuth app permissions

### SSL/HTTPS Issues
- Verify domain DNS is configured
- Check SSL certificate status
- Verify Nginx configuration
- Check firewall rules

---

## 📊 Production Readiness Checklist

### Critical (Must Have)
- [ ] Application deployed and accessible
- [ ] Database connected and working
- [ ] Health endpoint responding
- [ ] SSL/HTTPS configured
- [ ] Environment variables set correctly
- [ ] OAuth callback URLs updated

### Important (Should Have)
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring set up
- [ ] Database backups configured
- [ ] Log aggregation set up
- [ ] Performance monitoring

### Nice to Have
- [ ] CDN configured
- [ ] Advanced caching
- [ ] Load balancing
- [ ] Auto-scaling

---

## 🚀 Quick Commands Reference

```bash
# Generate JWT secret
openssl rand -base64 32

# Validate production environment
npm run validate:production

# Prepare for deployment
npm run prepare:production

# Verify deployment
npm run deploy:verify

# Check production build
npm run verify:production:build
```

---

## 📝 Next Steps After Deployment

1. **Test All Features**
   - User registration/login
   - Content creation
   - OAuth connections
   - Content publishing

2. **Set Up Monitoring**
   - Configure Sentry
   - Set up uptime monitoring
   - Configure alerts

3. **Optimize Performance**
   - Enable CDN
   - Configure caching
   - Optimize database queries

4. **Set Up Backups**
   - Database backups
   - File storage backups
   - Test restore process

---

## 🎯 Recommended Deployment Order

1. **Day 1**: Deploy to Render/Railway (30 min)
2. **Day 1**: Set up MongoDB Atlas (15 min)
3. **Day 1**: Configure environment variables (15 min)
4. **Day 1**: Test deployment (15 min)
5. **Day 2**: Update OAuth callback URLs (30 min)
6. **Day 2**: Set up monitoring (30 min)
7. **Day 2**: Configure backups (30 min)

**Total Time**: ~3 hours over 2 days

---

## 📚 Additional Resources

- **Render Guide**: `RENDER_QUICK_START.md`
- **Railway Guide**: `RAILWAY_QUICK_START.md`
- **OAuth Setup**: `OAUTH_NEXT_STEPS.md`
- **Environment Template**: `env.production.template`

---

**Ready to deploy? Choose your platform and follow the steps above! 🚀**

