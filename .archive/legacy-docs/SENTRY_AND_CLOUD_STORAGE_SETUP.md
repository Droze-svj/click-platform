# Sentry & Cloud Storage Setup Guide

## ✅ Implemented Features

### 1. Sentry Integration
- **Backend**: Error tracking and performance monitoring
- **Frontend**: Next.js error tracking with automatic source maps
- **Features**:
  - Automatic error capture
  - Performance monitoring
  - User context tracking
  - Breadcrumb logging
  - Sensitive data filtering

### 2. Cloud Storage (AWS S3)
- **Service**: `server/services/storageService.js`
- **Features**:
  - Automatic S3 upload for files
  - Local storage fallback (development)
  - File deletion support
  - Signed URL generation for private files
  - CDN support (CloudFront)

### 3. Real OAuth Integration
- **Twitter/X**: Full OAuth 2.0 implementation
- **LinkedIn**: OAuth 2.0 integration
- **Facebook/Instagram**: OAuth integration
- **Features**:
  - Authorization URL generation
  - Token exchange
  - Token refresh (Twitter)
  - Real API posting

---

## 🔧 Environment Variables Required

### Sentry Configuration

```env
# Backend Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=click@1.0.0

# Frontend Sentry (Next.js)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_RELEASE=click-client@1.0.0

# Sentry Organization (for source maps)
SENTRY_ORG=your-org
SENTRY_PROJECT=click
```

### AWS S3 Configuration

```env
# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_S3_ACL=private  # or public-read
AWS_CLOUDFRONT_URL=https://your-cdn.cloudfront.net  # Optional
```

### OAuth Configuration

```env
# Twitter/X OAuth
TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-client-secret

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret

# Facebook/Instagram OAuth
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret

# App URL (for OAuth callbacks)
APP_URL=https://yourdomain.com
# or
FRONTEND_URL=https://yourdomain.com
```

---

## 📝 Setup Instructions

### 1. Sentry Setup

1. **Create Sentry Account**:
   - Go to https://sentry.io
   - Create a new project
   - Select "Node.js" for backend
   - Select "Next.js" for frontend

2. **Get DSN**:
   - Copy the DSN from your Sentry project settings
   - Add to `.env` file

3. **Verify Setup**:
   - Errors will automatically be sent to Sentry
   - Check your Sentry dashboard for incoming errors

### 2. AWS S3 Setup

1. **Create S3 Bucket**:
   ```bash
   # Using AWS CLI
   aws s3 mb s3://your-bucket-name --region us-east-1
   ```

2. **Configure CORS** (if needed):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```

3. **Create IAM User**:
   - Create IAM user with S3 permissions
   - Generate access keys
   - Add to `.env` file

4. **Optional: CloudFront CDN**:
   - Create CloudFront distribution
   - Point to S3 bucket
   - Add CloudFront URL to `.env`

### 3. OAuth Setup

#### Twitter/X

1. **Create Twitter App**:
   - Go to https://developer.twitter.com
   - Create a new app
   - Enable OAuth 2.0
   - Set callback URL: `https://yourdomain.com/api/oauth/callback/twitter`
   - Get Client ID and Secret

2. **Add to `.env`**:
   ```env
   TWITTER_CLIENT_ID=your-client-id
   TWITTER_CLIENT_SECRET=your-client-secret
   ```

#### LinkedIn

1. **Create LinkedIn App**:
   - Go to https://www.linkedin.com/developers/apps
   - Create new app
   - Add redirect URL: `https://yourdomain.com/api/oauth/callback/linkedin`
   - Request permissions: `w_member_social`
   - Get Client ID and Secret

2. **Add to `.env`**:
   ```env
   LINKEDIN_CLIENT_ID=your-client-id
   LINKEDIN_CLIENT_SECRET=your-client-secret
   ```

#### Facebook/Instagram

1. **Create Facebook App**:
   - Go to https://developers.facebook.com
   - Create new app
   - Add Facebook Login product
   - Set OAuth redirect URI: `https://yourdomain.com/api/oauth/callback/facebook`
   - Get App ID and Secret

2. **Add to `.env`**:
   ```env
   FACEBOOK_APP_ID=your-app-id
   FACEBOOK_APP_SECRET=your-app-secret
   ```

---

## 🚀 Usage

### File Uploads

Files are automatically uploaded to S3 if configured, otherwise stored locally:

```javascript
const { uploadFile } = require('./services/storageService');

const result = await uploadFile(
  '/path/to/file',
  'videos/my-video.mp4',
  'video/mp4',
  { userId: '123' }
);

console.log(result.url); // S3 URL or local URL
```

### OAuth Flow

1. **Get Authorization URL**:
   ```javascript
   GET /api/oauth/auth/twitter
   // Returns: { authUrl: "...", state: "..." }
   ```

2. **User Authorizes**:
   - Redirect user to `authUrl`
   - User authorizes app
   - Callback to `/api/oauth/callback/twitter`

3. **Complete Connection**:
   ```javascript
   POST /api/oauth/complete
   {
     "platform": "twitter",
     "accessToken": "...",
     "refreshToken": "...",
     "metadata": {}
   }
   ```

### Posting to Social Media

```javascript
POST /api/social/post
{
  "platform": "twitter",
  "content": {
    "text": "Hello, world!"
  },
  "options": {}
}
```

---

## 🔍 Testing

### Test Sentry

1. **Trigger an error**:
   ```javascript
   throw new Error('Test error');
   ```

2. **Check Sentry dashboard** - error should appear

### Test Cloud Storage

1. **Upload a file**:
   ```bash
   curl -X POST http://localhost:5001/api/video/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "video=@test.mp4"
   ```

2. **Check S3 bucket** - file should be uploaded

### Test OAuth

1. **Get auth URL**:
   ```bash
   curl http://localhost:5001/api/oauth/auth/twitter \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Follow OAuth flow** - complete authorization

---

## 📊 Monitoring

### Sentry Dashboard

- View errors in real-time
- See performance metrics
- Track user sessions
- Monitor release health

### S3 Usage

- Monitor storage usage in AWS Console
- Set up CloudWatch alarms
- Configure lifecycle policies

---

## 🛠️ Troubleshooting

### Sentry Not Working

- Check DSN is correct
- Verify environment variables
- Check network connectivity
- Review Sentry project settings

### S3 Upload Fails

- Verify AWS credentials
- Check bucket permissions
- Ensure bucket exists
- Review IAM policies

### OAuth Errors

- Verify callback URLs match
- Check OAuth credentials
- Ensure redirect URIs are whitelisted
- Review platform-specific requirements

---

## 📚 Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api)
- [LinkedIn API](https://docs.microsoft.com/en-us/linkedin/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)

---

**All features are now production-ready!** 🎉






