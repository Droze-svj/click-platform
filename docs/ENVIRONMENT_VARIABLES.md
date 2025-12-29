# Environment Variables Documentation

Complete guide to all environment variables used in the application.

---

## 🔴 Required Variables

These variables **must** be set for the application to run.

### Core Configuration

```env
# Application
NODE_ENV=production                    # Environment: development, production, test
PORT=5001                              # Server port

# Database
MONGODB_URI=mongodb://localhost:27017/click  # MongoDB connection string

# Security
JWT_SECRET=your-super-secret-jwt-key   # Secret key for JWT tokens (use strong random string)
```

---

## 🟡 Recommended Variables

These variables are recommended for production but the app will work without them (with reduced functionality).

### Cloud Storage (AWS S3)

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1                   # AWS region
AWS_S3_ACL=private                      # Access control: private, public-read
AWS_CLOUDFRONT_URL=https://cdn.yourdomain.com  # Optional: CDN URL
```

**Note**: If not configured, files will be stored locally in the `uploads/` directory.

### OAuth Integrations

#### Twitter/X

```env
TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-client-secret
TWITTER_CALLBACK_URL=https://yourdomain.com/api/oauth/twitter/callback
```

#### LinkedIn

```env
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/oauth/linkedin/callback
```

#### Facebook/Instagram

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/oauth/facebook/callback
```

### Monitoring & Error Tracking

```env
# Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1          # 10% of transactions traced
```

### Caching (Redis)

```env
REDIS_URL=redis://localhost:6379       # Redis connection URL
```

### Email Service

```env
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Or SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Frontend

```env
FRONTEND_URL=https://yourdomain.com    # Frontend URL for OAuth callbacks
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api  # Public API URL
```

---

## 🟢 Optional Variables

These variables are optional and have sensible defaults.

### Rate Limiting

```env
RATE_LIMIT_WINDOW_MS=900000            # 15 minutes in milliseconds
RATE_LIMIT_MAX=100                     # Max requests per window
```

### Logging

```env
LOG_LEVEL=info                         # Log level: error, warn, info, debug
LOG_FORMAT=json                         # Log format: json, text
```

### Request Timeout

```env
REQUEST_TIMEOUT=30000                   # Request timeout in milliseconds (30 seconds)
```

### JWT Configuration

```env
JWT_EXPIRES_IN=30d                     # JWT token expiration (30 days)
```

### Data Retention

```env
DATA_RETENTION_DAYS=365                # Days to retain user data
```

### CORS

```env
CORS_ORIGIN=https://yourdomain.com      # CORS allowed origin
```

---

## 📋 Environment-Specific Files

### Development (.env)
```bash
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/click-dev
JWT_SECRET=dev-secret-key
PORT=5001
FRONTEND_URL=http://localhost:3000
```

### Production (.env.production)
```bash
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db/click
JWT_SECRET=your-production-secret-key-here
PORT=5001
FRONTEND_URL=https://yourdomain.com
# ... all other production variables
```

### Test (.env.test)
```bash
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/click-test
JWT_SECRET=test-secret-key
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, random secrets** for `JWT_SECRET` (minimum 32 characters)
3. **Rotate secrets regularly** in production
4. **Use different secrets** for development, staging, and production
5. **Restrict access** to environment variables on your server
6. **Use secret management** services (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## ✅ Validation

The application validates required environment variables on startup. Missing required variables will cause the application to fail to start.

To manually validate:

```bash
npm run validate:env
```

---

## 📝 Quick Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in required variables:
   ```bash
   # Edit .env file
   nano .env
   ```

3. Validate:
   ```bash
   npm run validate:env
   ```

---

## 🆘 Troubleshooting

### "Missing required environment variables"
- Check that all required variables are set
- Verify `.env` file exists and is in the project root
- Ensure variable names match exactly (case-sensitive)

### "Cloud storage not configured"
- This is a warning, not an error
- App will use local storage if S3 not configured
- For production, configure S3 for scalability

### "OAuth not configured"
- OAuth features will be disabled
- Set OAuth credentials to enable social media posting

---

## 📚 Additional Resources

- [AWS S3 Setup Guide](https://docs.aws.amazon.com/s3/)
- [Twitter OAuth Setup](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [Sentry Setup](https://docs.sentry.io/)
- [Redis Setup](https://redis.io/docs/getting-started/)




