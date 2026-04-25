// Click is configured for Gemini-only AI. This module previously exported an
// OpenAI client; it now returns `null` so any consumer that still does
// `require('../utils/openai')` falls through its existing null-check path and
// will route requests to ../utils/googleAI instead.
//
// To re-enable OpenAI in the future, set AI_GEMINI_ONLY=0 *and* OPENAI_API_KEY,
// and import the OpenAI SDK directly at the call site — this util will not be
// brought back, since centralizing two providers behind one shim hid bugs.

const logger = require('./logger');

if (process.env.OPENAI_API_KEY && process.env.AI_GEMINI_ONLY !== '0') {
  logger.warn(
    'OPENAI_API_KEY is set but AI_GEMINI_ONLY mode is active — OpenAI client is disabled. ' +
    'All AI calls route through Gemini (utils/googleAI.js). Unset OPENAI_API_KEY or set AI_GEMINI_ONLY=0 to opt out.'
  );
}

module.exports = null;
