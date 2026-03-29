const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { initDatabases, getDatabaseHealth } = require('../config/database');

async function test() {
  console.log('Testing database connections...');
  const status = await initDatabases();
  console.log('Status:', JSON.stringify(status, null, 2));
  const health = getDatabaseHealth();
  console.log('Health:', JSON.stringify(health, null, 2));
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
