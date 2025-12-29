// API Mocking Helpers for E2E Tests

/**
 * Mock external API responses
 */
async function setupAPIMocks(page) {
  // Mock OAuth responses
  await page.route('**/api/oauth/**/authorize', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          url: 'https://oauth-provider.com/auth?mock=true',
          state: 'mock-state-123',
        },
      }),
    });
  });

  // Mock OAuth callback
  await page.route('**/api/oauth/**/callback**', route => {
    route.fulfill({
      status: 302,
      headers: {
        Location: '/dashboard/social?platform=twitter&success=true',
      },
    });
  });

  // Mock OpenAI API (if needed)
  await page.route('**/api/ai/**', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content: 'Mock AI generated content',
            suggestions: ['suggestion1', 'suggestion2'],
          },
        }),
      });
    } else {
      route.continue();
    }
  });

  // Mock file upload
  await page.route('**/api/upload/**', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            fileId: 'mock-file-id',
            url: 'https://example.com/mock-file.mp4',
            size: 1024000,
          },
        }),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Mock network conditions
 */
async function setNetworkConditions(page, condition = 'fast') {
  const conditions = {
    fast: {
      downloadThroughput: 10 * 1024 * 1024, // 10 Mbps
      uploadThroughput: 5 * 1024 * 1024, // 5 Mbps
      latency: 10,
    },
    slow: {
      downloadThroughput: 500 * 1024, // 500 Kbps
      uploadThroughput: 250 * 1024, // 250 Kbps
      latency: 500,
    },
    offline: {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    },
  };

  await page.context().setOffline(condition === 'offline');
  // Note: Network throttling may require CDP session
}

/**
 * Intercept and log API calls
 */
async function interceptAPICalls(page, logCalls = false) {
  const apiCalls = [];

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      const call = {
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        timestamp: Date.now(),
      };
      apiCalls.push(call);
      
      if (logCalls) {
        console.log(`API Call: ${call.method} ${call.url} - ${call.status}`);
      }
    }
  });

  return apiCalls;
}

/**
 * Wait for specific API call
 */
async function waitForAPICall(page, urlPattern, method = 'GET', timeout = 30000) {
  return page.waitForResponse(
    response => {
      return response.url().includes(urlPattern) &&
             response.request().method() === method.toUpperCase();
    },
    { timeout }
  );
}

/**
 * Mock error responses
 */
async function mockAPIError(page, urlPattern, status = 500, error = 'Internal Server Error') {
  await page.route(`**${urlPattern}**`, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error,
      }),
    });
  });
}

/**
 * Reset all mocks
 */
async function resetMocks(page) {
  await page.unroute('**');
}

module.exports = {
  setupAPIMocks,
  setNetworkConditions,
  interceptAPICalls,
  waitForAPICall,
  mockAPIError,
  resetMocks,
};



