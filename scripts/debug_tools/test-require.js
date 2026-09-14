const path = require('path');
const fs = require('fs');

console.log('Testing requires...');

const routes = [
  './server/routes/auth',
  './server/routes/content',
  './server/routes/events',
  './server/routes/video',
  './server/routes/analytics/user',
  './server/routes/oauth/instagram',
  './server/routes/performance'
];

routes.forEach(route => {
  try {
    console.log(`Requiring ${route}...`);
    const mod = require(path.resolve(route));
    console.log(`  Success! Export type: ${typeof mod}`);
    if (typeof mod === 'object' && mod !== null) {
      console.log(`  Keys: ${Object.keys(mod).join(', ')}`);
    }
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }
});

console.log('Test complete.');
