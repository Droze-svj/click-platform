# 🚀 Webhook Setup - Do This Now

## Quick Checklist

Follow these steps in order:

### ✅ Step 1: Install ngrok (if needed)

```bash
brew install ngrok
```

### ✅ Step 2: Start Your Server

**Terminal 1:**
```bash
cd "/Users/orlandhino/WHOP AI V3"
npm run dev
```

Wait for: `Server running on port 5001`  
**Keep this terminal open!**

### ✅ Step 3: Start ngrok

**Open Terminal 2 (new window):**
```bash
ngrok http 5001
```

**You'll see:**
```
Forwarding    https://xxxxx.ngrok.io -> http://localhost:5001
```

**Copy the HTTPS URL:** `https://xxxxx.ngrok.io`  
**Keep ngrok running!**

### ✅ Step 4: Build Webhook URL

Your webhook URL:
```
https://xxxxx.ngrok.io/api/subscription/webhook
```

Replace `xxxxx` with your actual ngrok URL.

### ✅ Step 5: Configure in Whop

1. Go to: https://whop.com/dashboard
2. Settings → Webhooks
3. Add Webhook:
   - URL: `https://xxxxx.ngrok.io/api/subscription/webhook`
   - Events: Select ALL subscription events
   - Save

### ✅ Step 6: Verify

- Webhook status = Active ✅
- Server is running ✅
- ngrok is running ✅

## Done! 🎉

Once configured, webhooks will automatically sync subscriptions!
