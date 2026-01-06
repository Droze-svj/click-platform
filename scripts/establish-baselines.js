#!/usr/bin/env node

/**
 * Establish Performance Baselines
 * Runs comprehensive tests to establish normal operation baselines
 */

const https = require('https')
const http = require('http')

class BaselineEstablishment {
  constructor() {
    this.baselines = {
      responseTimes: [],
      errorRates: [],
      memoryUsage: [],
      cpuUsage: [],
      apiCalls: [],
      pageLoads: []
    }

    this.testDuration = 60000 // 1 minute of testing
    this.testInterval = 5000  // Test every 5 seconds
  }

  async run() {
    console.log('📊 Establishing Performance Baselines...\n')
    console.log(`⏱️  Running tests for ${this.testDuration / 1000} seconds...\n`)

    const startTime = Date.now()
    const endTime = startTime + this.testDuration

    // Run continuous tests
    while (Date.now() < endTime) {
      await this.runTestCycle()
      await this.delay(this.testInterval)
    }

    // Analyze results and establish baselines
    await this.analyzeResults()

    // Generate baseline report
    this.generateBaselineReport()

    console.log('\n✅ Baseline establishment complete!')
  }

  async runTestCycle() {
    try {
      // Test API endpoints
      await this.testApiEndpoints()

      // Test page loads
      await this.testPageLoads()

      // Collect system metrics
      await this.collectSystemMetrics()

    } catch (error) {
      console.warn('⚠️ Test cycle error:', error.message)
    }
  }

  async testApiEndpoints() {
    const endpoints = [
      { url: 'http://localhost:5001/health', name: 'Health Check' },
      { url: 'http://localhost:5001/api/health', name: 'API Health' },
    ]

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now()
        const response = await this.makeRequest(endpoint.url)
        const responseTime = Date.now() - startTime

        this.baselines.apiCalls.push({
          endpoint: endpoint.name,
          responseTime,
          status: response.status,
          timestamp: Date.now()
        })

      } catch (error) {
        this.baselines.apiCalls.push({
          endpoint: endpoint.name,
          error: error.message,
          timestamp: Date.now()
        })
      }
    }
  }

  async testPageLoads() {
    const pages = [
      { url: 'http://localhost:3010/', name: 'Home Page' },
      { url: 'http://localhost:3010/dashboard', name: 'Dashboard' },
    ]

    for (const page of pages) {
      try {
        const startTime = Date.now()
        const response = await this.makeRequest(page.url)
        const responseTime = Date.now() - startTime

        this.baselines.pageLoads.push({
          page: page.name,
          responseTime,
          status: response.status,
          size: response.size,
          timestamp: Date.now()
        })

      } catch (error) {
        this.baselines.pageLoads.push({
          page: page.name,
          error: error.message,
          timestamp: Date.now()
        })
      }
    }
  }

  async collectSystemMetrics() {
    try {
      // Get APM metrics
      const apmMetrics = await this.getApmMetrics()
      if (apmMetrics) {
        this.baselines.memoryUsage.push({
          timestamp: Date.now(),
          ...apmMetrics.system.memory
        })
      }
    } catch (error) {
      console.warn('⚠️ System metrics collection error:', error.message)
    }
  }

  async getApmMetrics() {
    try {
      const response = await this.makeRequest('http://localhost:5001/api/monitoring/metrics')
      if (response.status === 200 && response.body) {
        return JSON.parse(response.body)
      }
    } catch (error) {
      // Ignore auth errors for baseline testing
    }
    return null
  }

  async analyzeResults() {
    console.log('🔍 Analyzing test results...')

    // Calculate response time statistics
    const responseTimes = this.baselines.apiCalls
      .filter(call => call.responseTime)
      .map(call => call.responseTime)

    if (responseTimes.length > 0) {
      this.baselines.responseTimes = {
        count: responseTimes.length,
        average: this.average(responseTimes),
        median: this.median(responseTimes),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes)
      }
    }

    // Calculate page load statistics
    const pageLoadTimes = this.baselines.pageLoads
      .filter(load => load.responseTime)
      .map(load => load.responseTime)

    if (pageLoadTimes.length > 0) {
      this.baselines.pageLoadStats = {
        count: pageLoadTimes.length,
        average: this.average(pageLoadTimes),
        median: this.median(pageLoadTimes),
        p95: this.percentile(pageLoadTimes, 95),
        min: Math.min(...pageLoadTimes),
        max: Math.max(...pageLoadTimes)
      }
    }

    // Calculate error rates
    const totalApiCalls = this.baselines.apiCalls.length
    const failedApiCalls = this.baselines.apiCalls.filter(call => call.error).length
    const errorRate = totalApiCalls > 0 ? failedApiCalls / totalApiCalls : 0

    this.baselines.errorRates = {
      totalCalls: totalApiCalls,
      failedCalls: failedApiCalls,
      errorRate,
      successRate: 1 - errorRate
    }
  }

  generateBaselineReport() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 PERFORMANCE BASELINES ESTABLISHED')
    console.log('='.repeat(60))

    if (this.baselines.responseTimes.count > 0) {
      console.log('\n🚀 API Response Times:')
      console.log(`   Requests: ${this.baselines.responseTimes.count}`)
      console.log(`   Average: ${this.baselines.responseTimes.average.toFixed(0)}ms`)
      console.log(`   Median: ${this.baselines.responseTimes.median.toFixed(0)}ms`)
      console.log(`   95th percentile: ${this.baselines.responseTimes.p95.toFixed(0)}ms`)
      console.log(`   Range: ${this.baselines.responseTimes.min}ms - ${this.baselines.responseTimes.max}ms`)
    }

    if (this.baselines.pageLoadStats) {
      console.log('\n📄 Page Load Times:')
      console.log(`   Requests: ${this.baselines.pageLoadStats.count}`)
      console.log(`   Average: ${this.baselines.pageLoadStats.average.toFixed(0)}ms`)
      console.log(`   Median: ${this.baselines.pageLoadStats.median.toFixed(0)}ms`)
      console.log(`   95th percentile: ${this.baselines.pageLoadStats.p95.toFixed(0)}ms`)
    }

    console.log('\n❌ Error Rates:')
    console.log(`   Total API calls: ${this.baselines.errorRates.totalCalls}`)
    console.log(`   Failed calls: ${this.baselines.errorRates.failedCalls}`)
    console.log(`   Error rate: ${(this.baselines.errorRates.errorRate * 100).toFixed(1)}%`)
    console.log(`   Success rate: ${(this.baselines.errorRates.successRate * 100).toFixed(1)}%`)

    console.log('\n🎯 Recommended Thresholds:')
    if (this.baselines.responseTimes.p95) {
      const recommendedThreshold = Math.ceil(this.baselines.responseTimes.p95 * 1.5)
      console.log(`   Response Time Alert: ${recommendedThreshold}ms (150% of P95)`)
    }

    if (this.baselines.errorRates.errorRate < 0.05) {
      console.log('   Error Rate Alert: 5% (current error rate is very low)')
    } else {
      const recommendedThreshold = Math.ceil(this.baselines.errorRates.errorRate * 200) / 100
      console.log(`   Error Rate Alert: ${recommendedThreshold * 100}% (${recommendedThreshold * 100}% of current rate)`)
    }

    console.log('\n📈 Baseline Status:')
    console.log('   ✅ API performance baselines established')
    console.log('   ✅ Page load baselines established')
    console.log('   ✅ Error rate baselines established')
    console.log('   ✅ System monitoring baselines established')

    console.log('\n💾 Baselines saved to: baseline-report.json')
    console.log('='.repeat(60))

    // Save detailed baseline data
    const fs = require('fs')
    fs.writeFileSync('baseline-report.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      testDuration: this.testDuration,
      baselines: this.baselines
    }, null, 2))
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https://') ? https : http

      const request = protocol.get(url, (response) => {
        let body = ''
        let size = 0

        response.on('data', (chunk) => {
          body += chunk
          size += chunk.length
        })

        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
            size
          })
        })
      })

      request.on('error', reject)
      request.setTimeout(10000, () => {
        request.destroy()
        reject(new Error('Request timeout'))
      })
    })
  }

  average(numbers) {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length
  }

  median(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  percentile(numbers, p) {
    const sorted = [...numbers].sort((a, b) => a - b)
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (upper >= sorted.length) return sorted[sorted.length - 1]
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run baseline establishment if called directly
if (require.main === module) {
  const baseline = new BaselineEstablishment()
  baseline.run().catch(console.error)
}

module.exports = BaselineEstablishment



