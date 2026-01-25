import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Clear Functionality - Schema Groups UI', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('schema groups tab should show empty state after clearing everything', async ({ page }) => {
    // First, navigate to the Groups tab to verify initial state
    await carta.switchDockTab('groups');

    // Wait for the Groups tab content to load
    await page.waitForSelector('text=Schema Groups', { timeout: 5000 });

    // Initially should have built-in groups (software architecture, etc.)
    // Look specifically for group items within the schema groups container
    const groupsContainer = page.locator('text=Schema Groups').locator('..').locator('..');
    const initialGroupItems = await groupsContainer.locator('button:has-text("Software Architecture")').count();
    expect(initialGroupItems).toBeGreaterThan(0);

    // Now clear everything
    await carta.openClearModal();
    await carta.clearEverything();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Wait a moment for Yjs to propagate changes
    await page.waitForTimeout(500);

    // Verify Groups tab shows empty state (should already be on Groups tab)
    // Should now show "No schema groups available" message
    await expect(page.getByText('No schema groups available')).toBeVisible();

    // Verify Software Architecture group is gone
    await expect(page.getByText('Software Architecture')).not.toBeVisible();
  });

  test('schema groups tab should preserve groups when clearing only instances', async ({ page }) => {
    // Navigate to the Groups tab
    await carta.switchDockTab('groups');

    // Wait for content to load
    await page.waitForSelector('text=Schema Groups', { timeout: 5000 });

    // Verify Software Architecture group exists initially
    await expect(page.getByText('Software Architecture')).toBeVisible();

    // Clear only instances
    await carta.openClearModal();
    await carta.clearInstances();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Wait for page to stabilize
    await page.waitForTimeout(500);

    // Verify Groups tab still has groups (should already be on Groups tab)
    await expect(page.getByText('Software Architecture')).toBeVisible();

    // Should NOT show empty state message
    await expect(page.getByText('No schema groups available')).not.toBeVisible();
  });

  test('clear everything and restore defaults should restore schema groups', async ({ page }) => {
    // Navigate to the Groups tab
    await carta.switchDockTab('groups');

    // Wait for content to load
    await page.waitForSelector('text=Schema Groups', { timeout: 5000 });

    // Verify Software Architecture group exists initially
    await expect(page.getByText('Software Architecture')).toBeVisible();

    // Clear everything and restore defaults
    await carta.clearAndRestoreDefaults();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Wait for Yjs to propagate changes
    await page.waitForTimeout(500);

    // Verify Groups tab has groups again (should already be on Groups tab)
    await expect(page.getByText('Software Architecture')).toBeVisible();
    await expect(page.getByText('Database')).toBeVisible();
    await expect(page.getByText('API')).toBeVisible();
    await expect(page.getByText('UI')).toBeVisible();
  });
});
