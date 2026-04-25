# 🐛 Sentry Setup Guide

**Purpose**: Track and debug errors in production

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Sentry Account

1. **Sign up**: https://sentry.io/signup/
   - Free tier: **5,000 events/month** (perfect for testing)
   - No credit card required

2. **Choose platform**: **Node.js**

3. **Create a project**: "Click Platform"

---

### Step 2: Get DSN

1. **After creating project**, you'll see the **DSN**:
   - It looks like: `https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o1234567.ingest.sentry.io/1234567`

2. **Copy the DSN** (you'll need it for Render.com)

---

### Step 3: Configure Project Settings

1. **Go to**: Project Settings → Client Keys (DSN)

2. **Optional settings**:
   - **Environment**: `production` (or `staging`, `development`)
   - **Release**: Your app version (e.g., `v1.0.0`)
   - **Tags**: Add custom tags (e.g., `service: click`)

---

### Step 4: Add to Render.com

1. **Go to**: Your Render.com dashboard → Your service → Environment

2. **Add this variable**:

   ```
   Variable Name: SENTRY_DSN
   Value: https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o1234567.ingest.sentry.io/1234567
   (Paste your DSN from Step 2)
   ```

3. **Optional variables**:

   ```
   Variable Name: SENTRY_ENVIRONMENT
   Value: production
   (or staging, development)
   
   Variable Name: SENTRY_RELEASE
   Value: v1.0.0
   (Your app version - optional)
   ```

4. **Save** and **Redeploy** your service

---

## ✅ Verify Setup

After redeploying, check your logs. You should see:
```
✅ Sentry error tracking initialized
```

Instead of:
```
⚠️ Sentry DSN not configured. Error tracking disabled.
```

---

## 🧪 Test Error Tracking

### Option 1: Trigger a Test Error

1. **Create a test endpoint** (temporarily):

```javascript
// In your API, add a test route
app.get('/api/test-error', (req, res) => {
  throw new Error('Test error for Sentry');
});
```

2. **Visit**: `https://your-app.onrender.com/api/test-error`

3. **Check Sentry**: Go to https://sentry.io/ → Your project → Issues
   - You should see the error appear within seconds!

### Option 2: Use Sentry Test Button

1. **In Sentry dashboard**, go to your project
2. **Click**: "Test Error" button
3. **Check**: The error should appear in Issues

---

## 📊 Sentry Dashboard

- **View errors**: https://sentry.io/ → Your project → Issues
- **Performance**: https://sentry.io/ → Your project → Performance
- **Releases**: https://sentry.io/ → Your project → Releases
- **Settings**: https://sentry.io/ → Your project → Settings

---

## 🎯 What This Enables

- ✅ **Error tracking**: See all errors in production
- ✅ **Stack traces**: Full error details with line numbers
- ✅ **User context**: See which users encountered errors
- ✅ **Performance monitoring**: Track slow requests
- ✅ **Release tracking**: See which version has errors
- ✅ **Alerts**: Get notified when errors occur

---

## 🔔 Set Up Alerts (Optional)

1. **Go to**: Project Settings → Alerts

2. **Create alert rule**:
   - **When**: "An issue is created"
   - **Action**: Email/Slack notification
   - **Save**

3. **You'll get notified** when new errors occur!

---

## 📈 Features

### Error Grouping
- Similar errors are grouped together
- See error frequency and trends

### Breadcrumbs
- See user actions before the error
- Helpful for debugging

### User Context
- See which users are affected
- Track error patterns per user

### Performance Monitoring
- Track slow API endpoints
- Identify bottlenecks

---

## 💰 Pricing

- **Free Tier**: 5,000 events/month (perfect for testing)
- **Team**: $26/month for 50,000 events
- **Business**: $80/month for 100,000 events

**Start with free tier - upgrade when needed!**

---

## 🔒 Security Notes

- **DSN is public** - it's safe to expose (it's read-only)
- **Never commit** DSN to git (use environment variables)
- **Use different projects** for staging/production
- **Set up rate limiting** if needed

---

## 🎨 Customization

### Add Custom Context

In your code, you can add custom context:

```javascript
const Sentry = require('@sentry/node');

// Add user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name
});

// Add custom tags
Sentry.setTag('feature', 'oauth');
Sentry.setTag('platform', 'youtube');

// Add custom data
Sentry.setContext('request', {
  url: req.url,
  method: req.method,
  headers: req.headers
});
```

---

## 🚀 Best Practices

1. **Filter sensitive data**: Don't log passwords, tokens, etc.
2. **Use environments**: Separate staging/production
3. **Set up alerts**: Get notified of critical errors
4. **Review regularly**: Check for error patterns
5. **Fix high-frequency errors**: Prioritize common issues

---

## ✅ Checklist

- [ ] Created Sentry account
- [ ] Created Node.js project
- [ ] Copied DSN
- [ ] Added `SENTRY_DSN` to Render.com
- [ ] Redeployed service
- [ ] Verified in logs
- [ ] Tested error tracking
- [ ] Set up alerts (optional)

---

**Ready? Follow the steps above and add the DSN to Render.com! 🚀**

