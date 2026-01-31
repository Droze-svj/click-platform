# How to Get Your Webhook URL for Supabase

## Quick Reference

Your webhook endpoint URL format:
```
{YOUR_SERVER_URL}/api/webhooks/supabase
```

## Finding Your Server URL

### Local Development

**Default Local URL:**
```
http://localhost:5001/api/webhooks/supabase
```

**Using ngrok (for local testing with Supabase):**
1. Install ngrok: `brew install ngrok` (Mac) or download from [ngrok.com](https://ngrok.com)
2. **Sign up for ngrok (free):** Go to [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
3. **Get your authtoken:** Go to [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
4. **Configure ngrok:** Run `ngrok config add-authtoken YOUR_AUTHTOKEN_HERE`
5. Start your server: `cd server && node index.js`
6. In another terminal, run: `ngrok http 5001`
7. Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)
8. Your webhook URL: `https://abc123.ngrok.io/api/webhooks/supabase`

**Note:** The ngrok URL changes every time you restart ngrok (unless you have a paid plan with a static domain).

### Production

Find your production URL based on your hosting platform:

#### Render.com
- Check your Render dashboard
- URL format: `https://your-app-name.onrender.com/api/webhooks/supabase`
- Example: `https://my-api-abc123.onrender.com/api/webhooks/supabase`

#### Heroku
- Check your Heroku dashboard
- URL format: `https://your-app-name.herokuapp.com/api/webhooks/supabase`
- Example: `https://my-api-12345.herokuapp.com/api/webhooks/supabase`

#### Vercel
- Check your Vercel dashboard
- URL format: `https://your-app-name.vercel.app/api/webhooks/supabase`
- Or custom domain: `https://api.yourdomain.com/api/webhooks/supabase`

#### AWS / EC2
- Use your EC2 instance public IP or domain
- URL format: `https://your-domain.com/api/webhooks/supabase`
- Or: `https://ec2-xxx-xxx-xxx-xxx.compute-1.amazonaws.com/api/webhooks/supabase`

#### Custom Domain
- Use your domain with API subdomain
- URL format: `https://api.yourdomain.com/api/webhooks/supabase`
- Example: `https://api.example.com/api/webhooks/supabase`

## Checking Your Environment Variables

Your server URL might be defined in environment variables:

1. Check your `.env` file for:
   - `API_URL`
   - `BASE_URL`
   - `SERVER_URL`
   - `PORT` (default: 5001)

2. Check your hosting platform's environment variables:
   - Render.com: Dashboard > Environment
   - Heroku: `heroku config`
   - Vercel: Dashboard > Settings > Environment Variables

## Testing Your Webhook URL

Before configuring in Supabase, test that your URL is accessible:

```bash
# Test health endpoint
curl https://your-domain.com/api/webhooks/supabase/health

# Expected response:
# {
#   "status": "healthy",
#   "endpoint": "/api/webhooks/supabase",
#   ...
# }
```

If you get a connection error, check:
- ✅ Server is running
- ✅ URL is correct
- ✅ Port is accessible (not blocked by firewall)
- ✅ URL is publicly accessible (for production)

## Complete Example

### Local Development with ngrok:

1. **Start server:**
   ```bash
   cd "/Users/orlandhino/WHOP AI V3/server"
   node index.js
   ```
   Output: `✅ Server listening on port 5001`

2. **Start ngrok:**
   ```bash
   ngrok http 5001
   ```
   Output:
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:5001
   ```

3. **Use in Supabase:**
   ```
   URL: https://abc123.ngrok.io/api/webhooks/supabase
   Method: POST
   ```

### Production Example:

1. **Find your Render.com URL:**
   - Dashboard shows: `https://my-api-abc123.onrender.com`

2. **Use in Supabase:**
   ```
   URL: https://my-api-abc123.onrender.com/api/webhooks/supabase
   Method: POST
   ```

3. **Test it:**
   ```bash
   curl https://my-api-abc123.onrender.com/api/webhooks/supabase/health
   ```

## Common Issues

### "Connection Refused"
- Server not running
- Wrong port number
- Firewall blocking port

### "404 Not Found"
- Wrong URL path (should end with `/api/webhooks/supabase`)
- API routes not properly configured

### "Timeout"
- Server is slow to respond
- Network issues
- Server overloaded

### "For localhost only"
- Supabase cannot reach `localhost` URLs
- Use ngrok or deploy to a public server

## Need Help?

1. Check server logs: `tail -f server/logs/app.log`
2. Test health endpoint: `curl {YOUR_URL}/api/webhooks/supabase/health`
3. Check Supabase webhook logs in dashboard
4. Verify environment variables are set correctly

