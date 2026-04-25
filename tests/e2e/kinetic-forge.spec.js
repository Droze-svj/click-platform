// E2E Test: Kinetic Forge (Video Synthesis Hub) Upload Flow
// This test verifies the premium "Kinetic Forge" upload and redirection logic.

const { test, expect } = require('@playwright/test');
const { login, navigateToSection, uploadFile } = require('./helpers/test-helpers');
const path = require('path');

test.describe('Kinetic Forge - Synthesis Hub', () => {
  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for video synthesis flows
    test.setTimeout(120000);
    // Login to the platform
    await login(page);
  });

  test('Should navigate to Kinetic Forge and display the premium UI', async ({ page }) => {
    await navigateToSection(page, 'video');
    
    // Verify the URL and Page Title
    await expect(page).toHaveURL(/dashboard\/video/);
    
    // Check for the "Elite" headings we recently updated
    const mainHeading = page.locator('h1:has-text("Kinetic"), h1:has-text("Hub")');
    await expect(mainHeading).toBeVisible();
    
    // Verify the "Neural Ingress" status badge is present
    const statusBadge = page.locator('text=/NEURAL_INGRESS_ACTIVE/i');
    await expect(statusBadge).toBeVisible();
  });

  test('Should successfully upload a video payload to the Kinetic Forge', async ({ page }) => {
    await navigateToSection(page, 'video');

    // Path to the dummy video fixture created in earlier steps
    const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');
    
    // Click the "Ingest Payload" button/area (using the label we just refined)
    // The FileUpload component usually has an invisible input or a dropzone
    const fileInput = page.locator('input[type="file"]');
    
    // Verify the "Deploy Ingress" terminal section exists
    await expect(page.locator('h2:has-text("Deploy Ingress")')).toBeVisible();

    // Perform the upload using the helper
    await uploadFile(page, testVideoPath);

    // Verify the Swarm Consensus HUD (Neural Progress) appears
    // We recently refined the text to "Analyzing Kinetic Nodes"
    const hud = page.locator('text=/Analyzing Kinetic Nodes/i, text=/SYNTHESIZING/i');
    await expect(hud.first()).toBeVisible({ timeout: 15000 });

    // Wait for the success toast or redirection
    // Redirection happens in KineticSynthesisHubPage.handleForgePayload or pollSpectralStatus
    // It should go to /dashboard/video/edit/[contentId]
    await page.waitForURL(/\/dashboard\/video\/edit\/.+/, { timeout: 60000 });
    
    // Verify we arrived at the Spectral Chamber (Editor)
    await expect(page).toHaveURL(/\/dashboard\/video\/edit\/.+/);
  });

  test('Should display existing Kinetic Manifests in the Sequence Matrix', async ({ page }) => {
    await navigateToSection(page, 'video');
    
    // Wait for videos to load
    const sequenceMatrix = page.locator('h2:has-text("Sequence Matrix")');
    await expect(sequenceMatrix).toBeVisible();
    
    // Check if there are video cards (depending on if the test account has data)
    const videoCards = page.locator('.click-card');
    const count = await videoCards.count();
    
    if (count > 0) {
      // Verify first card has the "OPEN_MATRIX" action buttom
      const openButton = videoCards.first().locator('button:has-text("OPEN_MATRIX")');
      await expect(openButton).toBeVisible();
    }
  });

  test('Should show "Void Occupied" message when no videos are present', async ({ page }) => {
    // This might only work on a fresh account, but good for completeness
    await navigateToSection(page, 'video');
    
    // If no videos, check for the "Void Occupied" (rebranded Empty State)
    const emptyState = page.locator('h3:has-text("Void Occupied")');
    const videoCards = page.locator('.click-card');
    
    if (await videoCards.count() === 0) {
      await expect(emptyState).toBeVisible();
    }
  });
});
