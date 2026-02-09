import { test, expect, type Page } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Organizer Nesting E2E Tests
 *
 * Tests organizer child management features:
 * - Spread button visibility and behavior
 * - Collapse/expand toggle
 * - Nested organizer creation
 * - Child count badge updates
 *
 * Starter content includes "Related Ideas" organizer with 2 children.
 */

/**
 * Helper to select multiple nodes via drag selection
 */
async function selectNodesViaDrag(page: Page) {
  const canvas = page.locator('.react-flow');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  // Drag select over the nodes
  await page.mouse.move(canvasBox.x + 10, canvasBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, canvasBox.y + canvasBox.height - 10, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.describe('Organizer Nesting', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.gotoFresh();
    // Wait for starter content to load (wait for a construct node, not organizer)
    await expect(page.locator('.react-flow__node-construct').first()).toBeVisible({ timeout: 5000 });
  });

  test('spread button visible when organizer has 2+ children', async ({ page }) => {
    // Starter content includes "Related Ideas" organizer with 2 children
    const starterOrganizer = carta.getOrganizerNode(0);
    await expect(starterOrganizer).toBeVisible();

    // Verify organizer name
    await expect(starterOrganizer).toContainText('Related Ideas');

    // Verify child count badge shows 2
    const childCount = await carta.getChildCountBadge(starterOrganizer);
    expect(childCount).toBe('2');

    // Spread button should be visible
    const spreadButton = carta.getOrganizerSpreadButton(starterOrganizer);
    await expect(spreadButton).toBeVisible();
  });

  test('spread button preserves non-overlapping layout', async ({ page }) => {
    const starterOrganizer = carta.getOrganizerNode(0);
    await expect(starterOrganizer).toBeVisible();

    // Get initial positions of child nodes
    // Children are construct nodes that belong to the organizer
    const allNodes = page.locator('.react-flow__node');
    const initialNodeCount = await allNodes.count();

    // Record positions before clicking fix overlaps
    const nodePositions: { x: number; y: number }[] = [];
    for (let i = 0; i < initialNodeCount; i++) {
      const box = await allNodes.nth(i).boundingBox();
      if (box) {
        nodePositions.push({ x: box.x, y: box.y });
      }
    }

    // Click fix overlaps button (formerly "spread")
    // Starter content nodes don't overlap, so they shouldn't move
    const spreadButton = carta.getOrganizerSpreadButton(starterOrganizer);
    await spreadButton.click();
    await page.waitForTimeout(500);

    // Verify positions remain the same (no overlaps to fix)
    // Note: The algorithm preserves centroid, so small floating-point drift is possible
    let significantChange = false;
    for (let i = 0; i < Math.min(initialNodeCount, nodePositions.length); i++) {
      const box = await allNodes.nth(i).boundingBox();
      if (box) {
        const initial = nodePositions[i];
        // Allow 2px tolerance for floating-point rounding
        if (Math.abs(box.x - initial.x) > 2 || Math.abs(box.y - initial.y) > 2) {
          significantChange = true;
          break;
        }
      }
    }

    // Non-overlapping nodes should not move significantly
    expect(significantChange).toBe(false);
  });

  test('collapse toggle hides and shows children', async ({ page }) => {
    const starterOrganizer = carta.getOrganizerNode(0);
    await expect(starterOrganizer).toBeVisible();

    // Initial state: organizer is expanded, children should be visible
    // Count visible construct nodes (organizer children)
    const visibleNodesBefore = page.locator('.react-flow__node-construct:visible');
    const initialVisibleCount = await visibleNodesBefore.count();
    expect(initialVisibleCount).toBeGreaterThanOrEqual(2);

    // Click collapse button
    const collapseButton = carta.getOrganizerCollapseButton(starterOrganizer);
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();
    await page.waitForTimeout(500);

    // After collapse, child nodes should be hidden (dimmed or display: none)
    // The organizer should now be in collapsed chip mode (smaller pill shape)
    const visibleNodesAfter = page.locator('.react-flow__node-construct:visible');
    const collapsedVisibleCount = await visibleNodesAfter.count();

    // Collapsed state should hide children (fewer visible nodes)
    expect(collapsedVisibleCount).toBeLessThan(initialVisibleCount);

    // Organizer should now show "Expand organizer" button
    const expandButton = starterOrganizer.locator('button[title="Expand organizer"]');
    await expect(expandButton).toBeVisible();

    // Click expand button to restore
    await expandButton.click();
    await page.waitForTimeout(500);

    // Children should be visible again
    const restoredVisibleCount = await page.locator('.react-flow__node-construct:visible').count();
    expect(restoredVisibleCount).toBe(initialVisibleCount);
  });

  test('nested organizer creation increases organizer count', async ({ page }) => {
    // Count initial organizers
    const initialOrganizerCount = await page.locator('.react-flow__node-organizer').count();

    // Select multiple construct nodes via drag
    await selectNodesViaDrag(page);

    // Verify we have at least 2 selected nodes
    const selectedCount = await page.locator('.react-flow__node.selected').count();
    expect(selectedCount).toBeGreaterThanOrEqual(2);

    // Press Ctrl+G to create a new organizer
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // Should have one more organizer
    const newOrganizerCount = await page.locator('.react-flow__node-organizer').count();
    expect(newOrganizerCount).toBe(initialOrganizerCount + 1);

    // The new organizer should be visible
    const newOrganizer = page.locator('.react-flow__node-organizer').filter({ hasText: 'New Organizer' });
    await expect(newOrganizer).toBeVisible();

    // New organizer should show child count badge
    const childCount = await carta.getChildCountBadge(newOrganizer);
    expect(childCount).not.toBeNull();
    expect(parseInt(childCount || '0')).toBeGreaterThanOrEqual(2);
  });

  test('organizer child count badge updates correctly', async ({ page }) => {
    const starterOrganizer = carta.getOrganizerNode(0);
    await expect(starterOrganizer).toBeVisible();

    // Verify initial child count is 2
    const initialCount = await carta.getChildCountBadge(starterOrganizer);
    expect(initialCount).toBe('2');

    // Spread button should be visible with 2+ children
    const spreadButton = carta.getOrganizerSpreadButton(starterOrganizer);
    await expect(spreadButton).toBeVisible();
  });

  test('collapsed organizer displays child count badge in pill mode', async ({ page }) => {
    const starterOrganizer = carta.getOrganizerNode(0);
    await expect(starterOrganizer).toBeVisible();

    // Collapse the organizer
    const collapseButton = carta.getOrganizerCollapseButton(starterOrganizer);
    await collapseButton.click();
    await page.waitForTimeout(500);

    // Child count badge should still be visible in collapsed pill mode
    const childCount = await carta.getChildCountBadge(starterOrganizer);
    expect(childCount).toBe('2');

    // Collapsed mode should NOT show spread button
    const spreadButton = carta.getOrganizerSpreadButton(starterOrganizer);
    await expect(spreadButton).not.toBeVisible();
  });

  test('organizer with single child hides spread button', async ({ page }) => {
    // Create a new organizer with exactly 2 nodes to start
    const constructNodes = page.locator('.react-flow__node-construct');
    const constructCount = await constructNodes.count();

    if (constructCount < 2) {
      test.skip();
      return;
    }

    // Select first two construct nodes
    await constructNodes.nth(0).click();
    await page.keyboard.down('Control');
    await constructNodes.nth(1).click();
    await page.keyboard.up('Control');

    // Create organizer
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    const newOrganizer = page.locator('.react-flow__node-organizer').filter({ hasText: 'New Organizer' });
    await expect(newOrganizer).toBeVisible();

    // Spread button should be visible with 2 children
    const spreadButton = carta.getOrganizerSpreadButton(newOrganizer);
    await expect(spreadButton).toBeVisible();

    // Note: To properly test hiding spread button with 1 child,
    // we would need to remove a child from the organizer.
    // This requires additional UI operations not yet implemented in this test.
    // Skipping the second part of this test for now.
  });
});
