# 🚀 Production Deployment - Next Steps

Complete step-by-step guide to execute the production deployment.

---

## 📋 Step-by-Step Execution

### Step 1: Server Setup ⏱️ 10 minutes

**On your production server:**

```bash
# Run automated setup script
sudo bash scripts/setup-production.sh
```

**What it does:**
- Installs Node.js 18, PM2, MongoDB, Nginx, Certbot, FFmpeg
- Creates application user and directories
- Configures firewall
- Sets up log rotation

**Verify:**
```bash
node --version    # Should show v18.x
pm2 --version    # Should show PM2 version
mongod --version # Should show MongoDB version
nginx -v         # Should show Nginx version
```

---

### Step 2: Configure Environment Variables ⏱️ 5 minutes

**On your production server:**

```bash
cd /var/www/click

# Copy template
cp env.production.template .env.production

# Edit with your values
nano .env.production
```

**Minimum Required Variables:**
```env
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com
MONGODB_URI=mongodb://localhost:27017/click
JWT_SECRET=<generate with: openssl rand -base64 32>
```

**Validate:**
```bash
npm run validate:production
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
# Copy the output to JWT_SECRET in .env.production
```

---

### Step 3: Deploy Application ⏱️ 10 minutes

**Option A: Quick Deploy (Recommended)**
```bash
cd /var/www/click
sudo bash scripts/quick-deploy.sh
```

**Option B: Manual Deploy**
```bash
cd /var/www/click

# Pull latest code (if using git)
git pull origin main

# Install dependencies
npm ci --production
cd client && npm ci && npm run build && cd ..

# Run migrations
npm run deploy:migrate

# Create backup
npm run deploy:backup

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
```

**Verify:**
```bash
pm2 list
curl http://localhost:5001/api/health
```

---

### Step 4: Configure Nginx ⏱️ 5 minutes

```bash
# Copy Nginx config
sudo cp nginx.conf /etc/nginx/sites-available/click

# Edit domain name
sudo nano /etc/nginx/sites-available/click
# Replace 'your-domain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### Step 5: Setup SSL Certificate ⏱️ 5 minutes

```bash
# Automated SSL setup
sudo bash scripts/setup-ssl.sh

# Or manual:
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**Verify SSL:**
```bash
curl -I https://your-domain.com
# Should show HTTP/2 200
```

---

### Step 6: Setup Monitoring ⏱️ 5 minutes

```bash
# Automated monitoring setup
sudo bash scripts/setup-monitoring.sh
```

**What it sets up:**
- PM2 monitoring
- Log rotation
- Health check cron jobs
- Disk space monitoring
- Backup monitoring

---

### Step 7: Verify Deployment ⏱️ 2 minutes

```bash
# Run comprehensive verification
bash scripts/verify-deployment.sh
```

**Manual checks:**
```bash
# Health endpoint
curl http://localhost:5001/api/health

# PM2 status
pm2 list

# Application logs
pm2 logs click-api --lines 50

# Nginx status
sudo systemctl status nginx

# MongoDB status
sudo systemctl status mongod
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Application accessible at `https://your-domain.com`
- [ ] Health endpoint returns 200: `curl https://your-domain.com/api/health`
- [ ] SSL certificate valid (green lock in browser)
- [ ] Can register new user
- [ ] Can login
- [ ] PM2 processes running: `pm2 list`
- [ ] No errors in logs: `pm2 logs click-api --err`
- [ ] Database connected: Check health endpoint response
- [ ] Nginx serving correctly: Check access logs

---

## 🔧 Quick Commands Reference

### Application Management
```bash
pm2 list                    # List all processes
pm2 logs click-api          # View application logs
pm2 restart click-api       # Restart application
pm2 reload click-api        # Zero-downtime reload
pm2 monit                   # Real-time monitoring
pm2 stop click-api          # Stop application
pm2 delete click-api        # Remove from PM2
```

### Deployment
```bash
npm run deploy:quick        # Quick deployment
npm run deploy:migrate      # Run database migrations
npm run deploy:backup      # Create database backup
npm run deploy:verify      # Verify deployment
```

### Monitoring
```bash
pm2 logs click-api          # Application logs
tail -f /var/log/nginx/click-access.log  # Nginx access
tail -f /var/log/nginx/click-error.log   # Nginx errors
pm2 monit                   # PM2 monitoring dashboard
```

### Database
```bash
mongosh                     # MongoDB shell
npm run deploy:migrate     # Run migrations
npm run deploy:backup      # Create backup
```

### SSL
```bash
sudo certbot certificates   # List certificates
sudo certbot renew         # Renew certificates
sudo certbot renew --dry-run  # Test renewal
```

---

## 🚨 Troubleshooting

### Application won't start
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

### Database connection failed
```bash
# Check MongoDB
sudo systemctl status mongod
mongosh

# Test connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"
```

### Nginx 502 errors
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

### SSL certificate issues
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t
```

---

## 📊 Post-Deployment Monitoring

### Daily Checks
- [ ] Health endpoint responding
- [ ] No critical errors in logs
- [ ] Memory usage < 90%
- [ ] Disk space > 20%

### Weekly Checks
- [ ] Backups created successfully
- [ ] SSL certificate valid (auto-renews)
- [ ] Performance metrics normal
- [ ] Error rates acceptable

### Monthly Checks
- [ ] Security updates applied
- [ ] Dependencies updated (if needed)
- [ ] Backup restoration tested
- [ ] Performance review

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ Application accessible via HTTPS
✅ Health endpoint returns 200
✅ Users can register and login
✅ File uploads work
✅ OAuth connections work
✅ No critical errors in logs
✅ PM2 processes stable
✅ Database connected
✅ Monitoring active

---

## 📞 Support

If you encounter issues:

1. **Check logs first:**
   ```bash
   pm2 logs click-api
   sudo tail -f /var/log/nginx/click-error.log
   ```

2. **Run verification:**
   ```bash
   bash scripts/verify-deployment.sh
   ```

3. **Review documentation:**
   - `PRODUCTION_DEPLOYMENT.md` - Full guide
   - `DEPLOYMENT_CHECKLIST.md` - Checklist
   - `QUICK_START_PRODUCTION.md` - Quick reference

4. **Common solutions:**
   - Restart application: `pm2 restart click-api`
   - Restart Nginx: `sudo systemctl restart nginx`
   - Check environment: `npm run validate:production`
   - Rollback if needed: `bash scripts/rollback-deployment.sh`

---

**Ready to deploy! Follow the steps above in order.** 🚀



