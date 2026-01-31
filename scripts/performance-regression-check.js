#!/usr/bin/env node

/**
 * Performance Regression Detection Script
 * Compares current performance against established baselines
 */

const fs = require('fs')
const path = require('path')

class PerformanceRegressionChecker {
  constructor() {
    this.baselineFile = path.join(__dirname, '..', 'baseline-report.json')
    this.currentReportFile = path.join(__dirname, '..', 'performance-report.json')
    this.regressionThresholds = {
      fcp: 0.1,    // 10% increase allowed
      lcp: 0.1,    // 10% increase allowed
      fid: 0.15,   // 15% increase allowed
      cls: 0.2,    // 20% increase allowed (CLS is more variable)
      responseTime: 0.2, // 20% increase allowed
      bundleSize: 0.05   // 5% increase allowed
    }
  }

  async runRegressionCheck() {
    console.log('🔍 Running Performance Regression Check...')
    console.log('==========================================')

    try {
      // Load baseline and current reports
      const baseline = this.loadBaseline()
      const current = this.loadCurrentReport()

      console.log(`📊 Baseline: ${baseline.timestamp}`)
      console.log(`📊 Current:  ${current.timestamp}`)
      console.log('')

      // Check for regressions
      const regressions = this.checkRegressions(baseline, current)

      // Display results
      this.displayResults(regressions)

      // Exit with appropriate code
      if (regressions.critical.length > 0) {
        console.log('❌ CRITICAL REGRESSIONS DETECTED - BUILD FAILED')
        process.exit(1)
      } else if (regressions.warnings.length > 0) {
        console.log('⚠️  PERFORMANCE WARNINGS DETECTED')
        process.exit(0) // Don't fail build for warnings
      } else {
        console.log('✅ NO PERFORMANCE REGRESSIONS DETECTED')
        process.exit(0)
      }

    } catch (error) {
      console.error('❌ Error running regression check:', error.message)
      process.exit(1)
    }
  }

  loadBaseline() {
    if (!fs.existsSync(this.baselineFile)) {
      throw new Error(`Baseline file not found: ${this.baselineFile}. Run 'node scripts/establish-baselines.js' first.`)
    }

    const data = JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'))

    // Convert baseline format to match performance report format
    return {
      timestamp: data.timestamp,
      tests: [
        {
          name: 'First Contentful Paint',
          value: data.baselines?.fcp || 1800,
          status: 'baseline'
        },
        {
          name: 'Largest Contentful Paint',
          value: data.baselines?.lcp || 2500,
          status: 'baseline'
        },
        {
          name: 'First Input Delay',
          value: data.baselines?.fid || 100,
          status: 'baseline'
        },
        {
          name: 'Cumulative Layout Shift',
          value: data.baselines?.cls || 0.1,
          status: 'baseline'
        }
      ]
    }
  }

  loadCurrentReport() {
    if (!fs.existsSync(this.currentReportFile)) {
      throw new Error(`Performance report not found: ${this.currentReportFile}. Run performance tests first.`)
    }

    return JSON.parse(fs.readFileSync(this.currentReportFile, 'utf8'))
  }

  checkRegressions(baseline, current) {
    const regressions = {
      critical: [],
      warnings: [],
      improvements: []
    }

    // Map current test results
    const currentResults = {}
    current.tests.forEach(test => {
      if (test.status === 'passed') {
        currentResults[test.name] = test.value
      }
    })

    // Compare against baseline
    baseline.tests.forEach(baselineTest => {
      const currentValue = currentResults[baselineTest.name]
      if (currentValue === undefined) return

      const baselineValue = baselineTest.value
      const regression = this.calculateRegression(baselineTest.name, baselineValue, currentValue)

      if (regression.isRegression) {
        if (regression.isCritical) {
          regressions.critical.push(regression)
        } else {
          regressions.warnings.push(regression)
        }
      } else if (regression.improvement > 0.05) { // 5% improvement
        regressions.improvements.push(regression)
      }
    })

    return regressions
  }

  calculateRegression(metricName, baselineValue, currentValue) {
    const threshold = this.regressionThresholds[this.getMetricKey(metricName)]
    const change = (currentValue - baselineValue) / baselineValue

    return {
      metric: metricName,
      baseline: baselineValue,
      current: currentValue,
      change: change,
      changePercent: (change * 100).toFixed(1) + '%',
      isRegression: change > threshold,
      isCritical: change > (threshold * 2), // 2x threshold = critical
      improvement: change < 0 ? Math.abs(change) : 0
    }
  }

  getMetricKey(metricName) {
    const mapping = {
      'First Contentful Paint': 'fcp',
      'Largest Contentful Paint': 'lcp',
      'First Input Delay': 'fid',
      'Cumulative Layout Shift': 'cls',
      'Time to Interactive': 'tti',
      'Average Response Time': 'responseTime',
      'Bundle Size': 'bundleSize'
    }
    return mapping[metricName] || 'responseTime'
  }

  displayResults(regressions) {
    if (regressions.critical.length > 0) {
      console.log('🚨 CRITICAL REGRESSIONS:')
      regressions.critical.forEach(r => {
        console.log(`  ❌ ${r.metric}: ${r.changePercent} increase (${r.baseline} → ${r.current})`)
      })
      console.log('')
    }

    if (regressions.warnings.length > 0) {
      console.log('⚠️  PERFORMANCE WARNINGS:')
      regressions.warnings.forEach(r => {
        console.log(`  ⚠️  ${r.metric}: ${r.changePercent} increase (${r.baseline} → ${r.current})`)
      })
      console.log('')
    }

    if (regressions.improvements.length > 0) {
      console.log('🎉 PERFORMANCE IMPROVEMENTS:')
      regressions.improvements.forEach(r => {
        console.log(`  ✅ ${r.metric}: ${Math.abs(r.change * 100).toFixed(1)}% improvement (${r.baseline} → ${r.current})`)
      })
      console.log('')
    }

    if (regressions.critical.length === 0 && regressions.warnings.length === 0 && regressions.improvements.length === 0) {
      console.log('✅ No significant performance changes detected')
      console.log('')
    }
  }
}

// Run the regression check
const checker = new PerformanceRegressionChecker()
checker.runRegressionCheck().catch(console.error)










