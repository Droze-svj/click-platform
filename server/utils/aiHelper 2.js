/**
 * AI Helper Utilities
 * Provides unified, robust logic for handling AI outputs, 
 * cleaning JSON, and applying common transformations.
 */

const logger = require('./logger');

/**
 * 🛡️ Sovereign JSON Purifier
 * Guarantees that AI output is stripped of markdown wrapping (```json) before parsing.
 * Handles: markdown fences, pre/post-amble text, truncated output, and trailing commas.
 */
function safeJsonParse(rawString, fallback = {}) {
  if (!rawString) return fallback;
  
  try {
    let cleaned = String(rawString).trim();
    
    // 1. Remove markdown fences
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        // If match failed but ``` exists, try to strip them manually
        cleaned = cleaned.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      }
    }
    
    // 2. Extract outermost JSON structure (object or array) if there's pre/post-amble
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);
    else if (firstBrace !== -1) startIdx = firstBrace;
    else if (firstBracket !== -1) startIdx = firstBracket;

    if (startIdx !== -1) {
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      let endIdx = Math.max(lastBrace, lastBracket);
      
      if (endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
      } else {
        // Truncated: starts but doesn't end
        cleaned = cleaned.substring(startIdx);
      }
    }
    
    // 3. Quick try
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      // Continue to more aggressive repair
    }
    
    // 4. Aggressive repair (balance braces, close strings, remove trailing commas)
    let body = cleaned;
    let inString = false;
    let escape = false;
    const stack = [];
    let lastSafe = -1;
    
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && inString) { escape = true; continue; }
      if (c === '"') { inString = !inString; if (!inString) lastSafe = i; continue; }
      if (inString) continue;
      
      if (c === '{' || c === '[') {
        stack.push(c);
        lastSafe = i;
      } else if (c === '}' || c === ']') {
        const top = stack.pop();
        if ((c === '}' && top === '{') || (c === ']' && top === '[')) {
          lastSafe = i;
        } else {
          // Mismatch - likely truncated or malformed
          break;
        }
      } else if (/[0-9a-zA-Z]/.test(c) && stack.length > 0) {
        lastSafe = i;
      }
    }
    
    let repaired = body.slice(0, lastSafe + 1);
    if (inString) repaired += '"';
    
    // Strip trailing commas before closing
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');
    
    // Close remaining stack
    while (stack.length) {
      const open = stack.pop();
      repaired += open === '{' ? '}' : ']';
    }
    
    try {
      return JSON.parse(repaired);
    } catch (err) {
      logger.error('Aggressive JSON Repair Failed', { 
        error: err.message, 
        snippet: repaired.substring(0, 100) 
      });
      return fallback;
    }
  } catch (error) {
    logger.error('Unified JSON Purifier Fatal Error', { error: error.message });
    return fallback;
  }
}

/**
 * The Cliche Shield
 * Detects and replaces repetitive marketing jargon with high-impact originality.
 */
function applyClicheShield(text) {
  if (!text || typeof text !== 'string') return text;
  
  const cliches = {
    'game-changer': 'paradigm shift',
    'level up': 'strategic evolution',
    'cutting-edge': 'pioneer-grade',
    'seamlessly': 'intuitively',
    'one-stop shop': 'comprehensive ecosystem',
    'revolutionary': 'disruptive',
    'vibrant': 'dynamic',
    'powerful': 'high-velocity',
    'ultimate': 'definitive',
    'unleash': 'manifest',
    'transform': 'synthesize',
    'expert': 'master-grade',
    'innovative': 'avant-garde',
  };

  let cleaned = text;
  for (const [cliche, replacement] of Object.entries(cliches)) {
    const regex = new RegExp(`\\b${cliche}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned;
}

module.exports = {
  safeJsonParse,
  applyClicheShield
};
