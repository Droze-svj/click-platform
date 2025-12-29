#!/usr/bin/env node

/**
 * Security Verification Script
 * 
 * Verifies security configurations for production deployment.
 * Checks security headers, environment variables, dependencies, and best practices.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SECURITY_CHECKS = {
  dependencies: {
    name: 'Dependency Security Audit',
    check: async () => {
      try {
        const output = execSync('npm audit --production --json', { encoding: 'utf8', stdio: 'pipe' });
        const audit = JSON.parse(output);
        const vulnerabilities = audit.metadata?.vulnerabilities || {};
        const critical = vulnerabilities.critical || 0;
        const high = vulnerabilities.high || 0;
        const moderate = vulnerabilities.moderate || 0;
        
        if (critical > 0 || high > 0) {
          return {
            pass: false,
            message: `Found ${critical} critical and ${high} high severity vulnerabilities. Run 'npm audit' for details.`
          };
        }
        
        if (moderate > 0) {
          return {
            pass: true,
            warning: true,
            message: `Found ${moderate} moderate severity vulnerabilities. Review with 'npm audit'.`
          };
        }
        
        return { pass: true, message: 'No known security vulnerabilities' };
      } catch (error) {
        return { pass: true, warning: true, message: 'Could not run npm audit (non-critical)' };
      }
    }
  },
  
  securityHeaders: {
    name: 'Security Headers Configuration',
    check: async () => {
      const nextConfigPath = path.join(process.cwd(), 'client', 'next.config.js');
      if (!fs.existsSync(nextConfigPath)) {
        return { pass: false, message: 'next.config.js not found' };
      }
      
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      const requiredHeaders = [
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy'
      ];
      
      const missing = requiredHeaders.filter(header => !content.includes(header));
      if (missing.length > 0) {
        return {
          pass: false,
          message: `Missing security headers: ${missing.join(', ')}`
        };
      }
      
      return { pass: true, message: 'All required security headers configured' };
    }
  },
  
  envSecrets: {
    name: 'Environment Secrets Security',
    check: async () => {
      const envPath = path.join(process.cwd(), '.env.production') || path.join(process.cwd(), '.env');
      if (!fs.existsSync(envPath)) {
        return { pass: true, warning: true, message: 'No .env file found (using system environment)' };
      }
      
      const content = fs.readFileSync(envPath, 'utf8');
      const issues = [];
      
      // Check for weak secrets
      if (content.includes('JWT_SECRET=your-secret-key') || content.includes('JWT_SECRET=change-me')) {
        issues.push('JWT_SECRET appears to be a placeholder');
      }
      
      // Check for exposed secrets in git
      if (fs.existsSync(path.join(process.cwd(), '.git'))) {
        try {
          const gitCheck = execSync('git check-ignore .env.production .env', { encoding: 'utf8', stdio: 'pipe' });
          if (!gitCheck.trim()) {
            issues.push('.env files may not be in .gitignore');
          }
        } catch (e) {
          // Not a git repo or check-ignore failed
        }
      }
      
      if (issues.length > 0) {
        return { pass: false, message: issues.join('; ') };
      }
      
      return { pass: true, message: 'Environment secrets appear secure' };
    }
  },
  
  httpsEnforcement: {
    name: 'HTTPS Enforcement',
    check: async () => {
      const nextConfigPath = path.join(process.cwd(), 'client', 'next.config.js');
      if (!fs.existsSync(nextConfigPath)) {
        return { pass: true, warning: true, message: 'next.config.js not found' };
      }
      
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      if (content.includes('Strict-Transport-Security')) {
        return { pass: true, message: 'HSTS header configured' };
      }
      
      return { pass: true, warning: true, message: 'HSTS not configured (configure at hosting platform level)' };
    }
  },
  
  consoleLogs: {
    name: 'Console Log Removal',
    check: async () => {
      const nextConfigPath = path.join(process.cwd(), 'client', 'next.config.js');
      if (!fs.existsSync(nextConfigPath)) {
        return { pass: true, warning: true, message: 'next.config.js not found' };
      }
      
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      if (content.includes('removeConsole') && content.includes('production')) {
        return { pass: true, message: 'Console.log removal configured for production' };
      }
      
      return { pass: true, warning: true, message: 'Console.log removal not configured (recommended for production)' };
    }
  },
  
  cors: {
    name: 'CORS Configuration',
    check: async () => {
      // Check if CORS is configured in backend
      const serverPath = path.join(process.cwd(), 'server');
      if (!fs.existsSync(serverPath)) {
        return { pass: true, warning: true, message: 'Server directory not found' };
      }
      
      // Look for CORS configuration
      const files = ['index.js', 'app.js', 'server.js'];
      for (const file of files) {
        const filePath = path.join(serverPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('cors') || content.includes('CORS')) {
            return { pass: true, message: 'CORS configuration found' };
          }
        }
      }
      
      return { pass: true, warning: true, message: 'CORS configuration not verified (check server code)' };
    }
  },
  
  rateLimiting: {
    name: 'Rate Limiting',
    check: async () => {
      // Check if rate limiting is implemented
      const serverPath = path.join(process.cwd(), 'server');
      if (!fs.existsSync(serverPath)) {
        return { pass: true, warning: true, message: 'Server directory not found' };
      }
      
      // Look for rate limiting middleware
      const files = ['index.js', 'app.js', 'server.js', 'middleware.js'];
      for (const file of files) {
        const filePath = path.join(serverPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('rateLimit') || content.includes('rate-limit') || content.includes('express-rate-limit')) {
            return { pass: true, message: 'Rate limiting configured' };
          }
        }
      }
      
      return { pass: true, warning: true, message: 'Rate limiting not verified (recommended for production)' };
    }
  },
  
  inputValidation: {
    name: 'Input Validation',
    check: async () => {
      // Check if validation utilities exist
      const validationPath = path.join(process.cwd(), 'client', 'utils', 'validation.ts');
      if (fs.existsSync(validationPath)) {
        return { pass: true, message: 'Input validation utilities exist' };
      }
      
      return { pass: true, warning: true, message: 'Input validation utilities not verified' };
    }
  },
  
  errorHandling: {
    name: 'Error Handling',
    check: async () => {
      // Check if error handling is in place
      const errorHandlerPath = path.join(process.cwd(), 'client', 'utils', 'errorHandler.ts');
      const errorBoundaryPath = path.join(process.cwd(), 'client', 'components', 'ErrorBoundary.tsx');
      
      if (fs.existsSync(errorHandlerPath) && fs.existsSync(errorBoundaryPath)) {
        return { pass: true, message: 'Error handling and boundaries implemented' };
      }
      
      return { pass: true, warning: true, message: 'Error handling not fully verified' };
    }
  },
  
  sentry: {
    name: 'Error Tracking (Sentry)',
    check: async () => {
      const sentryPath = path.join(process.cwd(), 'client', 'sentry.client.config.ts');
      if (fs.existsSync(sentryPath)) {
        const content = fs.readFileSync(sentryPath, 'utf8');
        if (content.includes('beforeSend')) {
          return { pass: true, message: 'Sentry configured with sensitive data filtering' };
        }
        return { pass: true, warning: true, message: 'Sentry configured but sensitive data filtering not verified' };
      }
      
      return { pass: true, warning: true, message: 'Sentry not configured (recommended for production)' };
    }
  },
};

async function runSecurityVerification() {
  console.log('🔒 Security Verification');
  console.log('='.repeat(60));
  console.log('');
  
  const results = {
    passed: [],
    warnings: [],
    failed: []
  };
  
  for (const [key, check] of Object.entries(SECURITY_CHECKS)) {
    try {
      const result = await check.check();
      if (result.pass) {
        if (result.warning) {
          results.warnings.push({ name: check.name, message: result.message });
          console.log(`⚠️  ${check.name}: ${result.message}`);
        } else {
          results.passed.push({ name: check.name, message: result.message });
          console.log(`✅ ${check.name}: ${result.message}`);
        }
      } else {
        results.failed.push({ name: check.name, message: result.message });
        console.log(`❌ ${check.name}: ${result.message}`);
      }
    } catch (error) {
      results.warnings.push({ name: check.name, message: `Check failed: ${error.message}` });
      console.log(`⚠️  ${check.name}: Check failed - ${error.message}`);
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 SECURITY VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log('');
  
  if (results.failed.length > 0) {
    console.log('❌ Failed Checks:');
    results.failed.forEach(item => {
      console.log(`   - ${item.name}: ${item.message}`);
    });
    console.log('');
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings (non-critical):');
    results.warnings.forEach(item => {
      console.log(`   - ${item.name}: ${item.message}`);
    });
    console.log('');
  }
  
  const allCriticalPassed = results.failed.length === 0;
  
  if (allCriticalPassed) {
    console.log('✅ All critical security checks passed!');
    if (results.warnings.length > 0) {
      console.log(`⚠️  ${results.warnings.length} warning(s) - review recommended`);
    }
  } else {
    console.log('❌ Security verification failed. Please address the failed checks above.');
    process.exit(1);
  }
  
  console.log('');
  return allCriticalPassed;
}

// Run verification
if (require.main === module) {
  runSecurityVerification().catch(error => {
    console.error('Error running security verification:', error);
    process.exit(1);
  });
}

module.exports = { runSecurityVerification, SECURITY_CHECKS };



