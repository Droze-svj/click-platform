// Using built-in fetch

async function smokeTest() {
  const API_URL = 'http://localhost:5001/api';
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Smoke Test User'
  };

  console.log('🧪 Starting Smoke Test...');

  // 1. Health Check
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ Health Check:', health.status);
  } catch (e) {
    console.error('❌ Health Check Failed:', e.message);
  }

  // 2. Register User
  try {
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const reg = await regRes.json();
    if (reg.success) {
      console.log('✅ Registration Successful:', reg.data.user.email);
    } else {
      console.log('❌ Registration Failed:', reg.error);
    }
  } catch (e) {
    console.error('❌ Registration Error:', e.message);
  }

  // 3. Login User
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    const login = await loginRes.json();
    if (login.success) {
      console.log('✅ Login Successful. Token:', login.data.token.substring(0, 10) + '...');
    } else {
      console.log('❌ Login Failed:', login.error);
    }
  } catch (e) {
    console.error('❌ Login Error:', e.message);
  }
}

smokeTest();
