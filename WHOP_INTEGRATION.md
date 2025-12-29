# WHOP Integration Guide

## Setting Up WHOP Subscription

### 1. Create a Product on WHOP

1. Go to your WHOP dashboard
2. Create a new product
3. Set up monthly subscription pricing
4. Note your Product ID

### 2. Configure Webhooks

In your WHOP product settings, add a webhook URL:
```
https://your-domain.com/api/subscription/webhook
```

Webhook events to subscribe to:
- `subscription.created`
- `subscription.updated`
- `subscription.deleted`

### 3. Get API Credentials

1. Go to WHOP API settings
2. Generate an API key
3. Add it to your `.env` file:
```
WHOP_API_KEY=your-api-key-here
WHOP_API_URL=https://api.whop.com/api/v2
```

### 4. Subscription Verification Flow

When a user subscribes on WHOP:

1. User completes purchase on WHOP
2. WHOP sends webhook to `/api/subscription/webhook`
3. User can also manually verify by calling `/api/subscription/verify` with:
   - `whopUserId`: Their WHOP user ID
   - `whopSubscriptionId`: Their subscription ID

### 5. Access Control

The authentication middleware automatically checks subscription status:
- `active`: Full access
- `trial`: Full access (7-day trial)
- `cancelled`/`expired`: Access denied

## Testing

Use WHOP's sandbox mode for testing subscriptions without real charges.







