// Accessibility Testing Helpers

const { expect } = require('@playwright/test');

/**
 * Check page accessibility
 */
async function checkAccessibility(page, options = {}) {
  const violations = [];
  
  // Check for ARIA labels on interactive elements
  const interactiveElements = await page.locator('button, a, input, select, textarea').all();
  for (const element of interactiveElements) {
    const ariaLabel = await element.getAttribute('aria-label');
    const ariaLabelledBy = await element.getAttribute('aria-labelledby');
    const text = await element.textContent();
    const type = await element.getAttribute('type');
    
    // Skip hidden elements
    const isVisible = await element.isVisible();
    if (!isVisible) continue;
    
    // Check if element has accessible name
    if (!ariaLabel && !ariaLabelledBy && !text && type !== 'hidden') {
      const tagName = await element.evaluate(el => el.tagName);
      violations.push({
        element: tagName,
        issue: 'Missing accessible name',
        selector: await element.evaluate(el => {
          if (el.id) return `#${el.id}`;
          if (el.className) return `.${el.className.split(' ')[0]}`;
          return el.tagName.toLowerCase();
        }),
      });
    }
  }
  
  // Check for alt text on images
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const isDecorative = await img.getAttribute('role') === 'presentation';
    
    if (!alt && !isDecorative) {
      violations.push({
        element: 'img',
        issue: 'Missing alt text',
        selector: await img.evaluate(el => {
          if (el.id) return `#${el.id}`;
          return 'img';
        }),
      });
    }
  }
  
  // Check for heading hierarchy
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  let previousLevel = 0;
  for (const heading of headings) {
    const tagName = await heading.evaluate(el => el.tagName);
    const level = parseInt(tagName.substring(1));
    
    if (level > previousLevel + 1 && previousLevel > 0) {
      violations.push({
        element: tagName,
        issue: 'Heading level skipped',
        selector: await heading.evaluate(el => {
          if (el.id) return `#${el.id}`;
          return tagName.toLowerCase();
        }),
      });
    }
    
    previousLevel = level;
  }
  
  // Check for keyboard navigation
  const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]').all();
  const tabIndices = [];
  for (const element of focusableElements) {
    const tabIndex = await element.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex) >= 0) {
      tabIndices.push(parseInt(tabIndex));
    }
  }
  
  // Check for duplicate tab indices
  const duplicates = tabIndices.filter((item, index) => tabIndices.indexOf(item) !== index);
  if (duplicates.length > 0) {
    violations.push({
      element: 'multiple',
      issue: 'Duplicate tab indices found',
    });
  }
  
  if (options.failOnViolations && violations.length > 0) {
    console.error('Accessibility violations:', violations);
    throw new Error(`Found ${violations.length} accessibility violations`);
  }
  
  return violations;
}

/**
 * Test keyboard navigation
 */
async function testKeyboardNavigation(page, selector) {
  const element = page.locator(selector).first();
  await element.focus();
  
  // Test Tab navigation
  await page.keyboard.press('Tab');
  
  // Test Enter/Space on buttons
  const tagName = await element.evaluate(el => el.tagName);
  if (tagName === 'BUTTON' || tagName === 'A') {
    await element.press('Enter');
    await page.waitForTimeout(500);
  }
}

/**
 * Check color contrast (basic check)
 */
async function checkColorContrast(page) {
  // This is a simplified check - full contrast checking requires more complex logic
  const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6').all();
  const issues = [];
  
  for (const element of textElements) {
    const text = await element.textContent();
    if (!text || text.trim().length === 0) continue;
    
    const color = await element.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    
    // Basic check - in production, use a proper contrast checking library
    if (color.color === color.backgroundColor) {
      issues.push({
        element: await element.evaluate(el => el.tagName),
        issue: 'Text and background colors are the same',
      });
    }
  }
  
  return issues;
}

/**
 * Check for skip links
 */
async function checkSkipLinks(page) {
  const skipLinks = await page.locator('a[href*="#main"], a[href*="#content"], .skip-link').all();
  return skipLinks.length > 0;
}

/**
 * Test screen reader compatibility
 */
async function testScreenReader(page) {
  // Check for ARIA landmarks
  const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').all();
  
  // Check for ARIA live regions
  const liveRegions = await page.locator('[aria-live], [role="alert"], [role="status"]').all();
  
  return {
    hasLandmarks: landmarks.length > 0,
    hasLiveRegions: liveRegions.length > 0,
    landmarkCount: landmarks.length,
    liveRegionCount: liveRegions.length,
  };
}

module.exports = {
  checkAccessibility,
  testKeyboardNavigation,
  checkColorContrast,
  checkSkipLinks,
  testScreenReader,
};



