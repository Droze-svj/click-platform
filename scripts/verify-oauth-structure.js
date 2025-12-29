#!/usr/bin/env node

/**
 * OAuth Structure Verification Script
 * 
 * This script verifies the OAuth implementation structure without requiring credentials.
 * It checks:
 * - Service files exist and export required functions
 * - Route files exist and are properly structured
 * - Routes are registered in server/index.js
 * - Required middleware exists
 * 
 * Usage:
 *   node scripts/verify-oauth-structure.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const servicesDir = path.join(serverDir, 'services');
const routesDir = path.join(serverDir, 'routes');
const oauthRoutesDir = path.join(routesDir, 'oauth');

// Required OAuth services
const requiredServices = {
  linkedin: {
    file: 'linkedinOAuthService.js',
    functions: [
      'isConfigured',
      'getAuthorizationUrl',
      'exchangeCodeForToken',
      'getLinkedInUserInfo',
      'getLinkedInClient',
      'refreshAccessToken',
      'postToLinkedIn',
      'disconnectLinkedIn',
    ],
  },
  facebook: {
    file: 'facebookOAuthService.js',
    functions: [
      'isConfigured',
      'getAuthorizationUrl',
      'exchangeCodeForToken',
      'getFacebookUserInfo',
      'getFacebookPages',
      'getFacebookClient',
      'postToFacebook',
      'disconnectFacebook',
    ],
  },
  instagram: {
    file: 'instagramOAuthService.js',
    functions: [
      'isConfigured',
      'getInstagramAccounts',
      'getInstagramClient',
      'postToInstagram',
      'disconnectInstagram',
    ],
  },
  tiktok: {
    file: 'tiktokOAuthService.js',
    functions: [
      'isConfigured',
      'getAuthorizationUrl',
      'exchangeCodeForToken',
      'getTikTokUserInfo',
      'getTikTokClient',
      'refreshAccessToken',
      'uploadVideoToTikTok',
      'postToTikTok',
      'disconnectTikTok',
    ],
  },
  youtube: {
    file: 'youtubeOAuthService.js',
    functions: [
      'isConfigured',
      'getAuthorizationUrl',
      'exchangeCodeForToken',
      'getYouTubeUserInfo',
      'getYouTubeClient',
      'refreshAccessToken',
      'uploadVideoToYouTube',
      'postToYouTube',
      'disconnectYouTube',
    ],
  },
};

// Required OAuth routes
const requiredRoutes = {
  linkedin: 'linkedin.js',
  facebook: 'facebook.js',
  instagram: 'instagram.js',
  tiktok: 'tiktok.js',
  youtube: 'youtube.js',
};

// Required route endpoints
const requiredEndpoints = {
  linkedin: ['/authorize', '/callback', '/complete', '/post', '/disconnect', '/status'],
  facebook: ['/authorize', '/callback', '/complete', '/pages', '/post', '/disconnect', '/status'],
  instagram: ['/accounts', '/post', '/disconnect', '/status'],
  tiktok: ['/authorize', '/callback', '/complete', '/upload', '/post', '/disconnect', '/status'],
  youtube: ['/authorize', '/callback', '/complete', '/upload', '/post', '/disconnect', '/status'],
};

/**
 * Check if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Check if file contains required functions
 */
function checkServiceFunctions(servicePath, requiredFunctions) {
  if (!fileExists(servicePath)) {
    return { exists: false, functions: [] };
  }

  const content = fs.readFileSync(servicePath, 'utf8');
  const foundFunctions = [];

  for (const func of requiredFunctions) {
    // Check for function declaration or export
    const patterns = [
      new RegExp(`function\\s+${func}\\s*\\(`, 'g'),
      new RegExp(`${func}\\s*:\\s*function`, 'g'),
      new RegExp(`${func}\\s*:\\s*async`, 'g'),
      new RegExp(`const\\s+${func}\\s*=`, 'g'),
      new RegExp(`module\\.exports\\s*=\\s*{[^}]*${func}`, 'g'),
    ];

    const found = patterns.some(pattern => pattern.test(content));
    if (found) {
      foundFunctions.push(func);
    }
  }

  return { exists: true, functions: foundFunctions };
}

/**
 * Check if route file contains required endpoints
 */
function checkRouteEndpoints(routePath, requiredEndpoints) {
  if (!fileExists(routePath)) {
    return { exists: false, endpoints: [] };
  }

  const content = fs.readFileSync(routePath, 'utf8');
  const foundEndpoints = [];

  for (const endpoint of requiredEndpoints) {
    // Check for route definition
    const patterns = [
      new RegExp(`router\\.(get|post|delete|put)\\s*\\(['"]${endpoint.replace(/\//g, '\\/')}`, 'g'),
      new RegExp(`['"]${endpoint.replace(/\//g, '\\/')}['"]`, 'g'),
    ];

    const found = patterns.some(pattern => pattern.test(content));
    if (found) {
      foundEndpoints.push(endpoint);
    }
  }

  return { exists: true, endpoints: foundEndpoints };
}

/**
 * Check if routes are registered in server/index.js
 */
function checkRouteRegistration() {
  const indexPath = path.join(serverDir, 'index.js');
  if (!fileExists(indexPath)) {
    return { registered: false, routes: [] };
  }

  const content = fs.readFileSync(indexPath, 'utf8');
  const registeredRoutes = [];

  for (const [platform, routeFile] of Object.entries(requiredRoutes)) {
    const pattern = new RegExp(`/api/oauth/${platform}`, 'g');
    if (pattern.test(content)) {
      registeredRoutes.push(platform);
    }
  }

  return { registered: true, routes: registeredRoutes };
}

/**
 * Check middleware exists
 */
function checkMiddleware() {
  const middlewarePath = path.join(serverDir, 'middleware', 'oauthRateLimiter.js');
  const authPath = path.join(serverDir, 'middleware', 'auth.js');
  const asyncHandlerPath = path.join(serverDir, 'middleware', 'asyncHandler.js');

  return {
    oauthRateLimiter: fileExists(middlewarePath),
    auth: fileExists(authPath),
    asyncHandler: fileExists(asyncHandlerPath),
  };
}

/**
 * Main verification function
 */
function verifyOAuthStructure() {
  logSection('OAuth Structure Verification');

  let allPassed = true;
  const results = {};

  // Check services
  logSection('Checking OAuth Services');
  for (const [platform, service] of Object.entries(requiredServices)) {
    const servicePath = path.join(servicesDir, service.file);
    const { exists, functions } = checkServiceFunctions(servicePath, service.functions);

    if (!exists) {
      logError(`${platform}: Service file not found (${service.file})`);
      allPassed = false;
      results[platform] = { service: false, route: null };
      continue;
    }

    const missingFunctions = service.functions.filter(f => !functions.includes(f));
    if (missingFunctions.length > 0) {
      logWarning(`${platform}: Missing functions: ${missingFunctions.join(', ')}`);
      allPassed = false;
    } else {
      logSuccess(`${platform}: All required functions found (${functions.length}/${service.functions.length})`);
    }

    results[platform] = { service: exists, functions: functions.length, total: service.functions.length };
  }

  // Check routes
  logSection('Checking OAuth Routes');
  for (const [platform, routeFile] of Object.entries(requiredRoutes)) {
    const routePath = path.join(oauthRoutesDir, routeFile);
    const endpoints = requiredEndpoints[platform] || [];
    const { exists, endpoints: foundEndpoints } = checkRouteEndpoints(routePath, endpoints);

    if (!exists) {
      logError(`${platform}: Route file not found (${routeFile})`);
      allPassed = false;
      if (results[platform]) {
        results[platform].route = false;
      }
      continue;
    }

    const missingEndpoints = endpoints.filter(e => !foundEndpoints.includes(e));
    if (missingEndpoints.length > 0) {
      logWarning(`${platform}: Missing endpoints: ${missingEndpoints.join(', ')}`);
      allPassed = false;
    } else {
      logSuccess(`${platform}: All required endpoints found (${foundEndpoints.length}/${endpoints.length})`);
    }

    if (results[platform]) {
      results[platform].route = exists;
      results[platform].endpoints = foundEndpoints.length;
      results[platform].totalEndpoints = endpoints.length;
    }
  }

  // Check route registration
  logSection('Checking Route Registration');
  const { registered, routes } = checkRouteRegistration();
  if (registered) {
    logSuccess(`Routes registered in server/index.js (${routes.length}/${Object.keys(requiredRoutes).length} platforms)`);
    const missingRoutes = Object.keys(requiredRoutes).filter(r => !routes.includes(r));
    if (missingRoutes.length > 0) {
      logWarning(`Missing route registrations: ${missingRoutes.join(', ')}`);
      allPassed = false;
    }
  } else {
    logError('Could not check route registration (server/index.js not found)');
    allPassed = false;
  }

  // Check middleware
  logSection('Checking Middleware');
  const middleware = checkMiddleware();
  if (middleware.oauthRateLimiter) {
    logSuccess('OAuth rate limiter middleware found');
  } else {
    logError('OAuth rate limiter middleware not found');
    allPassed = false;
  }

  if (middleware.auth) {
    logSuccess('Auth middleware found');
  } else {
    logError('Auth middleware not found');
    allPassed = false;
  }

  if (middleware.asyncHandler) {
    logSuccess('Async handler middleware found');
  } else {
    logError('Async handler middleware not found');
    allPassed = false;
  }

  // Summary
  logSection('Verification Summary');
  
  const platforms = Object.keys(requiredServices);
  let serviceCount = 0;
  let routeCount = 0;

  platforms.forEach(platform => {
    const result = results[platform];
    if (result?.service) serviceCount++;
    if (result?.route) routeCount++;
  });

  logInfo(`Services: ${serviceCount}/${platforms.length} platforms`);
  logInfo(`Routes: ${routeCount}/${platforms.length} platforms`);
  logInfo(`Middleware: ${Object.values(middleware).filter(Boolean).length}/3 components`);

  if (allPassed) {
    logSuccess('All OAuth structure checks passed!');
    logInfo('Next step: Configure OAuth credentials and test end-to-end flows');
  } else {
    logWarning('Some OAuth structure checks failed. Please review the issues above.');
  }

  return { allPassed, results, middleware };
}

// Run if called directly
if (require.main === module) {
  try {
    const result = verifyOAuthStructure();
    process.exit(result.allPassed ? 0 : 1);
  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

module.exports = { verifyOAuthStructure };


