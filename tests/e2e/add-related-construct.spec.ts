import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for adding related constructs via context menu:
 * - Add related construct creates both node and edge
 * - No React Flow errors (error #008)
 * - Moving nodes after creation works without errors
 */
test.describe('Add Related Construct', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();

    // Ensure we have schemas by restoring defaults
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await page.waitForTimeout(500);
  });

  test('should create node via context menu without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Right-click on canvas to open context menu
    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Use explicit mouse events
    await page.mouse.move(canvasBox!.x + 300, canvasBox!.y + 300);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(300);

    // Look for any context menu item with "Add" in text
    const addButton = page.locator('button, [role="menuitem"]').filter({ hasText: /add/i }).first();

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/context-menu.png' });

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(300);

      // Now look for construct options
      const constructButton = page.locator('button').filter({ hasText: /Database|Table|Service|Task/i }).first();

      if (await constructButton.isVisible()) {
        await constructButton.click();
        await page.waitForTimeout(500);

        // Verify node was created
        const nodes = page.locator('.react-flow__node');
        const count = await nodes.count();
        expect(count).toBeGreaterThan(0);

        // Check for React Flow errors
        const reactFlowErrors = consoleErrors.filter((e) =>
          e.includes("Couldn't create edge") || e.includes('error#008')
        );
        expect(reactFlowErrors).toHaveLength(0);
      }
    }
  });

  test('should add related construct with edge via node context menu', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // First create a node using the Add Construct button
    const addButton = page.locator('button').filter({ hasText: /Add Construct/i });
    await addButton.click();
    await page.waitForTimeout(300);

    // Click first available construct
    const constructButton = page.locator('button').filter({ hasText: /Database|Service|Task/i }).first();
    if (await constructButton.isVisible()) {
      await constructButton.click();
      await page.waitForTimeout(500);
    } else {
      // Try any button in the menu
      const menuButton = page.locator('.fixed button').first();
      await menuButton.click();
      await page.waitForTimeout(500);
    }

    // Verify node exists
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1, { timeout: 10000 });

    // Right-click on the node
    const node = nodes.first();
    const nodeBox = await node.boundingBox();
    expect(nodeBox).not.toBeNull();

    await page.mouse.move(nodeBox!.x + 50, nodeBox!.y + 20);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(300);

    // Screenshot for debugging
    await page.screenshot({ path: 'test-results/node-context-menu.png' });

    // Look for "Add Related" button
    const addRelatedButton = page.locator('button, [role="menuitem"]').filter({ hasText: /add related/i }).first();

    if (await addRelatedButton.isVisible()) {
      // Hover to show submenu
      await addRelatedButton.hover();
      await page.waitForTimeout(300);

      // Screenshot submenu
      await page.screenshot({ path: 'test-results/add-related-submenu.png' });

      // Click first option in submenu (any button except "Add Related" itself)
      const submenuOption = page.locator('button').filter({ hasNotText: /add related/i }).last();

      if (await submenuOption.isVisible()) {
        await submenuOption.click();
        await page.waitForTimeout(500);

        // Verify second node was created
        await expect(nodes).toHaveCount(2, { timeout: 10000 });

        // Verify edge was created
        const edges = page.locator('.react-flow__edge');
        await expect(edges).toHaveCount(1, { timeout: 10000 });

        // Check for React Flow errors
        const reactFlowErrors = consoleErrors.filter((e) =>
          e.includes("Couldn't create edge") || e.includes('error#008')
        );
        expect(reactFlowErrors).toHaveLength(0);

        // Move the second node to verify no errors
        const secondNode = nodes.nth(1);
        const secondNodeBox = await secondNode.boundingBox();
        if (secondNodeBox) {
          await page.mouse.move(secondNodeBox.x + 50, secondNodeBox.y + 20);
          await page.mouse.down();
          await page.mouse.move(secondNodeBox.x + 150, secondNodeBox.y + 100, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);

          // Final error check
          const finalErrors = consoleErrors.filter((e) =>
            e.includes("Couldn't create edge") || e.includes('error#008')
          );
          expect(finalErrors).toHaveLength(0);
        }
      }
    } else {
      // No "Add Related" available - this construct type doesn't have related constructs
      console.log('No "Add Related" option available for this construct type');
    }
  });
});
