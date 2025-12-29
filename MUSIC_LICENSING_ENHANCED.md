# Music Licensing - Enhanced Compliance System

## Overview

Enhanced music licensing system with validation, quota management, compliance reporting, automated checks, and usage preview capabilities.

## New Features

### 1. **License Validation** (`musicLicenseValidationService.js`)

**Features:**
- Validate licenses before usage
- Check expiration dates
- Verify platform permissions
- Check usage limits
- Validate multiple tracks at once

**Validation Checks:**
- License status (active/inactive)
- Expiration dates
- Embedding permissions
- Usage limits
- Platform restrictions

**API:**
```
POST /api/music-licensing/validate
POST /api/music-licensing/validate/tracks
GET /api/music-licensing/track/:trackId/expiration
```

### 2. **Usage Quota Management** (`musicUsageQuotaService.js`)

**Features:**
- Monthly and daily quotas
- Per-license usage limits
- Quota tracking and reporting
- Usage recommendations

**Quota Types:**
- Monthly: Total tracks per month
- Daily: Tracks per day
- Per-license: Uses per licensed track

**API:**
```
GET /api/music-licensing/quota
GET /api/music-licensing/quota/statistics
GET /api/music-licensing/track/:trackId/can-use
```

### 3. **Compliance Reports** (`musicComplianceReportService.js`)

**Report Types:**
- Full compliance reports with summary and details
- Usage logs export (JSON/CSV)
- Compliance status calculation
- Issue identification

**Report Formats:**
- JSON (default)
- CSV (exportable)
- PDF (planned)

**Report Contents:**
- Usage summary by provider, license type, source
- Attribution compliance
- Registration status
- Compliance issues
- Export details

**API:**
```
GET /api/music-licensing/report?format=json&startDate=...&endDate=...
GET /api/music-licensing/export/logs?format=csv&startDate=...&endDate=...
```

### 4. **Automated Compliance Checks** (`musicComplianceCheckService.js`)

**Check Types:**
- Attribution compliance
- License registration
- License expiration
- Restriction violations

**Features:**
- Automated issue detection
- Severity classification
- Auto-fix capabilities
- Comprehensive reporting

**Auto-Fix:**
- Automatic license registration
- Missing attribution detection
- Expiration warnings

**API:**
```
GET /api/music-licensing/compliance/check
POST /api/music-licensing/compliance/auto-fix/:usageLogId
```

### 5. **Usage Preview** (`music-licensing-compliance.js`)

**Features:**
- Preview license usage before render
- Validate all tracks
- Check quotas
- Get comprehensive pre-render validation

**Checks:**
- License validity
- Quota availability
- Platform permissions
- All restrictions

**API:**
```
POST /api/music-licensing/preview-usage
```

## API Endpoints

### Validation
- `POST /api/music-licensing/validate` - Validate single track license
- `POST /api/music-licensing/validate/tracks` - Validate multiple tracks
- `GET /api/music-licensing/track/:trackId/expiration` - Check expiration

### Quotas
- `GET /api/music-licensing/quota?quotaType=monthly` - Check quota
- `GET /api/music-licensing/quota/statistics` - Get quota statistics
- `GET /api/music-licensing/track/:trackId/can-use` - Check if can use track

### Compliance
- `GET /api/music-licensing/compliance/check` - Run compliance check
- `POST /api/music-licensing/compliance/auto-fix/:usageLogId` - Auto-fix issues
- `GET /api/music-licensing/report` - Generate compliance report
- `GET /api/music-licensing/export/logs` - Export usage logs

### Preview
- `POST /api/music-licensing/preview-usage` - Preview usage before render

## Usage Workflow

### Before Render

1. **Preview Usage**
   ```
   POST /api/music-licensing/preview-usage
   ```
   - Validates all tracks
   - Checks quotas
   - Verifies permissions
   - Returns if render can proceed

2. **Validate Tracks**
   ```
   POST /api/music-licensing/validate/tracks
   ```
   - Individual track validation
   - Detailed error messages
   - Platform-specific checks

### During Render

3. **Log Usage** (automatic in render endpoint)
   - Usage logged for all tracks
   - Licenses registered if needed
   - Attributions generated

### After Render

4. **Run Compliance Check**
   ```
   GET /api/music-licensing/compliance/check
   ```
   - Automated compliance verification
   - Issue detection
   - Severity assessment

5. **Generate Report**
   ```
   GET /api/music-licensing/report
   ```
   - Full compliance report
   - Usage statistics
   - Export for audit

## Compliance Check Results

**Issue Types:**
- `missing_attribution` - Attribution required but not added
- `unregistered_license` - License needs registration
- `expired_license` - License has expired
- `expiring_license` - License expiring soon (30 days)
- `restriction_violation` - Restriction violation detected

**Severity Levels:**
- `critical` - Immediate action required
- `high` - Important issue to address
- `medium` - Should be addressed soon
- `low` - Minor issue

## Quota Management

**Quota Types:**
- **Monthly**: Total tracks used per month
- **Daily**: Tracks used per day (resets at midnight)
- **Per-License**: Uses per individual licensed track

**Quota Tracking:**
- Real-time usage counting
- Remaining quota calculation
- Percentage usage
- Warning thresholds (90% monthly, 80% daily)

**Recommendations:**
- Upgrade suggestions when quota high
- Usage monitoring alerts
- Reset information for daily quotas

## Compliance Report Structure

```json
{
  "generatedAt": "2024-01-01T00:00:00Z",
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "summary": {
    "totalUsage": 150,
    "byProvider": { "soundstripe": 100, "artlist": 50 },
    "byLicenseType": { "platform": 120, "per_export": 30 },
    "attributionRequired": 50,
    "registered": 30,
    "complianceIssues": 2
  },
  "compliance": {
    "status": "mostly_compliant",
    "issues": [
      {
        "type": "missing_attribution",
        "count": 2,
        "severity": "high"
      }
    ]
  },
  "details": [...]
}
```

## Best Practices

1. **Always preview usage before render**
2. **Check quotas regularly**
3. **Run compliance checks periodically**
4. **Generate reports for audits**
5. **Monitor expiration dates**
6. **Fix compliance issues promptly**
7. **Export logs for record-keeping**

## Integration Points

### Render Pipeline Integration

The render endpoint now includes:
1. Usage preview (optional, recommended)
2. License validation
3. Quota checking
4. Usage logging
5. License registration
6. Attribution generation

### Frontend Integration

**Pre-Render Validation:**
- Show validation status for all tracks
- Display quota information
- Warn about expiration
- Show restrictions

**Compliance Dashboard:**
- Display compliance status
- Show quota usage
- List compliance issues
- Generate reports

**Notifications:**
- Quota warnings
- Expiration alerts
- Compliance issues
- Registration reminders

## Future Enhancements

- [ ] License renewal reminders
- [ ] Automated compliance email reports
- [ ] Quota upgrade suggestions
- [ ] License cost tracking
- [ ] Usage analytics dashboard
- [ ] Scheduled compliance checks
- [ ] License inventory management
- [ ] Batch license operations







