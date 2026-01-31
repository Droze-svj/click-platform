# Supabase Webhook Setup Guide

## Overview
Your server now has a comprehensive webhook endpoint to receive database change events from Supabase with enterprise-grade features.

**Endpoints:**
- `POST /api/webhooks/supabase` - Receive webhook events
- `GET /api/webhooks/supabase/health` - Health check and statistics

## Features

✨ **Enterprise Features:**
- ✅ Signature verification (HMAC SHA256)
- ✅ Rate limiting (100 req/min per IP)
- ✅ Webhook logging/audit trail
- ✅ Async processing for heavy operations
- ✅ Conditional filtering support
- ✅ Automatic retry logic for transient errors
- ✅ Health check endpoint with metrics
- ✅ Error recovery and graceful degradation

## How to Configure in Supabase Dashboard

### Step 1: Access Supabase Dashboard
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project

### Step 2: Navigate to Database Webhooks
1. In the left sidebar, click **Database**
2. Click **Webhooks** (or **Database Webhooks**)
3. Click **Create a new webhook**

### Step 3: Configure Webhook Settings

**Name:** `Your App Webhook` (or any descriptive name)

**Table:** Select the table you want to monitor (e.g., `users`, `content`, etc.)

**Events:** Select the events you want to receive:
- ✅ **INSERT** - When a new row is created
- ✅ **UPDATE** - When a row is updated
- ✅ **DELETE** - When a row is deleted

**HTTP Request:**
- **Method:** `POST`
- **URL:** Enter your webhook endpoint URL (see below for how to get it)
- **HTTP Headers:** (Optional)
  ```
  Content-Type: application/json
  ```

### How to Get Your Webhook URL

The webhook endpoint URL format is: `{YOUR_SERVER_URL}/api/webhooks/supabase`

#### For Local Development:

**Option 1: Direct Localhost (for testing locally)**
```
http://localhost:5001/api/webhooks/supabase
```
- Only works if Supabase is running locally
- Or if you're using a tool like ngrok (see below)

**Option 2: Using ngrok (recommended for local testing with Supabase)**

1. Install ngrok:
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. Start your server on port 5001:
   ```bash
   cd server
   node index.js
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok http 5001
   ```

4. Copy the HTTPS URL from ngrok output:
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:5001
   ```

5. Use this URL in Supabase:
   ```
   https://abc123.ngrok.io/api/webhooks/supabase
   ```

#### For Production:

**Determine your production URL:**

1. Check your hosting platform:
   - **Render.com**: `https://your-app-name.onrender.com/api/webhooks/supabase`
   - **Heroku**: `https://your-app-name.herokuapp.com/api/webhooks/supabase`
   - **Vercel**: `https://your-app-name.vercel.app/api/webhooks/supabase`
   - **AWS/EC2**: `https://your-domain.com/api/webhooks/supabase`
   - **Custom Domain**: `https://api.yourdomain.com/api/webhooks/supabase`

2. Check your environment variables:
   - Look for `API_URL`, `BASE_URL`, or `SERVER_URL` in your `.env` file
   - Your production server URL should be publicly accessible

3. Test the URL:
   ```bash
   # Test if your endpoint is accessible
   curl https://your-production-domain.com/api/webhooks/supabase/health
   
   # Should return:
   # {"status":"healthy","timestamp":"...","endpoint":"/api/webhooks/supabase",...}
   ```

**Example Production URLs:**
```
https://my-app.onrender.com/api/webhooks/supabase
https://api.mycompany.com/api/webhooks/supabase
https://my-app.herokuapp.com/api/webhooks/supabase
```

### Step 4: Set Webhook Secret (Recommended)
1. In your Supabase webhook configuration, set a **Secret**
2. Copy this secret value
3. Add it to your `.env` file:
   ```env
   SUPABASE_WEBHOOK_SECRET=your_webhook_secret_here
   ```

**Note:** The webhook endpoint will verify signatures if `SUPABASE_WEBHOOK_SECRET` is set. In production, signature verification is required for security.

### Step 5: Verify Your Webhook URL

Before testing, verify your webhook URL is accessible:

1. **Test the health endpoint:**
   ```bash
   # Local development
   curl http://localhost:5001/api/webhooks/supabase/health
   
   # Production (replace with your URL)
   curl https://your-domain.com/api/webhooks/supabase/health
   ```

2. **Expected response:**
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-01-10T13:30:00Z",
     "endpoint": "/api/webhooks/supabase",
     "features": {
       "signatureVerification": true,
       "logging": true,
       "rateLimiting": true,
       "asyncProcessing": true
     }
   }
   ```

3. **If you get an error:**
   - Check your server is running
   - Verify the URL is correct
   - Check firewall/network settings
   - Ensure the endpoint is publicly accessible (for production)

### Step 6: Test the Webhook

1. **After creating the webhook in Supabase, test it by:**
   - Inserting a new row in the monitored table
   - Updating an existing row
   - Deleting a row

2. **Check your server logs for webhook events:**
   ```
   Supabase webhook received { type: 'INSERT', table: 'users', ... }
   ```

3. **Check Supabase Dashboard:**
   - Go to Database > Webhooks
   - Click on your webhook
   - Check the "Logs" or "History" tab
   - You should see successful deliveries (status 200)

4. **Monitor webhook activity:**
   ```bash
   # Check recent webhook logs via health endpoint
   curl https://your-domain.com/api/webhooks/supabase/health
   
   # Check server logs
   tail -f server/logs/app.log | grep "Supabase webhook"
   ```

## Environment Variables

Add to your `.env` file:

```env
# Supabase Webhook Secret (required in production)
SUPABASE_WEBHOOK_SECRET=your_secret_here

# Optional: Filter webhooks by table (comma-separated)
# Only process webhooks from these tables
SUPABASE_WEBHOOK_FILTER_TABLES=users,content,posts

# Optional: Block specific tables (comma-separated)
# Never process webhooks from these tables
SUPABASE_WEBHOOK_BLOCK_TABLES=logs,audit,internal

# Optional: Filter webhooks by event type (comma-separated)
# Only process these event types (INSERT, UPDATE, DELETE)
SUPABASE_WEBHOOK_FILTER_EVENTS=INSERT,UPDATE
```

## Supported Events

The webhook endpoint currently handles events for these tables:

### Users Table
- **INSERT** → Triggers `user.created` internal webhook
- **UPDATE** → Triggers `user.updated` internal webhook
- **DELETE** → Triggers `user.deleted` internal webhook

### Content Table
- **INSERT** → Triggers `content.created` internal webhook
- **UPDATE** → Triggers `content.updated` internal webhook
- **DELETE** → Triggers `content.deleted` internal webhook

### Other Tables
Events for other tables are logged but don't trigger internal webhooks by default. You can extend the handlers in `server/routes/webhooks.js`.

## Webhook Payload Format

Supabase sends webhooks in this format:

```json
{
  "type": "INSERT",
  "table": "users",
  "schema": "public",
  "record": {
    "id": "user-uuid",
    "email": "user@example.com",
    "created_at": "2024-01-10T13:30:00Z"
  },
  "old_record": null,
  "timestamp": "2024-01-10T13:30:00Z"
}
```

## Advanced Features

### Rate Limiting
- **Limit:** 100 requests per minute per IP address
- **Purpose:** Prevent abuse and ensure system stability
- **Response:** Returns 429 (Too Many Requests) when limit exceeded

### Async Processing
- Webhooks are processed asynchronously for better reliability
- The endpoint responds immediately with 200 OK
- Heavy operations don't block the webhook response
- Failed operations are automatically retried for transient errors

### Conditional Filtering
Configure which webhooks to process using environment variables:
- **`SUPABASE_WEBHOOK_FILTER_TABLES`** - Only process specified tables
- **`SUPABASE_WEBHOOK_BLOCK_TABLES`** - Block specific tables
- **`SUPABASE_WEBHOOK_FILTER_EVENTS`** - Only process specified event types

### Webhook Logging & Audit Trail
- All webhook events are logged to the database
- Track delivery status (delivered, failed, filtered)
- Monitor response times and error rates
- Access logs via the WebhookLog model

### Health Check Endpoint
Check webhook system status:
```bash
GET /api/webhooks/supabase/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T13:30:00Z",
  "endpoint": "/api/webhooks/supabase",
  "features": {
    "signatureVerification": true,
    "logging": true,
    "rateLimiting": true,
    "asyncProcessing": true
  },
  "stats": {
    "recentWebhooks": 150,
    "recentFailures": 2,
    "successRate": "98.67%"
  }
}
```

### Retry Logic
- Automatically retries failed webhooks for transient errors
- Network timeouts, connection errors, and 5xx errors are retried
- Validation errors (400, 401, 403) are not retried
- Retry delay: 5 seconds

## Security

- **Signature Verification:** The endpoint uses HMAC SHA256 with constant-time comparison to verify webhook signatures
- **Secret Required:** In production, `SUPABASE_WEBHOOK_SECRET` must be set
- **Headers:** The webhook accepts multiple signature header formats:
  - `x-supabase-signature`
  - `X-Supabase-Signature`
  - `x-supabase-webhook-signature`
  - `X-Supabase-Webhook-Signature`
- **Rate Limiting:** Prevents abuse and DoS attacks (100 req/min per IP)

## Troubleshooting

### Webhook Not Receiving Events
1. Check that the webhook URL is correct and accessible
2. Verify your server is running and the endpoint is accessible
3. Check Supabase webhook logs in the dashboard for delivery status
4. Check the health endpoint: `GET /api/webhooks/supabase/health`
5. Verify your server logs for webhook events

### Signature Verification Failing
1. Ensure `SUPABASE_WEBHOOK_SECRET` matches the secret in Supabase dashboard
2. Check that the secret is set correctly (no extra spaces or quotes)
3. Verify the signature header is being sent (case-insensitive)
4. Check server logs for signature mismatch details

### 401 Unauthorized Errors
- This means signature verification failed
- Check that `SUPABASE_WEBHOOK_SECRET` is set correctly
- In development, signature verification is optional if secret is not set
- In production, signature verification is required

### 429 Too Many Requests
- Rate limit exceeded (100 requests per minute per IP)
- This is normal for high-volume webhooks
- Consider batching webhooks in Supabase configuration
- Check if you're being attacked or if there's a loop

### Webhooks Being Filtered
- Check `SUPABASE_WEBHOOK_FILTER_TABLES` environment variable
- Check `SUPABASE_WEBHOOK_BLOCK_TABLES` environment variable
- Check `SUPABASE_WEBHOOK_FILTER_EVENTS` environment variable
- Review server logs for "filtered out" messages

### Webhook Processing Slow
- Webhooks are processed asynchronously, so response is immediate
- Check the health endpoint for recent processing times
- Review server logs for slow handler operations
- Consider optimizing your webhook handlers

### Missing Webhook Logs
- Verify MongoDB connection is working
- Check WebhookLog model is properly initialized
- Review server logs for logging errors
- Logging failures don't block webhook processing

## Example Webhook Configuration

**For local development:**
```
Name: Local Dev Webhook
Table: users
Events: INSERT, UPDATE, DELETE
URL: http://localhost:5001/api/webhooks/supabase
Secret: (optional for local dev)
```

**For production:**
```
Name: Production Webhook
Table: users
Events: INSERT, UPDATE, DELETE
URL: https://yourdomain.com/api/webhooks/supabase
Secret: [Set a strong secret and add to SUPABASE_WEBHOOK_SECRET]
```

## Extending Webhook Handlers

To handle events for additional tables, edit `server/routes/webhooks.js` and add cases in the switch statements within:
- `handleSupabaseInsert()`
- `handleSupabaseUpdate()`
- `handleSupabaseDelete()`

Example:
```javascript
case 'your_table_name':
  await handleYourTableInserted(record);
  break;
```

