# 🚀 Enhanced AI Model Versioning System

**Complete guide to advanced versioning features: A/B testing, rollback, gradual rollout**

---

## ✨ New Enhancements

### 1. A/B Testing ✅
- ✅ Test two versions side-by-side
- ✅ Compare performance metrics
- ✅ Quality score comparison
- ✅ Automatic winner determination

### 2. Version Rollback ✅
- ✅ Rollback to previous versions
- ✅ Automatic rollback detection
- ✅ Performance-based rollback recommendations
- ✅ Rollback history tracking

### 3. Gradual Rollout ✅
- ✅ Gradual percentage-based rollout
- ✅ User-based consistent assignment
- ✅ Automatic increment scheduling
- ✅ Success threshold monitoring
- ✅ Pause/cancel capabilities

### 4. Version Analytics ✅
- ✅ Performance tracking per version
- ✅ Usage statistics
- ✅ Quality trends
- ✅ Comparative analytics

### 5. Pre-Upgrade Validation ✅
- ✅ Test before upgrading
- ✅ Quality improvement validation
- ✅ Safety checks
- ✅ Recommendation engine

---

## 🔬 A/B Testing

### Test Two Versions

```javascript
const { abTestVersions } = require('./services/modelVersionTesting');

const results = await abTestVersions(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.0.0', // Version 1
  '1.1.0', // Version 2
  [
    'Create a viral TikTok caption',
    'Write an engaging LinkedIn post',
    // ... more test prompts
  ]
);

console.log('Version 1 Quality:', results.version1.avgQuality);
console.log('Version 2 Quality:', results.version2.avgQuality);
console.log('Winner:', results.comparison.recommendation.action);
```

### API Endpoint

```bash
POST /api/model-versions/:provider/:model/ab-test
Content-Type: application/json

{
  "version1": "1.0.0",
  "version2": "1.1.0",
  "testPrompts": [
    "Create engaging content",
    "Write a caption"
  ]
}
```

**Response:**
```json
{
  "results": {
    "version1": {
      "avgQuality": 0.75,
      "avgResponseTime": 1200,
      "wins": 2
    },
    "version2": {
      "avgQuality": 0.85,
      "avgResponseTime": 1100,
      "wins": 3
    },
    "comparison": {
      "qualityDelta": 0.10,
      "recommendation": {
        "action": "upgrade",
        "version": "1.1.0",
        "confidence": "high"
      }
    }
  }
}
```

---

## 🔄 Version Rollback

### Rollback to Previous Version

```javascript
const { rollbackVersion } = require('./services/modelVersionRollback');

await rollbackVersion(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.0.0', // Target version
  'Performance issues with 1.1.0'
);
```

### Check if Rollback Needed

```javascript
const { checkRollbackNeeded } = require('./services/modelVersionRollback');

const check = await checkRollbackNeeded('openrouter', 'qwen-2.5-7b-instruct', {
  minQualityThreshold: 0.6,
  minUsageCount: 20,
  daysSinceUpgrade: 7,
});

if (check.needed) {
  console.log('Rollback recommended:', check.reason);
  console.log('Recommended version:', check.recommendedVersion);
}
```

### Get Rollback Candidates

```javascript
const { getRollbackCandidates } = require('./services/modelVersionRollback');

const candidates = await getRollbackCandidates('openrouter', 'qwen-2.5-7b-instruct');

candidates.forEach(candidate => {
  console.log(`Version ${candidate.version}: Quality ${candidate.historicalPerformance}`);
});
```

### API Endpoints

```bash
# Rollback
POST /api/model-versions/:provider/:model/rollback
{
  "targetVersion": "1.0.0",
  "reason": "Performance issues"
}

# Check rollback needed
GET /api/model-versions/:provider/:model/rollback-check

# Get rollback candidates
GET /api/model-versions/:provider/:model/rollback-candidates
```

---

## 📈 Gradual Rollout

### Start Gradual Rollout

```javascript
const { startGradualRollout } = require('./services/modelVersionGradualRollout');

const rollout = await startGradualRollout(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.1.0', // New version
  {
    initialPercentage: 10,    // Start with 10%
    incrementPercentage: 10,  // Increase by 10% daily
    maxPercentage: 100,        // Full rollout
    minDaysBetweenIncrements: 1,
    successThreshold: 0.7,     // 70% success rate required
  }
);
```

### How Gradual Rollout Works

1. **Start**: 10% of requests use new version
2. **Monitor**: Track success rate, quality, response time
3. **Increment**: If metrics good, increase to 20%
4. **Continue**: Gradually increase to 100%
5. **Complete**: Mark new version as current

### Automatic Increments

- ✅ Checks every hour
- ✅ Increments if success rate > threshold
- ✅ Pauses if metrics drop
- ✅ Completes when reaches 100%

### User-Based Rollout

Users are consistently assigned to versions:
- Same user always gets same version during rollout
- Consistent experience
- Fair A/B testing

### API Endpoints

```bash
# Start rollout
POST /api/model-versions/:provider/:model/gradual-rollout
{
  "newVersion": "1.1.0",
  "initialPercentage": 10,
  "incrementPercentage": 10
}

# Get status
GET /api/model-versions/:provider/:model/rollout-status?newVersion=1.1.0

# Pause
POST /api/model-versions/:provider/:model/pause-rollout
{
  "newVersion": "1.1.0",
  "reason": "Monitoring issues"
}

# Cancel
POST /api/model-versions/:provider/:model/cancel-rollout
{
  "newVersion": "1.1.0",
  "reason": "Performance concerns"
}
```

---

## ✅ Pre-Upgrade Validation

### Validate Before Upgrading

```javascript
const { validateVersionBeforeUpgrade } = require('./services/modelVersionTesting');

const validation = await validateVersionBeforeUpgrade(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.1.0', // New version
  {
    testPrompts: [
      'Create engaging content',
      'Write a caption',
    ],
    minQualityImprovement: 0.1, // 10% improvement required
    minTests: 5,
  }
);

if (validation.valid) {
  console.log('Safe to upgrade:', validation.reason);
  console.log('Test results:', validation.testResults);
} else {
  console.log('Do not upgrade:', validation.reason);
}
```

### API Endpoint

```bash
POST /api/model-versions/:provider/:model/validate-upgrade
{
  "newVersion": "1.1.0",
  "testPrompts": ["Test prompt 1", "Test prompt 2"],
  "minQualityImprovement": 0.1
}
```

---

## 📊 Version Analytics

### Get Analytics

```javascript
const { getVersionAnalytics } = require('./services/modelVersionManager');

const analytics = await getVersionAnalytics(
  'openrouter',
  'qwen-2.5-7b-instruct',
  30 // Last 30 days
);

analytics.versions.forEach(version => {
  console.log(`Version ${version.version}:`);
  console.log(`  Quality: ${version.performance?.avgQuality || 'N/A'}`);
  console.log(`  Usage: ${version.performance?.usageCount || 0}`);
});
```

### API Endpoint

```bash
GET /api/model-versions/:provider/:model/analytics?days=30
```

**Response:**
```json
{
  "analytics": {
    "provider": "openrouter",
    "model": "qwen-2.5-7b-instruct",
    "totalVersions": 3,
    "currentVersion": "1.1.0",
    "versions": [
      {
        "version": "1.1.0",
        "current": true,
        "performance": {
          "avgQuality": 0.85,
          "avgResponseTime": 1100,
          "usageCount": 150
        }
      },
      {
        "version": "1.0.0",
        "current": false,
        "deprecated": "2024-11-15",
        "performance": {
          "avgQuality": 0.75,
          "usageCount": 200
        }
      }
    ]
  }
}
```

---

## 🔄 Complete Upgrade Flow

### Enhanced Auto-Upgrade with Testing

```javascript
const { autoUpgradeModel } = require('./services/modelVersionManager');

const result = await autoUpgradeModel('openrouter', 'qwen-2.5-7b-instruct', {
  autoUpgrade: true,
  testBeforeUpgrade: true,      // Test first
  useGradualRollout: true,      // Use gradual rollout
  minQualityImprovement: 0.1,  // 10% improvement required
});

if (result.rollout) {
  console.log('Gradual rollout started:', result.rolloutId);
  console.log('New version:', result.newVersion);
} else if (result.upgraded) {
  console.log('Immediately upgraded to:', result.newVersion);
}
```

### Flow Diagram

```
1. Check for Upgrades
   ↓
2. Test New Version (A/B test)
   ↓
3. Validate Improvement
   ↓
4. Start Gradual Rollout (10%)
   ↓
5. Monitor Metrics
   ↓
6. Increment Rollout (20%, 30%, ...)
   ↓
7. Complete Rollout (100%)
   ↓
8. Mark as Current Version
```

---

## 🎯 Best Practices

### 1. Always Test Before Upgrading

```javascript
// Test first
const validation = await validateVersionBeforeUpgrade(...);

if (validation.valid && validation.testResults.comparison.qualityDelta > 0.1) {
  // Safe to upgrade
  await recordModelUpgrade(...);
}
```

### 2. Use Gradual Rollout for Major Versions

```javascript
// Major version change - use gradual rollout
if (isMajorVersion(newVersion)) {
  await startGradualRollout(..., {
    initialPercentage: 5,  // Start small
    incrementPercentage: 5, // Slow increments
  });
}
```

### 3. Monitor After Upgrade

```javascript
// Check performance after upgrade
const rollbackCheck = await checkRollbackNeeded(..., {
  daysSinceUpgrade: 7,
});

if (rollbackCheck.needed) {
  await rollbackVersion(..., rollbackCheck.recommendedVersion);
}
```

### 4. A/B Test Critical Versions

```javascript
// Test before major upgrade
const testResults = await abTestVersions(..., '1.0.0', '2.0.0', [
  'Critical prompt 1',
  'Critical prompt 2',
]);

if (testResults.comparison.recommendation.action === 'upgrade') {
  // Proceed with upgrade
}
```

---

## 📋 Complete API Reference

### Version Management
- `GET /api/model-versions/:provider/:model/current` - Get current version
- `GET /api/model-versions/:provider/:model/history` - Get version history
- `GET /api/model-versions/:provider/:model/upgrades` - Check for upgrades
- `GET /api/model-versions/upgrade-recommendations` - Get recommendations
- `POST /api/model-versions/:provider/:model/upgrade` - Record upgrade
- `POST /api/model-versions/:provider/:model/auto-upgrade` - Auto-upgrade

### Testing & Validation
- `POST /api/model-versions/:provider/:model/ab-test` - A/B test versions
- `POST /api/model-versions/:provider/:model/validate-upgrade` - Validate before upgrade

### Rollback
- `POST /api/model-versions/:provider/:model/rollback` - Rollback version
- `GET /api/model-versions/:provider/:model/rollback-check` - Check if rollback needed
- `GET /api/model-versions/:provider/:model/rollback-candidates` - Get rollback candidates

### Gradual Rollout
- `POST /api/model-versions/:provider/:model/gradual-rollout` - Start rollout
- `GET /api/model-versions/:provider/:model/rollout-status` - Get status
- `POST /api/model-versions/:provider/:model/pause-rollout` - Pause rollout
- `POST /api/model-versions/:provider/:model/cancel-rollout` - Cancel rollout

### Analytics
- `GET /api/model-versions/:provider/:model/analytics` - Get analytics
- `GET /api/model-versions/:provider/:model/compare` - Compare versions

---

## 🎉 Enhanced Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| A/B Testing | ✅ Complete | Test versions side-by-side |
| Rollback | ✅ Complete | Rollback to previous versions |
| Gradual Rollout | ✅ Complete | Percentage-based rollout |
| Pre-Upgrade Validation | ✅ Complete | Test before upgrading |
| Version Analytics | ✅ Complete | Performance tracking |
| Auto-Upgrade | ✅ Enhanced | With testing and rollout |

---

## 🚀 Usage Examples

### Example 1: Safe Upgrade with Testing

```javascript
// 1. Check for upgrades
const upgrades = await checkForModelUpgrades('openrouter', 'qwen-2.5-7b-instruct');

if (upgrades.hasUpgrade) {
  // 2. Validate before upgrading
  const validation = await validateVersionBeforeUpgrade(
    'openrouter',
    'qwen-2.5-7b-instruct',
    upgrades.latestVersion
  );

  if (validation.valid) {
    // 3. Start gradual rollout
    const rollout = await startGradualRollout(
      'openrouter',
      'qwen-2.5-7b-instruct',
      upgrades.latestVersion
    );
  }
}
```

### Example 2: A/B Test Then Upgrade

```javascript
// 1. A/B test versions
const testResults = await abTestVersions(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.0.0',
  '1.1.0'
);

// 2. If new version wins, upgrade
if (testResults.comparison.recommendation.action === 'upgrade') {
  await recordModelUpgrade('openrouter', 'qwen-2.5-7b-instruct', {
    oldVersion: '1.0.0',
    newVersion: '1.1.0',
    improvements: testResults.comparison.recommendation.reason,
  });
}
```

### Example 3: Monitor and Rollback if Needed

```javascript
// After upgrade, monitor performance
setTimeout(async () => {
  const rollbackCheck = await checkRollbackNeeded(
    'openrouter',
    'qwen-2.5-7b-instruct',
    { daysSinceUpgrade: 7 }
  );

  if (rollbackCheck.needed) {
    await rollbackVersion(
      'openrouter',
      'qwen-2.5-7b-instruct',
      rollbackCheck.recommendedVersion,
      rollbackCheck.reason
    );
  }
}, 7 * 24 * 60 * 60 * 1000); // 7 days
```

---

## 📚 Documentation

- **Complete Guide**: `AI_MODEL_VERSIONING_GUIDE.md`
- **Enhanced Features**: `AI_MODEL_VERSIONING_ENHANCED.md` (this file)
- **Complete**: `MODEL_VERSIONING_COMPLETE.md`

---

**Status**: ✅ Enhanced versioning system with A/B testing, rollback, and gradual rollout!


