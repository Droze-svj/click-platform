# ☁️ Cloudinary Quick Setup Guide

**Step-by-step guide to set up Cloudinary for file storage**

---

## 🚀 Step 1: Create Cloudinary Account (2 minutes)

1. **Go to**: https://cloudinary.com/users/register/free
   - **Free tier**: 25GB storage, 25GB bandwidth/month
   - **No credit card** required

2. **Sign up** with your email

3. **Verify your email** (check inbox)

4. **Complete account setup**

---

## 🔑 Step 2: Get Your Credentials (1 minute)

1. **Go to Dashboard**: https://cloudinary.com/console

2. **You'll see your credentials** on the dashboard:
   - **Cloud Name**: `your-cloud-name` (e.g., `dxyz123abc`)
   - **API Key**: `123456789012345` (numbers)
   - **API Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (long string)

3. **Copy these 3 values** - you'll need them for Render.com

---

## 📝 Step 3: Add to Render.com (2 minutes)

1. **Go to**: Render.com → Your service → **Environment** tab

2. **Add these 3 variables**:

   **Variable 1:**
   ```
   Key: CLOUDINARY_CLOUD_NAME
   Value: [Your Cloud Name from Step 2]
   (e.g., dxyz123abc)
   ```

   **Variable 2:**
   ```
   Key: CLOUDINARY_API_KEY
   Value: [Your API Key from Step 2]
   (e.g., 123456789012345)
   ```

   **Variable 3:**
   ```
   Key: CLOUDINARY_API_SECRET
   Value: [Your API Secret from Step 2]
   (e.g., xxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
   ```

3. **Click**: "Save Changes"

4. **Service will auto-redeploy** (wait 2-5 minutes)

---

## ✅ Step 4: Verify Setup

After redeploying, check your Render.com logs. You should see:

```
✅ Cloud storage initialized: cloudinary
```

Instead of:
```
⚠️ Cloud storage not configured. Using local file storage.
```

---

## 🧪 Step 5: Test File Upload

1. **Upload a file** through your API
2. **Check Cloudinary dashboard**: https://cloudinary.com/console
3. **You should see** the uploaded file in your media library

---

## 📊 Cloudinary Dashboard

- **Media Library**: https://cloudinary.com/console/media_library
- **Settings**: https://cloudinary.com/console/settings
- **Usage**: https://cloudinary.com/console/usage

---

## 🎯 What This Enables

- ✅ **Persistent file storage** (files survive server restarts)
- ✅ **Image/video optimization** (automatic)
- ✅ **CDN delivery** (fast file access worldwide)
- ✅ **Scalable storage** (grows with your app)

---

## 💰 Pricing

- **Free Tier**: 25GB storage, 25GB bandwidth/month
- **Paid**: $89/month for 100GB storage, 100GB bandwidth

**Perfect for getting started!**

---

## 🔒 Security Notes

- **Never commit** API keys to git
- **Store** in Render.com environment variables only
- **Keep API Secret** secure (don't share it)

---

## ✅ Checklist

- [ ] Created Cloudinary account
- [ ] Got Cloud Name, API Key, and API Secret
- [ ] Added `CLOUDINARY_CLOUD_NAME` to Render.com
- [ ] Added `CLOUDINARY_API_KEY` to Render.com
- [ ] Added `CLOUDINARY_API_SECRET` to Render.com
- [ ] Saved changes and redeployed
- [ ] Verified in logs
- [ ] Tested file upload

---

## 🚀 Next Steps

After Cloudinary is set up, you can:
1. **Set up Sentry** - See `SETUP_SENTRY.md`
2. **Set up Redis** - See `SETUP_REDIS.md`

---

**Ready? Follow the steps above! It takes about 5 minutes total. 🚀**

