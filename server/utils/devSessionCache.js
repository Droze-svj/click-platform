// In-memory cache for dev-user session state (resets on nodemon restart)
// Centralized to avoid circular dependencies between auth middleware and user routes
// Enhanced with JSON persistence to ensure all progress and datas are saved

const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(process.cwd(), 'uploads/dev_sessions.json');

const devSessionCache = {
  'dev-user-123': { name: 'Master Admin', niche: 'Digital Marketing' },
  'dev-viral-124': { name: 'Viral Specialist', niche: 'Gaming' },
  'dev-finance-125': { name: 'Corporate Strategist', niche: 'Finance' },
  'dev-lifestyle-126': { name: 'Lifestyle Maven', niche: 'Lifestyle' },
  'dev-creator-127': { name: 'Educational Creator', niche: 'Education' }
};


// Load existing sessions on startup
try {
  if (fs.existsSync(SESSION_PATH)) {
    const data = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    Object.assign(devSessionCache, data);
    console.log(`📦 [DevSession] Loaded ${Object.keys(data).length} sessions from disk`);
  }
} catch (err) {
  console.error('❌ [DevSession] Failed to load data:', err.message);
}

/**
 * Persist the cache to disk
 */
function persistSessions() {
  try {
    if (!fs.existsSync(path.dirname(SESSION_PATH))) {
      fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    }
    fs.writeFileSync(SESSION_PATH, JSON.stringify(devSessionCache, null, 2));
  } catch (err) {
    console.error('❌ [DevSession] Failed to persist data:', err.message);
  }
}

// Proxied cache to handle auto-persistence on updates
const proxyHandler = {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    persistSessions();
    return true;
  }
};

const proxiedCache = new Proxy(devSessionCache, proxyHandler);

module.exports = {
  devSessionCache: proxiedCache,
  getDevSessionCache: () => proxiedCache
};
