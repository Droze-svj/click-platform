# 🚀 Production Deployment Guide

Complete guide for deploying Click to production.

---

## 📋 Prerequisites

- Ubuntu 20.04+ or similar Linux server
- Domain name configured
- SSH access to server
- MongoDB database (local or Atlas)
- AWS account (for S3 storage, optional)
- GitHub repository access

---

## 🛠️ Server Setup

### 1. Run Setup Script

On your production server:

```bash
sudo bash scripts/setup-production.sh
```

This will install:
- Node.js 18
- PM2 (process manager)
- MongoDB
- Nginx
- Certbot (SSL)
- FFmpeg
- Redis (optional)

### 2. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install MongoDB
# Follow: https://www.mongodb.com/docs/manual/installation/

# Install Nginx
sudo apt-get install -y nginx

# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx
```

---

## 📦 Application Deployment

### Option 1: Automated Deployment (GitHub Actions)

1. **Configure GitHub Secrets:**
   - `SSH_PRIVATE_KEY` - Private key for server access
   - `SSH_USER` - SSH username (usually `deploy`)
   - `SSH_HOST` - Server IP or domain
   - `PRODUCTION_DOMAIN` - Your domain name
   - `SLACK_WEBHOOK_URL` - For notifications (optional)

2. **Push to main branch:**
   ```bash
   git push origin main
   ```

3. **Deployment will automatically:**
   - Run tests
   - Build Docker image
   - Deploy to server
   - Run migrations
   - Restart application

### Option 2: Manual Deployment

1. **Clone repository on server:**
   ```bash
   cd /var/www/click
   git clone https://github.com/your-org/click.git .
   ```

2. **Install dependencies:**
   ```bash
   npm ci --production
   cd client && npm ci && npm run build && cd ..
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.production
   nano .env.production
   ```

4. **Run migrations:**
   ```bash
   node scripts/migrate-database.js
   ```

5. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

---

## 🔐 Environment Variables

Create `.env.production` with:

```env
# Server
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com

# Database
MONGODB_URI=mongodb://localhost:27017/click
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/click

# Security
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=30d

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# OAuth
TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-secret
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-secret
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-secret

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## 🌐 Nginx Configuration

1. **Copy Nginx config:**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/click
   sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/
   ```

2. **Update domain name:**
   ```bash
   sudo nano /etc/nginx/sites-available/click
   # Replace 'your-domain.com' with your actual domain
   ```

3. **Test configuration:**
   ```bash
   sudo nginx -t
   ```

4. **Reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

---

## 🔒 SSL Certificate

1. **Obtain SSL certificate:**
   ```bash
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

2. **Auto-renewal (already configured):**
   Certbot sets up automatic renewal. Test with:
   ```bash
   sudo certbot renew --dry-run
   ```

---

## 📊 PM2 Configuration

1. **Start application:**
   ```bash
   cd /var/www/click
   pm2 start ecosystem.config.js --env production
   ```

2. **Save PM2 configuration:**
   ```bash
   pm2 save
   ```

3. **Setup startup script:**
   ```bash
   pm2 startup
   # Follow the instructions shown
   ```

4. **PM2 Commands:**
   ```bash
   pm2 list              # List all processes
   pm2 logs click-api    # View logs
   pm2 restart click-api # Restart application
   pm2 stop click-api    # Stop application
   pm2 reload click-api  # Zero-downtime reload
   ```

---

## 🗄️ Database Setup

### Local MongoDB

1. **Start MongoDB:**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

2. **Create database:**
   ```bash
   mongosh
   use click
   ```

### MongoDB Atlas (Cloud)

1. Create cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Add to `MONGODB_URI` in `.env.production`
4. Whitelist server IP in Atlas

---

## 💾 Backup Setup

### Automated Backups

1. **Add to crontab:**
   ```bash
   crontab -e
   ```

2. **Add daily backup:**
   ```bash
   0 2 * * * cd /var/www/click && node scripts/backup-database.js
   0 3 * * * find /var/www/click/backups -name "*.gz" -mtime +7 -delete
   ```

### Manual Backup

```bash
cd /var/www/click
node scripts/backup-database.js
```

### Restore Backup

```bash
mongorestore --uri="mongodb://localhost:27017/click" --archive=backups/backup-2024-01-01.gz --gzip
```

---

## 🔄 Deployment Process

### Standard Deployment

1. **Pull latest code:**
   ```bash
   cd /var/www/click
   git pull origin main
   ```

2. **Install dependencies:**
   ```bash
   npm ci --production
   cd client && npm ci && npm run build && cd ..
   ```

3. **Run migrations:**
   ```bash
   node scripts/migrate-database.js
   ```

4. **Create backup:**
   ```bash
   node scripts/backup-database.js
   ```

5. **Reload application:**
   ```bash
   pm2 reload ecosystem.config.js --env production
   ```

### Rollback

If something goes wrong:

```bash
bash scripts/rollback-deployment.sh
```

---

## 📈 Monitoring

### Health Checks

1. **Application health:**
   ```bash
   curl http://localhost:5001/api/health
   ```

2. **PM2 monitoring:**
   ```bash
   pm2 monit
   ```

### Logs

1. **Application logs:**
   ```bash
   pm2 logs click-api
   tail -f /var/www/click/logs/pm2-out.log
   ```

2. **Nginx logs:**
   ```bash
   tail -f /var/log/nginx/click-access.log
   tail -f /var/log/nginx/click-error.log
   ```

### Sentry

Configure Sentry DSN in `.env.production` for error tracking.

---

## ✅ Pre-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations tested
- [ ] SSL certificate installed
- [ ] Nginx configured and tested
- [ ] PM2 configured with startup script
- [ ] Backups configured
- [ ] Monitoring set up (Sentry, etc.)
- [ ] Firewall configured
- [ ] Log rotation configured
- [ ] Health checks passing
- [ ] All tests passing
- [ ] Documentation updated

---

## 🔧 Troubleshooting

### Application won't start

1. Check logs:
   ```bash
   pm2 logs click-api --err
   ```

2. Check environment variables:
   ```bash
   pm2 env 0
   ```

3. Test database connection:
   ```bash
   node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"
   ```

### High memory usage

1. Check PM2 memory:
   ```bash
   pm2 monit
   ```

2. Restart if needed:
   ```bash
   pm2 restart click-api
   ```

### Nginx 502 errors

1. Check if application is running:
   ```bash
   pm2 list
   ```

2. Check Nginx error logs:
   ```bash
   tail -f /var/log/nginx/click-error.log
   ```

3. Check application logs:
   ```bash
   pm2 logs click-api
   ```

---

## 🚨 Emergency Procedures

### Application Down

1. **Check status:**
   ```bash
   pm2 status
   ```

2. **Restart:**
   ```bash
   pm2 restart all
   ```

3. **If still down, check logs:**
   ```bash
   pm2 logs --err
   ```

### Database Issues

1. **Check MongoDB:**
   ```bash
   sudo systemctl status mongod
   ```

2. **Restart MongoDB:**
   ```bash
   sudo systemctl restart mongod
   ```

3. **Check connection:**
   ```bash
   mongosh
   ```

### Rollback

If deployment causes issues:

```bash
bash scripts/rollback-deployment.sh
```

---

## 📞 Support

For issues:
1. Check logs first
2. Review this documentation
3. Check GitHub Issues
4. Contact support

---

## 🎯 Post-Deployment

After successful deployment:

1. ✅ Verify health endpoint
2. ✅ Test authentication
3. ✅ Test file uploads
4. ✅ Test OAuth connections
5. ✅ Monitor error rates
6. ✅ Check performance metrics
7. ✅ Verify backups are running

---

**Ready for production!** 🚀



