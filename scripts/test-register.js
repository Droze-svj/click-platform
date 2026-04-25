const axios = require('axios');

async function testRegister() {
  const url = 'http://localhost:5001/api/auth/register';
  console.log('🧪 Testing Register at ' + url);
  try {
    const res = await axios.post(url, {
      email: 'test' + Date.now() + '@example.com',
      password: 'StrongPassword123!',
      name: 'Test Bot'
    }, { timeout: 60000 });
    console.log('✅ Status:', res.status);
    console.log('✅ Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error Status:', err.response?.status);
    console.error('❌ Error Data:', JSON.stringify(err.response?.data, null, 2));
    console.error('❌ Message:', err.message);
  }
}

testRegister();
