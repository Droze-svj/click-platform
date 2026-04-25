const axios = require('axios');

const API_URL = 'https://click-platform.onrender.com';

async function verify() {
  console.log('🔍 Verifying Production API: ' + API_URL);
  try {
    const res = await axios.get(`${API_URL}/api/health`);
    console.log('✅ Health check status:', res.status);
    console.log('✅ Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data.status === 'ok' && res.data.integrations.database.connected) {
      console.log('\n🌟 PRODUCTION IS READY!');
    } else {
      console.log('\n⚠️ Production has issues.');
    }
  } catch (err) {
    console.error('❌ Error verifying production:', err.message);
  }
}

verify();
