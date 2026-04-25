# Click Pricing Structure

## Overview

Click offers three main pricing tiers designed to compete effectively in the market while providing clear value differentiation:

1. **Creator** - Competitive with OpusClip/Vizard Creator plans
2. **Agency** - Significantly higher pricing for multi-client features
3. **Enterprise** - Custom pricing with enterprise features

---

## Pricing Tiers

### 🆓 Free Tier
**Price:** $0/month

**Perfect for:** Trying out Click

**Features:**
- 5 videos/month
- 10 content generations/month
- 3 scripts/month
- 1GB storage
- 1 brand
- Basic analytics
- Email support

**Limits:**
- 5 projects
- 1 team member
- 100 API calls/day

---

### 🎨 Creator Tier
**Price:** $19/month or $190/year (Save $38/year)

**Perfect for:** Individual creators with limited brands

**Competitive Positioning:**
- OpusClip Starter: $15/month (150 credits)
- OpusClip Pro: $29/month (3,600 credits/year)
- Vizard Starter: $30/month (300 minutes)
- **Click Creator: $19/month** - Better value with more features

**Key Differentiator:** Limited to 2 brands (vs unlimited in competitors)

**Features:**
- ✅ 100 videos/month (competitive with OpusClip Pro)
- ✅ 300 content generations/month (more generous)
- ✅ 50 scripts/month
- ✅ 20GB storage
- ✅ **2 brands** (limited - key differentiator)
- ✅ 2 team members
- ✅ HD video processing
- ✅ Advanced analytics
- ✅ Data export
- ✅ All 6 social platforms
- ✅ Email support

**Limits:**
- 50 projects
- 2 team members
- 2,000 API calls/day
- **2 brands maximum**

**Why it's competitive:**
- More video processing than OpusClip Starter
- More content generations than competitors
- Better storage (20GB vs typical 10GB)
- Lower price than Vizard Starter
- But limited brands to differentiate from Agency tier

---

### 🏢 Agency/Business Tier
**Price:** $149/month or $1,490/year (Save $298/year)

**Perfect for:** Agencies and businesses managing multiple clients

**Significantly Higher Pricing Justification:**
- Multi-client workspace management
- White-label portals
- Client approval dashboards
- Cross-client benchmarking
- Business Intelligence dashboards
- Bulk scheduling/import
- Per-client billing

**Features:**
- ✅ 500 videos/month
- ✅ 2,000 content generations/month
- ✅ 200 scripts/month
- ✅ 200GB storage
- ✅ **10 brands**
- ✅ **10 client workspaces** (key feature)
- ✅ 20 team members
- ✅ Multi-client workspaces ✅
- ✅ White-label portals ✅
- ✅ Client approval dashboards ✅
- ✅ Cross-client benchmarking ✅
- ✅ Bulk scheduling ✅
- ✅ White-label reporting ✅
- ✅ Per-client billing ✅
- ✅ BI dashboards ✅
- ✅ Custom reports ✅
- ✅ ROI tracking ✅
- ✅ Predictive analytics ✅
- ✅ Full API access
- ✅ Priority support

**Limits:**
- Unlimited projects
- 20 team members
- 50,000 API calls/day
- 10 brands
- 10 client workspaces

**Value Proposition:**
- Features not available in Creator tier
- Multi-client management (unique to Agency tier)
- White-label capabilities
- Advanced BI and reporting
- Agency-specific workflows

---

### 🏛️ Enterprise Tier
**Price:** Custom (Contact Sales)

**Perfect for:** Large organizations with advanced requirements

**Enterprise Features:**
- ✅ **SSO (Single Sign-On)** ✅
- ✅ **SLA (Service Level Agreement)** ✅
- ✅ **Advanced integrations** ✅
- ✅ **Full API access** ✅
- ✅ **Dedicated support** ✅
- ✅ **Custom integrations** ✅
- ✅ **Data warehouse export** ✅
- ✅ **On-premise deployment option** ✅

**Features:**
- ✅ Unlimited videos
- ✅ Unlimited content generations
- ✅ Unlimited scripts
- ✅ Unlimited storage
- ✅ Unlimited brands
- ✅ Unlimited client workspaces
- ✅ Unlimited team members
- ✅ Unlimited API calls
- ✅ All Agency features included
- ✅ All Enterprise features included

**Custom Pricing Factors:**
- Number of users
- Volume requirements
- Custom integrations needed
- SLA requirements
- Support level needed
- Deployment preferences

---

## Competitive Comparison

### Creator Tier
| Feature | Click Creator | OpusClip Starter | OpusClip Pro | Vizard Starter |
|---------|--------------|------------------|--------------|----------------|
| Price | **$19/mo** | $15/mo | $29/mo | $30/mo |
| Videos/Credits | 100/mo | 150 credits | 3,600/year | 300 min/mo |
| Brands | **2** | 1 | Multiple | 1 |
| Storage | 20GB | Limited | Limited | Limited |
| Content Gen | 300/mo | Limited | Limited | Limited |
| Team Members | 2 | 1 | 2 | 1 |

**Click Advantage:** Better value with more features, but limited brands to differentiate from Agency tier.

### Agency Tier
**Competitive Advantage:** Most competitors don't offer multi-client management at this price point.

**Unique Features:**
- Multi-client workspaces
- White-label portals
- Client approval dashboards
- Cross-client benchmarking
- BI dashboards

### Enterprise Tier
**Competitive Advantage:** Full enterprise feature set with custom pricing.

**Unique Features:**
- SSO
- SLA
- Custom integrations
- On-premise deployment

---

## Pricing Strategy

### Creator Tier Strategy
- **Positioning:** Competitive with OpusClip/Vizard Creator plans
- **Differentiator:** Limited brands (2) to create upgrade path
- **Value:** More features than competitors at competitive price
- **Target:** Individual creators who don't need multi-client management

### Agency Tier Strategy
- **Positioning:** Significantly higher pricing justified by unique features
- **Differentiator:** Multi-client management, white-label, BI dashboards
- **Value:** Features not available in Creator tier
- **Target:** Agencies and businesses managing multiple clients

### Enterprise Tier Strategy
- **Positioning:** Custom pricing for enterprise needs
- **Differentiator:** SSO, SLA, advanced integrations, full API access
- **Value:** Enterprise-grade features with dedicated support
- **Target:** Large organizations with advanced requirements

---

## API Endpoints

### Get Pricing Tiers
```
GET /api/membership/packages
```
Returns all active pricing tiers with features and highlights.

### Compare Packages
```
GET /api/membership/pricing/compare?packages=packageId1,packageId2
```
Compare multiple packages side-by-side.

### Get Recommendations
```
GET /api/membership/pricing/recommend
```
Get personalized package recommendations based on usage data.

### Calculate Savings
```
GET /api/membership/pricing/savings?monthly=19&yearly=190
```
Calculate yearly savings for annual plans.

### Competitor Comparison
```
GET /api/membership/pricing/competitors
```
Get competitive comparison with OpusClip and Vizard.

---

## Migration Notes

### From Old Pricing
- **Old "Pro" ($29/mo)** → **New "Creator" ($19/mo)** - Better value
- **Old "Enterprise" ($99/mo)** → **New "Agency" ($149/mo)** - More features
- **New "Enterprise"** - Custom pricing for true enterprise needs

### Feature Mapping
- Old Pro features → Creator tier (with brand limitation)
- Old Enterprise features → Agency tier (with multi-client features)
- New Enterprise tier → True enterprise features (SSO, SLA, etc.)

---

## Implementation

### Database Schema
The `MembershipPackage` model includes:
- `limits.maxBrands` - Number of brand/workspace profiles
- `limits.maxClientWorkspaces` - For agency tier
- `agencyFeatures` - Multi-client, white-label, approvals, etc.
- `enterpriseFeatures` - SSO, SLA, advanced integrations, etc.
- `businessIntelligence` - BI dashboards, custom reports, ROI tracking
- `pricing.isCustom` - For Enterprise tier
- `pricing.contactSales` - For Enterprise tier

### Services
- `pricingService.js` - Pricing calculations, comparisons, recommendations
- `subscriptionService.js` - Subscription management (existing)
- `membershipService.js` - Membership management (existing)

### Routes
- `/api/membership/packages` - Get all tiers
- `/api/membership/pricing/compare` - Compare packages
- `/api/membership/pricing/recommend` - Get recommendations
- `/api/membership/pricing/savings` - Calculate savings
- `/api/membership/pricing/competitors` - Competitor comparison

---

## Next Steps

1. ✅ Update database schema with new fields
2. ✅ Seed new pricing tiers
3. ✅ Create pricing service
4. ✅ Update membership routes
5. ⏳ Update frontend pricing page
6. ⏳ Add subscription limit enforcement for brands/workspaces
7. ⏳ Update billing system
8. ⏳ Create migration script for existing users


