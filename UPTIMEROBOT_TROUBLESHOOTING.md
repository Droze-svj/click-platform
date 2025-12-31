# 🔧 UptimeRobot Troubleshooting Guide

## ❌ Error: "URL (IP) is invalid"

If you're getting this error, here are the solutions:

---

## ✅ Solution 1: Use Correct URL Format

**Make sure you're using the FULL URL with https://**

### ✅ Correct Format:
```
https://click-platform.onrender.com/api/health
```

### ❌ Wrong Formats:
- `click-platform.onrender.com/api/health` (missing https://)
- `http://click-platform.onrender.com/api/health` (should be https)
- `click-platform.onrender.com` (missing /api/health)
- IP address (don't use IP, use the domain)

---

## ✅ Solution 2: Check UptimeRobot Settings

### Monitor Type
- **Must be:** `HTTP(s)` or `HTTPS`
- **NOT:** `Ping` or `Port` (those require IP addresses)

### URL Field
- Enter the **complete URL** including `https://`
- Should be: `https://click-platform.onrender.com/api/health`

---

## ✅ Solution 3: Try Alternative Endpoints

If the health endpoint doesn't work, try these:

### Option 1: Root Health (if available)
```
https://click-platform.onrender.com/health
```

### Option 2: API Root
```
https://click-platform.onrender.com/api
```

### Option 3: Just the Domain
```
https://click-platform.onrender.com
```

**But `/api/health` is still the best option!**

---

## ✅ Solution 4: Step-by-Step UptimeRobot Setup

### Step 1: Monitor Type
1. Click "Add New Monitor"
2. **Select:** `HTTP(s)` (NOT Ping or Port)
3. This is important - Ping/Port require IP addresses

### Step 2: URL Field
1. In the "URL" field, enter:
   ```
   https://click-platform.onrender.com/api/health
   ```
2. Make sure there are no spaces
3. Make sure it starts with `https://`
4. Make sure it ends with `/api/health`

### Step 3: Other Settings
- **Friendly Name:** Click Platform (or any name)
- **Monitoring Interval:** 5 minutes
- **Alert Contacts:** Add your email

### Step 4: Create
- Click "Create Monitor"
- Should work now!

---

## 🔍 Verify URL is Accessible

Test the URL first:

```bash
curl https://click-platform.onrender.com/api/health
```

**Expected:** JSON response with `"status": "ok"`

If this works, the URL is valid and should work in UptimeRobot.

---

## 🆘 Still Not Working?

### Check These:

1. **Is the service running?**
   - Check Render.com dashboard
   - Service should be "Live" or "Running"

2. **Is the URL correct?**
   - Copy-paste exactly: `https://click-platform.onrender.com/api/health`
   - No extra spaces or characters

3. **Monitor Type Correct?**
   - Must be `HTTP(s)` or `HTTPS`
   - NOT `Ping` or `Port`

4. **Try Different Browser**
   - Sometimes browser cache causes issues
   - Try incognito/private mode

5. **Wait a Few Minutes**
   - If service just started, wait 2-3 minutes
   - Service might be starting up

---

## 📋 Quick Checklist

- [ ] Using `HTTP(s)` monitor type (NOT Ping/Port)
- [ ] URL includes `https://` at the start
- [ ] URL is: `https://click-platform.onrender.com/api/health`
- [ ] No spaces in the URL
- [ ] Service is running on Render.com
- [ ] URL works when tested with curl

---

## ✅ Alternative: Use Different Monitoring Service

If UptimeRobot continues to have issues:

### Better Uptime (Alternative)
- URL: `https://click-platform.onrender.com/api/health`
- Free tier available
- Similar features

### StatusCake (Alternative)
- URL: `https://click-platform.onrender.com/api/health`
- Free tier: 10 monitors
- Good alternative

---

## 🎯 Most Common Issue

**The most common issue is selecting the wrong Monitor Type.**

Make sure you select:
- ✅ **HTTP(s)** or **HTTPS**
- ❌ NOT **Ping** (requires IP)
- ❌ NOT **Port** (requires IP)

---

**Try these solutions and let me know if it works!** 🚀

