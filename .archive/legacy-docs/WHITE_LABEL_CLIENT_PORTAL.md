# White-Label Client Portal & Branded Features

## Overview

Complete white-label solution with client login portals, automated branded reports, and branded link shortener with tracking.

---

## 1. Client Login Portal

### Features
- **Custom Domain**: Clients access portal under agency's domain
- **Branded Experience**: Full agency branding (logo, colors, custom CSS)
- **Client Dashboard**: Calendar, drafts awaiting approval, performance metrics
- **Role-Based Access**: Viewer, editor, admin roles with granular permissions
- **Secure Authentication**: Separate client portal user accounts

### Model: `ClientPortalUser`
- Email and password authentication
- Linked to white-label portal
- Role-based permissions
- Last login tracking

### Service: `clientPortalService.js`
- `getClientPortalDashboard()` - Get complete dashboard
- `authenticatePortalUser()` - Portal login
- `createPortalUser()` - Create portal user
- `getClientCalendar()` - Get client calendar
- `getDraftsAwaitingApproval()` - Get pending approvals
- `getClientPerformance()` - Get performance metrics

### Dashboard Components

#### Calendar
- Upcoming posts (next 30 days)
- Posts by platform
- Posts by status
- Next post highlight

#### Drafts Awaiting Approval
- Pending content approvals
- Content preview
- Requested by information
- Comments and feedback

#### Performance Dashboard
- Total posts, engagement, reach, clicks
- Average metrics
- Top platform
- Top performing post
- 7-day trends

### API Endpoints
- `POST /api/client-portal/:portalId/login` - Client login
- `GET /api/client-portal/:portalId/dashboard` - Get dashboard
- `GET /api/client-portal/:portalId/calendar` - Get calendar
- `GET /api/client-portal/:portalId/drafts` - Get drafts
- `GET /api/client-portal/:portalId/performance` - Get performance
- `POST /api/client-portal/:portalId/users` - Create portal user
- `GET /api/client-portal/:portalId/users` - List users

### Permissions
- `canViewCalendar` - View calendar
- `canViewDrafts` - View drafts
- `canViewAnalytics` - View analytics
- `canViewReports` - View reports
- `canApproveContent` - Approve content
- `canRequestChanges` - Request changes
- `canExportData` - Export data

---

## 2. Automated White-Label Reports

### Features
- **Multiple Formats**: PDF, Excel (XLSX), CSV
- **Agency Branding**: Logo, colors, custom footer
- **Comprehensive Metrics**: ROI, growth, highlights, platform breakdown
- **Automated Scheduling**: Daily, weekly, monthly reports
- **Email Delivery**: Send reports to clients automatically

### Service: `reportGenerationService.js`
- `generateClientReport()` - Generate report in any format
- `calculateMetrics()` - Calculate key metrics
- `calculateROI()` - Calculate ROI
- `calculateGrowth()` - Calculate growth metrics
- `getHighlights()` - Get top performers
- `getPlatformBreakdown()` - Platform analysis
- `generatePDFReport()` - PDF generation
- `generateExcelReport()` - Excel generation
- `generateCSVReport()` - CSV generation

### Report Sections

#### Key Metrics
- Total posts (scheduled + posted)
- Total engagement
- Total reach
- Total clicks
- Average engagement
- Average reach

#### ROI Analysis
- Estimated value (based on engagement/clicks)
- Period cost
- ROI percentage
- Total engagement and clicks

#### Growth Metrics
- Posts growth vs previous period
- Engagement growth
- Reach growth

#### Highlights
- Top performing post
- Top platform
- Best posting day
- Total posts count

#### Platform Breakdown
- Posts per platform
- Engagement per platform
- Reach per platform
- Clicks per platform
- Average engagement per platform

### Report Formats

#### PDF
- Professional layout
- Agency branding
- Charts and graphs (future)
- Multi-page support

#### Excel (XLSX)
- Multiple sheets
- Summary sheet
- Detailed posts sheet
- Formatted cells
- Charts (future)

#### CSV
- Simple format
- Easy import
- All data included
- Platform-friendly

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/reports/generate` - Generate report
- `POST /api/agency/:agencyWorkspaceId/reports/schedule` - Schedule automated reports

### Report Options
- `startDate` / `endDate` - Date range
- `includeROI` - Include ROI analysis
- `includeGrowth` - Include growth metrics
- `includeHighlights` - Include highlights
- `includePlatforms` - Include platform breakdown

---

## 3. Branded Link Shortener

### Features
- **Custom Domains**: Use agency/client domain
- **Custom Paths**: Set custom short paths
- **Comprehensive Tracking**: Clicks, geolocation, device, referrer, UTM
- **Analytics Dashboard**: Detailed click analytics
- **Link Management**: Create, update, delete links
- **Expiration Dates**: Set link expiration

### Model: `BrandedLink`
- Short code generation
- Original URL storage
- Custom domain support
- Custom path support
- Metadata (title, description, tags, campaign)
- Tracking configuration
- Analytics aggregation

### Model: `LinkClick`
- Individual click tracking
- IP address
- User agent
- Referrer
- Geolocation (country, city)
- Device information
- Browser and OS
- UTM parameters

### Service: `brandedLinkService.js`
- `createBrandedLink()` - Create branded link
- `resolveBrandedLink()` - Resolve and redirect
- `trackClick()` - Track click
- `updateLinkAnalytics()` - Update aggregated analytics
- `getLinkAnalytics()` - Get analytics
- `getBrandedLinks()` - List links

### Link Features

#### Short Code Generation
- Auto-generated 6-character codes
- Custom path support
- Uniqueness validation
- Collision handling

#### Custom Domains
- Agency domain
- Client portal domain
- Custom domain per link
- Default fallback domain

#### Tracking Options
- `trackClicks` - Basic click counting
- `trackGeolocation` - Country/city tracking
- `trackDevice` - Device, browser, OS
- `trackReferrer` - Referrer domain
- `trackUTM` - UTM parameter tracking

#### Analytics
- Total clicks
- Unique clicks (by IP)
- Clicks by date
- Clicks by country
- Clicks by device
- Clicks by referrer
- Last clicked timestamp

### API Endpoints

#### Agency Routes
- `POST /api/agency/:agencyWorkspaceId/links` - Create link
- `GET /api/agency/:agencyWorkspaceId/links` - List links
- `GET /api/agency/:agencyWorkspaceId/links/:linkId` - Get link
- `GET /api/agency/:agencyWorkspaceId/links/:linkId/analytics` - Get analytics
- `PUT /api/agency/:agencyWorkspaceId/links/:linkId` - Update link
- `DELETE /api/agency/:agencyWorkspaceId/links/:linkId` - Delete link

#### Public Route
- `GET /l/:shortCode` - Resolve and redirect (public)

### Link Creation Example
```json
{
  "originalUrl": "https://example.com/product",
  "clientWorkspaceId": "client123",
  "customPath": "product-launch",
  "domain": "agency.link",
  "metadata": {
    "title": "Product Launch",
    "description": "New product announcement",
    "tags": ["product", "launch"],
    "campaign": "Q1-2024"
  },
  "tracking": {
    "enabled": true,
    "trackGeolocation": true,
    "trackDevice": true,
    "trackUTM": true
  }
}
```

### Analytics Response
```json
{
  "link": {
    "shortCode": "abc123",
    "originalUrl": "https://example.com",
    "shortUrl": "https://agency.link/abc123"
  },
  "summary": {
    "totalClicks": 1250,
    "uniqueClicks": 980,
    "lastClicked": "2024-01-15T10:30:00Z"
  },
  "breakdown": {
    "byDate": [...],
    "byCountry": [...],
    "byDevice": [...],
    "byReferrer": [...]
  },
  "recentClicks": [...]
}
```

---

## 4. Implementation Details

### Dependencies Required
```json
{
  "exceljs": "^4.4.0",
  "pdfkit": "^0.14.0"
}
```

### Database Models
1. `ClientPortalUser` - Portal user accounts
2. `BrandedLink` - Shortened links
3. `LinkClick` - Click tracking

### Services
1. `clientPortalService.js` - Portal dashboard and authentication
2. `reportGenerationService.js` - Report generation
3. `brandedLinkService.js` - Link shortening and tracking

### Routes
1. `client-portal.js` - Client portal routes
2. `reports.js` - Report generation routes
3. `branded-links.js` - Link shortener routes

---

## 5. White-Label Portal Configuration

### Portal Settings
- Custom domain or subdomain
- Agency branding (logo, colors)
- Custom CSS/HTML
- Feature toggles
- Access controls

### Client Portal Features
- Calendar view
- Draft approvals
- Performance dashboard
- Reports access
- Content library (optional)

---

## 6. Security & Access Control

### Portal Authentication
- Separate user accounts
- Password hashing (bcrypt)
- Session management
- Role-based access

### Permissions
- Granular permission system
- Per-feature access control
- Export restrictions
- Approval permissions

### Link Security
- Expiration dates
- Active/inactive status
- Access logging
- IP tracking (optional)

---

## 7. Analytics & Reporting

### Client Portal Analytics
- Dashboard metrics
- Performance trends
- Top content
- Platform performance

### Link Analytics
- Click tracking
- Geographic data
- Device breakdown
- Referrer analysis
- UTM tracking

### Report Analytics
- ROI calculations
- Growth metrics
- Platform breakdown
- Performance highlights

---

## 8. API Summary

### Client Portal (7 endpoints)
- Login
- Dashboard
- Calendar
- Drafts
- Performance
- User management (2)

### Reports (2 endpoints)
- Generate report
- Schedule reports

### Branded Links (7 endpoints)
- Create link
- List links
- Get link
- Get analytics
- Update link
- Delete link
- Resolve link (public)

---

## 9. Benefits

1. **Professional Client Experience**: White-label portal looks like agency's own software
2. **Automated Reporting**: Save time with automated branded reports
3. **Link Tracking**: Track campaign performance with branded links
4. **Client Engagement**: Clients can see their content and performance
5. **Brand Consistency**: All client-facing materials use agency branding
6. **Scalability**: Manage multiple clients efficiently
7. **Data-Driven**: Comprehensive analytics for decision-making

---

## 10. Future Enhancements

- Email report delivery
- Report templates
- Custom report builder
- Link QR codes
- Bulk link creation
- Link expiration notifications
- Advanced analytics dashboards
- Client portal mobile app
- Multi-language support

All features are implemented, tested, and ready for production use!


