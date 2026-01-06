#!/usr/bin/env node

/**
 * Click Production Testing Suite
 * Comprehensive testing for enterprise production deployment
 */

const axios = require('axios')
const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

class ClickProductionTester {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    this.apiUrl = process.env.API_URL || 'http://localhost:5001'
    this.testResults = {
      health: {},
      performance: {},
      security: {},
      integration: {},
      load: {},
      monitoring: {}
    }
    this.startTime = Date.now()
    this.logFile = path.join(__dirname, '..', 'logs', `test-results-${Date.now()}.json`)
  }

  async runAllTests() {
    console.log('🚀 Starting Click Production Testing Suite')
    console.log('==========================================\n')

    try {
      await this.runHealthTests()
      await this.runSecurityTests()
      await this.runPerformanceTests()
      await this.runIntegrationTests()
      await this.runLoadTests()
      await this.runMonitoringTests()

      this.generateReport()
      this.printSummary()

    } catch (error) {
      console.error('❌ Testing failed:', error.message)
      process.exit(1)
    }
  }

  async runHealthTests() {
    console.log('🔍 Running Health Checks...')
    console.log('==========================\n')

    const healthChecks = [
      { name: 'Frontend Health', url: `${this.baseUrl}/api/monitoring/health`, critical: true },
      { name: 'Backend API Health', url: `${this.apiUrl}/api/health`, critical: true },
      { name: 'Backend Probe', url: `${this.apiUrl}/api/probe`, critical: false },
      { name: 'Monitoring System', url: 'http://localhost:9090/health', critical: false },
      { name: 'Operations Dashboard', url: 'http://localhost:9091/health', critical: false }
    ]

    for (const check of healthChecks) {
      try {
        console.log(`Testing ${check.name}...`)
        const response = await axios.get(check.url, {
          timeout: 10000,
          validateStatus: () => true
        })

        const isHealthy = response.status >= 200 && response.status < 300
        this.testResults.health[check.name] = {
          status: isHealthy ? 'PASS' : 'FAIL',
          responseTime: response.headers['x-response-time'] || 'N/A',
          statusCode: response.status,
          critical: check.critical
        }

        console.log(`  ${isHealthy ? '✅' : '❌'} ${check.name}: ${response.status} (${response.headers['x-response-time'] || 'N/A'})`)

      } catch (error) {
        this.testResults.health[check.name] = {
          status: 'ERROR',
          error: error.message,
          critical: check.critical
        }
        console.log(`  ❌ ${check.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Health checks completed\n')
  }

  async runSecurityTests() {
    console.log('🛡️  Running Security Tests...')
    console.log('============================\n')

    const securityTests = [
      { name: 'SSL/TLS Certificate', url: this.baseUrl.replace('http://', 'https://'), checkSSL: true },
      { name: 'Security Headers', url: this.baseUrl, checkHeaders: true },
      { name: 'Rate Limiting', url: `${this.apiUrl}/api/health`, checkRateLimit: true },
      { name: 'CORS Policy', url: this.baseUrl, checkCORS: true },
      { name: 'XSS Protection', url: this.baseUrl, checkXSS: true }
    ]

    for (const test of securityTests) {
      try {
        console.log(`Testing ${test.name}...`)

        if (test.checkSSL) {
          // Check SSL certificate
          const isValidSSL = await this.checkSSL(test.url)
          this.testResults.security[test.name] = {
            status: isValidSSL ? 'PASS' : 'FAIL',
            details: isValidSSL ? 'Valid SSL certificate' : 'SSL certificate issues'
          }
          console.log(`  ${isValidSSL ? '✅' : '❌'} ${test.name}`)

        } else if (test.checkHeaders) {
          // Check security headers
          const response = await axios.get(test.url, { timeout: 5000 })
          const headers = response.headers

          const requiredHeaders = [
            'x-frame-options',
            'x-content-type-options',
            'x-xss-protection',
            'content-security-policy',
            'strict-transport-security'
          ]

          const presentHeaders = requiredHeaders.filter(h => headers[h])
          const score = (presentHeaders.length / requiredHeaders.length) * 100

          this.testResults.security[test.name] = {
            status: score >= 80 ? 'PASS' : 'WARN',
            score: `${score.toFixed(1)}%`,
            presentHeaders,
            missingHeaders: requiredHeaders.filter(h => !headers[h])
          }
          console.log(`  ${score >= 80 ? '✅' : '⚠️'} ${test.name}: ${score.toFixed(1)}% security headers present`)

        } else if (test.checkRateLimit) {
          // Test rate limiting
          const requests = Array(15).fill().map(() => axios.get(test.url, { timeout: 1000 }))
          const results = await Promise.allSettled(requests)
          const successCount = results.filter(r => r.status === 'fulfilled').length
          const rateLimited = successCount < 15

          this.testResults.security[test.name] = {
            status: rateLimited ? 'PASS' : 'WARN',
            successfulRequests: successCount,
            rateLimited
          }
          console.log(`  ${rateLimited ? '✅' : '⚠️'} ${test.name}: ${successCount}/15 requests successful`)

        } else if (test.checkCORS) {
          // Check CORS headers
          const response = await axios.get(test.url, { timeout: 5000 })
          const corsHeaders = Object.keys(response.headers).filter(h =>
            h.toLowerCase().includes('access-control')
          )

          this.testResults.security[test.name] = {
            status: corsHeaders.length > 0 ? 'PASS' : 'FAIL',
            corsHeaders
          }
          console.log(`  ${corsHeaders.length > 0 ? '✅' : '❌'} ${test.name}: ${corsHeaders.length} CORS headers found`)

        } else if (test.checkXSS) {
          // Basic XSS protection check
          const response = await axios.get(test.url, { timeout: 5000 })
          const hasXSSProtection = response.headers['x-xss-protection']

          this.testResults.security[test.name] = {
            status: hasXSSProtection ? 'PASS' : 'FAIL',
            xssProtection: hasXSSProtection
          }
          console.log(`  ${hasXSSProtection ? '✅' : '❌'} ${test.name}`)
        }

      } catch (error) {
        this.testResults.security[test.name] = {
          status: 'ERROR',
          error: error.message
        }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Security tests completed\n')
  }

  async checkSSL(url) {
    return new Promise(resolve => {
      const { spawn } = require('child_process')
      const openssl = spawn('openssl', ['s_client', '-connect', url.replace('https://', '').split('/')[0] + ':443', '-servername', url.replace('https://', '').split('/')[0]])

      let output = ''
      openssl.stdout.on('data', data => output += data)
      openssl.stderr.on('data', data => output += data)

      openssl.on('close', code => {
        const isValid = output.includes('Verify return code: 0') || output.includes('OK')
        resolve(isValid)
      })

      openssl.on('error', () => resolve(false))

      setTimeout(() => {
        openssl.kill()
        resolve(false)
      }, 5000)
    })
  }

  async runPerformanceTests() {
    console.log('⚡ Running Performance Tests...')
    console.log('==============================\n')

    const performanceTests = [
      { name: 'Frontend Response Time', url: this.baseUrl, target: 1000 },
      { name: 'API Response Time', url: `${this.apiUrl}/api/health`, target: 500 },
      { name: 'Static Asset Loading', url: `${this.baseUrl}/_next/static/css/app.css`, target: 300 }
    ]

    for (const test of performanceTests) {
      try {
        console.log(`Testing ${test.name}...`)

        const startTime = Date.now()
        const response = await axios.get(test.url, { timeout: 10000 })
        const responseTime = Date.now() - startTime

        const isWithinTarget = responseTime <= test.target
        this.testResults.performance[test.name] = {
          status: isWithinTarget ? 'PASS' : 'SLOW',
          responseTime: `${responseTime}ms`,
          target: `${test.target}ms`,
          withinTarget: isWithinTarget
        }

        console.log(`  ${isWithinTarget ? '✅' : '🐌'} ${test.name}: ${responseTime}ms (target: ${test.target}ms)`)

      } catch (error) {
        this.testResults.performance[test.name] = {
          status: 'ERROR',
          error: error.message
        }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Performance tests completed\n')
  }

  async runIntegrationTests() {
    console.log('🔗 Running Integration Tests...')
    console.log('==============================\n')

    const integrationTests = [
      { name: 'Database Connectivity', checkDB: true },
      { name: 'Redis Connectivity', checkRedis: true },
      { name: 'File Upload System', checkUpload: true },
      { name: 'Email System', checkEmail: true },
      { name: 'External API Integration', checkExternal: true }
    ]

    for (const test of integrationTests) {
      try {
        console.log(`Testing ${test.name}...`)

        if (test.checkDB) {
          // Check database connectivity via API
          const response = await axios.get(`${this.apiUrl}/api/health`, { timeout: 5000 })
          const dbHealthy = response.data?.database === 'connected'

          this.testResults.integration[test.name] = {
            status: dbHealthy ? 'PASS' : 'FAIL',
            details: dbHealthy ? 'Database connected' : 'Database connection issue'
          }
          console.log(`  ${dbHealthy ? '✅' : '❌'} ${test.name}`)

        } else if (test.checkRedis) {
          // Check Redis connectivity
          const response = await axios.get(`${this.apiUrl}/api/cache/health`, { timeout: 5000, validateStatus: () => true })
          const redisHealthy = response.status === 200

          this.testResults.integration[test.name] = {
            status: redisHealthy ? 'PASS' : 'FAIL',
            details: redisHealthy ? 'Redis connected' : 'Redis connection issue'
          }
          console.log(`  ${redisHealthy ? '✅' : '❌'} ${test.name}`)

        } else if (test.checkUpload) {
          // Test file upload capability
          const testFile = Buffer.from('test file content')
          const response = await axios.post(`${this.apiUrl}/api/upload/test`, testFile, {
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 10000,
            validateStatus: () => true
          })
          const uploadWorks = response.status === 200 || response.status === 201

          this.testResults.integration[test.name] = {
            status: uploadWorks ? 'PASS' : 'WARN',
            details: uploadWorks ? 'Upload system functional' : 'Upload may have issues'
          }
          console.log(`  ${uploadWorks ? '✅' : '⚠️'} ${test.name}`)

        } else if (test.checkEmail) {
          // Check email system (mock test)
          this.testResults.integration[test.name] = {
            status: 'SKIP',
            details: 'Email system requires manual testing'
          }
          console.log(`  ⏭️  ${test.name}: Skipped (requires manual testing)`)

        } else if (test.checkExternal) {
          // Test external API integrations
          const externalAPIs = ['https://api.github.com', 'https://httpbin.org']
          let workingAPIs = 0

          for (const api of externalAPIs) {
            try {
              await axios.get(api, { timeout: 5000 })
              workingAPIs++
            } catch (error) {
              // Continue testing other APIs
            }
          }

          const externalWorking = workingAPIs > 0
          this.testResults.integration[test.name] = {
            status: externalWorking ? 'PASS' : 'WARN',
            details: `${workingAPIs}/${externalAPIs.length} external APIs accessible`
          }
          console.log(`  ${externalWorking ? '✅' : '⚠️'} ${test.name}: ${workingAPIs}/${externalAPIs.length} APIs accessible`)
        }

      } catch (error) {
        this.testResults.integration[test.name] = {
          status: 'ERROR',
          error: error.message
        }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Integration tests completed\n')
  }

  async runLoadTests() {
    console.log('🔥 Running Load Tests...')
    console.log('=======================\n')

    const loadTests = [
      { name: 'Concurrent Users (10)', users: 10, duration: 10 },
      { name: 'Concurrent Users (50)', users: 50, duration: 15 },
      { name: 'API Stress Test', endpoint: '/api/health', requests: 100 }
    ]

    for (const test of loadTests) {
      try {
        console.log(`Testing ${test.name}...`)

        if (test.users) {
          // Simulate concurrent users
          const results = await this.simulateConcurrentUsers(test.users, test.duration)

          this.testResults.load[test.name] = {
            status: results.avgResponseTime < 2000 ? 'PASS' : 'SLOW',
            avgResponseTime: `${results.avgResponseTime.toFixed(0)}ms`,
            totalRequests: results.totalRequests,
            successRate: `${results.successRate.toFixed(1)}%`,
            users: test.users,
            duration: test.duration
          }

          console.log(`  ${results.avgResponseTime < 2000 ? '✅' : '🐌'} ${test.name}: ${results.avgResponseTime.toFixed(0)}ms avg, ${results.successRate.toFixed(1)}% success`)

        } else if (test.requests) {
          // API stress test
          const results = await this.stressTestAPI(test.endpoint, test.requests)

          this.testResults.load[test.name] = {
            status: results.successRate >= 95 ? 'PASS' : 'FAIL',
            successRate: `${results.successRate.toFixed(1)}%`,
            avgResponseTime: `${results.avgResponseTime.toFixed(0)}ms`,
            totalRequests: test.requests
          }

          console.log(`  ${results.successRate >= 95 ? '✅' : '❌'} ${test.name}: ${results.successRate.toFixed(1)}% success, ${results.avgResponseTime.toFixed(0)}ms avg`)
        }

      } catch (error) {
        this.testResults.load[test.name] = {
          status: 'ERROR',
          error: error.message
        }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Load tests completed\n')
  }

  async simulateConcurrentUsers(userCount, durationSeconds) {
    const requests = []
    const startTime = Date.now()

    // Generate concurrent requests
    for (let i = 0; i < userCount; i++) {
      requests.push(this.simulateUserSession(durationSeconds * 1000))
    }

    const results = await Promise.all(requests)
    const totalTime = Date.now() - startTime

    const totalRequests = results.reduce((sum, user) => sum + user.requests, 0)
    const totalResponseTime = results.reduce((sum, user) => sum + user.totalResponseTime, 0)
    const successfulRequests = results.reduce((sum, user) => sum + user.successfulRequests, 0)

    return {
      avgResponseTime: totalResponseTime / totalRequests,
      totalRequests,
      successRate: (successfulRequests / totalRequests) * 100
    }
  }

  async simulateUserSession(duration) {
    let requests = 0
    let successfulRequests = 0
    let totalResponseTime = 0
    const endTime = Date.now() + duration

    while (Date.now() < endTime) {
      try {
        const start = Date.now()
        await axios.get(this.baseUrl, { timeout: 5000 })
        totalResponseTime += Date.now() - start
        successfulRequests++
      } catch (error) {
        // Request failed, continue
      }
      requests++

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
    }

    return { requests, successfulRequests, totalResponseTime }
  }

  async stressTestAPI(endpoint, requestCount) {
    const requests = []
    const startTime = Date.now()

    for (let i = 0; i < requestCount; i++) {
      requests.push(axios.get(`${this.apiUrl}${endpoint}`, { timeout: 10000 }).catch(() => null))
    }

    const results = await Promise.all(requests)
    const successfulRequests = results.filter(r => r !== null).length
    const totalResponseTime = results
      .filter(r => r !== null)
      .reduce((sum, response) => {
        return sum + (response.headers['x-response-time'] ?
          parseFloat(response.headers['x-response-time']) : 0)
      }, 0)

    const avgResponseTime = successfulRequests > 0 ? totalResponseTime / successfulRequests : 0

    return {
      successRate: (successfulRequests / requestCount) * 100,
      avgResponseTime,
      successfulRequests,
      totalRequests: requestCount
    }
  }

  async runMonitoringTests() {
    console.log('📊 Running Monitoring Tests...')
    console.log('=============================\n')

    const monitoringTests = [
      { name: 'Prometheus Metrics', url: 'http://localhost:9090/api/v1/query?query=up', checkPrometheus: true },
      { name: 'Grafana Dashboard', url: 'http://localhost:3001/api/health', checkGrafana: true },
      { name: 'AlertManager Status', url: 'http://localhost:9093/api/v2/status', checkAlertManager: true },
      { name: 'Application Metrics', checkAppMetrics: true },
      { name: 'Log Aggregation', checkLogs: true }
    ]

    for (const test of monitoringTests) {
      try {
        console.log(`Testing ${test.name}...`)

        if (test.checkPrometheus) {
          const response = await axios.get(test.url, { timeout: 5000, validateStatus: () => true })
          const prometheusWorking = response.status === 200

          this.testResults.monitoring[test.name] = {
            status: prometheusWorking ? 'PASS' : 'FAIL',
            details: prometheusWorking ? 'Prometheus responding' : 'Prometheus not accessible'
          }
          console.log(`  ${prometheusWorking ? '✅' : '❌'} ${test.name}`)

        } else if (test.checkGrafana) {
          const response = await axios.get(test.url, { timeout: 5000, validateStatus: () => true })
          const grafanaWorking = response.status === 200

          this.testResults.monitoring[test.name] = {
            status: grafanaWorking ? 'PASS' : 'FAIL',
            details: grafanaWorking ? 'Grafana responding' : 'Grafana not accessible'
          }
          console.log(`  ${grafanaWorking ? '✅' : '❌'} ${test.name}`)

        } else if (test.checkAlertManager) {
          const response = await axios.get(test.url, { timeout: 5000, validateStatus: () => true })
          const alertManagerWorking = response.status === 200

          this.testResults.monitoring[test.name] = {
            status: alertManagerWorking ? 'PASS' : 'WARN',
            details: alertManagerWorking ? 'AlertManager responding' : 'AlertManager not accessible (may not be deployed)'
          }
          console.log(`  ${alertManagerWorking ? '✅' : '⚠️'} ${test.name}`)

        } else if (test.checkAppMetrics) {
          // Check if application exposes metrics
          const response = await axios.get(`${this.apiUrl}/metrics`, { timeout: 5000, validateStatus: () => true })
          const metricsAvailable = response.status === 200

          this.testResults.monitoring[test.name] = {
            status: metricsAvailable ? 'PASS' : 'WARN',
            details: metricsAvailable ? 'Application metrics available' : 'Application metrics not exposed'
          }
          console.log(`  ${metricsAvailable ? '✅' : '⚠️'} ${test.name}`)

        } else if (test.checkLogs) {
          // Check if logs are being written
          const logDir = path.join(__dirname, '..', 'logs')
          const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'))
          const logsExist = logFiles.length > 0

          this.testResults.monitoring[test.name] = {
            status: logsExist ? 'PASS' : 'WARN',
            details: logsExist ? `${logFiles.length} log files found` : 'No log files found'
          }
          console.log(`  ${logsExist ? '✅' : '⚠️'} ${test.name}: ${logFiles.length} log files`)
        }

      } catch (error) {
        this.testResults.monitoring[test.name] = {
          status: 'ERROR',
          error: error.message
        }
        console.log(`  ❌ ${test.name}: ${error.message}`)
      }
    }

    console.log('\n✅ Monitoring tests completed\n')
  }

  generateReport() {
    console.log('📋 Generating Test Report...')
    console.log('===========================\n')

    const report = {
      timestamp: new Date().toISOString(),
      duration: `${((Date.now() - this.startTime) / 1000).toFixed(1)}s`,
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`
      },
      results: this.testResults,
      summary: this.calculateSummary()
    }

    // Save report
    fs.writeFileSync(this.logFile, JSON.stringify(report, null, 2))
    console.log(`📄 Test report saved: ${this.logFile}\n`)
  }

  calculateSummary() {
    const summary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0,
      criticalFailures: 0,
      overallStatus: 'PASS'
    }

    const allResults = [
      ...Object.values(this.testResults.health),
      ...Object.values(this.testResults.security),
      ...Object.values(this.testResults.performance),
      ...Object.values(this.testResults.integration),
      ...Object.values(this.testResults.load),
      ...Object.values(this.testResults.monitoring)
    ]

    summary.totalTests = allResults.length

    for (const result of allResults) {
      switch (result.status) {
        case 'PASS':
          summary.passed++
          break
        case 'FAIL':
          summary.failed++
          if (result.critical) summary.criticalFailures++
          break
        case 'WARN':
        case 'SLOW':
          summary.warnings++
          break
        case 'ERROR':
          summary.errors++
          break
      }
    }

    // Determine overall status
    if (summary.criticalFailures > 0) {
      summary.overallStatus = 'CRITICAL'
    } else if (summary.failed > 0) {
      summary.overallStatus = 'FAIL'
    } else if (summary.errors > 0 || summary.warnings > 2) {
      summary.overallStatus = 'WARN'
    }

    return summary
  }

  printSummary() {
    console.log('🎯 TEST SUMMARY')
    console.log('==============\n')

    const summary = this.calculateSummary()

    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`✅ Passed: ${summary.passed}`)
    console.log(`❌ Failed: ${summary.failed}`)
    console.log(`⚠️  Warnings: ${summary.warnings}`)
    console.log(`🔥 Errors: ${summary.errors}`)
    console.log(`🚨 Critical Failures: ${summary.criticalFailures}\n`)

    const statusEmoji = {
      'PASS': '✅',
      'WARN': '⚠️',
      'FAIL': '❌',
      'CRITICAL': '🚨'
    }

    console.log(`${statusEmoji[summary.overallStatus]} Overall Status: ${summary.overallStatus}\n`)

    // Print critical issues
    if (summary.criticalFailures > 0) {
      console.log('🚨 CRITICAL ISSUES:')
      this.printCriticalIssues()
      console.log('')
    }

    // Print recommendations
    this.printRecommendations(summary)

    console.log(`\n📄 Detailed report: ${this.logFile}`)
    console.log('🏁 Click Production Testing Complete!\n')
  }

  printCriticalIssues() {
    const criticalChecks = Object.entries(this.testResults.health)
      .filter(([, result]) => result.status !== 'PASS' && result.critical)

    for (const [name, result] of criticalChecks) {
      console.log(`  • ${name}: ${result.error || 'Failed'}`)
    }
  }

  printRecommendations(summary) {
    console.log('💡 RECOMMENDATIONS:')

    if (summary.criticalFailures > 0) {
      console.log('  🚨 Address critical failures before production deployment')
    }

    if (summary.failed > 0) {
      console.log('  ❌ Fix failed tests to ensure system stability')
    }

    if (summary.warnings > 2) {
      console.log('  ⚠️  Review warnings to optimize performance and security')
    }

    if (summary.overallStatus === 'PASS') {
      console.log('  ✅ System is ready for production deployment!')
    }

    console.log('  📊 Run regular testing to maintain system health')
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ClickProductionTester()
  tester.runAllTests().catch(console.error)
}

module.exports = ClickProductionTester




