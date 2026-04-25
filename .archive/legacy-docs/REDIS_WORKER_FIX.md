# 🔴 Redis Worker Connection Fix

**Issue**: Workers connecting to localhost instead of cloud Redis

---

## 🔍 The Problem

Your logs show:
```
connect ECONNREFUSED 127.0.0.1:6379
```

This means workers are trying to connect to **localhost Redis** instead of your **cloud Redis**.

**Cause**: `REDIS_URL` environment variable is either:
1. Not set in Render.com
2. Not being read correctly
3. Service hasn't redeployed after adding it

---

## ✅ Quick Fix

### Step 1: Verify REDIS_URL in Render.com

1. **Go to**: Render.com → Your service → **Environment** tab
2. **Check**: `REDIS_URL` variable exists
3. **Value should be**:
   ```
   redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
   ```

**Important**:
- Variable name must be exactly: `REDIS_URL` (case-sensitive, no spaces)
- Value must be complete (no truncation)
- No quotes around the value

---

### Step 2: Force Redeploy

1. **Go to**: Render.com → Your service → **Manual Deploy** tab
2. **Click**: "Clear build cache & deploy"
3. **Wait** 2-5 minutes for deployment

---

### Step 3: Verify in Logs

After redeploying, check logs for:

**Should see:**
```
Using REDIS_URL for job queue connection
✅ Redis cache initialized
Redis client connected
Redis client ready
```

**Should NOT see:**
```
connect ECONNREFUSED 127.0.0.1:6379
Redis connection timeout
```

---

## 🔍 Debug Steps

### Check if REDIS_URL is Set

**In Render.com logs, look for:**
- `Using REDIS_URL for job queue connection` (good - variable is set)
- `REDIS_URL not set, using localhost fallback` (bad - variable not set)

---

### Verify Variable Format

**Correct format:**
```
REDIS_URL=redis://default:password@host:port
```

**Your exact value:**
```
REDIS_URL=redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

**Common mistakes:**
- ❌ `REDIS_URL ` (trailing space)
- ❌ `redis_url` (lowercase)
- ❌ `"redis://..."` (quotes)
- ❌ Value truncated

---

## 🚀 Most Likely Fix

**The `REDIS_URL` variable is not set in Render.com yet.**

1. **Go to**: Render.com → Your service → Environment
2. **Add**: `REDIS_URL` with your connection string
3. **Save** and **redeploy**
4. **Check logs** - should see workers connecting to cloud Redis

---

## ✅ Checklist

- [ ] `REDIS_URL` variable exists in Render.com
- [ ] Variable name is exact: `REDIS_URL` (case-sensitive)
- [ ] Value is complete connection string
- [ ] No spaces or quotes
- [ ] Service redeployed after adding
- [ ] Logs show "Using REDIS_URL for job queue connection"
- [ ] No more "connect ECONNREFUSED 127.0.0.1:6379" errors

---

## 🎯 Expected Behavior After Fix

**Workers should connect to:**
```
redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

**NOT:**
```
127.0.0.1:6379 (localhost)
```

---

**Add REDIS_URL to Render.com and redeploy! 🚀**

