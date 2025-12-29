// Natural Language Search Service
// Processes natural language queries and extracts intent

const { generateSocialContent } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Parse natural language query
 */
async function parseNaturalLanguageQuery(query) {
  try {
    // Extract search intent and filters from natural language
    const parsed = {
      originalQuery: query,
      searchTerms: [],
      filters: {},
      operators: [],
      intent: 'search'
    };

    // Extract quoted phrases (exact matches)
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      parsed.operators.push({
        type: 'exact',
        value: quotedMatches.map(m => m.replace(/"/g, ''))
      });
      query = query.replace(/"([^"]+)"/g, '').trim();
    }

    // Extract boolean operators
    const andMatches = query.match(/\b(and|&)\b/gi);
    const orMatches = query.match(/\b(or|\|)\b/gi);
    const notMatches = query.match(/\b(not|-)\b/gi);

    if (andMatches) {
      parsed.operators.push({ type: 'and' });
    }
    if (orMatches) {
      parsed.operators.push({ type: 'or' });
    }
    if (notMatches) {
      parsed.operators.push({ type: 'not' });
    }

    // Extract filters from natural language
    const filterPatterns = [
      { pattern: /(?:platform|on)\s+(twitter|linkedin|facebook|instagram|youtube|tiktok)/gi, key: 'platforms' },
      { pattern: /(?:type|kind|format)\s+(video|post|article|podcast|script)/gi, key: 'contentTypes' },
      { pattern: /(?:status|state)\s+(draft|published|scheduled|archived)/gi, key: 'status' },
      { pattern: /(?:tagged|with tags?)\s+([a-z0-9\s,]+)/gi, key: 'tags' },
      { pattern: /(?:created|made|posted)\s+(today|yesterday|this week|this month|last week|last month)/gi, key: 'dateRange' },
      { pattern: /(?:engagement|performance)\s+(?:over|above|more than)\s+(\d+)/gi, key: 'minEngagement' },
      { pattern: /(?:favorite|starred|bookmarked)/gi, key: 'isFavorite' }
    ];

    filterPatterns.forEach(({ pattern, key }) => {
      const matches = query.match(pattern);
      if (matches) {
        if (key === 'platforms' || key === 'contentTypes' || key === 'status') {
          parsed.filters[key] = matches.map(m => {
            const match = m.match(/(twitter|linkedin|facebook|instagram|youtube|tiktok|video|post|article|podcast|script|draft|published|scheduled|archived)/i);
            return match ? match[1].toLowerCase() : null;
          }).filter(Boolean);
        } else if (key === 'tags') {
          const tagMatch = matches[0].match(/(?:tagged|with tags?)\s+([a-z0-9\s,]+)/i);
          if (tagMatch) {
            parsed.filters.tags = tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
          }
        } else if (key === 'dateRange') {
          parsed.filters.dateRange = parseDateRange(matches[0]);
        } else if (key === 'minEngagement') {
          const engMatch = matches[0].match(/(\d+)/);
          if (engMatch) {
            parsed.filters.minEngagement = parseInt(engMatch[1]);
          }
        } else if (key === 'isFavorite') {
          parsed.filters.isFavorite = true;
        }
        // Remove filter from query
        query = query.replace(pattern, '').trim();
      }
    });

    // Extract intent
    const intentPatterns = [
      { pattern: /(?:show|find|search|get|list)/gi, intent: 'search' },
      { pattern: /(?:recommend|suggest|discover)/gi, intent: 'recommend' },
      { pattern: /(?:similar|like|related)/gi, intent: 'similar' },
      { pattern: /(?:trending|popular|best|top)/gi, intent: 'trending' }
    ];

    intentPatterns.forEach(({ pattern, intent }) => {
      if (query.match(pattern)) {
        parsed.intent = intent;
      }
    });

    // Remaining query is search terms
    parsed.searchTerms = query.split(/\s+/).filter(term => term.length > 0);

    return parsed;
  } catch (error) {
    logger.error('Error parsing natural language query', { error: error.message, query });
    return {
      originalQuery: query,
      searchTerms: query.split(/\s+/),
      filters: {},
      operators: [],
      intent: 'search'
    };
  }
}

/**
 * Parse date range from natural language
 */
function parseDateRange(dateString) {
  const now = new Date();
  const ranges = {
    'today': { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() },
    'yesterday': {
      start: new Date(now.setDate(now.getDate() - 1)),
      end: new Date(now.setHours(23, 59, 59, 999))
    },
    'this week': {
      start: new Date(now.setDate(now.getDate() - now.getDay())),
      end: new Date()
    },
    'this month': {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date()
    },
    'last week': {
      start: new Date(now.setDate(now.getDate() - now.getDay() - 7)),
      end: new Date(now.setDate(now.getDate() - now.getDay()))
    },
    'last month': {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0)
    }
  };

  const lower = dateString.toLowerCase();
  for (const [key, value] of Object.entries(ranges)) {
    if (lower.includes(key)) {
      return {
        start: value.start.toISOString(),
        end: value.end.toISOString()
      };
    }
  }

  return null;
}

/**
 * Enhance query with AI understanding
 */
async function enhanceQueryWithAI(query) {
  try {
    // Use AI to understand query intent and expand search terms
    const prompt = `Analyze this search query and extract:
1. Main search intent
2. Key topics/themes
3. Related terms/synonyms
4. Content type hints
5. Platform hints

Query: "${query}"

Respond with JSON: { intent, topics, relatedTerms, contentType, platform }`;

    // For now, return basic enhancement
    // In production, use OpenAI or similar
    return {
      intent: 'search',
      topics: extractTopics(query),
      relatedTerms: [],
      contentType: null,
      platform: null
    };
  } catch (error) {
    logger.error('Error enhancing query with AI', { error: error.message });
    return null;
  }
}

/**
 * Extract topics from query
 */
function extractTopics(query) {
  // Simple topic extraction
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = query.toLowerCase().split(/\s+/);
  return words.filter(word => word.length > 3 && !stopWords.includes(word));
}

module.exports = {
  parseNaturalLanguageQuery,
  enhanceQueryWithAI
};

