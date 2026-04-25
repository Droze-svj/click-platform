# Verify REDIS_URL in Render.com

## Quick Check

The workers are still connecting to localhost, which means `REDIS_URL` is either:
1. ❌ Not set in Render.com
2. ❌ Set but empty
3. ❌ Set incorrectly

## Step-by-Step Verification

### 1. Check if REDIS_URL Exists

1. Go to **Render.com Dashboard**
2. Click your service: **click-platform**
3. Go to **Environment** tab
4. **Search for** `REDIS_URL`
5. Check if it exists

### 2. If REDIS_URL Doesn't Exist

**Add it now:**
- **Key**: `REDIS_URL`
- **Value**: `redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560`
- **NO quotes, NO spaces**
- Click **Save Changes**

### 3. If REDIS_URL Exists

**Check the value:**
1. Click on `REDIS_URL` to edit it
2. Verify it matches exactly:
   ```
   redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
   ```
3. Common issues:
   - ❌ Has quotes: `"redis://..."`
   - ❌ Has spaces: ` redis://... ` or `redis://... `
   - ❌ Missing parts: `redis://host:port` (missing password)
   - ❌ Wrong password or host

### 4. Also Check NODE_ENV

Make sure `NODE_ENV` is set to `production`:
- **Key**: `NODE_ENV`
- **Value**: `production`
- This ensures strict validation is used

### 5. After Making Changes

1. **Save** all changes
2. Wait for **automatic redeploy** (or manually trigger it)
3. Check logs after deployment

## What to Look For in Logs

### ✅ Good Signs (REDIS_URL is set correctly):
```
🔍 getRedisConnection() called { hasRedisUrl: true, redisUrlLength: 150, ... }
✅ Using REDIS_URL for job queue connection (production)
🔗 Creating worker video-processing with connection: redis://default:****@redis-10560...
✅ Creating worker for video-processing with valid Redis connection
```

### ❌ Bad Signs (REDIS_URL is missing/wrong):
```
🔍 getRedisConnection() called { hasRedisUrl: false, redisUrlLength: 0, ... }
⚠️ REDIS_URL is REQUIRED in production/staging but is missing or empty.
⚠️ Skipping worker creation for video-processing - Redis not configured
```

### ❌ Still Bad (Workers connecting to localhost):
```
connect ECONNREFUSED 127.0.0.1:6379
```
This means workers are still being created with a localhost connection.

## If It Still Doesn't Work

1. **Delete and Re-add REDIS_URL**:
   - Delete `REDIS_URL` from Render.com
   - Save
   - Add it again with the exact value
   - Save

2. **Check for Typos**:
   - Copy the entire connection string from this guide
   - Paste it exactly into Render.com
   - No modifications

3. **Verify Redis Cloud**:
   - Check your Redis Cloud dashboard
   - Make sure the database is active
   - Copy the connection string from Redis Cloud if different

4. **Check Deployment**:
   - Make sure the latest code is deployed
   - Check if there's a deployment in progress
   - Wait for deployment to complete

## Expected Result

After fixing `REDIS_URL`, you should see:
- ✅ No more `connect ECONNREFUSED 127.0.0.1:6379` errors
- ✅ Workers connecting to Redis Cloud
- ✅ Background jobs processing correctly

