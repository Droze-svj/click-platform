# 🆓 Free AI Models Integration Guide

**Complete guide to using free AI model APIs with continuous learning in Click**

---

## 🌟 Overview

Click now supports multiple free AI model providers with continuous learning capabilities:

1. **OpenRouter** - 50 free requests/day, multiple models
2. **Hugging Face** - 1000 free requests/day
3. **Cerebras** - 1M tokens/day free
4. **Replicate** - $5 free credits for new users

All providers support:
- ✅ Continuous learning and performance tracking
- ✅ Model versioning and upgrades
- ✅ Automatic fallback between providers
- ✅ Performance-based model selection

---

## 🚀 Quick Start

### 1. Get API Keys (Optional but Recommended)

**OpenRouter** (Free, no key required for free models):
```bash
# Optional: Get API key for higher limits
# Visit: https://openrouter.ai/keys
export OPENROUTER_API_KEY=your-key-here
```

**Hugging Face** (Free tier available):
```bash
# Get free API key
# Visit: https://huggingface.co/settings/tokens
export HUGGINGFACE_API_KEY=your-key-here
```

**Cerebras** (Free tier, no key required):
```bash
# Optional: Get API key
export CEREBRAS_API_KEY=your-key-here
```

**Replicate** (Free $5 credits):
```bash
# Get API key
# Visit: https://replicate.com/account/api-tokens
export REPLICATE_API_KEY=your-key-here
```

### 2. Configure Environment

Add to `.env` or `.env.production`:
```env
# Free AI Model Providers (Optional)
OPENROUTER_API_KEY=your-openrouter-key
HUGGINGFACE_API_KEY=your-huggingface-key
CEREBRAS_API_KEY=your-cerebras-key
REPLICATE_API_KEY=your-replicate-key

# Frontend URL (for OpenRouter)
FRONTEND_URL=https://your-domain.com
```

### 3. Use in Code

```javascript
const { generateWithFreeModel } = require('./services/freeAIModelService');

// Generate content with free model
const result = await generateWithFreeModel(
  'Create a viral TikTok caption about AI',
  {
    provider: 'openrouter', // or 'huggingface', 'cerebras', 'replicate'
    taskType: 'caption-generation',
    temperature: 0.7,
    maxTokens: 200,
  }
);

console.log(result.content);
console.log(result.model); // Selected model
console.log(result.provider); // Provider name
console.log(result.version); // Model version
```

---

## 📊 Available Models

### OpenRouter (Recommended for Free Tier)

**Free Models:**
- `qwen/qwen-2.5-7b-instruct:free` - Best for general content
- `google/gemini-flash-1.5:free` - Fast and efficient

**Limits:**
- 50 requests/day (free tier)
- No API key required for free models
- OpenAI-compatible API

### Hugging Face

**Free Models:**
- `meta-llama/Llama-3.2-3B-Instruct` - Good for content generation
- `mistralai/Mistral-7B-Instruct-v0.2` - Fast responses
- `google/gemma-2b-it` - Lightweight option

**Limits:**
- 1000 requests/day (free tier)
- API key required
- Various model types available

### Cerebras

**Free Models:**
- `llama-3.1-8b-instruct` - High quality
- `qwen-2.5-7b-instruct` - Balanced performance

**Limits:**
- 1M tokens/day (free tier)
- No API key required
- OpenAI-compatible API

### Replicate

**Free Models:**
- `meta/llama-3-8b-instruct` - High quality
- `mistralai/mistral-7b-instruct-v0.2` - Fast

**Limits:**
- $5 free credits (valid 14 days)
- API key required
- Async processing

---

## 🧠 Continuous Learning

### How It Works

1. **Performance Tracking**: Every AI request is tracked with:
   - Response quality score
   - Response time
   - Token usage
   - Task type

2. **Model Selection**: System automatically selects best model based on:
   - Historical performance for task type
   - Quality scores
   - Response times
   - Usage patterns

3. **Version Tracking**: Models are versioned and tracked for:
   - Performance improvements
   - Breaking changes
   - Upgrade recommendations

### Get Learning Insights

```javascript
const { getLearningInsights } = require('./services/aiModelLearningService');

const insights = await getLearningInsights({
  days: 30, // Last 30 days
  taskType: 'caption-generation', // Optional filter
});

console.log(insights.bestModels); // Best models per task
console.log(insights.recommendations); // AI recommendations
```

### Get Best Model for Task

```javascript
const { getBestModelForTask } = require('./services/aiModelLearningService');

const best = await getBestModelForTask('caption-generation', {
  minUsageCount: 10, // Minimum uses to consider
  minQualityScore: 0.5, // Minimum quality
});

console.log(best.model); // Best model
console.log(best.confidence); // high/medium/low
console.log(best.score); // Quality score
```

---

## 🔄 Model Upgrades

### Check for Upgrades

```javascript
const { checkForModelUpgrades } = require('./services/aiModelLearningService');

const upgrade = await checkForModelUpgrades('openrouter', 'qwen-2.5-7b-instruct');

if (upgrade.hasUpgrade) {
  console.log('New version available:', upgrade.newVersion);
}
```

### Record Upgrade

```javascript
const { recordModelUpgrade } = require('./services/aiModelLearningService');

await recordModelUpgrade(
  'openrouter',
  'qwen-2.5-7b-instruct',
  '1.0.0', // Old version
  '1.1.0', // New version
  ['Improved response quality', 'Faster processing'] // Improvements
);
```

---

## 🎯 Best Practices

### 1. Provider Selection

- **Start with OpenRouter**: Best free tier, no key required
- **Use Hugging Face**: For specialized models
- **Use Cerebras**: For high token limits
- **Use Replicate**: For async/long-running tasks

### 2. Fallback Strategy

The system automatically falls back to OpenRouter if a provider fails:

```javascript
// Will try Cerebras first, fallback to OpenRouter if fails
const result = await generateWithFreeModel(prompt, {
  provider: 'cerebras',
});
```

### 3. Task-Specific Models

Let the system learn which models work best:

```javascript
// System will automatically select best model based on learning
const result = await generateWithFreeModel(prompt, {
  taskType: 'caption-generation', // Important for learning
});
```

### 4. Monitor Performance

```javascript
const insights = await getLearningInsights();

// Review recommendations
insights.recommendations.forEach(rec => {
  console.log(`${rec.task}: ${rec.recommendation} (${rec.confidence} confidence)`);
});
```

---

## 📈 Performance Metrics

### Tracked Metrics

- **Quality Score**: 0-1 based on response quality
- **Response Time**: Milliseconds
- **Token Usage**: Tokens per request
- **Usage Count**: Number of times used
- **Average Scores**: Aggregated performance

### Quality Score Calculation

Quality score considers:
- Response length (optimal range)
- Response time (faster is better, but not too fast)
- Content formatting
- Relevance indicators

---

## 🔧 API Reference

### `generateWithFreeModel(prompt, options)`

Generate content using free AI model.

**Parameters:**
- `prompt` (string): Input prompt
- `options` (object):
  - `provider` (string): 'openrouter' | 'huggingface' | 'cerebras' | 'replicate'
  - `model` (string): Specific model ID (optional)
  - `taskType` (string): Task type for learning
  - `temperature` (number): 0-1, default 0.7
  - `maxTokens` (number): Max tokens, default 2000

**Returns:**
```javascript
{
  content: string,
  model: string,
  provider: string,
  tokens: number,
  cost: 0, // Always free
  version: object,
}
```

### `getBestModelForTask(taskType, options)`

Get best model for task based on learning.

**Parameters:**
- `taskType` (string): Task type
- `options` (object):
  - `provider` (string): Filter by provider
  - `minUsageCount` (number): Minimum uses
  - `minQualityScore` (number): Minimum quality

**Returns:**
```javascript
{
  provider: string,
  model: string,
  confidence: 'high' | 'medium' | 'low',
  score: number,
  usageCount: number,
  avgResponseTime: number,
  reason: string,
}
```

### `getLearningInsights(options)`

Get learning insights and recommendations.

**Parameters:**
- `options` (object):
  - `provider` (string): Filter by provider
  - `taskType` (string): Filter by task
  - `days` (number): Days to look back

**Returns:**
```javascript
{
  totalModels: number,
  bestModels: array,
  recommendations: array,
  trends: object,
}
```

---

## 🆘 Troubleshooting

### Issue: API Key Not Working

**Solution**: Check environment variables:
```bash
echo $OPENROUTER_API_KEY
echo $HUGGINGFACE_API_KEY
```

### Issue: Rate Limit Exceeded

**Solution**: System automatically falls back to another provider.

### Issue: Model Not Available

**Solution**: Check available models:
```javascript
const { getAvailableModels } = require('./services/freeAIModelService');
const models = getAvailableModels('openrouter');
console.log(models);
```

---

## 📚 Additional Resources

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Hugging Face Docs**: https://huggingface.co/docs/api-inference
- **Cerebras Docs**: https://docs.cerebras.ai
- **Replicate Docs**: https://replicate.com/docs

---

**Status**: ✅ Free AI models integrated with continuous learning support!


