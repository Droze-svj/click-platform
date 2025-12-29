// E2E Tests: Content Creation Flows

const { test, expect } = require('@playwright/test');
const { login, navigateToSection, waitForContentLoad, createContent, waitForToast } = require('./helpers/test-helpers');

test.describe('Content Creation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Navigate to Content Page', async ({ page }) => {
    await navigateToSection(page, 'content');
    await expect(page).toHaveURL(/content/);
    
    // Should see content creation interface
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")');
    await expect(createButton.first()).toBeVisible();
  });

  test('Create Text Content', async ({ page }) => {
    await navigateToSection(page, 'content');

    // Click create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Content")').first();
    await createButton.click();

    // Fill content form
    const title = 'E2E Test Content';
    const text = 'This is test content created during E2E testing.';

    // Wait for form to appear
    await page.waitForSelector('input[name="title"], textarea[name="title"]', { timeout: 5000 });

    await page.fill('input[name="title"], textarea[name="title"]', title);
    await page.fill('textarea[name="text"], textarea[name="content"]', text);

    // Select platforms
    const platformCheckboxes = page.locator('input[type="checkbox"][value*="twitter"], input[type="checkbox"][value*="linkedin"]');
    const checkboxCount = await platformCheckboxes.count();
    if (checkboxCount > 0) {
      await platformCheckboxes.first().check();
    }

    // Submit form
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button[type="submit"]');
    await submitButton.click();

    // Wait for content to be created
    await waitForContentLoad(page);

    // Verify content appears in list
    const contentTitle = page.locator(`text=${title}`);
    await expect(contentTitle.first()).toBeVisible({ timeout: 10000 });
  });

  test('Generate AI Content', async ({ page }) => {
    await navigateToSection(page, 'content');

    // Look for AI generation button
    const aiButton = page.locator('button:has-text("AI"), button:has-text("Generate")');
    if (await aiButton.count() > 0) {
      await aiButton.first().click();

      // Fill AI prompt if form appears
      const promptInput = page.locator('textarea[placeholder*="prompt" i], textarea[name="prompt"]');
      if (await promptInput.count() > 0) {
        await promptInput.fill('Create a social media post about productivity');
        await page.click('button:has-text("Generate")');

        // Wait for AI response
        await page.waitForSelector('.ai-content, .generated-content', { timeout: 30000 });
      }
    }
  });

  test('Edit Content', async ({ page }) => {
    await navigateToSection(page, 'content');
    await waitForContentLoad(page);

    // Find first content item
    const contentItem = page.locator('.content-item, [data-content-id]').first();
    if (await contentItem.count() > 0) {
      // Click edit button
      const editButton = contentItem.locator('button:has-text("Edit"), [data-testid="edit"]');
      if (await editButton.count() > 0) {
        await editButton.click();

        // Wait for edit form
        await page.waitForSelector('input[name="title"], textarea[name="title"]', { timeout: 5000 });

        // Modify content
        const titleInput = page.locator('input[name="title"], textarea[name="title"]').first();
        await titleInput.fill('Updated E2E Test Content');

        // Save changes
        await page.click('button:has-text("Save"), button:has-text("Update")');

        // Verify update
        await waitForToast(page, 'updated', 'success');
      }
    }
  });

  test('Delete Content', async ({ page }) => {
    await navigateToSection(page, 'content');
    await waitForContentLoad(page);

    // Find first content item
    const contentItem = page.locator('.content-item, [data-content-id]').first();
    if (await contentItem.count() > 0) {
      // Click delete button
      const deleteButton = contentItem.locator('button:has-text("Delete"), [data-testid="delete"]');
      if (await deleteButton.count() > 0) {
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")');
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
        }

        // Verify deletion
        await waitForToast(page, 'deleted', 'success');
      }
    }
  });

  test('Content Search and Filter', async ({ page }) => {
    await navigateToSection(page, 'content');
    await waitForContentLoad(page);

    // Use search
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000); // Wait for search to execute

      // Results should update
      await waitForContentLoad(page);
    }

    // Test filters
    const filterButton = page.locator('button:has-text("Filter"), [data-testid="filter"]');
    if (await filterButton.count() > 0) {
      await filterButton.click();
      
      // Select a filter option
      const filterOption = page.locator('input[type="checkbox"][value*="video"], input[type="radio"][value*="video"]');
      if (await filterOption.count() > 0) {
        await filterOption.first().check();
        await page.click('button:has-text("Apply")');
        await waitForContentLoad(page);
      }
    }
  });

  test('Content Export', async ({ page }) => {
    await navigateToSection(page, 'content');
    await waitForContentLoad(page);

    // Find export button
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export"]');
    if (await exportButton.count() > 0) {
      await exportButton.first().click();

      // Select export format if dialog appears
      const formatOption = page.locator('button:has-text("PDF"), button:has-text("CSV")');
      if (await formatOption.count() > 0) {
        await formatOption.first().click();
      }

      // Wait for download (if triggered)
      await page.waitForTimeout(2000);
    }
  });
});



