# Testing Guide - How to Test Before Production

This guide explains how to test all features with real database storage (not dev mode) before real users start using Click.

## Understanding Dev Mode vs Real Mode

**Dev Mode (Current):**
- User IDs start with `dev-` or equal `dev-user-123`
- Returns mock data (no real database storage)
- Videos aren't actually stored or processed
- Good for frontend development, but not for testing the full system

**Real Mode (What You Need):**
- Real user accounts with real IDs (UUIDs from Supabase)
- Real database storage (Supabase or MongoDB)
- Videos are actually uploaded, stored, and processed
- Tests the full production workflow

## Setup for Testing

### Step 1: Ensure Database is Configured

You need either:
- **Supabase** (recommended - already set up in your code)
- **MongoDB** (legacy support)

Check your `.env` file:
```bash
# For Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OR for MongoDB
MONGODB_URI=mongodb://localhost:27017/click
```

### Step 2: Create a Real Test Account

#### Option A: Register via the UI (Recommended)

1. Go to your app: `http://localhost:3010/login`
2. Click "Sign Up" or "Register"
3. Fill in:
   - Email: `test@example.com` (use a real email for testing)
   - Password: (meet password requirements)
   - First Name: `Test`
   - Last Name: `User`
4. Click "Register"
5. Check your email for verification link (if email verification is enabled)
6. Log in with the credentials you created

#### Option B: Register via API

You can also register directly via the API:

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

Then log in:
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

Copy the `token` from the response and use it in your browser's localStorage:
```javascript
localStorage.setItem('token', 'YOUR_TOKEN_HERE')
```

### Step 3: Verify You're Using a Real Account

To check if you're using a real account (not dev mode):

1. Open browser DevTools (F12)
2. Go to Application/Storage → Local Storage
3. Check the `token` value
4. If it starts with `dev-jwt-token-`, you're in dev mode
5. If it's a JWT token (long string starting with `eyJ...`), you're using a real account

### Step 4: Test Video Uploads

Now when you upload a video with a real account:

1. ✅ Video is actually stored in your database
2. ✅ Video file is saved to disk or cloud storage
3. ✅ Video processing runs (clips, thumbnails, etc.)
4. ✅ You can view the actual uploaded video
5. ✅ All features work with real data

## Test Account Checklist

Create multiple test accounts to test different scenarios:

- [ ] **Admin Account**: Full access
- [ ] **Regular User**: Standard features
- [ ] **Trial User**: Test subscription limits
- [ ] **Premium User**: Test premium features

## Testing Different Features

### Video Upload & Processing
1. Upload a video (should be stored in database)
2. Check `/dashboard/video` - should show your uploaded video
3. Click on video to edit - should load actual video, not sample
4. Wait for processing - should generate real clips
5. Check video status - should show real processing progress

### Video Editing
1. Click "Edit Video" on an uploaded video
2. Should see your actual video (not BigBuckBunny sample)
3. Test manual edit mode (note: currently placeholder)
4. Test AI auto edit mode (note: currently placeholder)

### User Management
1. Test user profile updates
2. Test subscription management
3. Test settings changes

### Database Verification

Check your database to verify data is being stored:

**Supabase:**
- Go to your Supabase dashboard
- Check `users` table - should see your test user
- Check `content` table - should see uploaded videos
- Check `subscriptions` table - should see subscription data

**MongoDB:**
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/click

# Check users
db.users.find()

# Check content
db.contents.find({ type: 'video' })
```

## Disabling Dev Mode Detection (Advanced)

If you want to force real mode even for testing, you can:

1. Set `NODE_ENV=production` in your `.env` (but this enables production settings)
2. OR modify the dev mode detection logic in routes (not recommended)

**Better approach:** Just use real user accounts as described above.

## Environment Variables for Testing

Create a `.env.test` file or use your `.env`:

```bash
# Database
SUPABASE_URL=your_test_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key

# OR MongoDB
MONGODB_URI=mongodb://localhost:27017/click_test

# Node Environment (use 'development' for testing, not 'production')
NODE_ENV=development

# Server
PORT=5001

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5001/api

# JWT
JWT_SECRET=your_jwt_secret_for_testing

# Optional: Storage
AWS_S3_BUCKET=your_test_bucket (or use local storage)
```

## Testing Checklist

Before going to production, test:

- [ ] User registration and login
- [ ] Video uploads (various formats and sizes)
- [ ] Video processing (clips, thumbnails, captions)
- [ ] Video viewing and playback
- [ ] Video editing features
- [ ] User profile management
- [ ] Subscription management
- [ ] Payment processing (if applicable)
- [ ] Email notifications
- [ ] Error handling and edge cases
- [ ] Performance with multiple videos
- [ ] Database queries and storage
- [ ] API endpoints (test via Postman/curl)
- [ ] Frontend UI/UX

## Troubleshooting

### "Database not configured" error
- Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env`
- Or configure MongoDB if using that instead

### Still seeing dev mode behavior
- Check your JWT token - should NOT start with `dev-jwt-token-`
- Log out and log in with a real account
- Clear browser localStorage and re-login

### Videos not storing
- Check database connection
- Check file upload permissions
- Check storage configuration (local vs S3/Cloudinary)

### Can't register account
- Check database is configured
- Check email isn't already registered
- Check password meets requirements
- Check rate limiting isn't blocking you

## Next Steps

1. ✅ Set up database (Supabase or MongoDB)
2. ✅ Create test accounts
3. ✅ Test all features with real accounts
4. ✅ Verify data is stored in database
5. ✅ Test video processing pipeline
6. ✅ Test user workflows end-to-end
7. ✅ Fix any issues found
8. ✅ Deploy to staging environment
9. ✅ Test in staging
10. ✅ Deploy to production
