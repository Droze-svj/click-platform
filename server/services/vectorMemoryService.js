const { generateEmbeddings } = require('../utils/googleAI');
const redisClient = require('../utils/redisCache');

// Mock in-memory Vector DB fallback
// In production, instantiate Pinecone or Weaviate Client here
const inMemoryVectorDB = new Map(); // userId => Array of { id, text, vector, metadata }

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
    console.warn("Embeddings generation failed, memory not stored.");
    return false;
  }

  // To-Do: Replace with Pinecone / Weaviate 'upsert' method when client is added.
  if (!inMemoryVectorDB.has(userId)) {
    inMemoryVectorDB.set(userId, []);
  }

  const memoryStore = inMemoryVectorDB.get(userId);
  memoryStore.push({
    id: Date.now().toString(),
    text,
    vector,
    metadata,
  });

  return true;
}

/**
 * Query the vector DB for contextually relevant past preferences.
 * @param {string} userId - ID of the user
 * @param {string} queryText - The current task instructing the Editor Agent
 * @param {number} topK - How many memories to fetch
 */
async function queryUserMemory(userId, queryText, topK = 3) {
  // Semantic Cache Check via Redis (or local map if redis unavailable)
  const cacheKey = `semantic_cache:${userId}:${Buffer.from(queryText).toString('base64').substring(0, 32)}`;

  if (redisClient && redisClient.get) {
    try {
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        console.log("Semantic Cache Hit!");
        return JSON.parse(cachedResult);
      }
    } catch (err) {
      console.warn("Redis Cache check failed", err);
    }
  }

  const vector = await generateEmbeddings(queryText);
  if (!vector) return [];

  // To-Do: Replace with Pinecone / Weaviate 'query' method when client is added.
  const memoryStore = inMemoryVectorDB.get(userId) || [];

  // Calculate similarities
  const scoredMemories = memoryStore.map(memory => {
    return {
      ...memory,
      score: cosineSimilarity(vector, memory.vector),
    };
  });

  // Sort descending by score
  scoredMemories.sort((a, b) => b.score - a.score);

  // Return topK
  const results = scoredMemories.slice(0, topK).map(mem => ({
    text: mem.text,
    metadata: mem.metadata,
    score: mem.score,
  }));

  // Store in Redis Semantic Cache (expire in 1 hour)
  if (redisClient && redisClient.set) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(results), 'EX', 3600);
    } catch (err) {
      console.warn("Redis Cache set failed", err);
    }
  }

  return results;
}

module.exports = {
  storeUserMemory,
  queryUserMemory,
};
