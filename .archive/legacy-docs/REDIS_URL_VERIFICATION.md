# Redis URL Verification Guide

## Current Issue
Workers are trying to connect to `127.0.0.1:6379` (localhost) instead of your cloud Redis.

## Root Cause
`REDIS_URL` is either:
- Not set in Render.com
- Set but empty/invalid
- Not properly formatted

## Solution: Add REDIS_URL to Render.com

### Step 1: Get Your Redis Connection String
Your Redis connection string should be:
```
redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

### Step 2: Add to Render.com
1. Go to **Render.com Dashboard**
2. Click on your **service** (click-platform)
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add:
   - **Key**: `REDIS_URL`
   - **Value**: `redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560`
6. Click **Save Changes**
7. Wait for **automatic redeploy** (or trigger manual deploy)

### Step 3: Verify After Deployment
After deployment, check logs. You should see:

**✅ Success:**
```
Using REDIS_URL for job queue connection
✅ All workers initialized successfully
```

**❌ Still failing:**
```
⚠️ Redis not configured for job queues. Workers will be disabled.
```

## Common Issues

### Issue 1: Empty REDIS_URL
- **Symptom**: Variable exists but is empty
- **Fix**: Delete and recreate the variable with the correct value

### Issue 2: Wrong Variable Name
- **Symptom**: Using `REDIS_HOST` instead of `REDIS_URL`
- **Fix**: Use `REDIS_URL` (full connection string)

### Issue 3: Missing Quotes
- **Symptom**: Render.com might add quotes automatically
- **Fix**: Don't add quotes - just paste the connection string directly

### Issue 4: Deployment Not Triggered
- **Symptom**: Changes saved but no redeploy
- **Fix**: Go to **Manual Deploy** → **Deploy latest commit**

## Verification Checklist

- [ ] `REDIS_URL` is set in Render.com
- [ ] Value starts with `redis://`
- [ ] Value is not empty
- [ ] Service has been redeployed after adding variable
- [ ] Logs show "Using REDIS_URL for job queue connection"
- [ ] No more `ECONNREFUSED 127.0.0.1:6379` errors

## Expected Logs After Fix

```
{"level":"info","message":"Using REDIS_URL for job queue connection","service":"click"}
{"level":"info","message":"🚀 Initializing all job queue workers...","service":"click"}
{"level":"info","message":"✅ All workers initialized successfully","service":"click"}
```

## Still Having Issues?

1. **Check Render.com logs** for the exact error
2. **Verify REDIS_URL format** - must start with `redis://`
3. **Check Redis Cloud** - ensure your Redis instance is running
4. **Test connection** - try connecting from your local machine to verify the URL works

