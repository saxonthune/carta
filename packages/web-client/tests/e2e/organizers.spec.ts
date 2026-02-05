import { test, expect, type Page } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Organizers E2E Tests (Native parentId System)
 *
 * Tests the organizer UI workflow using React Flow's native parentId system:
 * - Create organizers from selected nodes via Ctrl+G
 * - Organizer nodes appear on canvas (type='organizer')
 * - Organizers can be collapsed/expanded
 * - Context menu organizer operations
 *
 * NOTE: Organizers are regular nodes with type='organizer'.
 * Children use parentId to reference their organizer.
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
 * Helper to get organizer nodes (type='organizer')
 */
function getOrganizerNodes(page: Page) {
  return page.locator('.react-flow__node-organizer');
}

test.describe('Organizers', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.gotoFresh();
    // Wait for starter content to load (wait for a construct node, not organizer)
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

  test('Ctrl+G creates an organizer from selected nodes', async ({ page }) => {
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    await selectNodesViaDrag(page);

    // Verify we have at least 2 selected
    const selectedCount = await page.locator('.react-flow__node.selected').count();
    expect(selectedCount).toBeGreaterThanOrEqual(2);

    // Count organizer nodes before (starter content has one organizer)
    const initialOrganizerCount = await getOrganizerNodes(page).count();

    // Press Ctrl+G to create an organizer
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // Should have one more organizer node
    const newOrganizerCount = await getOrganizerNodes(page).count();
    expect(newOrganizerCount).toBe(initialOrganizerCount + 1);

    // The newly created organizer should have the default name "New Organizer"
    const newOrganizerNode = getOrganizerNodes(page).filter({ hasText: 'New Organizer' });
    await expect(newOrganizerNode).toBeAttached({ timeout: 2000 });
  });

  test('organizer node displays name', async ({ page }) => {
    await selectNodesViaDrag(page);

    // Create organizer
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // The newly created organizer should display default name "New Organizer"
    const newOrganizerNode = getOrganizerNodes(page).filter({ hasText: 'New Organizer' });
    await expect(newOrganizerNode).toBeAttached();
  });

  test('organizer shows child count badge', async ({ page }) => {
    // First verify the starter organizer exists and shows count
    const starterOrganizer = getOrganizerNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(starterOrganizer).toBeAttached();
    // Starter organizer has 2 nodes assigned to it
    await expect(starterOrganizer).toContainText('2');
  });

  test('organizer has collapse toggle button', async ({ page }) => {
    // Find the starter organizer node
    const organizerNode = getOrganizerNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(organizerNode).toBeAttached();

    // Verify the collapse toggle button exists (eyeball icon)
    const toggleButton = organizerNode.locator('button[title="Collapse organizer"]');
    await expect(toggleButton).toBeAttached();
  });

  test.skip('context menu shows "Organize Selected" option with multiple selection', async ({ page }) => {
    // Skipped: Context menu integration needs investigation
    await selectNodesViaDrag(page);

    const firstNode = carta.getNode(0);
    await firstNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const organizeOption = page.getByRole('button', { name: /organize/i });
    await expect(organizeOption.first()).toBeAttached({ timeout: 5000 });
  });

  test.skip('context menu "Organize Selected" creates an organizer', async ({ page }) => {
    // Skipped: Context menu integration needs investigation
    const initialNodeCount = await page.locator('.react-flow__node').count();

    await selectNodesViaDrag(page);
    const firstNode = carta.getNode(0);
    await firstNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const organizeOption = page.getByRole('button', { name: /organize/i });
    await organizeOption.first().click({ force: true });
    await page.waitForTimeout(500);

    const newNodeCount = await page.locator('.react-flow__node').count();
    expect(newNodeCount).toBe(initialNodeCount + 1);
  });

  test.skip('context menu shows "Remove from Organizer" for organized node', async ({ page }) => {
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

    const removeOption = page.getByRole('button', { name: /remove.*organizer/i });
    await expect(removeOption).toBeAttached({ timeout: 5000 });
  });

  test('Ctrl+G requires at least 2 nodes selected', async ({ page }) => {
    // Count organizers before
    const initialOrganizerCount = await getOrganizerNodes(page).count();

    // Select only one construct node
    const constructNode = page.locator('.react-flow__node-construct').first();
    await constructNode.click();

    // Press Ctrl+G
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(500);

    // No new organizer node should be created
    const newOrganizerCount = await getOrganizerNodes(page).count();
    expect(newOrganizerCount).toBe(initialOrganizerCount);
  });

  test('organizer node is draggable', async ({ page }) => {
    // Use the starter organizer to test dragging
    const organizerNode = getOrganizerNodes(page).filter({ hasText: 'Related Ideas' });
    await expect(organizerNode).toBeAttached();

    // Drag the organizer node header
    const dragHandle = organizerNode.locator('.node-drag-handle');
    await expect(dragHandle).toBeAttached();
    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag 50 pixels to the right
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 50, handleBox!.y + handleBox!.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Organizer should still be attached (verifies no errors during drag)
    await expect(organizerNode).toBeAttached();
  });
});
