import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for verifying default state and clear/restore workflow.
 *
 * Key scenarios:
 * 1. Default view should have built-in schemas (verified via context menu)
 * 2. Clear everything should empty all data
 * 3. Clear everything -> restore defaults should restore built-ins
 */
// TODO: Fix E2E tests — requires dev server in static mode with no stale server on port 5173
test.describe.skip('Default State and Clear/Restore Workflow', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test.describe('Default State', () => {
    test('should have built-in construct schemas available in context menu', async () => {
      // Open context menu and check for "Add Node Here" with schemas
      await carta.openCanvasContextMenu();

      // The "Add Node Here" item should be visible with a count
      const addNodeButton = carta.page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeButton).toBeVisible();

      // Hover to open submenu
      await addNodeButton.hover();
      await carta.page.waitForTimeout(300);

      // Verify some built-in schema names appear in the submenu
      await expect(carta.page.locator('button').filter({ hasText: 'REST Controller' })).toBeVisible();
      await expect(carta.page.locator('button').filter({ hasText: 'Database' }).first()).toBeVisible();
      await expect(carta.page.locator('button').filter({ hasText: 'Table' })).toBeVisible();
      await expect(carta.page.locator('button').filter({ hasText: 'User Story' })).toBeVisible();
    });

    test('should have no instances on fresh load', async () => {
      const nodeCount = await carta.getNodeCount();
      expect(nodeCount).toBe(0);
    });
  });

  test.describe('Clear Everything', () => {
    test('should empty all construct schemas from context menu', async ({ page }) => {
      // First verify schemas exist via context menu
      await carta.openCanvasContextMenu();
      const addNodeButton = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeButton).toBeVisible();
      await page.keyboard.press('Escape');

      // Clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify schemas are cleared — context menu should show "+ Add Node Here" (no count)
      // or no "Add Node Here" at all
      await carta.openCanvasContextMenu();
      // After clearing, there should be no schemas, so the submenu should not list any
      const addNodeAfter = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      // If it exists, it should be the simple version without count
      if (await addNodeAfter.isVisible()) {
        const text = await addNodeAfter.textContent();
        // Should not contain a count like "(11)" — it should say "+ Add Node Here"
        expect(text).toContain('+ Add Node Here');
      }
      await page.keyboard.press('Escape');
    });

    test('should preserve document title after clear everything', async ({ page }) => {
      const initialTitle = await carta.getTitle();

      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      const newTitle = await carta.getTitle();
      expect(newTitle).toBe(initialTitle);
    });
  });

  test.describe('Clear Everything and Restore Defaults', () => {
    test('should restore built-in construct schemas after clear and restore', async ({ page }) => {
      // Clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify cleared
      await carta.openCanvasContextMenu();
      const addNodeCleared = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      if (await addNodeCleared.isVisible()) {
        const text = await addNodeCleared.textContent();
        expect(text).toContain('+ Add Node Here');
      }
      await page.keyboard.press('Escape');

      // Restore defaults
      await carta.openRestoreDefaultsModal();
      await carta.confirmRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify restored — context menu should have schemas again
      await carta.openCanvasContextMenu();
      const addNodeRestored = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeRestored).toBeVisible();
      await addNodeRestored.hover();
      await page.waitForTimeout(300);
      await expect(page.locator('button').filter({ hasText: 'REST Controller' })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: 'Database' }).first()).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('should use clear and restore button in one action', async ({ page }) => {
      await carta.clearAndRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify schemas are restored
      await carta.openCanvasContextMenu();
      const addNodeButton = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeButton).toBeVisible();
      await addNodeButton.hover();
      await page.waitForTimeout(300);
      await expect(page.locator('button').filter({ hasText: 'REST Controller' })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('should have no instances after clear and restore', async ({ page }) => {
      await carta.clearAndRestoreDefaults();
      await page.waitForTimeout(500);

      const nodeCount = await carta.getNodeCount();
      expect(nodeCount).toBe(0);
    });
  });

  test.describe('Clear Instances Only', () => {
    test('should preserve schemas when clearing instances only', async ({ page }) => {
      // Verify schemas exist
      await carta.openCanvasContextMenu();
      const addNodeBefore = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeBefore).toBeVisible();
      await page.keyboard.press('Escape');

      // Clear instances only
      await carta.openClearModal();
      await carta.clearInstances();
      await page.waitForTimeout(500);

      // Verify schemas are preserved
      await carta.openCanvasContextMenu();
      const addNodeAfter = page.locator('button').filter({ hasText: /Add Node Here/i }).first();
      await expect(addNodeAfter).toBeVisible();
      await addNodeAfter.hover();
      await page.waitForTimeout(300);
      await expect(page.locator('button').filter({ hasText: 'REST Controller' })).toBeVisible();
      await page.keyboard.press('Escape');
    });
  });
});
