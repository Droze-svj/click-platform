# 🚂 Railway.app Quick Start

**Get Click deployed to Railway.app in 10 minutes!**

---

## ⚡ Quick Steps

### 1. Sign Up (2 minutes)

1. Go to https://railway.app/
2. Click "Start a New Project"
3. Sign in with GitHub
4. Authorize Railway

### 2. Create Project (2 minutes)

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your Click repository
4. Railway auto-detects Node.js

### 3. Add Environment Variables (3 minutes)

Go to **Variables** tab and add these (copy from `.env.production`):

**Required**:
```
NODE_ENV=production
MONGODB_URI=your-mongodb-connection-string
REDIS_URL=your-redis-connection-string
JWT_SECRET=your-generated-secret
SESSION_SECRET=your-generated-secret
```

**OAuth** (add all you need):
```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
# ... etc
```

**Generate Secrets**:
```bash
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
```

### 4. Deploy (3 minutes)

1. Railway automatically starts deploying
2. Watch build logs
3. Wait for "Deployed" status
4. Visit your app: `https://your-app.railway.app`

### 5. Update OAuth Callbacks

Update callback URLs in your OAuth apps to:
```
https://your-app.railway.app/api/oauth/{platform}/callback
```

---

## ✅ Verification

1. **Health Check**: `https://your-app.railway.app/api/health`
2. **Frontend**: `https://your-app.railway.app`
3. **Logs**: Check Railway dashboard → Logs tab

---

## 🎯 That's It!

Your app is now live on Railway.app!

**Cost**: $0/month (free tier with $5 credit)

---

**Need help?** See `RAILWAY_DEPLOYMENT_GUIDE.md` for detailed instructions.


