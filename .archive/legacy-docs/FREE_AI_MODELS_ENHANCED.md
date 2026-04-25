# 🚀 Enhanced Free AI Models Integration

**Complete guide to using free AI models with API keys for higher limits**

---

## ✨ New Enhancements

### 1. API Key Management ✅
- ✅ Interactive key setup script
- ✅ Automatic key validation
- ✅ Key status monitoring
- ✅ Usage tracking per key

### 2. Rate Limit Management ✅
- ✅ Automatic rate limit tracking
- ✅ Per-provider limits
- ✅ Usage statistics
- ✅ Smart fallback when limits reached

### 3. Enhanced Learning ✅
- ✅ User-specific learning
- ✅ Performance tracking per user
- ✅ Quality scoring
- ✅ Best model recommendations

### 4. API Endpoints ✅
- ✅ Provider management
- ✅ Key validation
- ✅ Usage statistics
- ✅ Learning insights
- ✅ Best model selection

---

## 🔑 Getting API Keys

### Quick Setup (Interactive)

```bash
# Run interactive setup script
npm run get-free-ai-keys
```

This will:
1. Guide you through each provider
2. Open signup pages in browser
3. Help you add keys to `.env.production`
4. Validate keys automatically

### Manual Setup

#### 1. OpenRouter (Recommended)

**Free Tier**: 50 requests/day (no key needed)  
**With Key**: Higher limits, priority access

**Steps:**
1. Visit: https://openrouter.ai/keys
2. Sign up or log in
3. Create new API key
4. Add to `.env.production`:
   ```env
   OPENROUTER_API_KEY=your-key-here
   ```

#### 2. Hugging Face

**Free Tier**: 1000 requests/day  
**With Key**: Higher limits, more models

**Steps:**
1. Visit: https://huggingface.co/settings/tokens
2. Sign up or log in
3. Create token (read access)
4. Add to `.env.production`:
   ```env
   HUGGINGFACE_API_KEY=your-token-here
   ```

#### 3. Cerebras

**Free Tier**: 1M tokens/day (no key needed)  
**With Key**: Higher limits, priority

**Steps:**
1. Visit: https://www.cerebras.ai/api-access
2. Sign up for API access
3. Get API key
4. Add to `.env.production`:
   ```env
   CEREBRAS_API_KEY=your-key-here
   ```

#### 4. Replicate

**Free Tier**: $5 credits (new users)  
**With Key**: Access to premium models

**Steps:**
1. Visit: https://replicate.com/account/api-tokens
2. Sign up or log in
3. Create API token
4. Add to `.env.production`:
   ```env
   REPLICATE_API_KEY=your-token-here
   ```

---

## ✅ Validate API Keys

After adding keys, validate them:

```bash
npm run validate:free-ai-keys
```

This will:
- ✅ Check if keys are valid
- ✅ Show key details (credits, limits, etc.)
- ✅ Display provider limits
- ✅ Show validation status

---

## 📊 API Endpoints

### Get All Providers

```bash
GET /api/free-ai-models/providers
```

**Response:**
```json
{
  "providers": [
    {
      "id": "openrouter",
      "name": "OpenRouter",
      "limits": {
        "freeTier": {
          "requestsPerDay": 50
        }
      },
      "keyStatus": {
        "configured": true,
        "validated": true
      },
      "usage": {
        "usage": {
          "requests": 5,
          "tokens": 1250
        },
        "remaining": {
          "requests": 45
        }
      }
    }
  ]
}
```

### Get Available Models

```bash
GET /api/free-ai-models/providers/:provider/models
```

### Validate API Key

```bash
POST /api/free-ai-models/validate-key
Content-Type: application/json

{
  "provider": "openrouter",
  "apiKey": "your-key-here"
}
```

### Get Usage Statistics

```bash
GET /api/free-ai-models/usage
GET /api/free-ai-models/usage/:provider
```

### Get Best Model for Task

```bash
GET /api/free-ai-models/best-model/:taskType?provider=openrouter&minUsageCount=10
```

### Get Learning Insights

```bash
GET /api/free-ai-models/learning-insights?days=30&taskType=caption-generation
```

### Generate Content

```bash
POST /api/free-ai-models/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Create a viral TikTok caption",
  "provider": "openrouter",
  "taskType": "caption-generation",
  "temperature": 0.7,
  "maxTokens": 200
}
```

---

## 🎯 Usage Examples

### Example 1: Generate with Specific Provider

```javascript
const { generateWithFreeModel } = require('./services/freeAIModelService');

const result = await generateWithFreeModel(
  'Create engaging social media content',
  {
    provider: 'openrouter',
    taskType: 'content-generation',
    temperature: 0.8,
  }
);
```

### Example 2: Use Best Model (Auto-Select)

```javascript
const { getBestModelForTask } = require('./services/aiModelLearningService');

// Get best model based on learning
const best = await getBestModelForTask('caption-generation');

const result = await generateWithFreeModel(prompt, {
  provider: best.provider,
  model: best.model,
  taskType: 'caption-generation',
});
```

### Example 3: Check Rate Limits

```javascript
const { checkRateLimit, getUsage } = require('./services/freeAIModelRateLimiter');

// Check before making request
const rateLimit = checkRateLimit('openrouter');
console.log('Remaining requests:', rateLimit.remaining.requests);

// Get current usage
const usage = getUsage('openrouter');
console.log('Usage:', usage.usage);
console.log('Reset in:', usage.resetIn, 'seconds');
```

### Example 4: Validate API Key

```javascript
const { validateAPIKey } = require('./services/freeAIModelKeyManager');

const validation = await validateAPIKey('openrouter', 'your-key');
if (validation.isValid) {
  console.log('Key is valid!');
  console.log('Details:', validation.details);
}
```

---

## 📈 Rate Limit Management

### Automatic Rate Limiting

The system automatically:
- ✅ Tracks usage per provider
- ✅ Enforces daily limits
- ✅ Enforces per-minute limits
- ✅ Falls back to other providers when limited
- ✅ Resets limits daily

### Check Limits

```javascript
const { getUsage } = require('./services/freeAIModelRateLimiter');

const usage = getUsage('openrouter');
console.log(usage);
// {
//   usage: { requests: 5, tokens: 1250 },
//   remaining: { requests: 45, tokens: null },
//   limits: { requestsPerDay: 50 },
//   resetIn: 86400 // seconds until reset
// }
```

---

## 🧠 Enhanced Learning

### User-Specific Learning

The system now tracks:
- ✅ Performance per user
- ✅ Quality scores per user
- ✅ Best models per user
- ✅ Usage patterns

### Get Personal Insights

```javascript
const { getLearningInsights } = require('./services/aiModelLearningService');

const insights = await getLearningInsights({
  userId: user.id,
  days: 30,
  taskType: 'caption-generation',
});

console.log(insights.bestModels);
console.log(insights.recommendations);
```

---

## 🔄 Automatic Fallback

The system automatically falls back:

1. **Provider fails** → Try OpenRouter
2. **Rate limited** → Try another provider
3. **OpenAI fails** → Use free models
4. **Free model fails** → Try next provider

### Example

```javascript
// Will try Cerebras first, fallback to OpenRouter if fails
const result = await generateWithFreeModel(prompt, {
  provider: 'cerebras',
  fallbackToFree: true, // Enable fallback
});
```

---

## 📊 Monitoring & Analytics

### Usage Dashboard

Access usage stats via API:

```bash
GET /api/free-ai-models/usage
```

### Learning Dashboard

Get insights:

```bash
GET /api/free-ai-models/learning-insights?days=7
```

---

## 🎁 Benefits of API Keys

### Without Keys (Free Tier)
- ✅ OpenRouter: 50 requests/day
- ✅ Hugging Face: 1000 requests/day
- ✅ Cerebras: 1M tokens/day
- ✅ Replicate: $5 credits

### With Keys (Enhanced)
- 🚀 Higher request limits
- 🚀 Priority access
- 🚀 More models available
- 🚀 Better performance
- 🚀 Usage tracking
- 🚀 Credit management

---

## 🛠️ Troubleshooting

### Issue: Key Validation Fails

**Solution:**
```bash
# Re-validate
npm run validate:free-ai-keys

# Check key format
grep OPENROUTER_API_KEY .env.production
```

### Issue: Rate Limit Exceeded

**Solution:**
- System automatically falls back
- Check usage: `GET /api/free-ai-models/usage`
- Wait for daily reset
- Get API key for higher limits

### Issue: Provider Not Working

**Solution:**
- Check provider status
- Validate API key
- Try fallback provider
- Check error logs

---

## 📚 Additional Resources

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Hugging Face Docs**: https://huggingface.co/docs/api-inference
- **Cerebras Docs**: https://docs.cerebras.ai
- **Replicate Docs**: https://replicate.com/docs

---

## 🎯 Quick Start Checklist

- [ ] Run `npm run get-free-ai-keys` to set up keys
- [ ] Run `npm run validate:free-ai-keys` to verify
- [ ] Test generation: `POST /api/free-ai-models/generate`
- [ ] Check usage: `GET /api/free-ai-models/usage`
- [ ] Review insights: `GET /api/free-ai-models/learning-insights`

---

**Status**: ✅ Enhanced with API key management, rate limiting, and advanced learning!


