# 🆓 Free Deployment Guide - Render.com

**Deploy Click for FREE in 15 minutes**

---

## 🎯 Why Render.com for Free Deployment?

✅ **750 hours/month** (enough for 24/7)  
✅ **No credit card required**  
✅ **Free SSL/HTTPS**  
✅ **Custom domain support**  
✅ **Automatic deployments**  
✅ **Perfect for Click**  

**Limitation**: Sleeps after 15 min inactivity (wakes on request, ~30 sec delay)

---

## 📋 Prerequisites (All Free)

- [ ] GitHub account (free)
- [ ] Render.com account (free)
- [x] MongoDB Atlas account ✅ **You already have this!**
- [ ] Your code pushed to GitHub

**Total Cost**: $0/month

---

## 🚀 Step-by-Step Deployment

### Step 1: Get Your MongoDB Atlas Connection String (2 minutes)

**✅ Good news**: You already have MongoDB Atlas set up!

1. **Get your connection string from `.env`**:
   - Open your `.env` file
   - Find `MONGODB_URI=...`
   - Copy the entire connection string
   - **Save it** - you'll need it in Step 3

2. **Verify Network Access** (if needed):
   - Go to MongoDB Atlas dashboard
   - Go to "Network Access"
   - Make sure `0.0.0.0/0` is allowed (or Render.com IPs)
   - This allows Render.com to connect to your database

**Skip**: Creating new cluster, database user, etc. - you already have everything!

---

### Step 1 (Alternative): Set Up MongoDB Atlas (5 minutes) - SKIP IF YOU ALREADY HAVE IT

1. **Sign up**: https://www.mongodb.com/cloud/atlas
2. **Create Free Cluster**:
   - Click "Build a Database"
   - Choose "FREE" (M0) tier
   - Select region closest to you
   - Click "Create"
3. **Create Database User**:
   - Go to "Database Access"
   - Click "Add New Database User"
   - Username: `click-user`
   - Password: Generate secure password (save it!)
   - Click "Add User"
4. **Configure Network Access**:
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for free tier)
   - Or add `0.0.0.0/0`
5. **Get Connection String**:
   - Go to "Database" → "Connect"
   - Click "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database password
   - Example: `mongodb+srv://click-user:your-password@cluster0.xxxxx.mongodb.net/click?retryWrites=true&w=majority`

**Save this connection string!** You'll need it in Step 3.

---

### Step 2: Sign Up for Render.com (2 minutes)

1. **Go to**: https://render.com
2. **Click**: "Get Started for Free"
3. **Sign up with GitHub** (easiest option)
4. **Authorize Render** to access your GitHub

---

### Step 3: Deploy Your Application (8 minutes)

1. **Create New Web Service**:
   - Click "New +" button (top right)
   - Select "Web Service"

2. **Connect Repository**:
   - Click "Connect account" if not connected
   - Select your GitHub account
   - Find and select your Click repository
   - Click "Connect"

3. **Configure Service**:
   ```
   Name: click-platform
   Region: Choose closest to you
   Branch: main (or your default branch)
   Root Directory: (leave empty)
   Environment: Node
   Build Command: npm install && cd client && npm install && npm run build
   Start Command: npm start
   Plan: Free
   ```

4. **Set Environment Variables**:
   Click "Advanced" → "Add Environment Variable" and add:

   **Required Variables**:
   ```bash
   NODE_ENV=production
   PORT=5001
   MONGODB_URI=mongodb+srv://click-user:your-password@cluster0.xxxxx.mongodb.net/click?retryWrites=true&w=majority
   JWT_SECRET=generate-with-openssl-rand-base64-32
   FRONTEND_URL=https://your-app-name.onrender.com
   ```

   **Generate JWT Secret** (run in terminal):
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and use it as `JWT_SECRET`

   **OAuth Variables** (add your YouTube credentials):
   ```bash
   YOUTUBE_CLIENT_ID=your-youtube-client-id
   YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
   YOUTUBE_CALLBACK_URL=https://your-app-name.onrender.com/api/oauth/youtube/callback
   ```

   **Optional Variables** (add if you have them):
   ```bash
   OPENAI_API_KEY=your-openai-key
   REDIS_URL=your-redis-url
   AWS_ACCESS_KEY_ID=your-aws-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret
   AWS_S3_BUCKET=your-bucket-name
   ```

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for build (5-10 minutes)
   - Watch the logs for progress

---

### Step 4: Verify Deployment (2 minutes)

1. **Wait for Build to Complete**:
   - Check "Logs" tab
   - Look for "Build successful" or "Deployed"

2. **Test Health Endpoint**:
   ```bash
   curl https://your-app-name.onrender.com/api/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "environment": "production"
   }
   ```

3. **Test OAuth Status**:
   Visit: `https://your-app-name.onrender.com/api/oauth/youtube/status`
   (You'll need to be authenticated, but it should load)

---

## 🔧 Post-Deployment Setup

### 1. Update OAuth Callback URLs

Update your OAuth apps with production callback URLs:

**YouTube**:
- Go to Google Cloud Console
- Update callback URL: `https://your-app-name.onrender.com/api/oauth/youtube/callback`

**Twitter** (if configured):
- Update callback URL: `https://your-app-name.onrender.com/api/oauth/twitter/callback`

**LinkedIn** (if configured):
- Update callback URL: `https://your-app-name.onrender.com/api/oauth/linkedin/callback`

**Facebook** (if configured):
- Update callback URL: `https://your-app-name.onrender.com/api/oauth/facebook/callback`

### 2. Set Up UptimeRobot (Optional - Keep App Awake)

**Why**: Render free tier sleeps after 15 min inactivity. UptimeRobot pings your app to keep it awake.

1. **Sign up**: https://uptimerobot.com (free)
2. **Add Monitor**:
   - Type: HTTP(s)
   - Friendly Name: Click Platform
   - URL: `https://your-app-name.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
3. **Save Monitor**

**Result**: Your app stays awake 24/7 (within free tier limits)

---

## 📊 Free Tier Limits

### Render.com Free Tier:
- ✅ 750 hours/month (enough for 24/7)
- ✅ 512MB RAM
- ✅ Free SSL
- ⚠️ Sleeps after 15 min inactivity (wakes on request)

### MongoDB Atlas Free Tier:
- ✅ 512MB storage
- ✅ Shared cluster
- ✅ Free backups
- ✅ Sufficient for development/small projects

---

## 🎯 Your App URLs

After deployment, you'll have:

- **App URL**: `https://your-app-name.onrender.com`
- **API Health**: `https://your-app-name.onrender.com/api/health`
- **API Base**: `https://your-app-name.onrender.com/api`

---

## ✅ Deployment Checklist

- [ ] MongoDB Atlas account created
- [ ] Database cluster created
- [ ] Database user created
- [ ] Network access configured
- [ ] Connection string obtained
- [ ] Render.com account created
- [ ] GitHub repository connected
- [ ] Web service created
- [ ] Environment variables set
- [ ] Build successful
- [ ] Health endpoint working
- [ ] OAuth callback URLs updated
- [ ] UptimeRobot configured (optional)

---

## 🆘 Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify all environment variables are set
- Check Node.js version compatibility
- Review error messages in logs

### App Won't Start
- Check start command: `npm start`
- Verify PORT is set correctly
- Check MongoDB connection string
- Review application logs

### Database Connection Error
- Verify MongoDB Atlas network access allows all IPs
- Check connection string format
- Verify username/password are correct
- Check MongoDB Atlas cluster status

### OAuth Not Working
- Verify callback URLs match exactly
- Check OAuth credentials in environment variables
- Ensure OAuth apps are in production mode
- Review OAuth error logs

---

## 💡 Pro Tips

1. **Use UptimeRobot**: Keep your app awake 24/7
2. **Monitor Logs**: Check Render logs regularly
3. **Set Up Alerts**: Configure email notifications in Render
4. **Use Custom Domain**: Add your domain for free (just DNS setup)
5. **Optimize Build**: Reduce build time by optimizing dependencies

---

## 📚 Additional Resources

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Full Deployment Guide**: `PRODUCTION_DEPLOYMENT_ACTION_PLAN.md`
- **Render Quick Start**: `RENDER_QUICK_START.md`

---

## 🎉 Success!

Once deployed, you'll have:
- ✅ Production-ready Click platform
- ✅ Free hosting (Render.com)
- ✅ Free database (MongoDB Atlas)
- ✅ Free SSL/HTTPS
- ✅ Automatic deployments from GitHub
- ✅ 24/7 uptime (with UptimeRobot)

**Total Cost**: $0/month

---

**Ready to deploy? Follow the steps above! 🚀**

