import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * New User Experience (doc03.01.13)
 *
 * First-time visitors in local mode should land directly on a canvas
 * with starter content — no document browser modal, no blank canvas.
 * The starter content demonstrates the core interaction: typed nodes
 * connected by edges.
 */
test.describe('New User Experience', () => {
  test.beforeEach(async ({ page }) => {
    const carta = new CartaPage(page);
    // Clear all state to simulate a true first visit
    await carta.gotoFresh();
  });

  test('first visit lands on canvas, not document browser', async ({ page }) => {
    // The canvas (React Flow) should be visible — no modal gate
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // The document browser modal should NOT be shown
    const modalHeading = page.getByRole('heading', { name: 'Select a Document' });
    await expect(modalHeading).not.toBeVisible();

    // The settings button should be accessible (app chrome loaded)
    await expect(page.getByTestId('settings-menu-button')).toBeVisible();
  });

  test('starter content has nodes on first visit', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Should have at least 3 construct nodes (the starter graph)
    const constructNodes = page.locator('.react-flow__node-construct');
    await expect(constructNodes.first()).toBeVisible({ timeout: 5000 });
    const count = await constructNodes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Should also have an organizer
    const groupNodes = page.locator('.react-flow__node-organizer');
    await expect(groupNodes.first()).toBeAttached({ timeout: 2000 });
  });

  test('starter content has edges connecting the nodes', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Wait for construct nodes to render first
    await expect(page.locator('.react-flow__node-construct').first()).toBeVisible({ timeout: 5000 });

    // Should have at least 2 edges connecting starter nodes
    const edges = page.locator('.react-flow__edge');
    await expect(edges.first()).toBeVisible({ timeout: 5000 });
    const count = await edges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('starter nodes are interactive (can be selected)', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Find a construct node and click it to select.
    // The starter content has 3 note nodes - at least one should be selectable.
    const constructNodes = page.locator('.react-flow__node-construct');
    await expect(constructNodes.first()).toBeVisible({ timeout: 5000 });

    // Click directly on the node — use force to bypass any parent intercepts
    await constructNodes.first().click({ force: true });

    // Wait for any node to get selected — this tests that selection works in general
    const selectedNode = page.locator('.react-flow__node.selected');
    await expect(selectedNode).toBeAttached({ timeout: 3000 });
  });

  test('document persists across page reloads', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get the initial node count
    const nodes = page.locator('.react-flow__node');
    const initialCount = await nodes.count();
    expect(initialCount).toBeGreaterThan(0);

    // Reload the page
    await page.reload();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Same document should be restored (same node count)
    const reloadedCount = await nodes.count();
    expect(reloadedCount).toBe(initialCount);
  });

  test('returning visit reopens last document', async ({ page }) => {
    const carta = new CartaPage(page);

    // First: get to the canvas
    await carta.goto();
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get initial node count to verify same document
    const nodes = page.locator('.react-flow__node');
    const initialCount = await nodes.count();

    // Navigate away and back (go to root)
    await page.goto('/');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Should be the same document (same node count)
    const returnCount = await nodes.count();
    expect(returnCount).toBe(initialCount);
  });
});
