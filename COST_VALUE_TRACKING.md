# Cost & Value Tracking System

## Overview

Per-client cost and value tracking, service tiers (Bronze/Silver/Gold), and agency KPI dashboards with month-over-month performance tracking.

---

## 1. Per-Client Cost & Value Tracking

### Features
- **Time Tracking**: Track time spent per client/campaign
- **Cost Calculation**: Calculate total cost (time, tools, ad spend)
- **Value Metrics**: Track impressions, reach, engagement, leads, conversions
- **ROI Calculation**: Automatic ROI calculation
- **Time Saved**: Track time saved through automation
- **Breakdowns**: By platform, content type, and campaign

### Model: `ClientValueTracking`
- Period tracking (start/end dates)
- Cost breakdown (time, tools, ads)
- Value metrics (impressions, leads, conversions, revenue)
- ROI and efficiency metrics
- Detailed breakdowns

### Service: `valueTrackingService.js`
- `calculateValueTracking()` - Calculate tracking for period
- `getClientValueTracking()` - Get client tracking
- `getAgencyValueTracking()` - Get aggregated agency tracking

### Metrics Tracked
- **Cost**: Time spent, time cost, tool cost, ad spend
- **Value**: Impressions, reach, engagement, clicks, leads, conversions, revenue
- **Efficiency**: ROI, cost per impression/lead/conversion, engagement rate, time efficiency
- **Breakdowns**: By platform, content type, campaign

### API Endpoints
- `POST /api/clients/:clientWorkspaceId/value-tracking/calculate` - Calculate tracking
- `GET /api/clients/:clientWorkspaceId/value-tracking` - Get client tracking
- `GET /api/agency/:agencyWorkspaceId/value-tracking` - Get agency tracking

---

## 2. Service Tiers (Bronze/Silver/Gold)

### Features
- **Pre-Packaged Tiers**: Bronze, Silver, Gold tiers
- **Customizable**: Create custom tiers
- **Feature-Based**: Posts per week, platforms, reports, AI features
- **Portal Integration**: Display tiers in client portal
- **Usage Tracking**: Track tier usage and limits
- **Limit Enforcement**: Check and enforce tier limits

### Default Tiers

#### Bronze
- 5 posts per week
- 2 platforms (LinkedIn, Twitter)
- Basic reports (monthly)
- Basic AI features
- Email support
- $499/month

#### Silver
- 10 posts per week
- 4 platforms (LinkedIn, Twitter, Facebook, Instagram)
- Standard reports (biweekly)
- Advanced AI features
- Priority email support
- $999/month

#### Gold
- 20 posts per week
- 6 platforms (all)
- Advanced reports (weekly)
- All AI features
- Dedicated support
- Custom branding
- API access
- $1,999/month

### Model: `ServiceTier`
- Tier name and description
- Pricing (monthly/annual)
- Features (posts, platforms, reports, AI, support)
- Limits (storage, content library)

### Model: `ClientServiceTier`
- Client tier assignment
- Usage tracking
- Billing information
- Status tracking

### Service: `serviceTierService.js`
- `createServiceTier()` - Create tier
- `createDefaultTiers()` - Create default tiers
- `assignTierToClient()` - Assign tier to client
- `getClientTier()` - Get client tier
- `updateTierUsage()` - Update usage
- `checkTierLimits()` - Check limits

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/service-tiers` - Create tier
- `GET /api/agency/:agencyWorkspaceId/service-tiers` - Get tiers
- `POST /api/agency/:agencyWorkspaceId/service-tiers/default` - Create defaults
- `POST /api/clients/:clientWorkspaceId/service-tier/assign` - Assign tier
- `GET /api/clients/:clientWorkspaceId/service-tier` - Get client tier
- `PUT /api/clients/:clientWorkspaceId/service-tier/usage` - Update usage
- `GET /api/clients/:clientWorkspaceId/service-tier/limits` - Check limits

---

## 3. Agency KPI Dashboards

### Features
- **Month-over-Month Tracking**: Compare current vs. previous period
- **Performance Metrics**: Impressions, engagement, leads, conversions
- **Content Velocity**: Posts per day, content per day
- **Client Breakdown**: Clients by tier, active clients
- **Campaign Highlights**: Top performing campaigns
- **ROI Tracking**: Overall ROI and trends
- **Trend Analysis**: Up/down/stable indicators

### Dashboard Sections

#### Performance
- Total impressions
- Total engagement
- Total leads
- Total conversions
- Total revenue
- Average ROI
- Month-over-month changes

#### Content Velocity
- Total posts
- Total content created
- Posts per day
- Content per day
- Velocity trends

#### Clients
- Total clients
- Active clients
- Clients by tier (Bronze/Silver/Gold)

#### Campaigns
- Active campaigns
- Campaign highlights (top performers)
- Campaign ROI

#### ROI
- Total cost
- Total value
- Net value
- ROI percentage
- ROI trends

### Service: `kpiDashboardService.js`
- `getAgencyKPIDashboard()` - Get complete dashboard

### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/kpi-dashboard` - Get dashboard

---

## 4. Integration Points

### Value Tracking Integration
- Automatically calculates when posts are published
- Tracks time spent (estimated)
- Calculates time saved through automation
- Updates ROI in real-time

### Service Tier Integration
- Enforces limits when creating posts
- Tracks usage automatically
- Updates portal display
- Manages billing periods

### KPI Dashboard Integration
- Pulls from value tracking
- Compares periods automatically
- Updates in real-time
- Exportable for presentations

---

## 5. Usage Examples

### Calculate Value Tracking
```javascript
POST /api/clients/{clientWorkspaceId}/value-tracking/calculate
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "hourlyRate": 100,
  "conversionValue": 50
}
```

### Assign Service Tier
```javascript
POST /api/clients/{clientWorkspaceId}/service-tier/assign
{
  "tierId": "...",
  "upgrade": true
}
```

### Get KPI Dashboard
```javascript
GET /api/agency/{agencyWorkspaceId}/kpi-dashboard?comparePeriod=true
```

---

## 6. Models Summary

### ClientValueTracking
- Period-based tracking
- Cost and value metrics
- ROI calculation
- Breakdowns

### ServiceTier
- Tier definitions
- Features and limits
- Pricing

### ClientServiceTier
- Client assignments
- Usage tracking
- Billing

---

## 7. Services Summary

### valueTrackingService.js
- Value calculation
- ROI tracking
- Aggregation

### serviceTierService.js
- Tier management
- Client assignments
- Usage tracking
- Limit enforcement

### kpiDashboardService.js
- Dashboard generation
- Trend analysis
- Month-over-month comparison

---

## 8. API Summary

### Value Tracking (3 endpoints)
- Calculate tracking
- Get client tracking
- Get agency tracking

### Service Tiers (7 endpoints)
- Create tier
- Get tiers
- Create defaults
- Assign tier
- Get client tier
- Update usage
- Check limits

### KPI Dashboard (1 endpoint)
- Get dashboard

**Total: 11 endpoints**

---

## 9. Benefits

### For Agencies
1. **ROI Visibility**: See actual ROI per client
2. **Time Tracking**: Understand time investment
3. **Value Demonstration**: Show value to clients
4. **Tier Management**: Easy tier assignment and tracking
5. **KPI Dashboards**: Present to decision makers

### For Clients
1. **Transparency**: See value delivered
2. **Tier Clarity**: Understand service level
3. **Usage Visibility**: Track usage against limits

---

All features are implemented, tested, and ready for production use!


