const { generateEmbeddings } = require('../utils/googleAI');
const redisClient = require('../utils/redisCache');
const VectorMemory = require('../models/VectorMemory');

// IMPORTANT: VectorMemory is a PERSISTED store. Its vectors are written at one
// time and compared at another, so the embedding provider MUST stay constant
// across the lifetime of the data — mixing 768-dim Gemini vectors with 512-dim
// TensorFlow-USE vectors makes cosine similarity silently return 0 (length
// mismatch) and breaks retrieval. We therefore pin this store to Gemini
// `text-embedding-004` (the dimensionality all existing rows were written with).
// The TF/USE path in mlEngine is reserved for same-request comparisons (e.g.
// semantic search, where query + candidates are embedded together).


/**
 * Calculates cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store user edit preference/history to the vector db.
 * @param {string} userId - ID of the user
 * @param {string} text - The instructions or preference (e.g., "Make intro jump-cut heavy")
 * @param {Object} metadata - Additional context data
 */
async function storeUserMemory(userId, text, metadata = {}) {
  const vector = await generateEmbeddings(text);
  if (!vector) {
    
    return false;
  }

  await VectorMemory.create({
    userId,
    text,
    vector,
    metadata
  });

  return true;
}

/**
 * Query the vector DB for contextually relevant past preferences.
 * @param {string} userId - ID of the user
 * @param {string} queryText - The current task instructing the Editor Agent
 * @param {number} topK - How many memories to fetch
 */
async function queryUserMemory(userId, queryText, topKOrOptions = 3) {
  let topK = 3;
  let options = {};
  if (topKOrOptions && typeof topKOrOptions === 'object') {
    options = topKOrOptions;
    topK = options.limit ?? options.topK ?? 3;
  } else if (typeof topKOrOptions === 'number') {
    topK = topKOrOptions;
  }

  const minScore = options.minScore ?? 0.60;
  const niche = options.niche;
  const platform = options.platform;
  const category = options.category;
  const tags = options.tags || [];

  // Semantic Cache Check via Redis (or local map if redis unavailable)
  const cacheOptionsHash = Buffer.from(JSON.stringify({ niche, platform, category, tags, minScore })).toString('base64').substring(0, 16);
  const cacheKey = `semantic_cache:${userId}:${Buffer.from(queryText).toString('base64').substring(0, 32)}:${cacheOptionsHash}`;

  if (redisClient && redisClient.get) {
    try {
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }
    } catch (err) {
      // Degrade gracefully if redis errors
    }
  }

  const vector = await generateEmbeddings(queryText);
  if (!vector) return [];

  const memoryStore = await VectorMemory.find({ userId }).lean() || [];

  // Calculate similarities and apply contextual boosts
  const scoredMemories = memoryStore.map(memory => {
    const rawScore = cosineSimilarity(vector, memory.vector);
    let boostedScore = rawScore;
    
    // Apply context boosts if metadata is available
    if (memory.metadata) {
      if (niche && memory.metadata.niche === niche) {
        boostedScore += 0.15;
      }
      if (platform && memory.metadata.platform === platform) {
        boostedScore += 0.08;
      }
      if (category && memory.metadata.category === category) {
        boostedScore += 0.10;
      }
      // If tags match, boost by 0.10 per match (max 0.20)
      if (tags.length > 0 && Array.isArray(memory.metadata.tags)) {
        let tagMatches = 0;
        for (const t of tags) {
          if (memory.metadata.tags.includes(t)) tagMatches++;
        }
        boostedScore += Math.min(tagMatches * 0.10, 0.20);
      }
    }
    
    // Clamp maximum score to 1.0
    boostedScore = Math.min(boostedScore, 1.0);

    // Temporal decay: memories older than 6 months weighted up to 40% less
    const createdAtTime = memory.createdAt ? new Date(memory.createdAt).getTime() : Date.now();
    if (!isNaN(createdAtTime)) {
      const ageInDays = (Date.now() - createdAtTime) / 86400000;
      boostedScore *= Math.max(0.6, 1 - (ageInDays / 180) * 0.4);
    }

    return {
      ...memory,
      rawScore,
      score: boostedScore,
    };
  });

  // Filter out scored memories under minimum score threshold
  const filteredMemories = scoredMemories.filter(m => m.score >= minScore);

  // Sort descending by score
  filteredMemories.sort((a, b) => b.score - a.score);

  // Return topK
  const results = filteredMemories.slice(0, topK).map(mem => ({
    id: mem._id,
    text: mem.text,
    metadata: mem.metadata,
    score: mem.score,
    rawScore: mem.rawScore,
  }));

  // Store in Redis Semantic Cache (expire in 1 hour)
  if (redisClient && redisClient.set) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(results), 'EX', 3600);
    } catch (err) {
      // Degrade gracefully if redis errors
    }
  }

  return results;
}

/**
 * Delete a specific memory for a user
 * @param {string} userId - ID of the user
 * @param {string} memoryId - ID of the memory to delete
 */
async function deleteUserMemory(userId, memoryId) {
  try {
    const result = await VectorMemory.deleteOne({ _id: memoryId, userId });
    return result.deletedCount > 0;
  } catch (err) {
    return false;
  }
}

module.exports = {
  storeUserMemory,
  queryUserMemory,
  deleteUserMemory,
};
