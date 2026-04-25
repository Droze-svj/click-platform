# Pricing System Enhancements

## Overview

Enhanced pricing system with usage-based tracking, add-ons, prorated billing, promo codes, referral program, and comprehensive analytics.

---

## New Features

### 1. Usage Tracking System

#### Models
- **UsageTracking** - Monthly usage tracking with limits and overage
- Tracks: videos, content generations, scripts, posts, API calls, storage, brands, client workspaces
- Automatic monthly reset
- Overage tracking and charges

#### Service: `usageTrackingService.js`
- `getCurrentUsage()` - Get current period usage
- `incrementUsage()` - Track usage automatically
- `canPerformAction()` - Check if action is allowed
- `getUsageStats()` - Get historical usage statistics
- `calculateOverageCharges()` - Calculate overage fees

#### Middleware: `usageTracking.js`
- `trackUsage()` - Automatically track usage for actions
- `checkUsageLimit()` - Enforce usage limits before actions

---

### 2. Add-Ons System

#### Model: `AddOn`
- Purchasable add-ons for subscription packages
- Categories: usage, feature, support, storage, team
- Compatible with specific packages or all packages
- Monthly/yearly pricing

#### Available Add-Ons
1. **Extra Videos** - $9/mo - Additional 50 videos/month
2. **Extra Content Generations** - $7/mo - Additional 200/month
3. **Extra Storage** - $5/mo - Additional 50GB
4. **Additional Brand** - $15/mo - Add one more brand
5. **Additional Client Workspace** - $25/mo - Add client workspace (Agency only)
6. **Priority Support** - $19/mo - Priority email/chat support
7. **Additional Team Member** - $10/mo - Add team member

#### API Endpoints
- `GET /api/billing/add-ons` - Get available add-ons
- Add-ons included in subscription change process

---

### 3. Prorated Billing

#### Model: `SubscriptionChange`
- Tracks all subscription changes (upgrade, downgrade, renewal, etc.)
- Calculates prorated amounts
- Handles credits for unused time
- Supports add-ons and promo codes

#### Service: `billingService.js`
- `calculateProratedAmount()` - Calculate prorated charges/credits
- `processSubscriptionChange()` - Process upgrade/downgrade
- `completeSubscriptionChange()` - Complete after payment
- `applyPromoCode()` - Validate and apply discount codes

#### Features
- Automatic credit calculation for unused time
- Prorated charges for upgrades
- Support for mid-cycle changes
- Add-on pricing included
- Promo code discounts applied

---

### 4. Promo Codes

#### Model: `PromoCode`
- Discount codes with flexible options
- Types: percentage, fixed amount, free months
- Usage limits (total and per user)
- Validity dates
- Package-specific or universal

#### Features
- Percentage discounts (with max cap)
- Fixed amount discounts
- Free months for yearly subscriptions
- Min purchase requirements
- Max uses tracking

#### API Endpoints
- `POST /api/billing/promo-code/validate` - Validate promo code
- `GET /api/billing/promo-codes` - Get active promo codes

---

### 5. Referral Program

#### Service: `referralService.js`
- `generateReferralCode()` - Generate unique referral code
- `applyReferralCode()` - Apply referral code (new users)
- `getReferralStats()` - Get referral statistics

#### Rewards
- **Referrer**: 1 month free (promo code)
- **New User**: 20% off first month

#### User Model Updates
- `referralCode` - User's referral code
- `referredBy` - Who referred this user
- `referralStats` - Total referrals, active referrals, rewards
- `referralRewardCode` - Promo code for rewards

#### API Endpoints
- `GET /api/billing/referral/code` - Get/generate referral code
- `POST /api/billing/referral/apply` - Apply referral code
- `GET /api/billing/referral/stats` - Get referral statistics

---

### 6. Usage Analytics Dashboard

#### Routes: `usage-analytics.js`
- `GET /api/usage-analytics/dashboard` - Comprehensive dashboard
- `GET /api/usage-analytics/forecast` - Usage forecasting
- `GET /api/usage-analytics/breakdown` - Detailed breakdown

#### Features
- **Current Usage**: Real-time usage vs limits
- **Trends**: Month-over-month trends
- **Projections**: Forecast next period usage
- **Alerts**: Usage warnings and recommendations
- **Breakdown**: Detailed usage by metric
- **Forecasting**: Predictive usage analysis

#### Analytics Include
- Usage percentages
- Overage tracking
- Trend analysis (increasing/decreasing/stable)
- Usage projections
- Upgrade recommendations
- Limit warnings

---

## API Endpoints Summary

### Billing
- `POST /api/billing/upgrade` - Upgrade/downgrade subscription
- `POST /api/billing/change/:changeId/complete` - Complete subscription change
- `POST /api/billing/promo-code/validate` - Validate promo code
- `GET /api/billing/usage` - Get current usage
- `GET /api/billing/usage/stats` - Get usage statistics
- `GET /api/billing/usage/check` - Check if action allowed
- `GET /api/billing/overage` - Get overage charges
- `GET /api/billing/add-ons` - Get available add-ons
- `GET /api/billing/promo-codes` - Get active promo codes
- `GET /api/billing/history` - Get billing history
- `GET /api/billing/referral/code` - Get referral code
- `POST /api/billing/referral/apply` - Apply referral code
- `GET /api/billing/referral/stats` - Get referral stats

### Usage Analytics
- `GET /api/usage-analytics/dashboard` - Comprehensive dashboard
- `GET /api/usage-analytics/forecast` - Usage forecast
- `GET /api/usage-analytics/breakdown` - Detailed breakdown

---

## Usage Tracking Integration

### Automatic Tracking
Usage is automatically tracked when:
- Videos are processed
- Content is generated
- Scripts are created
- Posts are scheduled
- API calls are made
- Storage is used
- Brands/workspaces are created

### Limit Enforcement
Limits are checked before:
- Processing videos
- Generating content
- Creating scripts
- Scheduling posts
- Making API calls
- Creating brands/workspaces

### Overage Handling
When limits are exceeded:
- Overage is tracked
- Charges are calculated
- Users are notified
- Upgrade prompts shown

---

## Pricing Flow

### Upgrade/Downgrade Flow
1. User selects new package
2. System calculates prorated amount
3. User can add add-ons
4. User can apply promo code
5. System creates `SubscriptionChange` record
6. Payment processed
7. Subscription updated
8. Usage limits updated

### Add-On Purchase
1. User selects add-on
2. Add-on added to subscription change
3. Prorated pricing calculated
4. Payment processed
5. Features enabled immediately

### Promo Code Flow
1. User enters promo code
2. System validates code
3. Discount calculated
4. Applied to subscription change
5. Usage tracked

---

## Overage Rates

Default overage rates:
- **Videos**: $0.10 per video
- **Content Generations**: $0.05 per generation
- **API Calls**: $0.001 per 1,000 calls
- **Storage**: $0.01 per GB

Customizable per package or user.

---

## Usage Analytics Features

### Dashboard Metrics
- Current usage vs limits
- Usage percentages
- Overage amounts
- Trend indicators
- Projections

### Forecasting
- Linear regression forecasting
- Confidence levels (high/medium/low)
- Exceed predictions
- Buffer calculations

### Recommendations
- Upgrade suggestions
- Add-on recommendations
- Usage optimization tips
- Limit warnings

---

## Database Schema Updates

### User Model
- `referralCode` - Unique referral code
- `referredBy` - Referrer user ID
- `referralStats` - Referral statistics
- `referralRewardCode` - Reward promo code

### New Models
- `UsageTracking` - Monthly usage tracking
- `AddOn` - Purchasable add-ons
- `PromoCode` - Discount codes
- `SubscriptionChange` - Subscription change history

---

## Implementation Notes

### Usage Tracking
- Automatic monthly reset
- Overage tracking
- Historical data retention (30 days)
- Real-time limit checking

### Billing
- Prorated calculations
- Credit handling
- Add-on support
- Promo code integration
- Payment processing ready

### Analytics
- Real-time dashboard
- Historical trends
- Predictive forecasting
- Smart recommendations

---

## Next Steps

1. ✅ Usage tracking system
2. ✅ Add-ons system
3. ✅ Prorated billing
4. ✅ Promo codes
5. ✅ Referral program
6. ✅ Usage analytics
7. ⏳ Payment integration (Stripe/PayPal)
8. ⏳ Email notifications for usage alerts
9. ⏳ Frontend dashboard implementation
10. ⏳ Automated billing processing

---

## Benefits

1. **Flexible Pricing**: Add-ons allow users to customize their plan
2. **Fair Billing**: Prorated billing ensures users only pay for what they use
3. **Growth Tools**: Referral program and promo codes drive growth
4. **Transparency**: Usage analytics help users understand their consumption
5. **Proactive**: Alerts and recommendations prevent surprises
6. **Revenue Optimization**: Overage charges and add-ons increase revenue


