# 🔧 Sentry Setup Instructions

**Your Sentry DSN:** `https://a400da46f531219b7ce6f78a9d5cb6ff@o4510623214731264.ingest.de.sentry.io/4510629716033616`

---

## ✅ Step-by-Step Setup

### Step 1: Add to Render.com (2 minutes)

1. **Go to Render.com Dashboard**
   - Visit: https://dashboard.render.com
   - Click on your service: **click-platform**

2. **Navigate to Environment Variables**
   - Click on **Environment** tab (left sidebar)
   - Scroll down to see existing environment variables

3. **Add Sentry DSN**
   - Click **Add Environment Variable** button
   - **Key:** `SENTRY_DSN`
   - **Value:** `https://a400da46f531219b7ce6f78a9d5cb6ff@o4510623214731264.ingest.de.sentry.io/4510629716033616`
   - Click **Save Changes**

4. **Auto-Deploy**
   - Render.com will automatically redeploy your service
   - Wait 2-3 minutes for deployment to complete

---

## ✅ Step 2: Verify Setup (2 minutes)

### Check Render.com Logs

1. Go to your service → **Logs** tab
2. Look for one of these messages:
   - `✅ Sentry initialized`
   - `Sentry DSN configured`
   - Or check for any Sentry-related errors

### Test Sentry Integration

After deployment, you can test by:

1. **Check Sentry Dashboard**
   - Go to https://sentry.io
   - Navigate to your project
   - Go to **Issues** tab (should be empty initially)

2. **Trigger a Test Error** (Optional)
   - You can test by causing an intentional error
   - Or wait for real errors to appear

---

## ✅ Step 3: Verify It's Working

### Check Health Endpoint

```bash
curl https://click-platform.onrender.com/api/health
```

Look for Sentry status in the response (if included).

### Check Logs

In Render.com logs, you should see:
- No Sentry initialization errors
- Sentry-related log messages (if configured)

---

## 🎯 What Sentry Will Track

Once set up, Sentry will automatically track:

- ✅ **Uncaught Exceptions** - Errors that crash your app
- ✅ **Unhandled Promise Rejections** - Async errors
- ✅ **API Errors** - Errors in your API endpoints
- ✅ **Performance Issues** - Slow queries, slow endpoints
- ✅ **Release Tracking** - Track which deployment caused issues

---

## 📊 Using Sentry Dashboard

### View Errors

1. Go to https://sentry.io
2. Select your project
3. Click **Issues** to see all errors
4. Click on an error to see:
   - Stack trace
   - User information
   - Request details
   - Environment
   - Release version

### Set Up Alerts

1. Go to **Alerts** in Sentry
2. Create alert rules:
   - Email when new error occurs
   - Email when error rate spikes
   - Email for specific error types

---

## 🔍 Troubleshooting

### Sentry Not Working?

1. **Check DSN is correct**
   - Verify in Render.com → Environment
   - Should start with `https://` and end with project ID

2. **Check Logs**
   - Look for Sentry initialization errors
   - Check for connection errors

3. **Verify Deployment**
   - Make sure service redeployed after adding variable
   - Check deployment logs

4. **Test Connection**
   - Go to Sentry dashboard
   - Check if project is receiving data

---

## ✅ Success Checklist

- [ ] DSN added to Render.com environment variables
- [ ] Service redeployed successfully
- [ ] No Sentry errors in logs
- [ ] Sentry dashboard shows project is active
- [ ] Test error appears in Sentry (optional)

---

## 🎉 You're All Set!

Once Sentry is configured, you'll automatically receive:
- Real-time error notifications
- Detailed error reports
- Performance monitoring
- Release tracking

**Next Steps:**
1. Add the DSN to Render.com (see Step 1 above)
2. Wait for redeployment
3. Check Sentry dashboard for activity
4. Set up email alerts (optional)

---

**Need Help?**
- Sentry Docs: https://docs.sentry.io
- Render.com Docs: https://render.com/docs

