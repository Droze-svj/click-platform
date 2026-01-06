# 🎨 Render.com Backend Deployment Guide

**Date**: Current
**Status**: Complete Render.com Setup
**Cost**: $0/month (Free Tier) or $7/month (Always-On)

---

## 🎯 Overview

Render.com is a modern cloud platform that makes deploying applications simple. This guide will walk you through deploying Click backend to Render.com.

**Why Render.com**:
- ✅ Free tier available (spins down after inactivity)
- ✅ Automatic SSL certificates
- ✅ Git-based deployment
- ✅ Environment variables management
- ✅ Easy scaling
- ✅ Built-in health checks

---

## 📋 Current Status

✅ **Database Ready**: Supabase configured and tables created
✅ **Environment Configured**: All variables prepared
✅ **Deployment Files Ready**: render.yaml and .renderignore created

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ GitHub account (for repository)
2. ✅ Render.com account (we'll create this)
3. ✅ Free services set up:
   - MongoDB Atlas (M0 free tier) - OR use Render's free PostgreSQL
   - Redis Cloud (30MB free tier)
   - AWS S3 (free tier)
   - Sentry (free tier)

---

## 🚀 Step-by-Step Deployment

### Step 1: Sign Up for Render.com

1. **Go to**: https://render.com/
2. **Click "Get Started for Free"**
3. **Sign in with GitHub** (recommended)
4. **Authorize Render** to access your GitHub account

### Step 2: Create New Web Service

1. **Click "New +"** in dashboard
2. **Select "Web Service"**
3. **Connect your GitHub repository**:
   - Select your Click repository
   - Render will auto-detect it's a Node.js project

### Step 3: Configure Service Settings

**Basic Settings**:

- **Name**: `click-api` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `/` (root)

**Build & Deploy**:

- **Build Command**: 
  ```bash
  npm install && cd client && npm install && npm run build
  ```
- **Start Command**: 
  ```bash
  npm start
  ```
- **Environment**: `Node`

**Advanced Settings**:

- **Health Check Path**: `/api/health`
- **Auto-Deploy**: `Yes` (deploy on every push)

### Step 4: Add Environment Variables

Go to **Environment** tab and add:

#### Required Variables

```env
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-app.onrender.com
APP_URL=https://your-app.onrender.com

# Database - MongoDB Atlas (or use Render PostgreSQL)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/click?retryWrites=true&w=majority

# Redis
REDIS_URL=redis://username:password@host:port

# Security (generate these)
JWT_SECRET=your-generated-secret
SESSION_SECRET=your-generated-secret

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=click-storage
AWS_REGION=us-east-1

# OAuth - LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=https://your-app.onrender.com/api/oauth/linkedin/callback

# OAuth - Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=https://your-app.onrender.com/api/oauth/facebook/callback

# OAuth - TikTok
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
TIKTOK_CALLBACK_URL=https://your-app.onrender.com/api/oauth/tiktok/callback

# OAuth - YouTube
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_CALLBACK_URL=https://your-app.onrender.com/api/oauth/youtube/callback

# OAuth - Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=https://your-app.onrender.com/api/oauth/twitter/callback

# AI
OPENAI_API_KEY=sk-your-openai-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Email (optional)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
SMTP_FROM=noreply@your-domain.com
```

#### Generate Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate session secret
openssl rand -base64 32
```

### Step 5: Configure Custom Domain (Optional)

1. **Go to Settings** → **Custom Domains**
2. **Click "Add Custom Domain"**
3. **Enter your domain** (e.g., `click.example.com`)
4. **Add DNS records** as instructed:
   - CNAME: `your-domain.com` → `your-app.onrender.com`
5. **Render will automatically provision SSL**

### Step 6: Deploy

1. **Click "Create Web Service"**
2. **Render will start building** immediately
3. **Watch the build logs** to see progress
4. **Wait for deployment** to complete (usually 3-7 minutes)
5. **Service will be live** at `https://your-app.onrender.com`

### Step 7: Verify Deployment

1. **Check deployment status** in Render dashboard
2. **Visit your app**: `https://your-app.onrender.com`
3. **Test health endpoint**: `https://your-app.onrender.com/api/health`
4. **Check logs** in Render dashboard

---

## 🔧 Render.com Configuration Files

### render.yaml

Already created! Located in project root:

```yaml
services:
  - type: web
    name: click-api
    env: node
    buildCommand: npm install && cd client && npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
    healthCheckPath: /api/health
```

### Using render.yaml (Alternative Method)

Instead of manual setup, you can use the `render.yaml` file:

1. **Go to Dashboard** → **New** → **Blueprint**
2. **Connect GitHub repository**
3. **Render will use render.yaml** automatically
4. **Review and deploy**

---

## 📊 Render.com Features

### Free Tier

- ✅ **512MB RAM**
- ✅ **0.5 CPU**
- ✅ **Automatic SSL**
- ✅ **Custom domains**
- ✅ **Spins down** after 15 min inactivity
- ✅ **Free PostgreSQL** database (if you want to switch)

### Paid Tiers

- **Starter**: $7/month (always-on, 512MB RAM)
- **Standard**: $25/month (1GB RAM, better performance)
- **Pro**: $85/month (2GB RAM, high performance)

### Automatic Deployments

- ✅ **Deploys on every push** to main branch
- ✅ **Preview deployments** for pull requests
- ✅ **Rollback** to previous deployments
- ✅ **Build logs** for debugging

### Environment Management

- ✅ **Environment variables** in dashboard
- ✅ **Secrets management** (encrypted)
- ✅ **Different environments** (production, preview)

### Monitoring

- ✅ **Real-time logs** in dashboard
- ✅ **Metrics** (CPU, memory)
- ✅ **Deployment history**
- ✅ **Health checks**

---

## 🔍 Troubleshooting

### Build Fails

**Issue**: Build command fails
**Solution**:
- Check build logs in Render dashboard
- Verify `package.json` scripts are correct
- Ensure all dependencies are in `package.json`
- Check Node.js version (Render uses latest LTS)

### Application Won't Start

**Issue**: App crashes on start
**Solution**:
- Check application logs
- Verify all environment variables are set
- Ensure PORT is set correctly (Render sets this automatically)
- Check database connection string
- Verify health check path is correct

### Environment Variables Not Working

**Issue**: Variables not being read
**Solution**:
- Verify variables are set in Render dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding variables
- Check if variables are marked as "Secret" (they're still accessible)

### Slow First Load (Free Tier)

**Issue**: First request takes 30-60 seconds
**Solution**:
- This is normal for free tier (spins down after 15 min)
- Upgrade to Starter ($7/month) for always-on
- Or use a keep-alive service (UptimeRobot pings every 5 min)

### OAuth Callbacks Failing

**Issue**: OAuth redirects not working
**Solution**:
- Update callback URLs in OAuth apps to Render URL
- Verify `FRONTEND_URL` and `APP_URL` are correct
- Check CORS settings
- Ensure HTTPS is used in callback URLs

### Database Connection Fails

**Issue**: Can't connect to MongoDB
**Solution**:
- Verify MongoDB Atlas IP whitelist includes Render IPs
- Add `0.0.0.0/0` to whitelist (allows all IPs)
- Check connection string is correct
- Ensure database user has correct permissions

---

## 📈 Monitoring & Maintenance

### View Logs

1. **Go to Render dashboard**
2. **Click on your service**
3. **Click "Logs" tab**
4. **View real-time logs**
5. **Download logs** (if needed)

### Monitor Metrics

1. **Go to Render dashboard**
2. **Click on your service**
3. **View metrics**:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Set Up Alerts

1. **Go to Settings** → **Notifications**
2. **Configure email alerts** for:
   - Deployment failures
   - Service downtime
   - High resource usage

### Keep Service Awake (Free Tier)

To prevent spin-down on free tier:

1. **Use UptimeRobot** (free):
   - Sign up: https://uptimerobot.com/
   - Add monitor: `https://your-app.onrender.com/api/health`
   - Set interval: 5 minutes
   - Service stays awake

2. **Or upgrade to Starter** ($7/month) for always-on

---

## 💰 Cost Management

### Free Tier

- **$0/month**
- **512MB RAM**
- **0.5 CPU**
- **Spins down** after 15 min inactivity
- **Unlimited bandwidth**

### When to Upgrade

Upgrade to **Starter ($7/month)** when:
- You need always-on service
- First load speed is important
- You have regular traffic
- OAuth flows need to be instant

### Monitor Usage

1. **Go to Dashboard**
2. **View service metrics**
3. **Check resource usage**
4. **Monitor costs** (if on paid tier)

---

## 🔄 Continuous Deployment

### Automatic Deployments

Render automatically deploys when you:
- Push to main branch
- Merge pull request
- Manually trigger deployment

### Preview Deployments

- **Pull requests** get preview deployments
- **Test changes** before merging
- **Share preview URLs** with team
- **Automatic cleanup** after PR merge

### Rollback

1. **Go to Deployments** tab
2. **Find previous deployment**
3. **Click "Rollback"**
4. **App rolls back** to that version

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Render.com account created
- [ ] GitHub repository ready
- [ ] Environment variables prepared
- [ ] MongoDB Atlas configured (or use Render PostgreSQL)
- [ ] Redis Cloud configured
- [ ] AWS S3 configured
- [ ] OAuth apps created
- [ ] Callback URLs updated

### Deployment

- [ ] Web service created in Render
- [ ] Repository connected
- [ ] Build settings verified
- [ ] Environment variables added
- [ ] Health check path set
- [ ] Initial deployment successful
- [ ] Health check passing

### Post-Deployment

- [ ] Application accessible
- [ ] API endpoints working
- [ ] OAuth flows working
- [ ] Database connected
- [ ] Logs monitoring set up
- [ ] Custom domain configured (optional)
- [ ] Keep-alive service set up (free tier)

---

## 🎯 Quick Commands

### Render CLI (Optional)

Install Render CLI for advanced features:

```bash
# Install
npm i -g render

# Login
render login

# View services
render services list

# View logs
render logs --service click-api

# Open dashboard
render dashboard
```

---

## 🆓 Free Tier Optimization

### Keep Service Awake

**Option 1: UptimeRobot** (Recommended)
1. Sign up: https://uptimerobot.com/
2. Add monitor: `https://your-app.onrender.com/api/health`
3. Interval: 5 minutes
4. Service stays awake

**Option 2: Cron Job**
- Use external cron service
- Ping your app every 5 minutes
- Keeps service awake

**Option 3: Upgrade**
- Upgrade to Starter ($7/month)
- Always-on service
- No spin-down

---

## 📚 Additional Resources

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com/
- **Render Community**: https://community.render.com/

---

## 🎉 Summary

**Render.com is now configured and ready for deployment!**

✅ **Configuration files created**  
✅ **Deployment guide complete**  
✅ **Free tier optimized**  
✅ **Auto-deployment ready**  

**Next Step**: Follow the step-by-step guide above to deploy!

---

**Last Updated**: Current  
**Status**: ✅ **Render.com Setup Complete**


