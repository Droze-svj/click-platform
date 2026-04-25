# 📊 Monitoring URL Guide

## ✅ Recommended Monitoring URL

**Use this URL for monitoring services (UptimeRobot, Pingdom, etc.):**

```
https://click-platform.onrender.com/api/health
```

---

## Why This URL?

✅ **Lightweight** - Returns quickly, minimal server load  
✅ **Comprehensive** - Checks database, Redis, and all services  
✅ **Designed for Monitoring** - Built specifically for health checks  
✅ **Returns Status** - Shows if service is `ok` or `degraded`  
✅ **Fast Response** - Usually responds in < 1 second  

---

## Alternative URLs (Not Recommended for Monitoring)

### ❌ Don't Use These for Monitoring:

- `https://click-platform.onrender.com/` - Root endpoint (may not exist)
- `https://click-platform.onrender.com/api-docs` - Documentation (heavier)
- `https://click-platform.onrender.com/api/*` - Other endpoints (not designed for monitoring)

### ✅ Use Only:

- `https://click-platform.onrender.com/api/health` - **Best for monitoring**

---

## Setting Up UptimeRobot

### Step-by-Step:

1. **Go to:** https://uptimerobot.com/
2. **Sign up** (free account)
3. **Click:** "Add New Monitor"
4. **Configure:**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Click Platform
   - **URL:** `https://click-platform.onrender.com/api/health`
   - **Monitoring Interval:** 5 minutes
   - **Alert Contacts:** Add your email
5. **Click:** "Create Monitor"

### Why 5 Minutes?

- Render.com free tier spins down after **15 minutes** of inactivity
- Pinging every **5 minutes** keeps it awake
- Free tier on UptimeRobot allows up to 50 monitors

---

## Expected Response

When monitoring `https://click-platform.onrender.com/api/health`, you should see:

```json
{
  "status": "ok",
  "timestamp": "2025-12-31T13:57:31.920Z",
  "uptime": 1092.73,
  "responseTime": "277ms",
  "environment": "production",
  "version": "1.0.0",
  "integrations": {
    "sentry": {
      "enabled": true,
      "status": "configured"
    },
    "database": {
      "connected": true
    },
    "redis": {
      "enabled": true,
      "connected": true
    }
  }
}
```

### Success Criteria:

- ✅ HTTP Status: `200` or `503` (503 is OK if service is degraded but running)
- ✅ Response contains: `"status": "ok"` or `"status": "degraded"`
- ✅ Response time: < 5 seconds (usually < 1 second)

---

## Other Monitoring Services

### UptimeRobot (Recommended - Free)
- **URL:** `https://click-platform.onrender.com/api/health`
- **Interval:** 5 minutes
- **Free Tier:** 50 monitors

### Pingdom
- **URL:** `https://click-platform.onrender.com/api/health`
- **Interval:** 1-5 minutes
- **Free Tier:** 1 monitor

### StatusCake
- **URL:** `https://click-platform.onrender.com/api/health`
- **Interval:** 5 minutes
- **Free Tier:** 10 monitors

### Better Uptime
- **URL:** `https://click-platform.onrender.com/api/health`
- **Interval:** 1-5 minutes
- **Free Tier:** Available

---

## Monitoring Best Practices

### ✅ Do:
- Monitor `/api/health` endpoint
- Set interval to 5 minutes (keeps free tier awake)
- Set up email alerts for downtime
- Monitor during business hours (or 24/7 if needed)

### ❌ Don't:
- Monitor too frequently (< 1 minute) - wastes resources
- Monitor root URL or other endpoints
- Set up multiple monitors for the same URL (unnecessary)

---

## Alert Configuration

### Recommended Alerts:

1. **Service Down**
   - Alert when HTTP status is not 200/503
   - Alert when response time > 10 seconds
   - Alert when service is unreachable

2. **Service Degraded**
   - Alert when status is "degraded" for > 5 minutes
   - Alert when response time > 5 seconds consistently

3. **Recovery Alerts**
   - Alert when service comes back online
   - Alert when status changes from "degraded" to "ok"

---

## Quick Test

Test your monitoring URL:

```bash
curl https://click-platform.onrender.com/api/health
```

**Expected:** JSON response with `"status": "ok"`

---

## Summary

**Use this URL for all monitoring:**
```
https://click-platform.onrender.com/api/health
```

**Settings:**
- **Interval:** 5 minutes
- **Expected Status:** 200
- **Expected Response Time:** < 1 second
- **Alert On:** HTTP errors, timeouts, or status != 200

---

**That's it!** Set up your monitor with this URL and your service will stay awake! 🚀

