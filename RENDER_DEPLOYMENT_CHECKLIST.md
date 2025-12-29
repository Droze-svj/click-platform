# ✅ Render.com Deployment Checklist

## Pre-Deployment

- [ ] Render.com account created (https://render.com/)
- [ ] GitHub repository ready
- [ ] Free services configured:
  - [ ] MongoDB Atlas (M0 free tier) OR Render PostgreSQL
  - [ ] Redis Cloud (30MB free tier)
  - [ ] AWS S3 (free tier)
  - [ ] Sentry (free tier)
- [ ] OAuth apps created (see OAUTH_APPS_SETUP_GUIDE.md)
- [ ] Environment variables prepared

## Render Setup

- [ ] Sign in to Render.com with GitHub
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Verify build settings:
  - [ ] Build command: `npm install && cd client && npm install && npm run build`
  - [ ] Start command: `npm start`
  - [ ] Health check path: `/api/health`
- [ ] Add all environment variables (see RENDER_DEPLOYMENT_GUIDE.md)

## Environment Variables to Add

Copy from `.env.production` and add to Render dashboard:

- [ ] NODE_ENV=production
- [ ] PORT=5001 (Render sets this automatically, but good to have)
- [ ] FRONTEND_URL=https://your-app.onrender.com
- [ ] APP_URL=https://your-app.onrender.com
- [ ] MONGODB_URI=...
- [ ] REDIS_URL=...
- [ ] JWT_SECRET=...
- [ ] SESSION_SECRET=...
- [ ] AWS credentials
- [ ] OAuth credentials (all platforms)
- [ ] OPENAI_API_KEY=...
- [ ] SENTRY_DSN=...

**Important**: Update all callback URLs to Render URL:
```
https://your-app.onrender.com/api/oauth/{platform}/callback
```

## Deployment

- [ ] Initial deployment triggered
- [ ] Build successful (check logs)
- [ ] Application started successfully
- [ ] Health check passing: `https://your-app.onrender.com/api/health`
- [ ] Frontend accessible: `https://your-app.onrender.com`

## Post-Deployment

- [ ] Update OAuth callback URLs to Render URL
- [ ] Test OAuth flows
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Set up keep-alive service (free tier - UptimeRobot)
- [ ] Configure monitoring alerts

## Free Tier Optimization

- [ ] Set up UptimeRobot to ping `/api/health` every 5 minutes
- [ ] This keeps service awake (prevents 15-min spin-down)
- [ ] Or upgrade to Starter ($7/month) for always-on

## Verification

- [ ] Application is accessible
- [ ] API endpoints respond
- [ ] Database connected
- [ ] Redis connected
- [ ] File uploads work (S3)
- [ ] OAuth connections work
- [ ] Logs are visible in Render dashboard
- [ ] Service stays awake (if using keep-alive)

