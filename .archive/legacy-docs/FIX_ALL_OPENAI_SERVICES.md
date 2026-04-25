# Fix All Remaining OpenAI Services

Since we're seeing errors one by one, I'm going to proactively fix ALL remaining services that instantiate OpenAI at module load time. This will prevent the iterative fixing process.

## Services Still Needing Fixes

Based on the grep results, these services still need to be fixed:
1. `advancedRepurposingService.js`
2. `advancedContentGenerationService.js`
3. `aiRecommendationsEngine.js`
4. `aiConfidenceService.js`
5. `aiTemplateService.js`
6. `enhancedAISummaryService.js`
7. `smartThumbnailService.js`
8. `videoChaptersService.js`
9. `videoTranscriptionService.js`
10. `aiVideoEditingService.js`
11. `videoCaptionService.js`

## Services Already Safe
- `aiService.js` - Uses conditional
- `whisperService.js` - Uses conditional
- `scriptService.js` - Uses conditional
- `contentModerationService.js` - Uses try-catch
- `multiModelAIService.js` - Uses lazy initialization
- `reportComparisonService.js` - Creates client inside function
- `unifiedContentPipelineService.js` - Creates client inside function

## Pattern to Apply

Replace:
```javascript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

With:
```javascript
// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client', { error: error.message });
      return null;
    }
  }
  return openai;
}
```

And replace all `await openai.chat.completions.create({` with:
```javascript
const client = getOpenAIClient();
if (!client) {
  logger.warn('OpenAI API key not configured');
  throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
}

const response = await client.chat.completions.create({
```

