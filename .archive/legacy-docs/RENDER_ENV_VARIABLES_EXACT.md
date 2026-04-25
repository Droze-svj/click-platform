# 📋 Render.com Environment Variables - Exact Names & Values

**Copy-paste ready list for Render.com**

---

## ✅ Required Variables (Must Add)

### 1. Server Configuration

| Variable Name | Value | Where to Get |
|--------------|-------|--------------|
| `NODE_ENV` | `production` | Type this exactly |
| `PORT` | `5001` | Type this exactly |
| `FRONTEND_URL` | `https://your-app-name.onrender.com` | Your Render.com URL (replace `your-app-name` with your actual app name) |

**Example**:
```
NODE_ENV = production
PORT = 5001
FRONTEND_URL = https://click-platform.onrender.com
```

---

### 2. Database

| Variable Name | Value | Where to Get |
|--------------|-------|--------------|
| `MONGODB_URI` | `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority` | Copy from your `.env` file |

**How to get**:
1. Open your `.env` file
2. Find the line: `MONGODB_URI=...`
3. Copy everything after the `=` sign
4. Paste it as the value

**Example**:
```
MONGODB_URI = mongodb+srv://click-user:MyPassword123@cluster0.xxxxx.mongodb.net/click?retryWrites=true&w=majority
```

---

### 3. Security

| Variable Name | Value | Where to Get |
|--------------|-------|--------------|
| `JWT_SECRET` | `[generated-secret]` | Generate with: `openssl rand -base64 32` |

**How to generate**:
1. Open terminal
2. Run: `openssl rand -base64 32`
3. Copy the output (it will be a long string)
4. Paste it as the value

**Example**:
```
JWT_SECRET = aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz
```

---

### 4. YouTube OAuth

| Variable Name | Value | Where to Get |
|--------------|-------|--------------|
| `YOUTUBE_CLIENT_ID` | `[your-client-id]` | Copy from your `.env` file |
| `YOUTUBE_CLIENT_SECRET` | `[your-client-secret]` | Copy from your `.env` file |
| `YOUTUBE_CALLBACK_URL` | `https://your-app-name.onrender.com/api/oauth/youtube/callback` | Your Render URL + `/api/oauth/youtube/callback` |

**How to get**:
1. Open your `.env` file
2. Find: `YOUTUBE_CLIENT_ID=...` → Copy the value
3. Find: `YOUTUBE_CLIENT_SECRET=...` → Copy the value
4. For callback URL: Use your Render.com URL + `/api/oauth/youtube/callback`

**Example**:
```
YOUTUBE_CLIENT_ID = 236680378422-fac4iormhq73fmb0rhtr5si96am0ruis.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET = 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
YOUTUBE_CALLBACK_URL = https://click-platform.onrender.com/api/oauth/youtube/callback
```

---

## 📝 Complete List (Copy-Paste Format)

### In Render.com, add these exactly:

```
Variable Name: NODE_ENV
Value: production

Variable Name: PORT
Value: 5001

Variable Name: FRONTEND_URL
Value: https://your-app-name.onrender.com
(Replace 'your-app-name' with your actual Render app name)

Variable Name: MONGODB_URI
Value: [Copy from your .env file - everything after MONGODB_URI=]

Variable Name: JWT_SECRET
Value: [Run 'openssl rand -base64 32' and paste the output]

Variable Name: YOUTUBE_CLIENT_ID
Value: [Copy from your .env file - everything after YOUTUBE_CLIENT_ID=]

Variable Name: YOUTUBE_CLIENT_SECRET
Value: [Copy from your .env file - everything after YOUTUBE_CLIENT_SECRET=]

Variable Name: YOUTUBE_CALLBACK_URL
Value: https://your-app-name.onrender.com/api/oauth/youtube/callback
(Replace 'your-app-name' with your actual Render app name)
```

---

## 🎯 Step-by-Step: Adding in Render.com

### For Each Variable:

1. **Click "Add Environment Variable"**
2. **Enter Variable Name** (exact name from list above)
3. **Enter Value** (from your .env or generated)
4. **Click "Save"** (or add all then save once)

---

## 📋 Example: What It Looks Like

After adding all variables, your Render.com environment should look like:

```
NODE_ENV
production

PORT
5001

FRONTEND_URL
https://click-platform.onrender.com

MONGODB_URI
mongodb+srv://click-user:password@cluster0.xxxxx.mongodb.net/click?retryWrites=true&w=majority

JWT_SECRET
aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz

YOUTUBE_CLIENT_ID
236680378422-fac4iormhq73fmb0rhtr5si96am0ruis.apps.googleusercontent.com

YOUTUBE_CLIENT_SECRET
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

YOUTUBE_CALLBACK_URL
https://click-platform.onrender.com/api/oauth/youtube/callback
```

---

## ⚠️ Important Notes

### Variable Names (Exact Spelling)
- ✅ `NODE_ENV` (not `NODE_ENVIRONMENT`)
- ✅ `MONGODB_URI` (not `MONGODB_URL` or `MONGO_URI`)
- ✅ `JWT_SECRET` (not `JWT_KEY` or `JWT_TOKEN`)
- ✅ `YOUTUBE_CLIENT_ID` (not `YOUTUBE_API_KEY`)
- ✅ `YOUTUBE_CLIENT_SECRET` (not `YOUTUBE_SECRET`)

### Values (No Quotes, No Spaces)
- ✅ `production` (not `"production"` or ` production`)
- ✅ `5001` (not `"5001"` or ` 5001`)
- ✅ `mongodb+srv://...` (copy exactly, no quotes)

---

## 🔍 Quick Reference Table

| # | Variable Name | Example Value | Source |
|---|---------------|---------------|--------|
| 1 | `NODE_ENV` | `production` | Type exactly |
| 2 | `PORT` | `5001` | Type exactly |
| 3 | `FRONTEND_URL` | `https://click-platform.onrender.com` | Your Render URL |
| 4 | `MONGODB_URI` | `mongodb+srv://user:pass@cluster...` | From `.env` |
| 5 | `JWT_SECRET` | `aBcDeF...` (64 chars) | Generate new |
| 6 | `YOUTUBE_CLIENT_ID` | `236680378422-...` | From `.env` |
| 7 | `YOUTUBE_CLIENT_SECRET` | `GOCSPX-...` | From `.env` |
| 8 | `YOUTUBE_CALLBACK_URL` | `https://...onrender.com/api/oauth/youtube/callback` | Your Render URL + path |

---

## ✅ Checklist

Before deploying, make sure you have:

- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `5001`
- [ ] `FRONTEND_URL` = Your Render.com URL
- [ ] `MONGODB_URI` = Copied from your `.env`
- [ ] `JWT_SECRET` = Generated with `openssl rand -base64 32`
- [ ] `YOUTUBE_CLIENT_ID` = Copied from your `.env`
- [ ] `YOUTUBE_CLIENT_SECRET` = Copied from your `.env`
- [ ] `YOUTUBE_CALLBACK_URL` = Your Render URL + `/api/oauth/youtube/callback`

---

**Ready to add? Use the exact variable names and values above! 🚀**

