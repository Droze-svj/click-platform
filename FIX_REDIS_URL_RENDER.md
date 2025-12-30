# Fix Redis Connection in Render.com

## Problem

Workers are trying to connect to `127.0.0.1:6379` (localhost) instead of your Redis Cloud URL. This means `REDIS_URL` is either:
- Not set in Render.com
- Set but empty
- Set incorrectly

## Solution: Add REDIS_URL to Render.com

### Step 1: Get Your Redis Connection String

Your Redis Cloud connection string should be:
```
redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

### Step 2: Add to Render.com

1. Go to **Render.com Dashboard**
2. Click on your service: **click-platform**
3. Go to **Environment** tab
4. Scroll down to find `REDIS_URL` (or click "Add Environment Variable")
5. Set:
   - **Key**: `REDIS_URL`
   - **Value**: `redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560`
6. **IMPORTANT**: 
   - ✅ NO quotes around the value
   - ✅ NO extra spaces
   - ✅ Copy the entire string exactly as shown above
7. Click **Save Changes**

### Step 3: Redeploy

After saving, Render.com will automatically redeploy. Wait for the deployment to complete.

### Step 4: Verify

After redeployment, check the logs. You should see:
```
🔍 getRedisConnection() called { hasRedisUrl: true, redisUrlLength: 150, ... }
✅ Using REDIS_URL for job queue connection (production)
✅ Creating worker for video-processing with valid Redis connection
```

**You should NOT see**:
- ❌ `connect ECONNREFUSED 127.0.0.1:6379`
- ❌ `⚠️ REDIS_URL is REQUIRED in production/staging but is missing or empty`

## Common Mistakes

### ❌ Wrong: With Quotes
```
REDIS_URL="redis://default:password@host:port"
```

### ❌ Wrong: With Extra Spaces
```
REDIS_URL= redis://default:password@host:port 
```

### ❌ Wrong: Missing Parts
```
REDIS_URL=redis://host:port  (missing password)
```

### ✅ Correct: Exact String
```
REDIS_URL=redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

## If It Still Doesn't Work

1. **Check the exact value in Render.com**:
   - Go to Environment tab
   - Click on `REDIS_URL`
   - Verify it matches exactly (no quotes, no spaces)

2. **Check Redis Cloud**:
   - Make sure your Redis database is active
   - Verify the connection string in Redis Cloud dashboard

3. **Check logs after redeploy**:
   - Look for `🔍 getRedisConnection() called` message
   - Check what `hasRedisUrl` and `redisUrlLength` show

4. **Try removing and re-adding**:
   - Delete `REDIS_URL` from Render.com
   - Save
   - Add it again with the exact value
   - Save and redeploy

## Expected Behavior After Fix

✅ Workers will connect to Redis Cloud  
✅ No more `connect ECONNREFUSED 127.0.0.1:6379` errors  
✅ Background jobs will process correctly  
✅ Logs will show successful Redis connections  

