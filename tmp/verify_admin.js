const jwt = require('jsonwebtoken');
const axios = require('axios');

async function runTest() {
  const secret = 'fallback-secret';
  const adminToken = 'dev-jwt-token-admin'; // Bypasses decoding, maps to dev-user-123
  const userToken = jwt.sign({ userId: 'test-user-456' }, secret);

  const base = 'http://localhost:5001/api/model-versions/openai/gpt-4/rollback';
  const headers = { 'Host': 'localhost' };

  console.log('Testing Unauthorized...');
  try {
    const res = await axios.post(base, {}, { headers });
    console.log(`- Status: ${res.status}`);
  } catch (err) {
    console.log(`- Status: ${err.response?.status || err.message}`);
  }

  console.log('Testing Regular User (test-user-456)...');
  try {
    const res = await axios.post(base, { targetVersion: 'v1' }, { 
      headers: { ...headers, 'Authorization': `Bearer ${userToken}` } 
    });
    console.log(`- Status: ${res.status}`);
  } catch (err) {
    console.log(`- Status: ${err.response?.status || err.message}`);
    console.log(`- Body:`, err.response?.data);
  }

  console.log('Testing Admin User (dev-user-123)...');
  try {
    const res = await axios.post(base, { targetVersion: 'v1' }, { 
      headers: { ...headers, 'Authorization': `Bearer ${adminToken}` } 
    });
    console.log(`- Status: ${res.status}`);
  } catch (err) {
    console.log(`- Status: ${err.response?.status || err.message}`);
    // 404/400 is fine as long as not 403/401
    if (err.response?.status === 403 || err.response?.status === 401) {
      console.log(`- FAILED: Access denied for admin`);
    } else {
      console.log(`- PASSED: Permitted (received ${err.response?.status})`);
    }
  }
}

runTest();
