# ✅ Railway.app Deployment Checklist

## Pre-Deployment

- [ ] Railway.app account created (https://railway.app/)
- [ ] GitHub repository ready
- [ ] Free services configured:
  - [ ] MongoDB Atlas (M0 free tier)
  - [ ] Redis Cloud (30MB free tier)
  - [ ] AWS S3 (free tier)
  - [ ] Sentry (free tier)
- [ ] OAuth apps created (see OAUTH_APPS_SETUP_GUIDE.md)
- [ ] Environment variables prepared

## Railway Setup

- [ ] Sign in to Railway.app with GitHub
- [ ] Create new project
- [ ] Connect GitHub repository
- [ ] Verify build settings:
  - [ ] Build command: `npm install && cd client && npm install && npm run build`
  - [ ] Start command: `npm start`
- [ ] Add all environment variables (see RAILWAY_DEPLOYMENT_GUIDE.md)

## Environment Variables to Add

Copy from `.env.production` and add to Railway dashboard:

- [ ] NODE_ENV=production
- [ ] PORT=5001 (Railway sets this automatically, but good to have)
- [ ] FRONTEND_URL=https://your-app.railway.app
- [ ] APP_URL=https://your-app.railway.app
- [ ] MONGODB_URI=...
- [ ] REDIS_URL=...
- [ ] JWT_SECRET=...
- [ ] SESSION_SECRET=...
- [ ] AWS credentials
- [ ] OAuth credentials (all platforms)
- [ ] OPENAI_API_KEY=...
- [ ] SENTRY_DSN=...

## Deployment

- [ ] Initial deployment triggered
- [ ] Build successful (check logs)
- [ ] Application started successfully
- [ ] Health check passing: `https://your-app.railway.app/api/health`
- [ ] Frontend accessible: `https://your-app.railway.app`

## Post-Deployment

- [ ] Update OAuth callback URLs to Railway URL
- [ ] Test OAuth flows
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring alerts

## Verification

- [ ] Application is accessible
- [ ] API endpoints respond
- [ ] Database connected
- [ ] Redis connected
- [ ] File uploads work (S3)
- [ ] OAuth connections work
- [ ] Logs are visible in Railway dashboard

