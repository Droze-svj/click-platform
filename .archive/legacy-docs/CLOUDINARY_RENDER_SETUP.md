# ☁️ Cloudinary Render.com Setup - Your Credentials

**All your Cloudinary credentials are ready!**

---

## ✅ Your Cloudinary Credentials

- **Cloud Name**: `dq3qhgdky`
- **API Key**: `669778257786928`
- **API Secret**: `GvjJYi0TC-KkdycaDuuDD3L4D2w`

---

## 🚀 Add to Render.com (2 minutes)

### Step 1: Go to Render.com

1. **Go to**: https://dashboard.render.com/
2. **Click**: Your web service
3. **Go to**: **Environment** tab (left sidebar)

---

### Step 2: Add Environment Variables

**Click**: "Add Environment Variable" button

**Add Variable 1:**
```
Key: CLOUDINARY_CLOUD_NAME
Value: dq3qhgdky
```

**Click**: "Add Another"

**Add Variable 2:**
```
Key: CLOUDINARY_API_KEY
Value: 669778257786928
```

**Click**: "Add Another"

**Add Variable 3:**
```
Key: CLOUDINARY_API_SECRET
Value: GvjJYi0TC-KkdycaDuuDD3L4D2w
```

---

### Step 3: Save and Redeploy

1. **Click**: "Save Changes" (bottom of page)
2. **Render.com will automatically redeploy** your service
3. **Wait** 2-5 minutes for deployment to complete

---

## ✅ Step 4: Verify Setup

After redeploying, check your Render.com logs:

1. **Go to**: Your service → **Logs** tab
2. **Look for**:
   ```
   ✅ Cloud storage (Cloudinary) configured
   ```

**Instead of:**
```
⚠️ Cloud storage not configured. Using local file storage.
```

---

## 🧪 Step 5: Test File Upload

1. **Upload a file** through your API
2. **Check Cloudinary dashboard**: https://cloudinary.com/console/media_library
3. **You should see** the uploaded file in your media library

---

## 📊 Cloudinary Dashboard

- **Media Library**: https://cloudinary.com/console/media_library
- **Settings**: https://cloudinary.com/console/settings
- **Usage**: https://cloudinary.com/console/usage

---

## ✅ Checklist

- [x] Cloud Name: `dq3qhgdky`
- [x] API Key: `669778257786928`
- [x] API Secret: `GvjJYi0TC-KkdycaDuuDD3L4D2w`
- [ ] Added `CLOUDINARY_CLOUD_NAME` to Render.com
- [ ] Added `CLOUDINARY_API_KEY` to Render.com
- [ ] Added `CLOUDINARY_API_SECRET` to Render.com
- [ ] Saved changes and redeployed
- [ ] Verified in logs
- [ ] Tested file upload

---

## 🎯 What This Enables

- ✅ **Persistent file storage** (files survive server restarts)
- ✅ **Image/video optimization** (automatic)
- ✅ **CDN delivery** (fast file access worldwide)
- ✅ **25GB free storage** (perfect for getting started)

---

## 🔒 Security Note

**Never commit** these credentials to git. They're only stored in Render.com environment variables (which is correct!).

---

**Ready? Add all 3 variables to Render.com and you're done! 🚀**

