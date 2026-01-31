#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('🔧 Server Fix Script - WHOP AI V3');
console.log('=================================');

// Step 1: Kill existing processes
console.log('\n🛑 Killing existing processes...');
try {
  execSync('pkill -f "node server/index.js" || true');
  execSync('pkill -f "npm start" || true');
  console.log('✅ Processes killed');
} catch (err) {
  console.log('⚠️ No processes to kill or kill failed:', err.message);
}

// Step 2: Clear caches and temporary files
console.log('\n🧹 Clearing caches...');
const cacheDirs = [
  'node_modules/.cache',
  '.next/cache',
  'client/.next/cache'
];

cacheDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Cleared ${dir}`);
    } catch (err) {
      console.log(`⚠️ Failed to clear ${dir}:`, err.message);
    }
  }
});

// Step 3: Fix environment variables
console.log('\n🔧 Checking environment configuration...');
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file missing - creating template...');
  const envTemplate = `# Database
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis (optional - use cloud Redis for production)
REDIS_URL=redis://localhost:6379

# Email (optional)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Server
NODE_ENV=development
PORT=5001

# AI Services (optional)
OPENAI_API_KEY=your_openai_api_key_here

# Cloud Storage (optional)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env template - please fill in your values');
} else {
  console.log('✅ .env file exists');
}

// Step 4: Check and fix package.json
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('✅ package.json is valid');
} catch (err) {
  console.log('❌ package.json is invalid:', err.message);
}

// Step 5: Clean and reinstall dependencies
console.log('\n🔄 Cleaning node_modules...');
if (fs.existsSync('node_modules')) {
  try {
    fs.rmSync('node_modules', { recursive: true, force: true });
    console.log('✅ Removed node_modules');
  } catch (err) {
    console.log('⚠️ Failed to remove node_modules:', err.message);
  }
}

console.log('📦 Reinstalling dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (err) {
  console.log('❌ Failed to install dependencies:', err.message);
}

// Step 6: Set proper environment variables for development
console.log('\n🌍 Setting development environment...');
process.env.NODE_ENV = 'development';
process.env.PORT = '5001';

// Step 7: Start server with proper configuration
console.log('\n🚀 Starting server...');
console.log('Server will start with:');
console.log('- NODE_ENV: development');
console.log('- PORT: 5001');
console.log('- Memory limit: 2GB');
console.log('- Development mode (reduced features)');

const serverProcess = spawn('node', [
  '--max-old-space-size=2048',
  'server/index.js'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '5001'
  }
});

serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Server started successfully');
  } else {
    console.log(`❌ Server exited with code ${code}`);
    process.exit(code);
  }
});

// Wait a bit then check if server is responding
setTimeout(() => {
  console.log('\n🔍 Checking server health...');

  const http = require('http');
  const req = http.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  }, (res) => {
    console.log(`✅ Server responding on port 5001 (status: ${res.statusCode})`);

    if (res.statusCode === 200) {
      console.log('🎉 Server is healthy!');
      console.log('\n📋 Next steps:');
      console.log('1. Open http://localhost:5001 in your browser');
      console.log('2. Test the enhanced voice hooks at /api/video/voice-hooks');
      console.log('3. Check API docs at http://localhost:5001/api-docs');
      console.log('4. Start frontend: cd frontend-integration && npm start');
    }
  });

  req.on('error', (err) => {
    console.log('❌ Server not responding:', err.message);
    console.log('💡 Try running the server manually: node --max-old-space-size=2048 server/index.js');
  });

  req.on('timeout', () => {
    console.log('⏰ Server health check timed out');
    req.destroy();
  });

  req.end();
}, 5000);





