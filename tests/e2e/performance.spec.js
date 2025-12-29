// E2E Tests: Performance

const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');
const { measurePageLoad, checkPerformanceIssues, analyzeResources } = require('./helpers/performance-helpers');

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard Load Performance', async ({ page }) => {
    const metrics = await measurePageLoad(page, '/dashboard');
    
    // Page should load in under 3 seconds
    expect(metrics.loadTime).toBeLessThan(3000);
    
    // First contentful paint should be under 1.5 seconds
    if (metrics.firstContentfulPaint) {
      expect(metrics.firstContentfulPaint).toBeLessThan(1500);
    }
  });

  test('Content Page Performance', async ({ page }) => {
    const metrics = await measurePageLoad(page, '/dashboard/content');
    
    expect(metrics.loadTime).toBeLessThan(3000);
  });

  test('Resource Analysis', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const analysis = await analyzeResources(page);
    
    // Should not have too many resources
    expect(analysis.summary.total).toBeLessThan(100);
    
    // Total size should be reasonable
    expect(analysis.summary.totalSize).toBeLessThan(10 * 1024 * 1024); // 10MB
  });

  test('API Response Times', async ({ page }) => {
    await page.goto('/dashboard/content');
    
    // Monitor API calls
    const apiCalls = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        apiCalls.push({
          url: response.url(),
          duration: timing.responseEnd - timing.requestStart,
        });
      }
    });
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check API response times
    for (const call of apiCalls) {
      expect(call.duration).toBeLessThan(2000); // 2 seconds max
    }
  });

  test('Performance Issues Check', async ({ page }) => {
    await page.goto('/dashboard');
    
    const issues = await checkPerformanceIssues(page, {
      maxLoadTime: 3000,
      maxImageSize: 500 * 1024,
    });
    
    // Log issues but don't fail unless critical
    if (issues.length > 0) {
      console.log('Performance issues found:', issues);
    }
    
    // Critical issues should not exist
    const criticalIssues = issues.filter(i => i.type === 'slow_page_load');
    expect(criticalIssues.length).toBe(0);
  });
});



