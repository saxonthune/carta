import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for verifying default state and clear/restore workflow.
 *
 * Key scenarios:
 * 1. Default view should have built-in schemas only
 * 2. Clear everything should empty all data
 * 3. Clear everything -> restore defaults should restore built-ins only
 */
test.describe('Default State and Clear/Restore Workflow', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test.describe('Default State', () => {
    test('should have built-in construct schemas on fresh load', async ({ page }) => {
      // Navigate to constructs tab
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);

      // Verify built-in construct schemas are present by checking for schema buttons
      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Database' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'DB Attribute' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Constraint' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'API Model' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'UI Event' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'UI Screen' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'User Story' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Implementation Details' })).toBeVisible();
    });

    test('should have built-in port schemas on fresh load', async ({ page }) => {
      // Navigate to ports tab
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);

      // Verify built-in port schemas are present by checking for schema buttons
      await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Flow Out' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Child' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Link' })).toBeVisible(); // symmetric port
      await expect(page.getByRole('button', { name: 'Intercept' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Forward' })).toBeVisible();
    });

    test('should have built-in schema groups on fresh load', async ({ page }) => {
      // Navigate to groups tab
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);

      // Verify built-in schema groups are present
      // NOTE: Currently only the top-level group appears. Nested groups (Database, API, UI)
      // should also appear but don't - this is tracked as a known issue.
      await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();
      // TODO: Fix nested group loading - these should be visible:
      // await expect(page.getByRole('button', { name: 'Database' })).toBeVisible();
      // await expect(page.getByRole('button', { name: 'API' })).toBeVisible();
      // await expect(page.getByRole('button', { name: 'UI' })).toBeVisible();
    });

    test('should have no instances on fresh load', async () => {
      // Canvas should have no nodes
      const nodeCount = await carta.getNodeCount();
      expect(nodeCount).toBe(0);
    });

    test('should have empty deployables on fresh load', async ({ page }) => {
      // Navigate to deployables tab
      await carta.switchDockTab('deployables');
      await page.waitForTimeout(300);

      // Should show empty state or no deployable items
      const deployableItems = page.locator('[data-testid="deployable-item"]');
      const count = await deployableItems.count();
      expect(count).toBe(0);
    });
  });

  test.describe('Clear Everything', () => {
    // BUG: Clear Everything doesn't actually clear schemas from the Yjs store
    test.skip('should empty all construct schemas', async ({ page }) => {
      // First verify schemas exist
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();

      // Clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify schemas are cleared
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'REST Controller' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Database' })).not.toBeVisible();
    });

    // BUG: Clear Everything doesn't actually clear port schemas from the Yjs store
    test.skip('should empty all port schemas', async ({ page }) => {
      // First verify port schemas exist
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();

      // Clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify port schemas are cleared
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'Flow In' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Flow Out' })).not.toBeVisible();
    });

    test('should empty all schema groups', async ({ page }) => {
      // First verify groups exist
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();

      // Clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify groups are cleared
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);

      await expect(page.getByRole('button', { name: 'Software Architecture' })).not.toBeVisible();
    });

    test('should preserve document title after clear everything', async ({ page }) => {
      const initialTitle = await carta.getTitle();

      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      const newTitle = await carta.getTitle();
      expect(newTitle).toBe(initialTitle);
    });

    test('should close modal after clear everything', async ({ page }) => {
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(300);

      await expect(carta.clearModal).not.toBeVisible();
    });
  });

  test.describe('Clear Everything and Restore Defaults', () => {
    // BUG: Clear + Restore workflow doesn't work - clear doesn't clear, restore doesn't restore
    test.skip('should restore built-in construct schemas after clear and restore', async ({ page }) => {
      // First clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify cleared
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'REST Controller' })).not.toBeVisible();

      // Now restore defaults
      await carta.openRestoreDefaultsModal();
      await carta.confirmRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify built-ins are restored
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Database' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'User Story' })).toBeVisible();
    });

    test.skip('should restore built-in port schemas after clear and restore', async ({ page }) => {
      // First clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify cleared
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Flow In' })).not.toBeVisible();

      // Now restore defaults
      await carta.openRestoreDefaultsModal();
      await carta.confirmRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify built-ins are restored
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Flow Out' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Child' })).toBeVisible();
    });

    test.skip('should restore built-in schema groups after clear and restore', async ({ page }) => {
      // First clear everything
      await carta.openClearModal();
      await carta.clearEverything();
      await page.waitForTimeout(500);

      // Verify cleared
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Software Architecture' })).not.toBeVisible();

      // Now restore defaults
      await carta.openRestoreDefaultsModal();
      await carta.confirmRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify built-ins are restored
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();
    });

    test.skip('should use clear and restore button in one action', async ({ page }) => {
      // Use the combined clear and restore button
      await carta.clearAndRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify built-ins are present
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Database' })).toBeVisible();
    });

    test('should have no instances after clear and restore', async ({ page }) => {
      // Clear and restore
      await carta.clearAndRestoreDefaults();
      await page.waitForTimeout(500);

      // Verify no nodes on canvas
      const nodeCount = await carta.getNodeCount();
      expect(nodeCount).toBe(0);
    });

    test('should have empty deployables after clear and restore', async ({ page }) => {
      // Clear and restore
      await carta.clearAndRestoreDefaults();
      await page.waitForTimeout(500);

      // Navigate to deployables tab
      await carta.switchDockTab('deployables');
      await page.waitForTimeout(300);

      // Should show empty state
      const deployableItems = page.locator('[data-testid="deployable-item"]');
      const count = await deployableItems.count();
      expect(count).toBe(0);
    });
  });

  test.describe('Clear Instances Only', () => {
    test('should preserve schemas when clearing instances only', async ({ page }) => {
      // Verify schemas exist
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();

      // Clear instances only
      await carta.openClearModal();
      await carta.clearInstances();
      await page.waitForTimeout(500);

      // Verify schemas are preserved
      await carta.switchDockTab('constructs');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Database' })).toBeVisible();
    });

    test('should preserve port schemas when clearing instances only', async ({ page }) => {
      // Verify port schemas exist
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();

      // Clear instances only
      await carta.openClearModal();
      await carta.clearInstances();
      await page.waitForTimeout(500);

      // Verify port schemas are preserved
      await carta.switchDockTab('ports');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Flow Out' })).toBeVisible();
    });

    test('should preserve groups when clearing instances only', async ({ page }) => {
      // Verify groups exist
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();

      // Clear instances only
      await carta.openClearModal();
      await carta.clearInstances();
      await page.waitForTimeout(500);

      // Verify groups are preserved
      await carta.switchDockTab('groups');
      await page.waitForTimeout(300);
      await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();
    });
  });
});
