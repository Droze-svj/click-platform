# 🚂 Railway.app Deployment Guide

**Date**: Current  
**Status**: Complete Railway.app Setup  
**Cost**: $0/month (Free Tier)

---

## 🎯 Overview

Railway.app is a modern platform that makes deploying applications simple. This guide will walk you through deploying Click to Railway.app.

**Why Railway.app**:
- ✅ $5 free credit/month (enough for small apps)
- ✅ Automatic SSL certificates
- ✅ Git-based deployment
- ✅ Environment variables management
- ✅ No credit card required initially
- ✅ Easy scaling

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ GitHub account (for repository)
2. ✅ Railway.app account (we'll create this)
3. ✅ Free services set up:
   - MongoDB Atlas (M0 free tier)
   - Redis Cloud (30MB free tier)
   - AWS S3 (free tier)
   - Sentry (free tier)

---

## 🚀 Step-by-Step Deployment

### Step 1: Sign Up for Railway.app

1. **Go to**: https://railway.app/
2. **Click "Start a New Project"**
3. **Sign in with GitHub** (recommended)
4. **Authorize Railway** to access your GitHub account

### Step 2: Create New Project

1. **Click "New Project"**
2. **Select "Deploy from GitHub repo"**
3. **Choose your Click repository**
4. **Railway will automatically detect** it's a Node.js project

### Step 3: Configure Build Settings

Railway will auto-detect, but verify these settings:

**Build Command**:
```bash
npm install && cd client && npm install && npm run build
```

**Start Command**:
```bash
npm start
```

**Root Directory**: Leave as `/` (root)

### Step 4: Add Environment Variables

Go to your project → **Variables** tab and add:

#### Required Variables

```env
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-app.railway.app
APP_URL=https://your-app.railway.app

# Database
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
LINKEDIN_CALLBACK_URL=https://your-app.railway.app/api/oauth/linkedin/callback

# OAuth - Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=https://your-app.railway.app/api/oauth/facebook/callback

# OAuth - TikTok
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
TIKTOK_CALLBACK_URL=https://your-app.railway.app/api/oauth/tiktok/callback

# OAuth - YouTube
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_CALLBACK_URL=https://your-app.railway.app/api/oauth/youtube/callback

# OAuth - Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=https://your-app.railway.app/api/oauth/twitter/callback

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

1. **Go to Settings** → **Domains**
2. **Click "Add Domain"**
3. **Enter your domain** (e.g., `click.example.com`)
4. **Add DNS records** as instructed:
   - CNAME: `your-domain.com` → `your-app.railway.app`
5. **Railway will automatically provision SSL**

### Step 6: Deploy

1. **Railway will automatically deploy** when you push to GitHub
2. **Or click "Deploy"** in Railway dashboard
3. **Watch the build logs** to see progress
4. **Wait for deployment** to complete (usually 2-5 minutes)

### Step 7: Verify Deployment

1. **Check deployment status** in Railway dashboard
2. **Visit your app**: `https://your-app.railway.app`
3. **Test health endpoint**: `https://your-app.railway.app/api/health`
4. **Check logs** in Railway dashboard

---

## 🔧 Railway.app Configuration Files

### railway.json

Already created! Located in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && cd client && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### .railwayignore (Optional)

Create this file to exclude files from deployment:

```
node_modules
.git
.env.local
.env.development
*.log
coverage
.nyc_output
playwright-report
test-results
```

---

## 📊 Railway.app Features

### Automatic Deployments

- ✅ **Deploys on every push** to main branch
- ✅ **Preview deployments** for pull requests
- ✅ **Rollback** to previous deployments
- ✅ **Build logs** for debugging

### Environment Management

- ✅ **Environment variables** in dashboard
- ✅ **Secrets management** (encrypted)
- ✅ **Different environments** (production, staging)

### Monitoring

- ✅ **Real-time logs** in dashboard
- ✅ **Metrics** (CPU, memory, network)
- ✅ **Deployment history**
- ✅ **Health checks**

### Scaling

- ✅ **Auto-scaling** based on usage
- ✅ **Resource limits** (CPU, memory)
- ✅ **Horizontal scaling** (multiple instances)

---

## 🔍 Troubleshooting

### Build Fails

**Issue**: Build command fails
**Solution**:
- Check build logs in Railway dashboard
- Verify `package.json` scripts are correct
- Ensure all dependencies are in `package.json`

### Application Won't Start

**Issue**: App crashes on start
**Solution**:
- Check application logs
- Verify all environment variables are set
- Ensure PORT is set correctly (Railway sets this automatically)
- Check database connection string

### Environment Variables Not Working

**Issue**: Variables not being read
**Solution**:
- Verify variables are set in Railway dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding variables

### OAuth Callbacks Failing

**Issue**: OAuth redirects not working
**Solution**:
- Update callback URLs in OAuth apps to Railway URL
- Verify `FRONTEND_URL` and `APP_URL` are correct
- Check CORS settings

### Database Connection Fails

**Issue**: Can't connect to MongoDB
**Solution**:
- Verify MongoDB Atlas IP whitelist includes Railway IPs
- Check connection string is correct
- Ensure database user has correct permissions

---

## 📈 Monitoring & Maintenance

### View Logs

1. **Go to Railway dashboard**
2. **Click on your service**
3. **Click "Logs" tab**
4. **View real-time logs**

### Monitor Metrics

1. **Go to Railway dashboard**
2. **Click on your service**
3. **View metrics**:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count

### Set Up Alerts

1. **Go to Settings** → **Notifications**
2. **Configure alerts** for:
   - Deployment failures
   - High resource usage
   - Service downtime

---

## 💰 Cost Management

### Free Tier Limits

- **$5 credit/month** (free tier)
- **512MB RAM** per service
- **1GB storage**
- **100GB bandwidth**

### Monitor Usage

1. **Go to Settings** → **Usage**
2. **View current usage**:
   - Compute hours
   - Bandwidth
   - Storage

### Upgrade When Needed

When you exceed free tier:
- **Hobby Plan**: $5/month (more resources)
- **Pro Plan**: $20/month (even more resources)

---

## 🔄 Continuous Deployment

### Automatic Deployments

Railway automatically deploys when you:
- Push to main branch
- Merge pull request
- Manually trigger deployment

### Preview Deployments

- **Pull requests** get preview deployments
- **Test changes** before merging
- **Share preview URLs** with team

### Rollback

1. **Go to Deployments** tab
2. **Find previous deployment**
3. **Click "Redeploy"**
4. **App rolls back** to that version

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Railway.app account created
- [ ] GitHub repository connected
- [ ] Environment variables added
- [ ] MongoDB Atlas configured
- [ ] Redis Cloud configured
- [ ] AWS S3 configured
- [ ] OAuth apps created
- [ ] Callback URLs updated

### Deployment

- [ ] Project created in Railway
- [ ] Repository connected
- [ ] Build settings verified
- [ ] Environment variables set
- [ ] Initial deployment successful
- [ ] Health check passing

### Post-Deployment

- [ ] Application accessible
- [ ] API endpoints working
- [ ] OAuth flows working
- [ ] Database connected
- [ ] Logs monitoring set up
- [ ] Custom domain configured (optional)

---

## 🎯 Quick Commands

### Railway CLI (Optional)

Install Railway CLI for advanced features:

```bash
# Install
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open dashboard
railway open
```

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app/
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app/

---

## 🎉 Summary

**Railway.app is now configured and ready for deployment!**

✅ **Configuration files created**  
✅ **Deployment guide complete**  
✅ **Free tier optimized**  
✅ **Auto-deployment ready**  

**Next Step**: Follow the step-by-step guide above to deploy!

---

**Last Updated**: Current  
**Status**: ✅ **Railway.app Setup Complete**


