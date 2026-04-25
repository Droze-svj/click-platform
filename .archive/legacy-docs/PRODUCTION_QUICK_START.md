# ⚡ Production Quick Start

**Fast-track guide to get Click running in production**

---

## 🚀 Quick Setup (15 minutes)

### 1. Generate Secrets (1 min)

```bash
bash scripts/generate-production-secrets.sh
```

Copy the generated secrets to `.env.production`

### 2. Configure Environment (2 min)

```bash
cp env.production.template .env.production
nano .env.production
```

**Minimum required:**
```env
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com
MONGODB_URI=mongodb://localhost:27017/click
JWT_SECRET=<from-step-1>
OPENAI_API_KEY=sk-your-key
```

### 3. Validate (1 min)

```bash
npm run validate:production
```

### 4. Prepare Deployment (5 min)

```bash
npm run prepare:production
```

This runs:
- ✅ Environment validation
- ✅ Tests
- ✅ Frontend build
- ✅ Creates deployment package

### 5. Deploy to Server (5 min)

```bash
# On server
cd /var/www/click
tar -xzf deploy-*.tar.gz
cd deploy-*
cp .env.production .env
npm ci --production
cd client && npm ci && npm run build && cd ..
pm2 start ecosystem.config.js --env production
pm2 save
```

### 6. Configure Nginx (1 min)

```bash
sudo cp nginx.conf /etc/nginx/sites-available/click
sudo ln -s /etc/nginx/sites-available/click /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/click  # Update domain
sudo nginx -t && sudo systemctl reload nginx
```

### 7. Setup SSL (1 min)

```bash
sudo certbot --nginx -d your-domain.com
```

---

## ✅ Verify

```bash
# Health check
curl https://your-domain.com/api/health

# PM2 status
pm2 list
pm2 logs click-api
```

---

## 🎯 That's It!

Your production deployment is ready. See `PRODUCTION_PREPARATION_GUIDE.md` for detailed configuration.


