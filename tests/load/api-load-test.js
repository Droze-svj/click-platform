import http from 'k6/http';
import { check, sleep } from 'k6';

// Export an options object for K6 execution
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Simulate 20 concurrent users stepping up over 30s
    { duration: '1m', target: 20 },  // Hold at 20 concurrent users for 1m
    { duration: '30s', target: 0 },  // Ramp down to 0 over 30s
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'], // 95% of requests must complete within 1500ms
    'http_req_failed': ['rate<0.05'],    // less than 5% of requests can fail
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5001/api';

// Create a mock script payload for synthesis
const mockScript = {
  title: 'K6 Stress Test',
  scenes: [
    {
      type: 'b-roll',
      description: 'A bustling coffee shop',
      duration: 5,
    },
    {
      type: 'character',
      description: 'A man coding on a laptop',
      duration: 3,
    }
  ]
};

// Create mock video metadata
const mockVideoData = {
  id: 'k6_stress_001',
  durationSeconds: 15,
  targetPlatform: 'tiktok',
  niche: 'technology'
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${__ENV.JWT_TOKEN}` // Mock authorization token
  };

  // 1. Fetch Sovereign Insights (High Read Load)
  const insightsRes = http.get(`${BASE_URL}/sovereign/insights?niche=technology`, { headers });
  check(insightsRes, {
    'Insights status is 200': (r) => r.status === 200,
    'Insights returned success': (r) => r.json('success') === true,
  });
  sleep(1);

  // 2. Build Spatial Ledger (Complex Processing Load)
  const spatialRes = http.post(`${BASE_URL}/phase8/spatial/build`, JSON.stringify({
    script: mockScript,
    projectId: 'stress_test_ledger'
  }), { headers });
  check(spatialRes, {
    'Spatial Ledger status is 200': (r) => r.status === 200,
    'Ledger returned success': (r) => r.json('success') === true,
  });
  sleep(1);

  // 3. Generate ZPD Overlays (Data Generation Load)
  const zpdRes = http.post(`${BASE_URL}/phase8/zpd/generate`, JSON.stringify({
    videoData: mockVideoData,
    options: { overlayCount: 2 }
  }), { headers });
  check(zpdRes, {
    'ZPD Generation status is 200': (r) => r.status === 200,
    'ZPD Generation returned manifest': (r) => r.json().manifest !== undefined,
  });
  sleep(1);
}
