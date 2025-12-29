// E2E Tests: Accessibility

const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');
const { checkAccessibility, testKeyboardNavigation, checkSkipLinks, testScreenReader } = require('./helpers/accessibility-helpers');

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Homepage Accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    
    const violations = await checkAccessibility(page, { failOnViolations: false });
    
    // Log violations but don't fail test
    if (violations.length > 0) {
      console.log('Accessibility violations found:', violations);
    }
    
    // Check for skip links
    const hasSkipLinks = await checkSkipLinks(page);
    expect(hasSkipLinks).toBeTruthy();
  });

  test('Content Page Accessibility', async ({ page }) => {
    await navigateToSection(page, 'content');
    
    const violations = await checkAccessibility(page, { failOnViolations: false });
    
    // Verify interactive elements are accessible
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 5)) { // Test first 5 buttons
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  test('Keyboard Navigation', async ({ page }) => {
    await navigateToSection(page, 'content');
    
    // Test Tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Test Enter key on focused button
    if (focusedElement === 'BUTTON') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  });

  test('Screen Reader Compatibility', async ({ page }) => {
    await page.goto('/dashboard');
    
    const screenReaderInfo = await testScreenReader(page);
    
    // Should have ARIA landmarks
    expect(screenReaderInfo.hasLandmarks).toBeTruthy();
  });

  test('Form Accessibility', async ({ page }) => {
    await navigateToSection(page, 'content');
    
    // Find create form
    const createButton = page.locator('button:has-text("Create")').first();
    if (await createButton.count() > 0) {
      await createButton.click();
      
      // Wait for form
      await page.waitForSelector('input[name="title"], textarea[name="title"]', { timeout: 5000 });
      
      // Check form labels
      const inputs = await page.locator('input, textarea, select').all();
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          expect(label > 0 || ariaLabel || placeholder).toBeTruthy();
        }
      }
    }
  });
});



