const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { initDatabases, getDatabaseHealth } = require('../config/database');

async function test() {
  
  const status = await initDatabases();
  
  const health = getDatabaseHealth();
  
  process.exit(0);
}

test().catch(err => {
  
  process.exit(1);
});
