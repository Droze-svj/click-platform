# 🔧 Add Missing Environment Variables to Render.com

## Step-by-Step Guide

### Step 1: Go to Render.com Dashboard
1. Open https://dashboard.render.com/
2. Click on your **web service** (click-platform)
3. Click the **Environment** tab

---

## 🔴 Required Variables (Must Add)

### 1. NODE_ENV
**Variable Name:** `NODE_ENV`  
**Value:** `production`

**How to add:**
- Click **Add Environment Variable**
- Key: `NODE_ENV`
- Value: `production`
- Click **Save Changes**

---

### 2. MONGODB_URI
**Variable Name:** `MONGODB_URI`  
**Value:** Your MongoDB Atlas connection string

**Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/click?retryWrites=true&w=majority
```

**How to get it:**
1. Go to MongoDB Atlas → Your cluster
2. Click **Connect** → **Connect your application**
3. Copy the connection string
4. Replace `<password>` with your actual password
5. Replace `<dbname>` with `click` (or your database name)

**Example:**
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/click?retryWrites=true&w=majority
```

**How to add:**
- Click **Add Environment Variable**
- Key: `MONGODB_URI`
- Value: Paste your connection string (no quotes)
- Click **Save Changes**

---

### 3. JWT_SECRET
**Variable Name:** `JWT_SECRET`  
**Value:** A secure random string (at least 32 characters)

**How to generate:**
Run this command in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use this online generator: https://randomkeygen.com/

**Example value:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**How to add:**
- Click **Add Environment Variable**
- Key: `JWT_SECRET`
- Value: Paste the generated secret (no quotes, no spaces)
- Click **Save Changes**

---

## ✅ Already Configured (Verify These Exist)

### SendGrid
- `SENDGRID_API_KEY` ✅
- `SENDGRID_FROM_EMAIL` ✅
- `SENDGRID_FROM_NAME` ✅

### Cloudinary
- `CLOUDINARY_CLOUD_NAME` ✅
- `CLOUDINARY_API_KEY` ✅
- `CLOUDINARY_API_SECRET` ✅

### YouTube OAuth
- `YOUTUBE_CLIENT_ID` ✅
- `YOUTUBE_CLIENT_SECRET` ✅
- `YOUTUBE_CALLBACK_URL` ✅

---

## ⏳ Add This One (Redis)

### REDIS_URL
**Variable Name:** `REDIS_URL`  
**Value:** Your Redis connection string

**Your Redis connection string:**
```
redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

**How to add:**
- Click **Add Environment Variable**
- Key: `REDIS_URL`
- Value: `redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560`
- Click **Save Changes**

**Important:**
- No quotes around the value
- No spaces before or after
- Copy exactly as shown above

---

## 📋 Quick Checklist

Add these 4 variables to Render.com:

- [ ] `NODE_ENV` = `production`
- [ ] `MONGODB_URI` = Your MongoDB Atlas connection string
- [ ] `JWT_SECRET` = Generated secure random string (32+ characters)
- [ ] `REDIS_URL` = `redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560`

---

## 🚀 After Adding Variables

1. **Save all changes** in Render.com
2. **Wait for automatic redeploy** (or trigger manual deploy)
3. **Check logs** - you should see:
   ```
   ✅ Environment variables validated
   ✅ MongoDB connected
   ✅ Email service initialized (SendGrid)
   ✅ Cloud storage (Cloudinary) configured
   ✅ Redis cache initialized
   🚀 Server running on port 5001
   ```

---

## ⚠️ Common Mistakes

### ❌ Wrong Variable Names
- `NODE_ENV ` (trailing space)
- `node_env` (lowercase)
- `MONGODB-URI` (hyphen instead of underscore)

### ✅ Correct Variable Names
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `REDIS_URL`

### ❌ Wrong Values
- `"production"` (with quotes)
- `production ` (trailing space)
- `MONGODB_URI = mongodb://...` (with spaces around =)

### ✅ Correct Values
- `production` (no quotes, no spaces)
- `mongodb+srv://...` (no quotes, no spaces)

---

## 🔍 Verify Variables

After adding, check:
1. Variable names are exact (case-sensitive)
2. No quotes around values
3. No trailing spaces
4. MongoDB URI is complete
5. JWT_SECRET is at least 32 characters

---

## 📞 Need Help?

If you're missing your MongoDB connection string:
1. Go to MongoDB Atlas
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Copy the connection string
5. Replace `<password>` and `<dbname>`

If you need to generate a new JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

**After adding all variables, your server should start successfully! 🎉**

