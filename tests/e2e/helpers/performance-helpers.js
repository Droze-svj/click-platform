// Performance Testing Helpers

/**
 * Measure page load performance
 */
async function measurePageLoad(page, url) {
  const metrics = {};
  
  // Navigate and measure
  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  metrics.loadTime = Date.now() - startTime;
  
  // Get performance metrics from browser
  const performanceMetrics = await page.evaluate(() => {
    const perfData = window.performance.timing;
    return {
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
      loadComplete: perfData.loadEventEnd - perfData.navigationStart,
      firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
    };
  });
  
  return {
    ...metrics,
    ...performanceMetrics,
  };
}

/**
 * Measure API response times
 */
async function measureAPIPerformance(page, urlPattern) {
  const responseTimes = [];
  
  page.on('response', async response => {
    if (response.url().includes(urlPattern)) {
      const timing = response.timing();
      responseTimes.push({
        url: response.url(),
        status: response.status(),
        duration: timing.responseEnd - timing.requestStart,
        waitTime: timing.responseStart - timing.requestStart,
        downloadTime: timing.responseEnd - timing.responseStart,
      });
    }
  });
  
  return responseTimes;
}

/**
 * Check for performance issues
 */
async function checkPerformanceIssues(page, thresholds = {}) {
  const defaultThresholds = {
    maxLoadTime: 3000,
    maxAPITime: 1000,
    maxImageSize: 500 * 1024, // 500KB
    maxBundleSize: 2 * 1024 * 1024, // 2MB
    ...thresholds,
  };
  
  const issues = [];
  
  // Check page load time
  const loadMetrics = await measurePageLoad(page, page.url());
  if (loadMetrics.loadTime > defaultThresholds.maxLoadTime) {
    issues.push({
      type: 'slow_page_load',
      value: loadMetrics.loadTime,
      threshold: defaultThresholds.maxLoadTime,
    });
  }
  
  // Check image sizes
  const images = await page.locator('img').all();
  for (const img of images) {
    const src = await img.getAttribute('src');
    if (src && !src.startsWith('data:')) {
      try {
        const response = await page.request.get(src);
        const size = (await response.body()).length;
        if (size > defaultThresholds.maxImageSize) {
          issues.push({
            type: 'large_image',
            url: src,
            size,
            threshold: defaultThresholds.maxImageSize,
          });
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
  
  return issues;
}

/**
 * Measure memory usage
 */
async function measureMemoryUsage(page) {
  const memory = await page.evaluate(() => {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };
    }
    return null;
  });
  
  return memory;
}

/**
 * Test with throttled network
 */
async function testWithThrottling(page, url, throttling = 'slow') {
  const conditions = {
    slow: {
      downloadThroughput: 500 * 1024, // 500 Kbps
      uploadThroughput: 250 * 1024, // 250 Kbps
      latency: 500,
    },
    fast: {
      downloadThroughput: 10 * 1024 * 1024, // 10 Mbps
      uploadThroughput: 5 * 1024 * 1024, // 5 Mbps
      latency: 10,
    },
  };
  
  const condition = conditions[throttling] || conditions.slow;
  
  // Note: Network throttling requires CDP session
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: condition.downloadThroughput,
    uploadThroughput: condition.uploadThroughput,
    latency: condition.latency,
  });
  
  const metrics = await measurePageLoad(page, url);
  
  await client.detach();
  
  return metrics;
}

/**
 * Count and measure resource sizes
 */
async function analyzeResources(page) {
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.map(entry => ({
      name: entry.name,
      type: entry.initiatorType,
      duration: entry.duration,
      size: entry.transferSize || 0,
    }));
  });
  
  const summary = {
    total: resources.length,
    totalSize: resources.reduce((sum, r) => sum + r.size, 0),
    byType: {},
  };
  
  resources.forEach(resource => {
    if (!summary.byType[resource.type]) {
      summary.byType[resource.type] = {
        count: 0,
        totalSize: 0,
      };
    }
    summary.byType[resource.type].count++;
    summary.byType[resource.type].totalSize += resource.size;
  });
  
  return {
    resources,
    summary,
  };
}

module.exports = {
  measurePageLoad,
  measureAPIPerformance,
  checkPerformanceIssues,
  measureMemoryUsage,
  testWithThrottling,
  analyzeResources,
};



