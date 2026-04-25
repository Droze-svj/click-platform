# 🔄 AI Model Versioning & Upgrade System

**Complete guide to AI model versioning, upgrades, and continuous learning**

---

## 🌟 Overview

Click's AI model versioning system tracks model versions, detects upgrades, and manages continuous learning improvements. The system:

- ✅ Tracks model versions over time
- ✅ Detects new versions from providers
- ✅ Recommends upgrades based on performance
- ✅ Records upgrade history
- ✅ Compares versions
- ✅ Supports automatic upgrades

---

## 🔄 How Versioning Works

### 1. Version Detection

The system automatically checks for new model versions:

**Daily Checks** (2 AM):
- Scans all providers for new versions
- Compares with current versions
- Identifies improvements
- Creates upgrade recommendations

**On-Demand Checks**:
- API endpoint: `GET /api/model-versions/:provider/:model/upgrades`
- Manual upgrade checks
- Before using a model

### 2. Version Tracking

Each model version is tracked with:

```javascript
{
  provider: 'openrouter',
  model: 'qwen-2.5-7b-instruct',
  version: '1.1.0',
  previousVersion: '1.0.0',
  current: true,
  released: Date,
  improvements: [
    'Improved response quality',
    'Faster processing',
    'Better context understanding'
  ],
  breakingChanges: [],
  baselinePerformance: {
    avgQualityScore: 0.85,
    avgResponseTime: 1200,
    avgTokens: 500
  }
}
```

### 3. Continuous Learning → Version Improvements

**How it works:**

1. **Performance Tracking**: Every AI request is tracked
   - Quality score (0-1)
   - Response time
   - Token usage
   - User satisfaction

2. **Learning Over Time**: System learns which models work best
   - Task-specific performance
   - User-specific preferences
   - Quality trends

3. **Version Recommendations**: When performance improves
   - System detects better versions
   - Recommends upgrades
   - Shows expected improvements

4. **Automatic Upgrades**: (Optional)
   - Can auto-upgrade when recommended
   - Records upgrade history
   - Tracks performance changes

---

## 🚀 Using Version Management

### Check for Upgrades

```javascript
const { checkForModelUpgrades } = require('./services/modelVersionManager');

const upgrades = await checkForModelUpgrades('openrouter', 'qwen-2.5-7b-instruct');

if (upgrades?.hasUpgrade) {
  console.log('New version available!');
  console.log('Current:', upgrades.currentVersion);
  console.log('Latest:', upgrades.latestVersion);
  console.log('Improvements:', upgrades.improvements);
}
```

### Get Upgrade Recommendations

```javascript
const { getUpgradeRecommendations } = require('./services/modelVersionManager');

const recommendations = await getUpgradeRecommendations();

recommendations.forEach(rec => {
  console.log(`${rec.provider}/${rec.model}:`);
  console.log(`  Current: ${rec.currentVersion}`);
  console.log(`  Latest: ${rec.latestVersion}`);
  console.log(`  Reason: ${rec.reason}`);
  console.log(`  Recommended: ${rec.recommended}`);
});
```

### Record an Upgrade

```javascript
const { recordModelUpgrade } = require('./services/modelVersionManager');

await recordModelUpgrade('openrouter', 'qwen-2.5-7b-instruct', {
  oldVersion: '1.0.0',
  newVersion: '1.1.0',
  improvements: [
    'Improved response quality by 15%',
    'Reduced response time by 20%',
    'Better context understanding'
  ],
  breakingChanges: [],
  migrationNotes: 'No migration needed - drop-in replacement'
});
```

### Get Version History

```javascript
const { getVersionHistory } = require('./services/modelVersionManager');

const history = await getVersionHistory('openrouter', 'qwen-2.5-7b-instruct');

history.forEach(version => {
  console.log(`Version ${version.version}:`);
  console.log(`  Released: ${version.released}`);
  console.log(`  Improvements: ${version.improvements.length}`);
  console.log(`  Current: ${version.current}`);
});
```

### Compare Versions

```javascript
const { compareVersions } = require('./services/modelVersionManager');

const comparison = await compareVersions(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.0.0',
  '1.1.0'
);

console.log('Performance Delta:', comparison.comparison.performanceDelta);
console.log('New Features:', comparison.comparison.newFeatures);
console.log('Breaking Changes:', comparison.comparison.breakingChanges);
```

---

## 📊 API Endpoints

### Get Current Version

```bash
GET /api/model-versions/:provider/:model/current
```

**Response:**
```json
{
  "version": {
    "provider": "openrouter",
    "model": "qwen-2.5-7b-instruct",
    "version": "1.1.0",
    "current": true,
    "released": "2024-11-15T00:00:00.000Z",
    "improvements": ["Improved quality", "Faster processing"]
  }
}
```

### Get Version History

```bash
GET /api/model-versions/:provider/:model/history
```

**Response:**
```json
{
  "history": [
    {
      "version": "1.1.0",
      "released": "2024-11-15",
      "current": true
    },
    {
      "version": "1.0.0",
      "released": "2024-10-01",
      "current": false,
      "deprecated": "2024-11-15"
    }
  ]
}
```

### Check for Upgrades

```bash
GET /api/model-versions/:provider/:model/upgrades
```

**Response:**
```json
{
  "upgrades": {
    "hasUpgrade": true,
    "currentVersion": "1.0.0",
    "latestVersion": "1.1.0",
    "improvements": [
      "Improved response quality",
      "Faster processing"
    ],
    "recommended": true
  }
}
```

### Get Upgrade Recommendations

```bash
GET /api/model-versions/upgrade-recommendations?provider=openrouter
```

**Response:**
```json
{
  "recommendations": [
    {
      "provider": "openrouter",
      "model": "qwen-2.5-7b-instruct",
      "currentVersion": "1.0.0",
      "latestVersion": "1.1.0",
      "improvements": ["Quality improvements"],
      "recommended": true,
      "reason": "New version available with improvements"
    }
  ]
}
```

### Record Upgrade

```bash
POST /api/model-versions/:provider/:model/upgrade
Content-Type: application/json

{
  "oldVersion": "1.0.0",
  "newVersion": "1.1.0",
  "improvements": [
    "Improved response quality",
    "Faster processing"
  ],
  "breakingChanges": [],
  "migrationNotes": "No migration needed"
}
```

### Auto-Upgrade

```bash
POST /api/model-versions/:provider/:model/auto-upgrade
Content-Type: application/json

{
  "autoUpgrade": true,
  "minQualityImprovement": 0.1
}
```

### Compare Versions

```bash
GET /api/model-versions/:provider/:model/compare?version1=1.0.0&version2=1.1.0
```

---

## 🔄 Continuous Learning → Version Improvements

### How Learning Creates Better Versions

1. **Performance Data Collection**
   ```
   Every AI request → Tracked → Analyzed → Learned
   ```

2. **Pattern Detection**
   - Which models work best for which tasks
   - Quality trends over time
   - User preferences

3. **Improvement Identification**
   - When new versions perform better
   - When to recommend upgrades
   - Expected improvements

4. **Version Evolution**
   ```
   v1.0.0 → Learning → v1.1.0 (improved)
   v1.1.0 → Learning → v1.2.0 (better)
   v1.2.0 → Learning → v2.0.0 (major upgrade)
   ```

### Example Learning Flow

```javascript
// 1. Track usage
await trackModelUsage({
  provider: 'openrouter',
  model: 'qwen-2.5-7b-instruct',
  taskType: 'caption-generation',
  qualityScore: 0.75,
  responseTime: 1200,
});

// 2. System learns
// After 100 uses, avg quality: 0.78

// 3. Check for upgrades
const upgrades = await checkForModelUpgrades('openrouter', 'qwen-2.5-7b-instruct');

// 4. If upgrade available and better
if (upgrades.hasUpgrade && upgrades.improvements.length > 0) {
  // 5. Recommend upgrade
  const recommendation = {
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    expectedImprovement: '15% better quality',
    recommended: true,
  };
}

// 6. Auto-upgrade (if enabled)
if (autoUpgradeEnabled) {
  await autoUpgradeModel('openrouter', 'qwen-2.5-7b-instruct');
}
```

---

## 📈 Version Upgrade Scenarios

### Scenario 1: Provider Releases New Version

**What happens:**
1. Daily check detects new version
2. System compares with current
3. Creates upgrade recommendation
4. Records in database
5. Notifies admin/user

**Example:**
```
OpenRouter releases qwen-2.5-7b-instruct v1.1.0
→ System detects upgrade
→ Recommends upgrade
→ Shows improvements: "15% better quality"
→ User approves → Upgrade recorded
```

### Scenario 2: Performance-Based Upgrade

**What happens:**
1. System tracks performance
2. Detects low performance (< 0.6 quality)
3. Checks for better versions
4. Recommends upgrade
5. Auto-upgrades if enabled

**Example:**
```
Model performance drops to 0.55
→ System checks for upgrades
→ Finds newer version with 0.75 performance
→ Recommends upgrade
→ Auto-upgrades (if enabled)
```

### Scenario 3: Continuous Learning Improvement

**What happens:**
1. System learns from usage
2. Identifies best models per task
3. Detects when new versions perform better
4. Automatically switches to better version
5. Records upgrade

**Example:**
```
After 1000 uses:
→ System learns qwen-2.5-7b-instruct v1.1.0 is 20% better
→ Automatically uses v1.1.0 for new requests
→ Records upgrade from v1.0.0 to v1.1.0
```

---

## 🎯 Best Practices

### 1. Regular Upgrade Checks

```javascript
// Check weekly for upgrades
const cron = require('node-cron');
cron.schedule('0 2 * * 0', async () => {
  const recommendations = await getUpgradeRecommendations();
  // Notify admin of available upgrades
});
```

### 2. Test Before Upgrading

```javascript
// Test new version before upgrading
const testResult = await generateWithFreeModel(
  'Test prompt',
  { provider: 'openrouter', model: 'qwen-2.5-7b-instruct:1.1.0' }
);

if (testResult.qualityScore > currentQuality) {
  await recordModelUpgrade(...);
}
```

### 3. Monitor Performance After Upgrade

```javascript
// Track performance after upgrade
const postUpgradePerf = await getModelPerformance('openrouter', 'qwen-2.5-7b-instruct');

if (postUpgradePerf.avgQualityScore < preUpgradePerf.avgQualityScore) {
  // Consider rolling back
  await rollbackVersion(...);
}
```

### 4. Version Pinning

```javascript
// Pin to specific version
const result = await generateWithFreeModel(prompt, {
  provider: 'openrouter',
  model: 'qwen-2.5-7b-instruct:1.0.0', // Pinned version
});
```

---

## 🔍 Version Information

### Current Version Structure

```javascript
{
  provider: 'openrouter',
  model: 'qwen-2.5-7b-instruct',
  version: '1.1.0',
  previousVersion: '1.0.0',
  current: true,
  released: Date,
  improvements: [
    'Improved response quality by 15%',
    'Reduced response time by 20%',
    'Better context understanding'
  ],
  breakingChanges: [],
  migrationNotes: 'No migration needed',
  baselinePerformance: {
    avgQualityScore: 0.85,
    avgResponseTime: 1200,
    avgTokens: 500
  }
}
```

### Version History

```javascript
[
  {
    version: '1.1.0',
    released: '2024-11-15',
    current: true,
    improvements: ['Quality improvements']
  },
  {
    version: '1.0.0',
    released: '2024-10-01',
    current: false,
    deprecated: '2024-11-15'
  }
]
```

---

## 🚀 Quick Start

### 1. Check for Upgrades

```bash
curl http://localhost:5001/api/model-versions/openrouter/qwen-2.5-7b-instruct/upgrades \
  -H "Authorization: Bearer <token>"
```

### 2. Get Recommendations

```bash
curl http://localhost:5001/api/model-versions/upgrade-recommendations \
  -H "Authorization: Bearer <token>"
```

### 3. Record Upgrade

```bash
curl -X POST http://localhost:5001/api/model-versions/openrouter/qwen-2.5-7b-instruct/upgrade \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "oldVersion": "1.0.0",
    "newVersion": "1.1.0",
    "improvements": ["Better quality"]
  }'
```

---

## 📊 Upgrade Dashboard

Access upgrade information via:

- **API**: `/api/model-versions/*`
- **Learning Insights**: Shows version recommendations
- **Admin Dashboard**: (Can be built) Shows all upgrades

---

## 🔄 Automatic Upgrades

### Enable Auto-Upgrade

```javascript
// In .env.production
ENABLE_AUTO_MODEL_UPGRADES=true
MIN_QUALITY_IMPROVEMENT=0.1
```

### How It Works

1. Daily checks for upgrades
2. Tests new version performance
3. Compares with current
4. Auto-upgrades if improvement > threshold
5. Records upgrade
6. Notifies admin

---

## 📚 Additional Resources

- **Model Learning**: `server/services/aiModelLearningService.js`
- **Version Manager**: `server/services/modelVersionManager.js`
- **Version Model**: `server/models/ModelVersion.js`

---

**Status**: ✅ Model versioning system complete with continuous learning and automatic upgrades!


