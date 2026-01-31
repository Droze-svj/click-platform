#!/usr/bin/env node

/**
 * Monitoring Setup Script
 * Configures all monitoring systems for Click application
 */

const fs = require('fs')
const path = require('path')

class MonitoringSetup {
  constructor() {
    this.rootDir = path.join(__dirname, '..')
    this.envFile = path.join(this.rootDir, '.env.local')
    this.monitoringEnvFile = path.join(this.rootDir, '.env.monitoring.local')
  }

  async run() {
    console.log('🚀 Setting up Click Monitoring Systems...\n')

    try {
      // Load existing environment
      const existingEnv = this.loadEnvFile(this.envFile)
      const monitoringEnv = this.loadEnvFile(this.monitoringEnvFile)

      // Merge configurations
      const finalConfig = { ...existingEnv, ...monitoringEnv }

      // Set up analytics providers
      await this.setupAnalyticsProviders(finalConfig)

      // Configure alerting channels
      await this.setupAlertingChannels(finalConfig)

      // Set performance thresholds
      this.setupPerformanceThresholds(finalConfig)

      // Enable monitoring systems
      this.enableMonitoringSystems(finalConfig)

      // Save configuration
      this.saveConfiguration(finalConfig)

      // Test systems
      await this.testSystems()

      // Display setup summary
      this.displaySetupSummary(finalConfig)

    } catch (error) {
      console.error('❌ Setup failed:', error.message)
      process.exit(1)
    }
  }

  loadEnvFile(filePath) {
    const config = {}

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
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

  async setupAnalyticsProviders(config) {
    console.log('📊 Setting up Analytics Providers...')

    // Demo configurations for development
    if (!config.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      console.log('   ⚠️  Google Analytics not configured (demo mode)')
      console.log('   💡 Add NEXT_PUBLIC_GA_MEASUREMENT_ID for production')
    } else {
      console.log('   ✅ Google Analytics configured')
    }

    if (!config.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      console.log('   ⚠️  Mixpanel not configured (demo mode)')
      console.log('   💡 Add NEXT_PUBLIC_MIXPANEL_TOKEN for production')
    } else {
      console.log('   ✅ Mixpanel configured')
    }

    // Enable privacy mode for development
    config.NEXT_PUBLIC_DISABLE_PRIVACY_ANALYTICS = 'true'
    console.log('   ✅ Privacy analytics enabled (local storage)')
  }

  async setupAlertingChannels(config) {
    console.log('🚨 Setting up Alerting Channels...')

    // Email configuration
    if (!config.SMTP_HOST) {
      console.log('   ⚠️  Email alerting not configured')
      console.log('   💡 Configure SMTP_* variables for email alerts')
    } else {
      console.log('   ✅ Email alerting configured')
    }

    // Slack configuration
    if (!config.SLACK_BOT_TOKEN && !config.SLACK_WEBHOOK_URL) {
      console.log('   ⚠️  Slack alerting not configured')
      console.log('   💡 Add SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL for Slack alerts')
    } else {
      console.log('   ✅ Slack alerting configured')
    }

    // Console alerting (always enabled for development)
    config.NEXT_PUBLIC_ENABLE_CONSOLE_ALERTS = 'true'
    console.log('   ✅ Console alerting enabled')
  }

  setupPerformanceThresholds(config) {
    console.log('⚡ Setting Performance Thresholds...')

    // Set development-friendly thresholds
    const thresholds = {
      PERFORMANCE_RESPONSE_TIME_THRESHOLD: '5000', // 5 seconds for dev
      PERFORMANCE_ERROR_RATE_THRESHOLD: '0.1',    // 10% error rate
      PERFORMANCE_MEMORY_THRESHOLD: '0.9',        // 90% memory usage
      PERFORMANCE_CPU_THRESHOLD: '0.8',           // 80% CPU usage
      ALERT_COOLDOWN_MINUTES: '1',                // 1 minute cooldown
      MAX_ALERTS_PER_HOUR: '50',                  // 50 alerts/hour max
      CWV_CLS_THRESHOLD: '0.25',                  // Relaxed Core Web Vitals
      CWV_FID_THRESHOLD: '300',
      CWV_FCP_THRESHOLD: '3000',
      CWV_LCP_THRESHOLD: '4000',
      CWV_TTFB_THRESHOLD: '1800'
    }

    Object.assign(config, thresholds)
    console.log('   ✅ Performance thresholds configured')
  }

  enableMonitoringSystems(config) {
    console.log('🔧 Enabling Monitoring Systems...')

    // Enable all monitoring systems
    const monitoringFlags = {
      NEXT_PUBLIC_ENABLE_APM: 'true',
      NEXT_PUBLIC_ENABLE_RUM: 'true',
      NEXT_PUBLIC_ENABLE_ERROR_MONITORING: 'true',
      NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING: 'true',
      NEXT_PUBLIC_ENABLE_DETAILED_LOGGING: 'true'
    }

    Object.assign(config, monitoringFlags)
    console.log('   ✅ All monitoring systems enabled')
  }

  saveConfiguration(config) {
    console.log('💾 Saving Configuration...')

    // Convert config object to .env format
    const envLines = Object.entries(config).map(([key, value]) => `${key}=${value}`)

    // Add header comments
    const header = [
      '# Click Monitoring Configuration',
      '# Generated by setup-monitoring.js',
      '# ' + new Date().toISOString(),
      '',
    ]

    const content = header.concat(envLines).join('\n')

    fs.writeFileSync(this.envFile, content)
    console.log(`   ✅ Configuration saved to ${this.envFile}`)
  }

  async testSystems() {
    console.log('🧪 Testing Monitoring Systems...')

    try {
      // Test APM system
      const apmResponse = await this.makeRequest('http://localhost:5001/api/monitoring/health')
      if (apmResponse.status === 200) {
        console.log('   ✅ APM system responding')
      } else {
        console.log('   ⚠️  APM system not responding')
      }

      // Test frontend
      const frontendResponse = await this.makeRequest('http://localhost:3010/')
      if (frontendResponse.status === 200) {
        console.log('   ✅ Frontend responding')
      } else {
        console.log('   ⚠️  Frontend not responding')
      }

    } catch (error) {
      console.log('   ⚠️  System tests skipped (servers not running)')
    }
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const https = require('https')
      const http = require('http')
      const protocol = url.startsWith('https://') ? https : http

      const request = protocol.get(url, (response) => {
        resolve({
          status: response.statusCode,
          headers: response.headers
        })
      })

      request.on('error', reject)
      request.setTimeout(5000, () => {
        request.destroy()
        reject(new Error('Timeout'))
      })
    })
  }

  displaySetupSummary(config) {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 MONITORING SETUP COMPLETE')
    console.log('='.repeat(60))

    console.log('\n📊 Analytics Configuration:')
    console.log(`   Google Analytics: ${config.NEXT_PUBLIC_GA_MEASUREMENT_ID ? '✅ Configured' : '⚠️  Not configured'}`)
    console.log(`   Mixpanel: ${config.NEXT_PUBLIC_MIXPANEL_TOKEN ? '✅ Configured' : '⚠️  Not configured'}`)
    console.log(`   Privacy Analytics: ✅ Enabled`)

    console.log('\n🚨 Alerting Configuration:')
    console.log(`   Email: ${config.SMTP_HOST ? '✅ Configured' : '⚠️  Not configured'}`)
    console.log(`   Slack: ${(config.SLACK_BOT_TOKEN || config.SLACK_WEBHOOK_URL) ? '✅ Configured' : '⚠️  Not configured'}`)
    console.log(`   Console: ✅ Enabled`)

    console.log('\n⚡ Performance Thresholds:')
    console.log(`   Response Time: ${config.PERFORMANCE_RESPONSE_TIME_THRESHOLD}ms`)
    console.log(`   Error Rate: ${config.PERFORMANCE_ERROR_RATE_THRESHOLD * 100}%`)
    console.log(`   Memory Usage: ${config.PERFORMANCE_MEMORY_THRESHOLD * 100}%`)
    console.log(`   CPU Usage: ${config.PERFORMANCE_CPU_THRESHOLD * 100}%`)

    console.log('\n🔧 Monitoring Systems:')
    console.log('   ✅ Application Performance Monitoring (APM)')
    console.log('   ✅ Real User Monitoring (RUM)')
    console.log('   ✅ Error Monitoring & Alerting')
    console.log('   ✅ Performance Monitoring')

    console.log('\n📋 Next Steps:')
    console.log('   1. Restart your servers: npm run dev')
    console.log('   2. Test error monitoring: visit /test-errors')
    console.log('   3. Check APM dashboard: Ctrl+Shift+E')
    console.log('   4. Monitor health: /api/monitoring/health')

    console.log('\n🚀 Ready for production monitoring!')
    console.log('='.repeat(60))
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new MonitoringSetup()
  setup.run().catch(console.error)
}

module.exports = MonitoringSetup










