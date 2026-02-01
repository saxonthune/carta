import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for node editing behavior:
 * - Fields in expanded nodes can be clicked and edited
 * - Dragging only works from the header
 */
// TODO: Fix E2E tests — requires dev server in static mode with no stale server on port 5173
test.describe.skip('Node Editing', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();

    // Ensure we have schemas by restoring defaults
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await page.waitForTimeout(500);
  });

  test('should allow editing field values in expanded node', async ({ page }) => {
    // Create a node via context menu
    await carta.addNodeViaContextMenu('Database');

    // Find the node
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 10000 });

    // Double-click to expand the node
    await node.dblclick();
    await page.waitForTimeout(300);

    // Look for an enabled input field in the expanded node (skip the disabled ID field)
    const enabledInputs = node.locator('input[type="text"]:not([disabled])');
    const textareas = node.locator('textarea');

    let editableField = enabledInputs.first();
    if (!(await editableField.isVisible())) {
      editableField = textareas.first();
    }

    if (await editableField.isVisible()) {
      await editableField.click();
      await editableField.fill('Test Value');
      await expect(editableField).toHaveValue('Test Value');
    }
  });

  test('should only drag node from header area', async ({ page }) => {
    // Create a node
    await carta.addNodeViaContextMenu('Database');

    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 10000 });

    // Get initial position
    const initialBox = await node.boundingBox();
    expect(initialBox).not.toBeNull();

    // Double-click to expand
    await node.dblclick();
    await page.waitForTimeout(300);

    // Find the header with drag handle
    const header = node.locator('.node-drag-handle').first();
    await expect(header).toBeVisible();

    // Get fresh position after expand
    const beforeDragBox = await node.boundingBox();
    expect(beforeDragBox).not.toBeNull();

    // Drag from the header (should move the node)
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();

    if (headerBox && beforeDragBox) {
      const startX = headerBox.x + headerBox.width / 2;
      const startY = headerBox.y + headerBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const afterHeaderDragBox = await node.boundingBox();
      expect(afterHeaderDragBox).not.toBeNull();

      if (afterHeaderDragBox) {
        const headerXDiff = Math.abs(afterHeaderDragBox.x - beforeDragBox.x);
        expect(headerXDiff).toBeGreaterThan(50);
      }
    }
  });
});
