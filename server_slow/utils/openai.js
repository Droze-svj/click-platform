// OpenAI client for moderation, completions, etc.
// Used by contentModerationService (now uses googleAI) and legacy services.
// Services have been migrated to use ../utils/googleAI; this is kept for any remaining references.

let client = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (err) {
  // openai package not installed or init failed
}

module.exports = client;
