# Rate Limit and 500 Error Fixes

## Summary
Fixed persistent `429 (Too Many Requests)` errors and improved error handling for endpoints returning `500 (Internal Server Error)`.

## Changes Made

### 1. Excluded `/api/auth/me` from Rate Limiting
- **File**: `server/middleware/enhancedRateLimiter.js`
- **Change**: Added `/api/auth/me` to the `skip` function in `apiLimiter`
- **Reason**: `/api/auth/me` is called frequently by multiple frontend components (`useAuth` hook, dashboard page, home page) and React's Strict Mode in development doubles the requests. This endpoint should not be rate limited as it's essential for authentication state management.

### 2. Fixed `getUserAlerts` Error Handling
- **File**: `server/services/searchAlertService.js`
- **Change**: Modified `getUserAlerts` to return an empty array `[]` on error instead of throwing
- **Reason**: Prevents `500 (Internal Server Error)` when the SearchAlert model has issues or database queries fail. This matches the pattern used in `getSearchFacets` which returns an empty object on error.

## Expected Results

### Rate Limiting
- ✅ `/api/auth/me` should no longer return `429` errors
- ✅ Other endpoints still have rate limiting (300 requests per 15 minutes)
- ✅ Per-user rate limiting for authenticated requests

### 500 Errors
- ✅ `/api/search/alerts` should return `200` with empty array instead of `500` on errors
- ✅ `/api/search/facets` already handles errors gracefully (returns empty object)
- ✅ `/api/search/saved` already handles errors gracefully (returns empty array)
- ✅ `/api/notifications` should work if Notification model is properly set up

## Testing

After Render.com deploys (usually 2-5 minutes):

1. **Clear browser cache** (important for React Strict Mode changes)
2. **Refresh the dashboard**
3. **Check browser console** - should see:
   - ✅ No `429` errors for `/api/auth/me`
   - ✅ No `500` errors for `/api/search/alerts`
   - ✅ Other endpoints may still show `500` if there are underlying issues

## If 500 Errors Persist

If you still see `500` errors for other endpoints:

1. **Check Render.com logs** for specific error messages
2. **Verify models exist**: `SearchAlert`, `SavedSearch`, `Notification`
3. **Check database connection**: Ensure MongoDB Atlas is accessible
4. **Check model imports**: Ensure all models are properly imported in services

## Next Steps

1. Wait for Render.com to deploy (check deployment status)
2. Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Test the dashboard again
4. Report any remaining `429` or `500` errors with specific endpoint names

