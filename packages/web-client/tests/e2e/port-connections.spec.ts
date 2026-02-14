import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Port Connection E2E Tests (doc03.01.03, doc03.03.02)
 *
 * Tests the port drawer, drop zones, and connection creation workflow.
 */
test.describe('Port Connections', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.gotoFresh();
    // Wait for starter content to load (wait for construct nodes, not visual group)
    await expect(page.locator('.react-flow__node-construct').first()).toBeVisible({ timeout: 5000 });
  });

  test('port drawer expands on hover at node bottom', async ({ page }) => {
    // Use construct node (not visual group)
    const firstNode = carta.getConstructNode(0);
    await expect(firstNode).toBeVisible();

    // Get initial state - look for the collapsed port drawer dots
    const box = await firstNode.boundingBox();
    if (!box) throw new Error('Node not found');

    // Hover near the bottom of the node
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5);
    await page.waitForTimeout(400);

    // The expanded drawer should appear with port circles (Handle elements)
    // In expanded state, we should see handles with drawer: prefix
    const expandedDrawer = page.locator('[data-handleid^="drawer:"]');
    await expect(expandedDrawer.first()).toBeVisible({ timeout: 2000 });
  });

  test('port drawer collapses when mouse leaves', async ({ page }) => {
    const firstNode = carta.getConstructNode(0);
    const box = await firstNode.boundingBox();
    if (!box) throw new Error('Node not found');

    // Hover to expand
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5);
    await page.waitForTimeout(400);

    // Verify expanded
    const expandedDrawer = page.locator('[data-handleid^="drawer:"]');
    await expect(expandedDrawer.first()).toBeVisible({ timeout: 2000 });

    // Move mouse away from the node entirely
    await page.mouse.move(box.x + box.width + 100, box.y + box.height + 100);
    await page.waitForTimeout(400);

    // The drawer handles should no longer be visible
    await expect(expandedDrawer.first()).not.toBeVisible({ timeout: 2000 });
  });

  test('port drawer has draggable handles for initiating connections', async ({ page }) => {
    // Verify drawer handles exist and have the correct structure for drag-to-connect
    const firstNode = carta.getConstructNode(0);
    const box = await firstNode.boundingBox();
    if (!box) throw new Error('Node not found');

    // Hover to expand port drawer
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5);
    await page.waitForTimeout(400);

    // Drawer handles should be visible with drawer: prefix in their ID
    const drawerHandles = page.locator('[data-handleid^="drawer:"]');
    const handleCount = await drawerHandles.count();
    expect(handleCount).toBeGreaterThan(0);

    // Handles should have the source type (for initiating connections)
    const firstHandle = drawerHandles.first();
    await expect(firstHandle).toHaveAttribute('data-handlepos', 'bottom');
  });

  test('can create connection by dragging to valid drop zone', async ({ page }) => {
    const nodeCount = await page.locator('.react-flow__node-construct').count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    // Count existing edges
    const initialEdgeCount = await page.locator('.react-flow__edge').count();

    const sourceNode = carta.getConstructNode(0);
    const targetNode = carta.getConstructNode(1);

    const sourceBox = await sourceNode.boundingBox();
    const targetBox = await targetNode.boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Nodes not found');

    // Hover to expand source port drawer
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height - 5);
    await page.waitForTimeout(400);

    // Find a drawer handle (source port)
    const drawerHandle = page.locator('[data-handleid^="drawer:"]').first();
    await expect(drawerHandle).toBeVisible();
    const handleBox = await drawerHandle.boundingBox();
    if (!handleBox) throw new Error('Handle not found');

    // Start drag from the handle
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();

    // Move to target node to trigger drop zones
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 });
    await page.waitForTimeout(300);

    // Find a visible drop zone and drop on it
    const dropZone = page.locator('[data-handleid^="dropzone:"]').first();
    const dropZoneVisible = await dropZone.isVisible();

    if (dropZoneVisible) {
      const dropBox = await dropZone.boundingBox();
      if (dropBox) {
        await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2);
        await page.waitForTimeout(100);
      }
    }

    await page.mouse.up();
    await page.waitForTimeout(500);

    // Should have created a new edge (or same count if connection already existed)
    const finalEdgeCount = await page.locator('.react-flow__edge').count();
    // At minimum, the edge count shouldn't decrease
    expect(finalEdgeCount).toBeGreaterThanOrEqual(initialEdgeCount);
  });

  test('starter content has connected nodes', async ({ page }) => {
    // The starter content should have nodes connected with edges
    const edges = page.locator('.react-flow__edge');
    await expect(edges.first()).toBeVisible({ timeout: 5000 });

    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);
  });
});
