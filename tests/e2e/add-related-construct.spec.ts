import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for adding related constructs via context menu:
 * - Add related construct creates both node and edge
 * - No React Flow errors (error #008)
 * - Moving nodes after creation works without errors
 */
// TODO: Fix E2E tests — requires dev server in static mode with no stale server on port 5173
test.describe.skip('Add Related Construct', () => {
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
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Add a Database node via context menu
    await carta.addNodeViaContextMenu('Database');

    // Verify node was created
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1, { timeout: 10000 });

    // Check for React Flow errors
    const reactFlowErrors = consoleErrors.filter((e) =>
      e.includes("Couldn't create edge") || e.includes('error#008')
    );
    expect(reactFlowErrors).toHaveLength(0);
  });

  test('should add related construct with edge via node context menu', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // First create a node
    await carta.addNodeViaContextMenu('Database');

    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1, { timeout: 10000 });

    // Right-click on the node to open node context menu
    const node = nodes.first();
    const nodeBox = await node.boundingBox();
    expect(nodeBox).not.toBeNull();

    await page.mouse.click(nodeBox!.x + 50, nodeBox!.y + 20, { button: 'right' });
    await page.waitForTimeout(300);

    // Look for "Add Related" button
    const addRelatedButton = page.locator('button').filter({ hasText: /Add Related/i }).first();

    if (await addRelatedButton.isVisible()) {
      // Hover to show submenu
      await addRelatedButton.hover();
      await page.waitForTimeout(300);

      // Click first option in submenu
      const submenuOption = page.locator('button').filter({ hasNotText: /Add Related|Copy|Delete|Edit Field/i }).last();

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

          const finalErrors = consoleErrors.filter((e) =>
            e.includes("Couldn't create edge") || e.includes('error#008')
          );
          expect(finalErrors).toHaveLength(0);
        }
      }
    } else {
      // No "Add Related" available — this construct type doesn't have related constructs
      console.log('No "Add Related" option available for this construct type');
    }
  });
});
