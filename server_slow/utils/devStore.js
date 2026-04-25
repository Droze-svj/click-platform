// In-memory store for dev content to bypass MongoDB during development
// Centralized to ensure all services can access mock data
// Enhanced with JSON persistence to survive nodemon restarts

const fs = require('fs');
const path = require('path');
const Content = require('../models/Content');

const STORE_PATH = path.join(process.cwd(), 'uploads/dev_store.json');
const devVideoStore = new Map();

// Load existing data on startup
try {
  if (fs.existsSync(STORE_PATH)) {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    Object.entries(data).forEach(([key, value]) => {
      devVideoStore.set(key, value);
    });
    console.log(`📦 [DevStore] Loaded ${devVideoStore.size} items from disk`);
  }
} catch (err) {
  console.error('❌ [DevStore] Failed to load data:', err.message);
}

// Intercept Map.set to persist data
const originalSet = devVideoStore.set.bind(devVideoStore);
devVideoStore.set = function(key, value) {
  const result = originalSet(key, value);
  try {
    const data = Object.fromEntries(devVideoStore);
    if (!fs.existsSync(path.dirname(STORE_PATH))) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ [DevStore] Failed to persist data:', err.message);
  }
  return result;
};

/**
 * Resolve content by ID, supporting both MongoDB and In-Memory Dev Store
 */
async function resolveContent(videoId, options = {}) {
  if (!videoId) return null;
  
  if (videoId.toString().startsWith('dev-content-') || videoId.toString().startsWith('dev-')) {
    const mockContent = devVideoStore.get(videoId);
    if (!mockContent) return null;
    return mockContent;
  }
  
  try {
    const { getDatabaseHealth } = require('../config/database');
    if (!getDatabaseHealth().mongodb) return null;

    const query = Content.findById(videoId);
    if (options.select) query.select(options.select);
    if (options.lean) query.lean();
    
    return await query.exec();
  } catch (err) {
    // If it's a cast error, it might be a malformed dev ID that didn't start with dev-
    return null;
  }
}

module.exports = {
  devVideoStore,
  resolveContent
};
