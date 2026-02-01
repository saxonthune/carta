import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for Clear Everything with persistence.
 * Verifies that clearing persists across page reload and that restore works.
 */
// TODO: Fix E2E tests — requires dev server in static mode with no stale server on port 5173
test.describe.skip('Clear Everything Persistence', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('should clear schemas and reflect in context menu', async ({ page }) => {
    // Verify schemas exist via context menu
    await carta.openCanvasContextMenu();
    const addNodeBefore = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
    await expect(addNodeBefore).toBeVisible();
    // Should have a count (schemas loaded)
    const textBefore = await addNodeBefore.textContent();
    expect(textBefore).not.toContain('+ Add Node Here');
    await page.keyboard.press('Escape');

    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Verify schemas are cleared
    await carta.openCanvasContextMenu();
    const addNodeAfter = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
    if (await addNodeAfter.isVisible()) {
      const text = await addNodeAfter.textContent();
      expect(text).toContain('+ Add Node Here');
    }
    await page.keyboard.press('Escape');
  });

  test('cleared state should persist after page reload', async ({ page }) => {
    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu-button"]');

    // Verify schemas are still cleared after reload
    await carta.openCanvasContextMenu();
    const addNodeButton = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
    if (await addNodeButton.isVisible()) {
      const text = await addNodeButton.textContent();
      expect(text).toContain('+ Add Node Here');
    }
    await page.keyboard.press('Escape');
  });

  test('restore defaults after clear should bring back schemas', async ({ page }) => {
    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Restore defaults
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await page.waitForTimeout(500);

    // Verify schemas are back via context menu
    await carta.openCanvasContextMenu();
    const addNodeButton = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
    await expect(addNodeButton).toBeVisible();
    await addNodeButton.hover();
    await page.waitForTimeout(300);
    await expect(page.locator('button').filter({ hasText: 'REST Controller' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Database' }).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
