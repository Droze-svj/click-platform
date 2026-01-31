// OpenAI client for moderation, completions, etc.
// Used by contentModerationService and other AI features.

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
