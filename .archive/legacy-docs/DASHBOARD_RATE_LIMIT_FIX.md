# Dashboard Rate Limiting Fix

## Problem
The dashboard was experiencing `429 (Too Many Requests)` errors when loading, causing multiple API endpoints to fail. This was happening because:

1. **Low Rate Limit**: The rate limiter was set to only 100 requests per 15 minutes per IP
2. **IP-Based Limiting**: All requests from the same IP (e.g., Render.com's load balancer) were counted together
3. **Dashboard Load**: The dashboard makes 10+ concurrent API calls on initial load, quickly hitting the limit

## Solution
Updated `server/middleware/rateLimiter.js` to:

1. **Increased Rate Limit**: Changed from 100 to 300 requests per 15 minutes
2. **Per-User Rate Limiting**: Authenticated users are now tracked by `req.user._id` instead of IP address
3. **Health Check Exclusion**: Health check endpoints are excluded from rate limiting

### Changes Made:
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?._id?.toString() || req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    // Skip health checks
    return req.path === '/health' || req.path === '/health/debug-redis';
  },
});
```

## Testing

### Automated Test
Run the test script:
```bash
./scripts/test-dashboard-rate-limit.sh
```

### Manual Testing
1. **Wait for Render.com to redeploy** (check Render.com dashboard)
2. **Open the dashboard**: https://click-platform.onrender.com
3. **Log in** with your credentials
4. **Open browser console** (F12 → Console tab)
5. **Check for errors**:
   - ✅ Should see successful API calls (200 status)
   - ❌ Should NOT see 429 errors
   - ⚠️ May see 401/403 for unauthenticated endpoints (normal)

### Expected Behavior
- **Before Fix**: Multiple 429 errors on dashboard load
- **After Fix**: All API calls succeed (200 status) or show appropriate auth errors (401/403)

## Verification Checklist

- [ ] Render.com deployment completed successfully
- [ ] Health endpoint responds: `https://click-platform.onrender.com/api/health`
- [ ] Can log in to dashboard
- [ ] Dashboard loads without 429 errors in console
- [ ] All dashboard features accessible
- [ ] Multiple page refreshes don't trigger rate limits

## Rate Limit Details

### Current Limits:
- **Authenticated Users**: 300 requests per 15 minutes (per user)
- **Anonymous Users**: 300 requests per 15 minutes (per IP)
- **Auth Endpoints**: 5 requests per 15 minutes (stricter)
- **Upload Endpoints**: 10 uploads per hour

### Why This Works:
- Each authenticated user gets their own rate limit bucket
- Dashboard's 10-15 concurrent API calls are well within the 300 limit
- Multiple users don't interfere with each other's limits
- Health checks don't count toward limits

## Next Steps

If you still see 429 errors after redeploy:

1. **Check Render.com logs** for deployment status
2. **Verify the code was deployed** (check git commit in Render.com)
3. **Clear browser cache** and try again
4. **Wait a few minutes** for rate limit windows to reset
5. **Check if you're hitting a different rate limiter** (auth, upload, etc.)

## Related Files

- `server/middleware/rateLimiter.js` - Main rate limiting configuration
- `server/middleware/enhancedRateLimiter.js` - Enhanced rate limiter with Redis support
- `server/index.js` - Where rate limiter is applied (`app.use('/api', apiLimiter)`)

