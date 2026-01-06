# 🚀 Render.com Backend Deployment - Quick Start

## Immediate Deployment Steps

### 1. Create Render Account & Service
1. Go to https://render.com/
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure service:
   - **Name**: `click-platform-backend`
   - **Environment**: `Node`
   - **Region**: `Oregon` (or your preferred region)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2. Add Environment Variables
In Render dashboard → Service Settings → Environment, add:

```bash
# Server Configuration
NODE_ENV=production
PORT=5001

# URLs (update with your Render URL after deployment)
FRONTEND_URL=https://click-platform-etcdqdbfx-knights-projects-700666a6.vercel.app
APP_URL=https://your-render-service.onrender.com

# Supabase Database (already configured)
SUPABASE_URL=https://cylfimsyfnodvgrzulof.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bGZpbXN5Zm5vZHZncnp1bG9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ2ODc0MCwiZXhwIjoyMDgzMDQ0NzQwfQ.1yGhK6OUMUkVZx9cdoIilB98ynGBk02q5AVsxbGj4zM
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bGZpbXN5Zm5vZHZncnp1bG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Njg3NDAsImV4cCI6MjA4MzA0NDc0MH0.X-UDaV1zswaDZFvQ1zfBnzAa8EQs9yoe_-loLVZ3w9Y

# Security
JWT_SECRET=MPyQ5XhIelQs/KKfUY2yjMsuUdDnKtOKLaXqGx94eBs=
JWT_EXPIRES_IN=7d
SESSION_SECRET=5VIQqR8avDiN1F4i54IVNEhxMOX5BynH1BKFMhojMvs=

# Optional Services (add if you have them)
# MONGODB_URI=mongodb+srv://...
# REDIS_URL=redis://...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=...
# OPENAI_API_KEY=...
# SENTRY_DSN=...
```

### 3. Deploy & Verify
1. **Click "Create Web Service"**
2. **Wait for deployment** (usually 5-10 minutes)
3. **Check the URL** provided by Render (e.g., `https://click-platform-backend.onrender.com`)
4. **Verify health check**: Visit `https://your-service.onrender.com/api/health`

### 4. Update Frontend
Once backend is deployed, update Vercel environment variables:

```bash
NEXT_PUBLIC_BACKEND_URL=https://your-render-service.onrender.com/api
```

## Free Tier Considerations

### Keep Service Awake (Important!)
Render's free tier spins down after 15 minutes of inactivity. To keep your service awake:

1. **Set up UptimeRobot** (free):
   - Go to https://uptimerobot.com/
   - Add new monitor
   - URL: `https://your-render-service.onrender.com/api/health`
   - Monitoring interval: 5 minutes

2. **Or use Cron-job.org** (free):
   - Go to https://cron-job.org/
   - Create new cron job
   - URL: `https://your-render-service.onrender.com/api/health`
   - Schedule: Every 10 minutes

### Free Tier Limits
- 750 hours/month (about 31 days)
- 512 MB RAM
- 0.1 CPU
- Community support only

## Troubleshooting

### Build Failures
- Check Render build logs
- Ensure all dependencies are in package.json
- Verify environment variables are correct

### Runtime Errors
- Check Render service logs
- Verify database connections
- Test API endpoints manually

### Health Check Issues
- Ensure `/api/health` endpoint exists
- Check if service is spinning down (use uptime monitor)

---

**Ready to deploy?** Follow the 4 steps above and your backend will be live! 🚀
