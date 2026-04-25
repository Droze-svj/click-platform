# 📧 SendGrid Setup Guide

**Purpose**: Enable email features (password resets, notifications, email verification)

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create SendGrid Account

1. **Sign up**: https://signup.sendgrid.com/
   - Free tier: **100 emails/day** (perfect for testing)
   - No credit card required

2. **Verify your email** (check inbox)

3. **Complete account setup**

---

### Step 2: Create API Key

1. **Go to**: https://app.sendgrid.com/settings/api_keys

2. **Click**: "Create API Key"

3. **Settings**:
   - **Name**: `Click Platform Production`
   - **Permissions**: **Full Access** (or "Restricted Access" with Mail Send permission)
   - Click **Create & View**

4. **Copy the API Key** (you'll only see it once!)
   - It looks like: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

5. **Save it somewhere safe** (you'll need it for Render.com)

---

### Step 3: Verify Sender Identity

1. **Go to**: https://app.sendgrid.com/settings/sender_auth

2. **Choose one**:

   **Option A: Single Sender Verification** (Easiest - for testing)
   - Click "Verify a Single Sender"
   - Fill in your details:
     - **From Email**: `noreply@yourdomain.com` (or use your personal email for testing)
     - **From Name**: `Click Platform`
     - **Reply To**: Your email
   - Click "Create"
   - **Check your email** and verify the sender

   **Option B: Domain Authentication** (Recommended for production)
   - Click "Authenticate Your Domain"
   - Follow the DNS setup instructions
   - Add the DNS records to your domain

---

### Step 4: Add to Render.com

1. **Go to**: Your Render.com dashboard → Your service → Environment

2. **Add these variables**:

   ```
   Variable Name: SENDGRID_API_KEY
   Value: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   (Paste your API key from Step 2)
   
   Variable Name: SENDGRID_FROM_EMAIL
   Value: noreply@yourdomain.com
   (Use the email you verified in Step 3)
   
   Variable Name: SENDGRID_FROM_NAME
   Value: Click Platform
   (Optional - defaults to "Click Platform")
   ```

3. **Save** and **Redeploy** your service

---

## ✅ Verify Setup

After redeploying, check your logs. You should see:
```
✅ SendGrid email service initialized
```

Instead of:
```
⚠️ SendGrid API key not found. Email service disabled.
```

---

## 🧪 Test Email Sending

You can test by:
1. Using the password reset feature
2. Triggering a test email from your API
3. Checking SendGrid dashboard → Activity (see sent emails)

---

## 📊 SendGrid Dashboard

- **Monitor emails**: https://app.sendgrid.com/activity
- **View stats**: https://app.sendgrid.com/stats
- **Manage API keys**: https://app.sendgrid.com/settings/api_keys

---

## 🎯 What This Enables

- ✅ Password reset emails
- ✅ Email verification
- ✅ Notification emails
- ✅ Welcome emails
- ✅ Any email features in your app

---

## 💰 Pricing

- **Free Tier**: 100 emails/day (perfect for testing)
- **Essentials**: $19.95/month for 50,000 emails
- **Pro**: $89.95/month for 100,000 emails

**Start with free tier - upgrade when needed!**

---

## 🔒 Security Notes

- **Never commit** your API key to git
- **Store** in Render.com environment variables only
- **Rotate** API keys periodically
- **Use restricted access** API keys in production (if possible)

---

**Ready? Follow the steps above and add the variables to Render.com! 🚀**

