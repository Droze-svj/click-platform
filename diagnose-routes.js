// Diagnostic script: loads each route file that server/index.js uses,
// checks if it exports a function (router) or an object (bad), and detects hangs.

const path = require('path');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

// Load .env so routes that check env vars don't fail oddly
const rootEnv = path.join(__dirname, '.env.nosync');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// All routes as mounted in server/index.js (in order)
const routes = [
  './server/routes/auth',
  './server/routes/user',
  './server/routes/dashboard',
  './server/routes/tasks',
  './server/routes/pm',
  './server/routes/posts',
  './server/routes/subscription',
  './server/routes/video',
  './server/routes/content',
  './server/routes/quote',
  './server/routes/scheduler',
  './server/routes/analytics/content',
  './server/routes/analytics/performance',
  './server/routes/analytics/growth',
  './server/routes/analytics/advanced',
  './server/routes/analytics/predictions',
  './server/routes/analytics',
  './server/routes/analytics/advanced-features',
  './server/routes/niche',
  './server/routes/upload',
  './server/routes/upload/progress',
  './server/routes/search',
  './server/routes/export',
  './server/routes/batch',
  './server/routes/templates',
  './server/routes/music',
  './server/routes/video/effects',
  './server/routes/video/enhance',
  './server/routes/admin',
  './server/routes/scripts',
  './server/routes/versions',
  './server/routes/collaboration',
  './server/routes/membership',
  './server/routes/notifications',
  './server/routes/subscription/status',
  './server/routes/import',
  './server/routes/workflows',
  './server/routes/engagement',
  './server/routes/library',
  './server/routes/suggestions',
  './server/routes/social',
  './server/routes/oauth',
  './server/routes/teams',
  './server/routes/approvals',
  './server/routes/collections',
  './server/routes/comments',
  './server/routes/analytics/enhanced',
  './server/routes/analytics/contentPerformance',
  './server/routes/analytics/platform',
  './server/routes/analytics/bi',
  './server/routes/benchmarking',
  './server/routes/curation',
  './server/routes/audience',
  './server/routes/onboarding',
  './server/routes/help-center',
  './server/routes/templates/marketplace',
  './server/routes/collaboration/realtime',
  './server/routes/collaboration/permissions',
  './server/routes/push',
  './server/routes/templates/analytics',
  './server/routes/sso',
  './server/routes/admin/dashboard',
  './server/routes/white-label',
  './server/routes/reports',
  './server/routes/webhooks',
  './server/routes/sso/scim',
  './server/routes/admin/audit',
  './server/routes/admin/settings',
  './server/routes/admin/bulk',
  './server/routes/admin/error-analytics',
  './server/routes/reports/schedule',
  './server/routes/white-label/theme',
  './server/routes/cdn',
  './server/routes/cdn/analytics',
  './server/routes/cdn/warming',
  './server/routes/monitoring',
  './server/routes/monitoring/tracing',
  './server/routes/disaster-recovery',
  './server/routes/disaster-recovery/encryption',
  './server/routes/microservices',
  './server/routes/database/sharding',
  './server/routes/database/rebalancing',
  './server/routes/creative/ideation',
  './server/routes/creative/brand-voice',
  './server/routes/creative/hashtags',
  './server/routes/productive/calendar',
  './server/routes/productive/repurposing',
  './server/routes/productive/ab-testing',
  './server/routes/video/ai-editing',
  './server/routes/video/manual-editing',
  './server/routes/assets',
  './server/routes/video/voice-hooks',
  './server/routes/video/captions',
  './server/routes/video/advanced-editing',
  './server/routes/graphql',
  './server/routes/plugins',
  './server/routes/marketplace',
  './server/routes/tenants',
  './server/routes/workflows/advanced-automation',
  './server/routes/video/analytics',
  './server/routes/video/transcription',
  './server/routes/video/thumbnails',
  './server/routes/video/chapters',
  './server/routes/video/optimization',
  './server/routes/debug',
  './server/routes/ai/multi-model',
  './server/routes/ai/recommendations',
  './server/routes/ai/predictive',
  './server/routes/ai/advanced',
  './server/routes/ai/content-generation',
  './server/routes/ai/adapt',
  './server/routes/ai/generate-idea',
  './server/routes/infrastructure/cache',
  './server/routes/infrastructure/load-balancer',
  './server/routes/infrastructure/database',
  './server/routes/infrastructure/resources',
  './server/routes/workflows/templates',
  './server/routes/search/advanced',
  './server/routes/search/elasticsearch',
  './server/routes/suggestions/enhanced',
  './server/routes/workflows/enhanced',
  './server/routes/ai-recommendations',
  './server/routes/scheduling/advanced',
  './server/routes/pipeline',
  './server/routes/content-operations',
  './server/routes/enterprise',
  './server/routes/agency',
  './server/routes/recycling-advanced',
  './server/routes/content-ops-api',
  './server/routes/integrations',
  './server/routes/events',
  './server/routes/billing',
  './server/routes/usage-analytics',
  './server/routes/agency-calendar',
  './server/routes/agency-campaigns',
  './server/routes/agency-bulk',
  './server/routes/calendar-enhanced',
  './server/routes/client-portal',
  './server/routes/branded-links',
  './server/routes/reports-enhanced',
  './server/routes/portal-enhanced',
  './server/routes/client-guidelines',
  './server/routes/approval-workflow',
  './server/routes/email-approval',
  './server/routes/post-comments',
  './server/routes/post-versions',
  './server/routes/cross-client-features',
  './server/routes/cross-client-enhanced',
  './server/routes/value-tracking',
  './server/routes/service-tiers',
  './server/routes/kpi-dashboard',
  './server/routes/value-tracking-enhanced',
  './server/routes/social-performance-metrics',
  './server/routes/social-performance-enhanced',
  './server/routes/traffic-conversions',
  './server/routes/revenue-enhanced',
  './server/routes/content-insights',
  './server/routes/content-insights-enhanced',
  './server/routes/client-health',
  './server/routes/client-health-enhanced',
  './server/routes/agency-business',
  './server/routes/agency-business-enhanced',
  './server/routes/approval-kanban',
  './server/routes/simple-portal',
  './server/routes/inline-comments',
  './server/routes/version-comparison',
  './server/routes/approval-enhanced',
  './server/routes/report-builder',
  './server/routes/report-enhanced',
  './server/routes/pricing-enhanced',
  './server/routes/support-enhanced',
  './server/routes/pro-mode',
  './server/routes/workload-dashboard',
  './server/routes/playbooks',
  './server/routes/risk-flags',
  './server/routes/ai-content',
  './server/routes/ai-enhanced',
  './server/routes/moderation',
  './server/routes/backup',
  './server/routes/video/advanced',
  './server/routes/video/progress',
  './server/routes/workflows/webhooks',
  './server/routes/jobs',
  './server/routes/jobs/dashboard',
  './server/routes/jobs/progress',
  './server/routes/upload/progress',
  './server/routes/upload/chunked',
  './server/routes/security',
  './server/routes/privacy',
  './server/routes/cache',
  './server/routes/oauth/twitter',
  './server/routes/oauth/linkedin',
  './server/routes/oauth/google',
  './server/routes/oauth/facebook',
  './server/routes/oauth/instagram',
  './server/routes/oauth/youtube',
  './server/routes/oauth/tiktok',
  './server/routes/oauth/health',
  './server/routes/monitoring/performance',
  './server/routes/monitoring/cache',
  './server/routes/monitoring/database',
  './server/routes/analytics/user',
  './server/routes/transcripts',
  './server/routes/performance',
  './server/routes/translation',
  './server/routes/feature-flags',
  './server/routes/health',
  './server/routes/free-ai-models',
  './server/routes/model-versions',
  './server/routes/v2/index',
];

// Test each route in a child process with timeout
const TIMEOUT_MS = 5000;

console.log(`Testing ${routes.length} route files...\n`);

let problems = [];

for (const routePath of routes) {
  const absPath = path.resolve(__dirname, routePath);

  // Check if file exists first
  let fp = absPath;
  if (!fs.existsSync(fp)) {
    fp = fp + '.js';
  }
  if (!fp.endsWith('.js')) fp += '.js';

  if (!fs.existsSync(fp) && !fs.existsSync(absPath)) {
    // try as directory index
    const idxPath = path.join(absPath, 'index.js');
    if (!fs.existsSync(idxPath)) {
      console.log(`❓ MISSING: ${routePath}`);
      problems.push({ path: routePath, issue: 'FILE_NOT_FOUND' });
      continue;
    }
  }

  // Run in child process with timeout
  const script = `
    // silence most output
    const origWarn = console.warn;
    const origLog = console.log;
    const origError = console.error;
    // Allow critical output through
    console.warn = () => {};
    console.error = () => {};
    console.log = () => {};

    // Load env
    const path = require('path');
    const fs = require('fs');
    const rootEnv = path.join('${__dirname.replace(/\\/g, '/')}', '.env.nosync');
    if (fs.existsSync(rootEnv)) {
      require('dotenv').config({ path: rootEnv });
    } else {
      require('dotenv').config({ path: path.join('${__dirname.replace(/\\/g, '/')}', '.env') });
    }

    try {
      const mod = require('${absPath.replace(/\\/g, '/')}');
      const t = typeof mod;
      if (t === 'function') {
        process.stdout.write('OK:function');
      } else if (t === 'object' && mod && typeof mod.use === 'function') {
        process.stdout.write('OK:router');
      } else {
        process.stdout.write('BAD:' + t + ':' + JSON.stringify(Object.keys(mod || {})).substring(0, 100));
      }
    } catch(e) {
      process.stdout.write('ERR:' + e.message.substring(0, 200));
    }
    process.exit(0);
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    env: process.env,
    cwd: __dirname,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (result.status === null || result.killed) {
    console.log(`⏰ TIMEOUT (${TIMEOUT_MS}ms): ${routePath}`);
    problems.push({ path: routePath, issue: 'TIMEOUT' });
  } else if (stdout.startsWith('BAD:')) {
    console.log(`❌ BAD EXPORT (${stdout}): ${routePath}`);
    problems.push({ path: routePath, issue: stdout });
  } else if (stdout.startsWith('ERR:')) {
    console.log(`💥 ERROR (${stdout}): ${routePath}`);
    problems.push({ path: routePath, issue: stdout });
  } else if (stdout.startsWith('OK:')) {
    // OK - show brief tick
    process.stdout.write('.');
  } else {
    console.log(`❓ UNKNOWN (stdout="${stdout.substring(0,100)}", stderr="${stderr.substring(0,100)}"): ${routePath}`);
  }
}

console.log('\n\n=== SUMMARY ===');
if (problems.length === 0) {
  console.log('✅ All routes loaded successfully!');
} else {
  console.log(`Found ${problems.length} problem(s):\n`);
  problems.forEach(p => {
    console.log(`  ❌ ${p.path}`);
    console.log(`     Issue: ${p.issue}\n`);
  });
}
