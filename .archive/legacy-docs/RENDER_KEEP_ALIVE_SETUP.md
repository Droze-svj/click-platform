# 🔄 Render.com Free Tier - Keep Service Awake

## Problem

Render.com free tier **spins down** after 15 minutes of inactivity. This means:
- First request after sleep takes 30-60 seconds
- Bad user experience
- OAuth flows may timeout

## Solution: Keep Service Awake

### Option 1: UptimeRobot (Recommended - Free)

1. **Sign up**: https://uptimerobot.com/ (free)
2. **Add Monitor**:
   - Monitor Type: HTTP(s)
   - Friendly Name: Click Keep-Alive
   - URL: `https://your-app.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
3. **Save**
4. **Service stays awake** (pings every 5 minutes)

**Cost**: Free

### Option 2: Cron-Job.org (Free)

1. **Sign up**: https://cron-job.org/ (free)
2. **Create Cron Job**:
   - URL: `https://your-app.onrender.com/api/health`
   - Schedule: Every 5 minutes
3. **Service stays awake**

**Cost**: Free

### Option 3: Upgrade to Starter

1. **Go to Render dashboard**
2. **Upgrade service** to Starter ($7/month)
3. **Service always-on** (no spin-down)

**Cost**: $7/month

## Recommendation

**Use UptimeRobot** (free) to keep service awake. It's:
- ✅ Free
- ✅ Reliable
- ✅ Easy to set up
- ✅ No code changes needed

