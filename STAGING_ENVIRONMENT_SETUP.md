# 🎭 Staging Environment Setup Guide

This guide will help you set up a staging environment for Click that mirrors production but uses separate resources.

---

## 📋 Overview

**Staging Environment Purpose:**
- Test new features before production
- Verify deployments without affecting production
- Test OAuth integrations safely
- Validate database migrations
- Test performance and scalability

**Key Differences from Production:**
- Separate database (click-staging)
- Different port (5002 vs 5001)
- Staging domain (staging.your-domain.com)
- Separate OAuth apps (test credentials)
- More lenient rate limiting
- Debug logging enabled

---

## 🚀 Quick Start

### 1. Initial Setup

```bash
# Run the staging setup script
npm run setup:staging
```

This will:
- Create `.env.staging` from template
- Install dependencies
- Create staging directories
- Build frontend
- Create PM2 staging config

### 2. Configure Environment

Edit `.env.staging` with your staging values:

```bash
# Edit the staging environment file
nano .env.staging
# or
code .env.staging
```

**Key values to set:**
- `MONGODB_URI` - Staging database connection
- `FRONTEND_URL` - Staging frontend URL
- `JWT_SECRET` - Different from production
- OAuth credentials for staging apps
- `SENTRY_DSN` - Staging Sentry project

### 3. Start Staging Environment

**Option A: Direct Node.js**
```bash
npm run start:staging
```

**Option B: PM2**
```bash
pm2 start ecosystem.staging.config.js --env staging
pm2 logs click-api-staging
```

**Option C: Docker Compose**
```bash
npm run docker:staging
# or
docker-compose -f docker-compose.staging.yml up -d
```

---

## 📁 File Structure

```
.
├── .env.staging                    # Staging environment variables
├── env.staging.template            # Template for staging env
├── ecosystem.staging.config.js    # PM2 config for staging
├── docker-compose.staging.yml     # Docker Compose for staging
├── scripts/
│   ├── setup-staging.sh           # Initial setup script
│   ├── deploy-staging.sh          # Deployment script
│   └── validate-staging-env.js    # Environment validation
└── logs/
    └── staging/                   # Staging logs
```

---

## 🔧 Configuration

### Database Setup

**MongoDB Atlas (Recommended):**
1. Create a new cluster for staging
2. Create database: `click-staging`
3. Add connection string to `.env.staging`

**Local MongoDB:**
```bash
# Create staging database
mongosh
use click-staging
db.createCollection('users')
```

### Redis Setup

**Local Redis:**
```bash
# Use different database index
REDIS_URL=redis://localhost:6379/1
```

**Redis Cloud:**
- Create separate staging instance
- Use staging connection string

### OAuth Apps Setup

For each platform, create separate staging/test apps:

**Twitter/X:**
- Create test app in Twitter Developer Portal
- Use staging callback URL: `https://staging.your-domain.com/api/oauth/twitter/callback`

**LinkedIn:**
- Create test app in LinkedIn Developer Portal
- Use staging callback URL: `https://staging.your-domain.com/api/oauth/linkedin/callback`

**Facebook:**
- Create test app in Facebook Developer Portal
- Use staging callback URL: `https://staging.your-domain.com/api/oauth/facebook/callback`

**Instagram:**
- Uses Facebook app (same as above)

**YouTube:**
- Create test OAuth app in Google Cloud Console
- Use staging callback URL: `https://staging.your-domain.com/api/oauth/youtube/callback`

**TikTok:**
- Create test app in TikTok Developer Portal
- Use staging callback URL: `https://staging.your-domain.com/api/oauth/tiktok/callback`

### Domain & SSL

**Staging Domain:**
- Set up subdomain: `staging.your-domain.com`
- Point DNS to staging server
- Obtain SSL certificate (Let's Encrypt recommended)

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl;
    server_name staging.your-domain.com;

    ssl_certificate /path/to/staging/cert.pem;
    ssl_certificate_key /path/to/staging/key.pem;

    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🧪 Testing

### Validate Environment

```bash
# Validate staging environment variables
node scripts/validate-staging-env.js
```

### Health Check

```bash
# Check if staging is running
curl http://localhost:5002/api/health

# Expected response:
# {"status":"ok","environment":"staging","timestamp":"..."}
```

### Test OAuth Flows

```bash
# Test OAuth integrations
npm run test:integrations
```

### Run E2E Tests Against Staging

```bash
# Set staging URL
export STAGING_URL=http://localhost:5002

# Run E2E tests
npm run test:e2e
```

---

## 📦 Deployment

### Deploy to Staging Server

```bash
# Create deployment package
npm run deploy:staging

# This creates: deploy-staging-YYYYMMDD-HHMMSS.tar.gz

# Upload to staging server
scp deploy-staging-*.tar.gz user@staging-server:/path/to/deploy/

# On staging server:
tar -xzf deploy-staging-*.tar.gz
cd deploy-staging-*
bash deploy.sh
```

### Update Staging

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
npm run deploy:staging
pm2 reload click-api-staging
```

---

## 🔍 Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs click-api-staging

# Monitor resources
pm2 monit

# View status
pm2 status
```

### Application Logs

```bash
# View staging logs
tail -f logs/staging/pm2-combined.log

# View error logs
tail -f logs/staging/pm2-error.log
```

### Sentry (Staging Project)

- Create separate Sentry project for staging
- Set `SENTRY_DSN` in `.env.staging`
- Set `SENTRY_ENVIRONMENT=staging`
- Monitor staging errors separately

---

## 🗄️ Database Management

### Run Migrations

```bash
# Run migrations on staging
NODE_ENV=staging npm run deploy:migrate
```

### Backup Staging Database

```bash
# Backup staging database
NODE_ENV=staging npm run deploy:backup
```

### Seed Test Data

```bash
# Seed staging with test data (if needed)
NODE_ENV=staging node scripts/seed-test-data.js
```

---

## 🐳 Docker Setup

### Start Staging with Docker

```bash
# Start all services
npm run docker:staging

# Or manually
docker-compose -f docker-compose.staging.yml up -d
```

### Stop Staging

```bash
# Stop all services
npm run docker:staging:down

# Or manually
docker-compose -f docker-compose.staging.yml down
```

### View Logs

```bash
# View all logs
docker-compose -f docker-compose.staging.yml logs -f

# View specific service
docker-compose -f docker-compose.staging.yml logs -f app
```

---

## 🔐 Security Considerations

### Staging Security

1. **Separate Credentials**: Use different credentials from production
2. **Access Control**: Limit who can access staging
3. **Data Privacy**: Don't use real user data in staging
4. **Rate Limiting**: More lenient but still present
5. **SSL**: Use HTTPS even in staging
6. **Firewall**: Restrict access to staging server

### Environment Variables

- Never commit `.env.staging` to git
- Use different secrets from production
- Rotate secrets regularly
- Use environment-specific OAuth apps

---

## 🧹 Cleanup

### Reset Staging Database

```bash
# Drop and recreate staging database
mongosh
use click-staging
db.dropDatabase()
```

### Clear Staging Logs

```bash
# Clear old logs
rm -rf logs/staging/*
```

### Stop Staging Services

```bash
# Stop PM2
pm2 stop click-api-staging
pm2 delete click-api-staging

# Or stop Docker
npm run docker:staging:down
```

---

## 📊 Staging vs Production

| Feature | Staging | Production |
|---------|---------|------------|
| Port | 5002 | 5001 |
| Database | click-staging | click |
| Domain | staging.your-domain.com | your-domain.com |
| Logging | Debug | Info |
| Rate Limiting | 200 req/15min | 100 req/15min |
| Monitoring | Separate Sentry project | Production Sentry |
| OAuth Apps | Test apps | Production apps |
| SSL | Staging certificate | Production certificate |

---

## ✅ Checklist

Before using staging:

- [ ] `.env.staging` configured
- [ ] Staging database created
- [ ] Redis configured (optional)
- [ ] Staging domain configured
- [ ] SSL certificate installed
- [ ] OAuth apps configured for staging
- [ ] AWS S3 staging bucket (if using)
- [ ] Sentry staging project configured
- [ ] PM2 or Docker configured
- [ ] Health check passing
- [ ] OAuth flows tested
- [ ] E2E tests passing

---

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 5002
lsof -i :5002

# Kill process if needed
kill -9 <PID>
```

### Database Connection Failed

```bash
# Test MongoDB connection
mongosh "mongodb://localhost:27017/click-staging"

# Check MongoDB is running
systemctl status mongod
```

### OAuth Callback Errors

- Verify callback URLs match in OAuth apps
- Check staging domain is accessible
- Verify SSL certificate is valid

### PM2 Not Starting

```bash
# Check PM2 logs
pm2 logs click-api-staging --lines 50

# Restart PM2
pm2 restart click-api-staging
```

---

## 📚 Additional Resources

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [OAuth Setup Guide](./docs/OAUTH_SETUP.md)
- [Environment Variables](./env.staging.template)

---

**Staging is ready when:**
- ✅ Health check returns 200
- ✅ All OAuth flows work
- ✅ Database connections work
- ✅ Logs show no errors
- ✅ E2E tests pass

Happy testing! 🎭


