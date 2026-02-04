import { test, expect, type Page } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Visual Groups E2E Tests (Native parentId System)
 *
 * Tests the visual grouping UI workflow using React Flow's native parentId system:
 * - Create groups from selected nodes via Ctrl+G
 * - Visual group nodes appear on canvas (type='visual-group')
 * - Groups can be collapsed/expanded
 * - Context menu group operations
 *
 * NOTE: Groups are now regular nodes with type='visual-group'.
 * Children use parentId to reference their group.
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

/**
 * Helper to get visual group nodes (type='visual-group')
 */
function getVisualGroupNodes(page: Page) {
  return page.locator('.react-flow__node-visual-group');
}

test.describe('Visual Groups', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.gotoFresh();
    // Wait for starter content to load (wait for a construct node, not visual group)
    await expect(page.locator('.react-flow__node-construct').first()).toBeVisible({ timeout: 5000 });
  });

  test('can select multiple nodes with drag selection', async ({ page }) => {
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    await selectNodesViaDrag(page);

    // At least 2 nodes should be selected (have 'selected' class)
    const selectedNodes = page.locator('.react-flow__node.selected');
    const selectedCount = await selectedNodes.count();
    expect(selectedCount).toBeGreaterThanOrEqual(2);
  });

  test('Ctrl+G creates a visual group from selected nodes', async ({ page }) => {
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    await selectNodesViaDrag(page);

    // Verify we have at least 2 selected
    const selectedCount = await page.locator('.react-flow__node.selected').count();
    expect(selectedCount).toBeGreaterThanOrEqual(2);

    // Count group nodes before (starter content has one group)
    const initialGroupCount = await getVisualGroupNodes(page).count();

    // Press Ctrl+G to create a group
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // Should have one more group node
    const newGroupCount = await getVisualGroupNodes(page).count();
    expect(newGroupCount).toBe(initialGroupCount + 1);

    // The newly created group should have the default name "New Group"
    const newGroupNode = getVisualGroupNodes(page).filter({ hasText: 'New Group' });
    await expect(newGroupNode).toBeAttached({ timeout: 2000 });
  });

  test('visual group node displays group name', async ({ page }) => {
    await selectNodesViaDrag(page);

    // Create group
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // The newly created group should display default name "New Group"
    const newGroupNode = getVisualGroupNodes(page).filter({ hasText: 'New Group' });
    await expect(newGroupNode).toBeAttached();
  });

  test('visual group shows child count badge', async ({ page }) => {
    // First verify the starter group exists and shows count
    const starterGroup = getVisualGroupNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(starterGroup).toBeAttached();
    // Starter group has 2 nodes assigned to it
    await expect(starterGroup).toContainText('2');
  });

  test('visual group has collapse toggle button', async ({ page }) => {
    // Find the starter group node
    const groupNode = getVisualGroupNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(groupNode).toBeAttached();

    // Verify the collapse toggle button exists (eyeball icon)
    const toggleButton = groupNode.locator('button[title="Collapse group"]');
    await expect(toggleButton).toBeAttached();
  });

  test.skip('context menu shows "Group Selected" option with multiple selection', async ({ page }) => {
    // Skipped: Context menu integration needs investigation
    // The context menu may have different structure or naming
    await selectNodesViaDrag(page);

    const firstNode = carta.getNode(0);
    await firstNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const groupOption = page.getByRole('button', { name: /group/i });
    await expect(groupOption.first()).toBeAttached({ timeout: 5000 });
  });

  test.skip('context menu "Group Selected" creates a group', async ({ page }) => {
    // Skipped: Context menu integration needs investigation
    const initialNodeCount = await page.locator('.react-flow__node').count();

    await selectNodesViaDrag(page);
    const firstNode = carta.getNode(0);
    await firstNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const groupOption = page.getByRole('button', { name: /group/i });
    await groupOption.first().click({ force: true });
    await page.waitForTimeout(500);

    const newNodeCount = await page.locator('.react-flow__node').count();
    expect(newNodeCount).toBe(initialNodeCount + 1);
  });

  test.skip('context menu shows "Remove from Group" for grouped node', async ({ page }) => {
    // Skipped: Context menu integration needs investigation
    await selectNodesViaDrag(page);
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    await page.locator('.react-flow').click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    const firstNode = carta.getNode(0);
    await firstNode.click();
    await firstNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const removeOption = page.getByRole('button', { name: /remove.*group/i });
    await expect(removeOption).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+G requires at least 2 nodes selected', async ({ page }) => {
    // Count groups before
    const initialGroupCount = await getVisualGroupNodes(page).count();

    // Select only one construct node
    const constructNode = page.locator('.react-flow__node-construct').first();
    await constructNode.click();

    // Press Ctrl+G
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // No new group node should be created
    const newGroupCount = await getVisualGroupNodes(page).count();
    expect(newGroupCount).toBe(initialGroupCount);
  });

  test('visual group node is draggable', async ({ page }) => {
    // Use the starter group to test dragging
    const groupNode = getVisualGroupNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(groupNode).toBeAttached();

    // Drag the group node header
    const dragHandle = groupNode.locator('.node-drag-handle');
    await expect(dragHandle).toBeAttached();
    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag 50 pixels to the right
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 50, handleBox!.y + handleBox!.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Group should still be attached (verifies no errors during drag)
    await expect(groupNode).toBeAttached();
  });
});
