# 🔴 Redis Setup Guide

**Purpose**: Enable caching and background job queues for better performance

---

## 🎯 Choose Your Provider

### Option 1: Redis Cloud (Recommended - Easiest)
- ✅ **Free tier**: 30MB storage
- ✅ **No credit card** required
- ✅ **Managed service** (no setup needed)
- ✅ **5 minutes** to set up

### Option 2: Upstash Redis
- ✅ **Free tier**: 10,000 commands/day
- ✅ **Serverless** (pay per use)
- ✅ **No credit card** required
- ✅ **Good for low traffic**

### Option 3: Render.com Redis (Paid)
- ✅ **Integrated** with Render.com
- ⚠️ **$7/month** (no free tier)
- ✅ **Easiest** if you're already on Render

---

## 🚀 Option 1: Redis Cloud Setup (Recommended)

### Step 1: Create Account

1. **Sign up**: https://redis.com/try-free/
   - Free tier: **30MB storage**
   - No credit card required

2. **Verify your email**

3. **Complete account setup**

---

### Step 2: Create Database

1. **Go to**: https://redis.com/redis-enterprise-cloud/

2. **Click**: "New Subscription" or "Create Database"

3. **Choose**: **Free** tier

4. **Settings**:
   - **Name**: `click-platform-redis`
   - **Region**: Choose closest to you (e.g., `AWS / us-east-1`)
   - **Memory**: 30MB (free tier)
   - Click **Activate**

5. **Wait** for database to be created (1-2 minutes)

---

### Step 3: Get Connection String

1. **In your database**, click **"Connect"** or **"Configuration"**

2. **You'll see**:
   - **Public endpoint**: `redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345`
   - **Password**: `your-password-here` (or generate one)

3. **Connection string format**:
   ```
   redis://default:password@host:port
   ```

4. **Example**:
   ```
   redis://default:MyPassword123@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
   ```

---

### Step 4: Add to Render.com

1. **Go to**: Your Render.com dashboard → Your service → Environment

2. **Add this variable**:

   ```
   Variable Name: REDIS_URL
   Value: redis://default:MyPassword123@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
   (Replace with your actual connection string from Step 3)
   ```

3. **Save** and **Redeploy** your service

---

## 🚀 Option 2: Upstash Redis Setup

### Step 1: Create Account

1. **Sign up**: https://upstash.com/
   - Free tier: **10,000 commands/day**
   - No credit card required

2. **Verify your email**

---

### Step 2: Create Database

1. **Go to**: https://console.upstash.com/redis

2. **Click**: "Create Database"

3. **Settings**:
   - **Name**: `click-platform-redis`
   - **Type**: Regional (or Global for better performance)
   - **Region**: Choose closest to you
   - **Tier**: Free
   - Click **Create**

---

### Step 3: Get Connection String

1. **In your database**, go to **"Details"** tab

2. **You'll see**:
   - **Endpoint**: `usw1-xxxxx.upstash.io:6379`
   - **Password**: `your-password-here`

3. **Connection string**:
   ```
   redis://default:password@endpoint:port
   ```

4. **Example**:
   ```
   redis://default:MyPassword123@usw1-xxxxx.upstash.io:6379
   ```

---

### Step 4: Add to Render.com

Same as Redis Cloud - add `REDIS_URL` variable.

---

## 🚀 Option 3: Render.com Redis (Paid)

### Step 1: Create Redis Service

1. **In Render.com dashboard**, click **"New +"**

2. **Choose**: **"Redis"**

3. **Settings**:
   - **Name**: `click-platform-redis`
   - **Plan**: Starter ($7/month) or higher
   - **Region**: Same as your web service
   - Click **Create Redis**

4. **Wait** for Redis to be created

---

### Step 2: Get Connection String

1. **In your Redis service**, go to **"Info"** tab

2. **You'll see**:
   - **Internal Redis URL**: `redis://red-xxxxx:6379`
   - **External Redis URL**: `redis://red-xxxxx:6379` (if available)

3. **For same service**: Use internal URL
4. **For different service**: Use external URL

---

### Step 3: Add to Render.com

Add `REDIS_URL` to your web service environment variables.

---

## ✅ Verify Setup

After redeploying, check your logs. You should see:
```
✅ Redis cache initialized
Redis client connected
Redis client ready
```

Instead of:
```
Redis not configured, caching disabled (optional)
```

---

## 🧪 Test Redis Connection

### Option 1: Check Logs
- Look for "Redis client connected" in logs

### Option 2: Test Cache
- Make an API request
- Check if caching is working (faster response times)

### Option 3: Test Job Queue
- If you have background jobs, they should work now

---

## 📊 Monitoring

- **Redis Cloud**: https://redis.com/redis-enterprise-cloud/
- **Upstash**: https://console.upstash.com/
- **Render.com**: Your Redis service dashboard

---

## 🎯 What This Enables

- ✅ **Caching**: Faster API responses
- ✅ **Session storage**: Store user sessions
- ✅ **Background jobs**: Process tasks asynchronously
- ✅ **Rate limiting**: Control API usage
- ✅ **Real-time features**: Pub/sub for real-time updates

---

## 💰 Pricing Comparison

| Provider | Free Tier | Paid (per month) |
|----------|-----------|------------------|
| **Redis Cloud** | 30MB storage | $5+ for 100MB |
| **Upstash** | 10K commands/day | $0.20 per 100K commands |
| **Render.com** | None | $7 for 25MB |

**Recommendation**: Start with **Redis Cloud** (best free tier)

---

## 🔒 Security Notes

- **Never commit** Redis password to git
- **Store** connection string in Render.com environment variables only
- **Use SSL/TLS** if available (Redis Cloud supports it)
- **Restrict access** by IP if possible
- **Rotate passwords** periodically

---

## 🚀 Quick Start Recommendation

**For fastest setup**: Use **Redis Cloud**
1. Sign up (2 minutes)
2. Create database (1 minute)
3. Copy connection string (1 minute)
4. Add to Render.com (1 minute)
5. **Total: 5 minutes!**

---

## ⚙️ Advanced Configuration

### SSL/TLS Connection

If your Redis provider supports SSL:

```
REDIS_URL=rediss://default:password@host:port
(Note the 'rediss://' with double 's')
```

### Separate Host/Port/Password

If you prefer separate variables:

```
REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=MyPassword123
```

---

## ✅ Checklist

- [ ] Chose a Redis provider
- [ ] Created account
- [ ] Created database
- [ ] Copied connection string
- [ ] Added `REDIS_URL` to Render.com
- [ ] Redeployed service
- [ ] Verified in logs
- [ ] Tested caching/jobs

---

**Ready? Follow the steps above and add Redis to Render.com! 🚀**

