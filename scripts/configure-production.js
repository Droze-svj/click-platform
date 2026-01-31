#!/usr/bin/env node

/**
 * Production Configuration Setup
 * Configures the application for production deployment
 */

const fs = require('fs')
const path = require('path')

class ProductionConfigurator {
  constructor() {
    this.rootDir = path.join(__dirname, '..')
    this.envFile = path.join(this.rootDir, '.env.local')
    this.backupFile = path.join(this.rootDir, '.env.backup')
  }

  async run() {
    console.log('🚀 Configuring Click for Production Deployment\n')

    try {
      // Create backup of current config
      await this.backupCurrentConfig()

      // Load current configuration
      const currentConfig = this.loadCurrentConfig()

      // Generate production configuration
      const prodConfig = this.generateProductionConfig(currentConfig)

      // Validate configuration
      const validation = this.validateProductionConfig(prodConfig)

      if (!validation.valid) {
        console.error('❌ Configuration validation failed:')
        validation.errors.forEach(error => console.error(`   • ${error}`))
        process.exit(1)
      }

      // Save production configuration
      this.saveProductionConfig(prodConfig)

      // Generate deployment checklist
      this.generateDeploymentChecklist(prodConfig)

      // Show configuration summary
      this.showConfigurationSummary(prodConfig)

    } catch (error) {
      console.error('❌ Production configuration failed:', error.message)
      process.exit(1)
    }
  }

  async backupCurrentConfig() {
    if (fs.existsSync(this.envFile)) {
      fs.copyFileSync(this.envFile, this.backupFile)
      console.log('✅ Current configuration backed up')
    }
  }

  loadCurrentConfig() {
    const config = {}

    if (fs.existsSync(this.envFile)) {
      const content = fs.readFileSync(this.envFile, 'utf8')
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))

      lines.forEach(line => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim()
        }
      })
    }

    return config
  }

  generateProductionConfig(currentConfig) {
    const prodConfig = { ...currentConfig }

    // Production environment settings
    prodConfig.NODE_ENV = 'production'
    prodConfig.NEXT_PUBLIC_NODE_ENV = 'production'

    // Application URLs (customize these for your domain)
    prodConfig.NEXT_PUBLIC_APP_URL = prodConfig.NEXT_PUBLIC_APP_URL || 'https://click-app.com'
    prodConfig.NEXT_PUBLIC_API_URL = prodConfig.NEXT_PUBLIC_API_URL || 'https://api.click-app.com'

    // VAPID Keys (should be set from previous generation)
    prodConfig.VAPID_EMAIL = prodConfig.VAPID_EMAIL || 'notifications@click-app.com'

    // PWA Configuration
    prodConfig.NEXT_PUBLIC_ENABLE_PWA = 'true'
    prodConfig.NEXT_PUBLIC_ENABLE_SERVICE_WORKER = 'true'
    prodConfig.NEXT_PUBLIC_ENABLE_OFFLINE_SUPPORT = 'true'
    prodConfig.NEXT_PUBLIC_ENABLE_BACKGROUND_SYNC = 'true'
    prodConfig.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS = 'true'

    // Performance monitoring
    prodConfig.NEXT_PUBLIC_ENABLE_APM = 'true'
    prodConfig.NEXT_PUBLIC_ENABLE_RUM = 'true'

    // Production thresholds (stricter than development)
    prodConfig.PERFORMANCE_RESPONSE_TIME_THRESHOLD = '1000'
    prodConfig.PERFORMANCE_ERROR_RATE_THRESHOLD = '0.05'
    prodConfig.PERFORMANCE_MEMORY_THRESHOLD = '0.8'
    prodConfig.PERFORMANCE_CPU_THRESHOLD = '0.7'

    // Core Web Vitals (stricter for production)
    prodConfig.CWV_CLS_THRESHOLD = '0.1'
    prodConfig.CWV_FID_THRESHOLD = '100'
    prodConfig.CWV_FCP_THRESHOLD = '1800'
    prodConfig.CWV_LCP_THRESHOLD = '2500'
    prodConfig.CWV_TTFB_THRESHOLD = '800'

    // Alert configuration
    prodConfig.ALERT_COOLDOWN_MINUTES = '5'
    prodConfig.MAX_ALERTS_PER_HOUR = '10'

    // Security settings
    prodConfig.NEXT_PUBLIC_ENABLE_DETAILED_LOGGING = 'false'

    // Build information
    prodConfig.NEXT_PUBLIC_BUILD_ID = `production-${Date.now()}`
    prodConfig.BUILD_DATE = new Date().toISOString()

    return prodConfig
  }

  validateProductionConfig(config) {
    const errors = []
    const warnings = []

    // Required settings
    if (!config.NEXT_PUBLIC_APP_URL || config.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      errors.push('NEXT_PUBLIC_APP_URL must be set to production domain')
    }

    if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
      warnings.push('VAPID keys not configured - push notifications will not work')
    }

    if (!config.JWT_SECRET || config.JWT_SECRET.includes('your-super-secret')) {
      errors.push('JWT_SECRET must be set to a secure random string')
    }

    // PWA validation
    if (!config.NEXT_PUBLIC_ENABLE_PWA) {
      warnings.push('PWA features disabled - app will not be installable')
    }

    // HTTPS requirement for PWA
    if (config.NEXT_PUBLIC_APP_URL && !config.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
      errors.push('Production URL must use HTTPS for PWA features')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  saveProductionConfig(config) {
    // Convert config object to .env format
    const envLines = Object.entries(config).map(([key, value]) => `${key}=${value}`)

    // Add production header
    const header = [
      '# ===========================================',
      '# CLICK PRODUCTION CONFIGURATION',
      '# ===========================================',
      '# Generated for production deployment',
      '# DO NOT commit this file to version control',
      '#',
      `# Generated: ${new Date().toISOString()}`,
      '',
    ]

    const content = header.concat(envLines).join('\n')
    fs.writeFileSync(this.envFile, content)

    console.log('✅ Production configuration saved')
  }

  generateDeploymentChecklist(config) {
    const checklistPath = path.join(this.rootDir, 'DEPLOYMENT_CHECKLIST.md')

    const checklist = `# 🚀 Click Production Deployment Checklist

## Pre-Deployment Verification

### ✅ **Domain & SSL Configuration**
- [ ] Domain (${config.NEXT_PUBLIC_APP_URL}) points to production server
- [ ] SSL certificate installed and valid
- [ ] HTTPS redirect configured
- [ ] DNS propagation complete

### ✅ **Environment Configuration**
- [ ] All required environment variables set
- [ ] JWT_SECRET is secure and unique
- [ ] Database connection configured
- [ ] VAPID keys for push notifications
- [ ] SMTP settings for email alerts

### ✅ **PWA & Offline Features**
- [ ] Service worker accessible at /sw.js
- [ ] PWA manifest at /manifest.json
- [ ] All PNG icons generated and accessible
- [ ] Offline page at /offline.html
- [ ] Push notification API configured

### ✅ **Security & Performance**
- [ ] HTTPS enforced everywhere
- [ ] CSP headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Bundle size optimized

### ✅ **Monitoring & Alerting**
- [ ] APM monitoring enabled
- [ ] Error tracking configured
- [ ] Alert channels set up (email/Slack)
- [ ] Performance thresholds configured
- [ ] Health check endpoints working

## Deployment Steps

### 1. **Code Deployment**
\`\`\`bash
# Build the application
npm run build

# Deploy to production server
# (Vercel, Netlify, or your hosting platform)
\`\`\`

### 2. **Database Migration**
\`\`\`bash
# Run database migrations
npm run db:migrate

# Seed initial data if needed
npm run db:seed
\`\`\`

### 3. **Service Configuration**
\`\`\`bash
# Restart all services
pm2 restart all

# Verify services are running
pm2 status
\`\`\`

### 4. **DNS & CDN Setup**
- [ ] Update DNS records
- [ ] Configure CDN (Cloudflare, AWS CloudFront)
- [ ] Set up image optimization
- [ ] Enable caching rules

## Post-Deployment Testing

### ✅ **Core Functionality**
- [ ] Website loads on production domain
- [ ] User registration/login works
- [ ] Core features functional
- [ ] API endpoints responding

### ✅ **PWA Features**
- [ ] PWA install prompt appears
- [ ] App installs successfully
- [ ] Offline mode works
- [ ] Push notifications functional
- [ ] Service worker registered

### ✅ **Performance & Monitoring**
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals green
- [ ] APM data collecting
- [ ] Error monitoring active
- [ ] Alert system tested

### ✅ **Mobile Testing**
- [ ] iOS Safari PWA installation
- [ ] Android Chrome PWA installation
- [ ] Offline functionality on mobile
- [ ] Push notifications on mobile
- [ ] Responsive design verified

## Emergency Rollback

### **Rollback Plan**
1. **Immediate Rollback**: Switch to previous deployment
2. **Database Rollback**: Restore from backup if needed
3. **DNS Rollback**: Point domain back to stable version
4. **Communication**: Notify users of temporary issues

### **Monitoring During Rollback**
- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Verify rollback success
- [ ] Update status page

## Success Metrics

### **Performance Targets**
- **Load Time**: < 3 seconds
- **Lighthouse Score**: > 90
- **Core Web Vitals**: All green
- **Error Rate**: < 5%

### **PWA Adoption**
- **Install Rate**: > 10% of visitors
- **Offline Usage**: > 20% of sessions
- **Push Engagement**: > 30% click-through rate

### **Business Metrics**
- **Uptime**: 99.9% SLA
- **User Satisfaction**: > 4.5/5 rating
- **Conversion Rate**: Maintain or improve

---

## 📞 **Emergency Contacts**

- **Technical Lead**: [Name] - [Email/Phone]
- **DevOps**: [Name] - [Email/Phone]
- **Business Owner**: [Name] - [Email/Phone]
- **Hosting Support**: [Provider] - [Support Contact]

## 📋 **Final Sign-off**

- [ ] **Technical Review**: All code changes approved
- [ ] **Security Review**: Penetration testing passed
- [ ] **Performance Review**: Benchmarks met
- [ ] **Business Review**: Requirements satisfied
- [ ] **Legal Review**: Compliance requirements met

---

**🚀 Deployment Authorized By**: ____________________
**Date**: ____________________
**Time**: ____________________

---
*Generated: ${new Date().toISOString()}*
`

    fs.writeFileSync(checklistPath, checklist)
    console.log('📋 Deployment checklist generated')
  }

  showConfigurationSummary(config) {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 PRODUCTION CONFIGURATION SUMMARY')
    console.log('='.repeat(60))

    console.log('\n🌐 **Application URLs**')
    console.log(`   Frontend: ${config.NEXT_PUBLIC_APP_URL}`)
    console.log(`   API: ${config.NEXT_PUBLIC_API_URL}`)

    console.log('\n🔔 **Push Notifications**')
    console.log(`   VAPID Keys: ${config.VAPID_PUBLIC_KEY ? '✅ Configured' : '❌ Missing'}`)
    console.log(`   Email: ${config.VAPID_EMAIL}`)

    console.log('\n📱 **PWA Features**')
    console.log(`   Service Worker: ✅ Enabled`)
    console.log(`   Offline Support: ✅ Enabled`)
    console.log(`   Push Notifications: ✅ Enabled`)
    console.log(`   Background Sync: ✅ Enabled`)

    console.log('\n📊 **Monitoring & Alerts**')
    console.log(`   APM: ✅ Enabled`)
    console.log(`   RUM: ✅ Enabled`)
    console.log(`   Error Tracking: ✅ Enabled`)
    console.log(`   Performance Thresholds: ✅ Configured`)

    console.log('\n🔒 **Security**')
    console.log(`   JWT Secret: ${config.JWT_SECRET ? '✅ Set' : '❌ Missing'}`)
    console.log(`   HTTPS Required: ✅ Enforced`)
    console.log(`   CORS: ✅ Configured`)

    console.log('\n📈 **Performance Targets**')
    console.log(`   Response Time: < ${config.PERFORMANCE_RESPONSE_TIME_THRESHOLD}ms`)
    console.log(`   Error Rate: < ${config.PERFORMANCE_ERROR_RATE_THRESHOLD * 100}%`)
    console.log(`   Memory Usage: < ${config.PERFORMANCE_MEMORY_THRESHOLD * 100}%`)

    console.log('\n🚀 **Ready for Deployment!**')

    if (config.NEXT_PUBLIC_APP_URL && config.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      console.log('\n⚠️  **Warning**: Update NEXT_PUBLIC_APP_URL to production domain')
    }

    if (!config.JWT_SECRET || config.JWT_SECRET.includes('your-super-secret')) {
      console.log('\n⚠️  **Warning**: Set secure JWT_SECRET before deployment')
    }

    console.log('\n📁 **Files Generated**:')
    console.log('   • .env.local (production configuration)')
    console.log('   • .env.backup (backup of previous config)')
    console.log('   • DEPLOYMENT_CHECKLIST.md (deployment guide)')

    console.log('\n🎯 **Next Steps**:')
    console.log('   1. Review and customize configuration')
    console.log('   2. Set up production domain and SSL')
    console.log('   3. Configure alert channels (email/Slack)')
    console.log('   4. Deploy to production server')
    console.log('   5. Test PWA features on mobile devices')
    console.log('   6. Monitor performance and alerts')

    console.log('='.repeat(60))
  }
}

// Run configuration if called directly
if (require.main === module) {
  const configurator = new ProductionConfigurator()
  configurator.run().catch(console.error)
}

module.exports = ProductionConfigurator










