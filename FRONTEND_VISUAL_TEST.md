# 🎨 Visual Testing Guide - Click Platform Frontend

## Quick Start - Test the Frontend Visually

Your backend is live on Render.com. Let's start the frontend locally and connect it to your production backend.

## 🚀 Step 1: Start the Frontend

### Option A: Quick Start (Recommended)

```bash
# Navigate to project root
cd "/Users/orlandhino/WHOP AI V3"

# Set the API URL to point to your production backend
export NEXT_PUBLIC_API_URL=https://click-platform.onrender.com/api

# Start the frontend
cd client
npm run dev
```

The frontend will start on **http://localhost:3000**

### Option B: Using npm script (from root)

```bash
# From project root
NEXT_PUBLIC_API_URL=https://click-platform.onrender.com/api npm run dev:client
```

## 🌐 Step 2: Access the Application

1. **Open your browser** and go to: **http://localhost:3000**

2. **You'll see:**
   - Landing page
   - Login/Register options
   - Navigation to all features

## 📝 Step 3: Create an Account

1. Click **"Register"** or go to **http://localhost:3000/register**
2. Fill in:
   - Email
   - Password
   - Name
3. Click **"Sign Up"**

## 🔐 Step 4: Login

1. Go to **http://localhost:3000/login**
2. Enter your credentials
3. You'll be redirected to the dashboard

## 🎯 Step 5: Explore Features

Once logged in, you can access:

- **Dashboard** (`/dashboard`) - Overview of your content
- **Content** (`/dashboard/content`) - Create and manage content
- **Video** (`/dashboard/video`) - Video processing and editing
- **Social** (`/dashboard/social`) - Social media management
- **Calendar** (`/dashboard/calendar`) - Content scheduling
- **Analytics** (`/dashboard/analytics`) - Performance metrics
- **Settings** (`/dashboard/settings`) - Account settings

## 🔗 Connect YouTube (Already Set Up!)

1. Go to **Social** page (`/dashboard/social`)
2. Look for **YouTube** connection
3. Your YouTube account should already be connected!
   - Channel: TRADER MAYNE CLIPZ
   - Channel ID: UC7O3Cj41CjZobabUJzof0xg

## 🧪 Test Features

### Test Content Creation
1. Go to **Content** page
2. Try creating new content
3. Generate social media posts

### Test Video Features
1. Go to **Video** page
2. Upload a test video (if you have one)
3. Process and edit videos

### Test Social Media
1. Go to **Social** page
2. Check YouTube connection status
3. Try posting content (when ready)

### Test Scheduling
1. Go to **Calendar** page
2. Schedule content for future dates
3. View scheduled posts

## ⚙️ Configuration

### Permanent Configuration (Recommended)

Create a `.env.local` file in the `client` directory:

```bash
cd client
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://click-platform.onrender.com/api
EOF
```

Then start the frontend:
```bash
npm run dev
```

### Environment Variables

The frontend uses:
- `NEXT_PUBLIC_API_URL` - Backend API URL (defaults to `http://localhost:5001/api`)

## 🐛 Troubleshooting

### Frontend won't start
```bash
# Make sure you're in the client directory
cd client

# Install dependencies if needed
npm install

# Try starting again
npm run dev
```

### Can't connect to backend
- Check that `NEXT_PUBLIC_API_URL` is set correctly
- Verify backend is running: `curl https://click-platform.onrender.com/api/health`
- Check browser console for errors

### CORS errors
- The backend should already have CORS configured
- If you see CORS errors, check the backend logs

### Authentication issues
- Make sure you're using the correct credentials
- Check that tokens are being stored in localStorage
- Try logging out and back in

## 📱 What You Can Test

### ✅ Available Now
- User registration and login
- Dashboard navigation
- Content creation interface
- Video upload interface
- Social media connections (YouTube)
- Calendar/scheduling interface
- Analytics dashboard
- Settings page

### ⏳ Needs Setup
- Twitter/X posting (needs OAuth credentials)
- LinkedIn posting (needs OAuth credentials)
- Facebook/Instagram posting (needs OAuth credentials)

## 🎉 Ready to Test!

Run this command to start:

```bash
cd "/Users/orlandhino/WHOP AI V3/client" && NEXT_PUBLIC_API_URL=https://click-platform.onrender.com/api npm run dev
```

Then open **http://localhost:3000** in your browser!

---

**Backend URL:** https://click-platform.onrender.com  
**Frontend URL:** http://localhost:3000 (when running locally)

