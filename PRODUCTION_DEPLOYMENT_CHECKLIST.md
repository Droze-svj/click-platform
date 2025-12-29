# 🚀 Production Deployment Checklist

**Date**: Current  
**Status**: Ready for Deployment  
**Priority**: Critical

---

## 📋 Pre-Deployment Checklist

### 1. Code Quality ✅
- [x] All tests passing (`npm test`)
- [x] E2E tests passing (`npm run test:e2e:browser`)
- [x] Linting passed (`npm run lint`)
- [x] Code review completed
- [x] No critical security vulnerabilities
- [x] Dependencies updated and secure

### 2. Environment Configuration ✅
- [ ] Production `.env` file created
- [ ] All environment variables configured
- [ ] OAuth credentials configured for production
- [ ] Database connection strings set
- [ ] Redis connection configured
- [ ] AWS S3 credentials configured
- [ ] API keys configured
- [ ] Frontend URL configured
- [ ] Backend URL configured

### 3. Database Setup ✅
- [ ] Production MongoDB instance created
- [ ] Database connection tested
- [ ] Database backups configured
- [ ] Database indexes created
- [ ] Migration scripts ready
- [ ] Database monitoring configured

### 4. Infrastructure Setup ✅
- [ ] Server/hosting provider selected
- [ ] Server instance created
- [ ] Domain name configured
- [ ] DNS records configured
- [ ] SSL certificate obtained
- [ ] Firewall rules configured
- [ ] Load balancer configured (if needed)

### 5. Redis Setup ✅
- [ ] Redis instance created
- [ ] Redis connection tested
- [ ] Redis persistence configured
- [ ] Redis monitoring configured

### 6. Storage Setup ✅
- [ ] AWS S3 bucket created
- [ ] S3 bucket permissions configured
- [ ] CDN configured (CloudFront/Cloudflare)
- [ ] Storage monitoring configured

### 7. Monitoring & Logging ✅
- [ ] Sentry configured for error tracking
- [ ] PM2 configured for process management
- [ ] Health check endpoints configured
- [ ] Uptime monitoring configured
- [ ] Log aggregation configured
- [ ] Alerting configured

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Verification

```bash
# 1. Run all tests
npm test
npm run test:e2e:browser

# 2. Verify environment
npm run validate:production

# 3. Verify OAuth structure
npm run verify:oauth:structure

# 4. Check for security issues
npm audit
```

### Step 2: Build Application

```bash
# 1. Install dependencies
npm ci

# 2. Build frontend
cd client
npm ci
npm run build
cd ..

# 3. Create production build
npm run deploy:build
```

### Step 3: Deploy to Server

```bash
# 1. Copy files to server
scp -r deploy-* user@server:/path/to/app

# 2. SSH into server
ssh user@server

# 3. Navigate to app directory
cd /path/to/app

# 4. Install production dependencies
npm ci --production

# 5. Run database migrations
npm run deploy:migrate

# 6. Start application with PM2
pm2 start ecosystem.config.js --env production
```

### Step 4: Configure Nginx

```bash
# 1. Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/click
sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/

# 2. Test nginx configuration
sudo nginx -t

# 3. Reload nginx
sudo systemctl reload nginx
```

### Step 5: Configure SSL

```bash
# Using Let's Encrypt
sudo certbot --nginx -d yourdomain.com

# Or using Cloudflare (if using Cloudflare)
# SSL is handled automatically
```

### Step 6: Verify Deployment

```bash
# 1. Check health endpoint
curl https://yourdomain.com/api/health

# 2. Check application status
pm2 status

# 3. Check logs
pm2 logs

# 4. Run deployment verification
npm run deploy:verify
```

---

## 🔧 Post-Deployment Tasks

### 1. Initial Verification
- [ ] Health check endpoint responds
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Database connection works
- [ ] Redis connection works
- [ ] File uploads work
- [ ] OAuth flows work

### 2. Monitoring Setup
- [ ] Sentry error tracking active
- [ ] PM2 monitoring active
- [ ] Uptime monitoring active
- [ ] Log aggregation working
- [ ] Alerts configured

### 3. Backup Configuration
- [ ] Database backups scheduled
- [ ] File backups configured
- [ ] Backup restoration tested

### 4. Security Hardening
- [ ] Firewall rules configured
- [ ] Rate limiting active
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] CORS configured correctly

### 5. Performance Optimization
- [ ] CDN configured
- [ ] Caching configured
- [ ] Compression enabled
- [ ] Image optimization active

---

## 📝 Environment Variables Checklist

### Required Variables

```env
# Application
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Database
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_REGION=...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# OAuth - LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_CALLBACK_URL=https://api.yourdomain.com/api/oauth/linkedin/callback

# OAuth - Facebook
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=https://api.yourdomain.com/api/oauth/facebook/callback

# OAuth - TikTok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_CALLBACK_URL=https://api.yourdomain.com/api/oauth/tiktok/callback

# OAuth - YouTube
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_CALLBACK_URL=https://api.yourdomain.com/api/oauth/youtube/callback

# OpenAI
OPENAI_API_KEY=...

# Sentry
SENTRY_DSN=...

# Email
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

---

## 🛠️ Deployment Scripts

### Available Scripts

```bash
# Validate production environment
npm run validate:production

# Build for production
npm run deploy:build

# Deploy to production
npm run deploy:build

# Verify deployment
npm run deploy:verify

# Setup SSL
npm run deploy:setup-ssl

# Setup monitoring
npm run deploy:setup-monitoring

# Database migration
npm run deploy:migrate

# Database backup
npm run deploy:backup
```

---

## 🔍 Verification Commands

### Health Checks

```bash
# API Health
curl https://api.yourdomain.com/api/health

# OAuth Status
curl https://api.yourdomain.com/api/oauth/health

# Database Connection
# Check PM2 logs or application logs
```

### Application Status

```bash
# PM2 Status
pm2 status

# PM2 Logs
pm2 logs

# PM2 Monitoring
pm2 monit
```

---

## ⚠️ Common Issues & Solutions

### Issue: Application won't start
**Solution**:
- Check PM2 logs: `pm2 logs`
- Check environment variables
- Check database connection
- Check port availability

### Issue: OAuth callbacks failing
**Solution**:
- Verify callback URLs in OAuth apps
- Check callback URLs in environment variables
- Verify HTTPS is configured
- Check CORS settings

### Issue: Database connection fails
**Solution**:
- Verify MongoDB URI
- Check network connectivity
- Verify database credentials
- Check firewall rules

### Issue: File uploads fail
**Solution**:
- Verify AWS S3 credentials
- Check S3 bucket permissions
- Verify bucket exists
- Check network connectivity

### Issue: High memory usage
**Solution**:
- Check PM2 memory limits
- Review application logs
- Check for memory leaks
- Consider scaling horizontally

---

## 📊 Deployment Checklist Summary

| Category | Items | Status |
|----------|-------|--------|
| Code Quality | 6 | ✅ Ready |
| Environment Config | 8 | ⏳ Pending |
| Database Setup | 6 | ⏳ Pending |
| Infrastructure | 7 | ⏳ Pending |
| Redis Setup | 4 | ⏳ Pending |
| Storage Setup | 4 | ⏳ Pending |
| Monitoring | 6 | ⏳ Pending |
| **Total** | **41** | **7/41 Complete** |

---

## 🎯 Quick Start Deployment

### For Quick Testing

```bash
# 1. Prepare environment
cp env.production.template .env.production
# Edit .env.production with your values

# 2. Validate
npm run validate:production

# 3. Build
npm run deploy:build

# 4. Deploy (manual or automated)
# Follow deployment steps above
```

---

## 📝 Post-Deployment Monitoring

### Daily Checks
- [ ] Application uptime
- [ ] Error rates
- [ ] Response times
- [ ] Database performance
- [ ] Memory usage

### Weekly Checks
- [ ] Backup verification
- [ ] Security updates
- [ ] Performance optimization
- [ ] User feedback review

### Monthly Checks
- [ ] Full backup restoration test
- [ ] Security audit
- [ ] Performance review
- [ ] Capacity planning

---

## ✅ Deployment Readiness

**Code**: ✅ Ready  
**Tests**: ✅ Passing  
**Documentation**: ✅ Complete  
**Scripts**: ✅ Available  
**Infrastructure**: ⏳ Pending Configuration  
**Credentials**: ⏳ Pending Configuration  

**Overall Status**: **Ready for deployment once infrastructure and credentials are configured**

---

**Last Updated**: Current  
**Next Steps**: Configure infrastructure and credentials, then proceed with deployment


