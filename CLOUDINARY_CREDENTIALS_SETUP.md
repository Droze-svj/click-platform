# ☁️ Cloudinary Credentials Setup

**Your Cloud Name**: `dq3qhgdky`

---

## 🔑 Step 1: Get Your API Key and API Secret

1. **Go to**: https://cloudinary.com/console

2. **In the Dashboard**, you'll see:
   - **Cloud Name**: `dq3qhgdky` ✅ (you already have this)
   - **API Key**: `123456789012345` (numbers - copy this)
   - **API Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (long string - copy this)

3. **Copy both** the API Key and API Secret

---

## 📝 Step 2: Add to Render.com

1. **Go to**: Render.com → Your service → **Environment** tab

2. **Add these 3 variables**:

   **Variable 1:**
   ```
   Key: CLOUDINARY_CLOUD_NAME
   Value: dq3qhgdky
   ```

   **Variable 2:**
   ```
   Key: CLOUDINARY_API_KEY
   Value: [Paste your API Key from Step 1]
   (Should be numbers like: 123456789012345)
   ```

   **Variable 3:**
   ```
   Key: CLOUDINARY_API_SECRET
   Value: [Paste your API Secret from Step 1]
   (Should be a long string)
   ```

3. **Click**: "Save Changes"

4. **Service will auto-redeploy** (wait 2-5 minutes)

---

## ✅ Step 3: Verify Setup

After redeploying, check your Render.com logs. You should see:

```
✅ Cloud storage (Cloudinary) configured
```

Instead of:
```
⚠️ Cloud storage not configured. Using local file storage.
```

---

## 🎯 Quick Checklist

- [x] Cloud Name: `dq3qhgdky`
- [ ] Got API Key from Cloudinary dashboard
- [ ] Got API Secret from Cloudinary dashboard
- [ ] Added `CLOUDINARY_CLOUD_NAME` to Render.com
- [ ] Added `CLOUDINARY_API_KEY` to Render.com
- [ ] Added `CLOUDINARY_API_SECRET` to Render.com
- [ ] Saved changes and redeployed
- [ ] Verified in logs

---

## 📍 Where to Find Credentials

**Cloudinary Dashboard**: https://cloudinary.com/console

Look for:
- **Account Details** section
- Shows: Cloud Name, API Key, API Secret

---

**Next: Get your API Key and API Secret from the Cloudinary dashboard, then add all 3 variables to Render.com! 🚀**

