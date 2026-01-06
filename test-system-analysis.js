/**
 * Comprehensive Click System Analysis Tool
 * Tests performance, functionality, and error handling
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

class ClickSystemAnalyzer {
  constructor() {
    this.baseUrl = 'http://localhost:3010';
    this.apiUrl = 'http://localhost:5001';
    this.results = {
      serverStatus: {},
      performance: {},
      functionality: {},
      errors: [],
      recommendations: []
    };
  }

  async runFullAnalysis() {
    console.log('🚀 Starting Click System Analysis...\n');

    try {
      await this.checkServerStatus();
      await this.analyzePerformance();
      await this.testFunctionality();
      await this.testErrorHandling();
      await this.analyzeLogs();

      this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      this.results.errors.push({
        phase: 'analysis',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkServerStatus() {
    console.log('📊 Checking Server Status...');

    const tests = [
      { name: 'Frontend Home', url: `${this.baseUrl}/`, expectedStatus: 200 },
      { name: 'Frontend Dashboard', url: `${this.baseUrl}/dashboard`, expectedStatus: 200 },
      { name: 'Backend API Auth', url: `${this.apiUrl}/api/auth/me`, expectedStatus: 401 }, // Expected unauthorized
      { name: 'Backend API Analytics', url: `${this.apiUrl}/api/analytics/content/insights`, expectedStatus: 401 },
    ];

    for (const test of tests) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(test.url);
        const responseTime = Date.now() - startTime;

        const status = {
          name: test.name,
          url: test.url,
          status: response.statusCode,
          responseTime,
          success: response.statusCode === test.expectedStatus,
          size: response.size || 0
        };

        this.results.serverStatus[test.name] = status;

        console.log(`  ✅ ${test.name}: ${response.statusCode} (${responseTime}ms)`);

        if (!status.success) {
          this.results.recommendations.push({
            type: 'server',
            severity: 'medium',
            message: `${test.name} returned unexpected status ${response.statusCode} (expected ${test.expectedStatus})`,
            action: 'Check server configuration and logs'
          });
        }

      } catch (error) {
        this.results.serverStatus[test.name] = {
          name: test.name,
          url: test.url,
          status: 'ERROR',
          error: error.message,
          success: false
        };

        this.results.errors.push({
          phase: 'server_status',
          test: test.name,
          error: error.message
        });

        console.log(`  ❌ ${test.name}: ERROR - ${error.message}`);
      }
    }
  }

  async analyzePerformance() {
    console.log('\n⚡ Analyzing Performance...');

    const performanceTests = [
      { name: 'Home Page Load', url: `${this.baseUrl}/`, runs: 5 },
      { name: 'Dashboard Load', url: `${this.baseUrl}/dashboard`, runs: 5 },
      { name: 'Video Page Load', url: `${this.baseUrl}/dashboard/video`, runs: 3 },
      { name: 'API Health Check', url: `${this.apiUrl}/api/auth/me`, runs: 3 },
    ];

    for (const test of performanceTests) {
      console.log(`  📈 Testing ${test.name} (${test.runs} runs)...`);

      const times = [];
      let failures = 0;

      for (let i = 0; i < test.runs; i++) {
        try {
          const startTime = Date.now();
          await this.makeRequest(test.url);
          const responseTime = Date.now() - startTime;
          times.push(responseTime);

          // Small delay between requests
          await this.delay(100);
        } catch (error) {
          failures++;
          console.log(`    ⚠️  Run ${i + 1} failed: ${error.message}`);
        }
      }

      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const p95Time = this.calculatePercentile(times, 95);

        const performance = {
          name: test.name,
          runs: test.runs,
          successfulRuns: times.length,
          failedRuns: failures,
          averageTime: Math.round(avgTime),
          minTime,
          maxTime,
          p95Time: Math.round(p95Time),
          stability: failures === 0 ? 'excellent' :
                   failures < test.runs * 0.2 ? 'good' : 'poor'
        };

        this.results.performance[test.name] = performance;

        console.log(`    📊 Avg: ${performance.averageTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms, P95: ${performance.p95Time}ms`);

        // Performance recommendations
        if (avgTime > 1000) {
          this.results.recommendations.push({
            type: 'performance',
            severity: 'high',
            message: `${test.name} is slow (${performance.averageTime}ms average)`,
            action: 'Optimize server response times, check database queries, implement caching'
          });
        } else if (avgTime > 500) {
          this.results.recommendations.push({
            type: 'performance',
            severity: 'medium',
            message: `${test.name} response time could be improved (${performance.averageTime}ms)`,
            action: 'Consider implementing caching, optimizing queries, or CDN usage'
          });
        }

        if (performance.stability === 'poor') {
          this.results.recommendations.push({
            type: 'reliability',
            severity: 'high',
            message: `${test.name} has poor stability (${failures}/${test.runs} failures)`,
            action: 'Investigate server stability, check error logs, review infrastructure'
          });
        }
      }
    }
  }

  async testFunctionality() {
    console.log('\n🔧 Testing Core Functionality...');

    const functionalityTests = [
      { name: 'Error Test Page', url: `${this.baseUrl}/test-errors`, shouldContain: 'Error Handling Test' },
      { name: 'Login Page', url: `${this.baseUrl}/login`, shouldContain: 'login' },
      { name: 'Register Page', url: `${this.baseUrl}/register`, shouldContain: 'register' },
    ];

    for (const test of functionalityTests) {
      try {
        const response = await this.makeRequest(test.url, true);
        const containsExpected = response.body && response.body.toLowerCase().includes(test.shouldContain.toLowerCase());

        const result = {
          name: test.name,
          url: test.url,
          status: response.statusCode,
          containsExpected,
          size: response.size,
          success: response.statusCode === 200 && containsExpected
        };

        this.results.functionality[test.name] = result;

        if (result.success) {
          console.log(`  ✅ ${test.name}: Functional`);
        } else {
          console.log(`  ❌ ${test.name}: Issues detected`);
          this.results.recommendations.push({
            type: 'functionality',
            severity: containsExpected ? 'low' : 'medium',
            message: `${test.name} has functionality issues`,
            action: 'Check page content and ensure all features work correctly'
          });
        }

      } catch (error) {
        this.results.functionality[test.name] = {
          name: test.name,
          status: 'ERROR',
          error: error.message,
          success: false
        };

        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  async testErrorHandling() {
    console.log('\n🛡️ Testing Error Handling...');

    // Test some error scenarios
    const errorTests = [
      { name: 'Invalid API Endpoint', url: `${this.apiUrl}/api/nonexistent`, expectedStatus: 404 },
      { name: 'Invalid Frontend Route', url: `${this.baseUrl}/nonexistent-page`, expectedStatus: 404 },
    ];

    for (const test of errorTests) {
      try {
        const response = await this.makeRequest(test.url);
        const correctError = response.statusCode === test.expectedStatus;

        this.results.functionality[`${test.name} Error`] = {
          name: test.name,
          status: response.statusCode,
          correctError,
          success: correctError
        };

        if (correctError) {
          console.log(`  ✅ ${test.name}: Proper error handling`);
        } else {
          console.log(`  ❌ ${test.name}: Incorrect error response (${response.statusCode})`);
        }

      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  async analyzeLogs() {
    console.log('\n📋 Analyzing System Logs...');

    try {
      const logPath = '/Users/orlandhino/WHOP AI V3/.cursor/debug.log';
      const logContent = fs.readFileSync(logPath, 'utf8');
      const logLines = logContent.trim().split('\n');

      const logStats = {
        totalEntries: logLines.length,
        byMessageType: {},
        byLocation: {},
        recentEntries: [],
        timeRange: null
      };

      let firstTimestamp = null;
      let lastTimestamp = null;

      logLines.forEach((line, index) => {
        try {
          const entry = JSON.parse(line);

          // Track message types
          const messageType = entry.message || 'unknown';
          logStats.byMessageType[messageType] = (logStats.byMessageType[messageType] || 0) + 1;

          // Track locations
          const location = entry.location || 'unknown';
          logStats.byLocation[location] = (logStats.byLocation[location] || 0) + 1;

          // Track timestamps
          if (entry.timestamp) {
            if (!firstTimestamp || entry.timestamp < firstTimestamp) firstTimestamp = entry.timestamp;
            if (!lastTimestamp || entry.timestamp > lastTimestamp) lastTimestamp = entry.timestamp;
          }

          // Keep recent entries
          if (index >= logLines.length - 10) {
            logStats.recentEntries.push(entry);
          }

        } catch (parseError) {
          console.log(`    ⚠️  Could not parse log line ${index + 1}`);
        }
      });

      if (firstTimestamp && lastTimestamp) {
        logStats.timeRange = {
          start: new Date(firstTimestamp).toISOString(),
          end: new Date(lastTimestamp).toISOString(),
          duration: lastTimestamp - firstTimestamp
        };
      }

      this.results.logAnalysis = logStats;

      console.log(`  📊 Analyzed ${logStats.totalEntries} log entries`);
      console.log(`  ⏰ Log time range: ${logStats.timeRange ? `${logStats.timeRange.start} to ${logStats.timeRange.end}` : 'Unknown'}`);
      console.log(`  📈 Top message types:`, Object.entries(logStats.byMessageType).slice(0, 5));

    } catch (error) {
      console.log(`  ❌ Could not analyze logs: ${error.message}`);
      this.results.errors.push({
        phase: 'log_analysis',
        error: error.message
      });
    }
  }

  generateReport() {
    console.log('\n📋 Generating System Analysis Report...\n');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        serverHealth: this.calculateServerHealth(),
        performanceScore: this.calculatePerformanceScore(),
        functionalityScore: this.calculateFunctionalityScore(),
        totalErrors: this.results.errors.length,
        totalRecommendations: this.results.recommendations.length
      },
      details: this.results,
      recommendations: this.results.recommendations
    };

    // Save detailed report
    fs.writeFileSync('system-analysis-report.json', JSON.stringify(report, null, 2));

    // Print summary
    console.log('='.repeat(60));
    console.log('🎯 CLICK SYSTEM ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Server Health: ${report.summary.serverHealth}/100`);
    console.log(`⚡ Performance Score: ${report.summary.performanceScore}/100`);
    console.log(`🔧 Functionality Score: ${report.summary.functionalityScore}/100`);
    console.log(`❌ Total Errors Found: ${report.summary.totalErrors}`);
    console.log(`💡 Recommendations: ${report.summary.totalRecommendations}`);
    console.log('');

    if (report.recommendations.length > 0) {
      console.log('🔧 KEY RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${index + 1}. ${severityIcon} ${rec.message}`);
        console.log(`     💡 ${rec.action}`);
        console.log('');
      });
    }

    console.log('📄 Detailed report saved to: system-analysis-report.json');
    console.log('='.repeat(60));
  }

  calculateServerHealth() {
    const statuses = Object.values(this.results.serverStatus);
    const healthy = statuses.filter(s => s.success).length;
    return Math.round((healthy / statuses.length) * 100);
  }

  calculatePerformanceScore() {
    const performances = Object.values(this.results.performance);
    if (performances.length === 0) return 100;

    const avgScore = performances.reduce((sum, p) => {
      let score = 100;
      if (p.averageTime > 1000) score -= 40;
      else if (p.averageTime > 500) score -= 20;

      if (p.stability === 'poor') score -= 30;
      else if (p.stability === 'good') score -= 10;

      return sum + Math.max(0, score);
    }, 0) / performances.length;

    return Math.round(avgScore);
  }

  calculateFunctionalityScore() {
    const functionalities = Object.values(this.results.functionality);
    const working = functionalities.filter(f => f.success).length;
    return Math.round((working / functionalities.length) * 100);
  }

  async makeRequest(url, includeBody = false) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https://') ? https : http;

      const request = protocol.get(url, (response) => {
        let body = '';
        let size = 0;

        response.on('data', (chunk) => {
          body += chunk;
          size += chunk.length;
        });

        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: includeBody ? body : null,
            size
          });
        });
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the analysis
const analyzer = new ClickSystemAnalyzer();
analyzer.runFullAnalysis().catch(console.error);




