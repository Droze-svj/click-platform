# 🚀 Production Preparation Guide

**Complete guide to preparing Click for production deployment**

---

## 📋 Pre-Deployment Checklist

### ✅ Environment Configuration

- [ ] `.env.production` file created and configured
- [ ] All required environment variables set
- [ ] JWT_SECRET generated (32+ characters)
- [ ] MongoDB connection string configured
- [ ] OAuth credentials configured for all platforms
- [ ] AWS S3 credentials configured (if using cloud storage)
- [ ] Redis URL configured (if using caching)
- [ ] Sentry DSN configured (for error tracking)
- [ ] Email SMTP configured (if using email features)

### ✅ Server Requirements

- [ ] Server provisioned (Ubuntu 20.04+ recommended)
- [ ] Node.js 18+ installed
- [ ] MongoDB installed and running
- [ ] Redis installed and running (optional)
- [ ] Nginx installed
- [ ] PM2 installed globally
- [ ] FFmpeg installed (for video processing)
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Domain DNS configured

### ✅ Security

- [ ] Firewall configured (ports 22, 80, 443)
- [ ] SSH key-based authentication enabled
- [ ] Strong passwords set for all services
- [ ] Database access restricted
- [ ] API rate limiting configured
- [ ] CORS configured correctly
- [ ] Security headers configured in Nginx

### ✅ Monitoring & Logging

- [ ] Sentry configured for error tracking
- [ ] PM2 monitoring enabled
- [ ] Log rotation configured
- [ ] Health check endpoints tested
- [ ] Uptime monitoring set up

### ✅ Backups

- [ ] Database backup strategy configured
- [ ] File backup strategy configured (S3 or local)
- [ ] Backup restoration tested
- [ ] Automated backup schedule set

---

## 🔧 Step-by-Step Preparation

### Step 1: Generate Required Secrets

```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Save to .env.production
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.production
```

### Step 2: Configure Environment Variables

```bash
# Copy template
cp env.production.template .env.production

# Edit with your values
nano .env.production
```

**Required Variables:**
```env
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com
MONGODB_URI=mongodb://localhost:27017/click
JWT_SECRET=<generated-secret-32-chars>
OPENAI_API_KEY=sk-your-openai-key
```

### Step 3: Validate Environment

```bash
# Validate production environment
npm run validate:production
```

### Step 4: Run Production Preparation Script

```bash
# Run full preparation
npm run prepare:production
```

This will:
- ✅ Validate environment variables
- ✅ Run tests
- ✅ Build frontend
- ✅ Run linting
- ✅ Check OAuth configuration
- ✅ Create deployment package

### Step 5: Test Build Locally

```bash
# Build frontend
cd client && npm run build && cd ..

# Test production build
NODE_ENV=production npm start
```

### Step 6: Create Deployment Package

```bash
# Create deployment package
npm run deploy:build
```

---

## 📦 Deployment Package Contents

The deployment package includes:
- ✅ Production-ready server code
- ✅ Built frontend (Next.js)
- ✅ PM2 configuration
- ✅ Nginx configuration template
- ✅ Deployment scripts
- ✅ Environment template

---

## 🚀 Production Deployment Steps

### On Production Server:

1. **Upload deployment package**
   ```bash
   scp deploy-*.tar.gz user@server:/var/www/
   ```

2. **Extract and setup**
   ```bash
   cd /var/www
   tar -xzf deploy-*.tar.gz
   cd deploy-*
   ```

3. **Configure environment**
   ```bash
   cp .env.production .env
   nano .env  # Edit with production values
   ```

4. **Install dependencies**
   ```bash
   npm ci --production
   cd client && npm ci && npm run build && cd ..
   ```

5. **Run migrations**
   ```bash
   npm run deploy:migrate
   ```

6. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

7. **Configure Nginx**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/click
   sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/
   sudo nano /etc/nginx/sites-available/click  # Update domain
   sudo nginx -t
   sudo systemctl reload nginx
   ```

8. **Setup SSL**
   ```bash
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

9. **Verify deployment**
   ```bash
   curl https://your-domain.com/api/health
   pm2 logs click-api
   ```

---

## 🔍 Post-Deployment Verification

### Health Checks

```bash
# API Health
curl https://your-domain.com/api/health

# Frontend
curl https://your-domain.com

# PM2 Status
pm2 list
pm2 logs click-api
```

### Test Critical Flows

- [ ] User registration
- [ ] User login
- [ ] OAuth connections (all platforms)
- [ ] Content creation
- [ ] Content scheduling
- [ ] Content publishing
- [ ] Analytics dashboard

---

## 📊 Monitoring Setup

### PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs click-api

# View metrics
pm2 status
```

### Sentry Monitoring

- Configure Sentry DSN in `.env.production`
- Verify errors are being tracked
- Set up alerts for critical errors

### Health Check Monitoring

- Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- Monitor `/api/health` endpoint
- Set up alerts for downtime

---

## 🔒 Security Hardening

### Server Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### Application Security

- ✅ Use HTTPS only
- ✅ Set secure cookies
- ✅ Enable CORS correctly
- ✅ Rate limit API endpoints
- ✅ Validate all inputs
- ✅ Use parameterized queries
- ✅ Sanitize user inputs

---

## 📝 Production Checklist Summary

Before going live, ensure:

1. ✅ All environment variables configured
2. ✅ Database migrations run
3. ✅ SSL certificate installed
4. ✅ Domain DNS configured
5. ✅ OAuth apps configured with production URLs
6. ✅ Monitoring set up
7. ✅ Backups configured
8. ✅ All tests passing
9. ✅ Health checks working
10. ✅ Error tracking configured

---

## 🆘 Troubleshooting

### Common Issues

**Server won't start:**
- Check MongoDB connection
- Verify environment variables
- Check PM2 logs: `pm2 logs click-api`

**Frontend not loading:**
- Verify Next.js build completed
- Check Nginx configuration
- Verify static file paths

**OAuth not working:**
- Verify callback URLs in OAuth apps
- Check environment variables
- Verify HTTPS is enabled

**Database connection errors:**
- Verify MongoDB is running
- Check connection string
- Verify network access

---

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/)

---

**Status**: Ready for production deployment after completing checklist.


