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

    // Should have at least 2 nodes (the starter graph)
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('starter content has edges connecting the nodes', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Wait for nodes to render first
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 });

    // Should have at least 1 edge connecting starter nodes
    const edges = page.locator('.react-flow__edge');
    await expect(edges.first()).toBeVisible({ timeout: 5000 });
    const count = await edges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('starter nodes are interactive (can be selected)', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const firstNode = page.locator('.react-flow__node').first();
    await expect(firstNode).toBeVisible({ timeout: 5000 });

    // Click the node header (drag handle area) to select it
    const header = firstNode.locator('.node-drag-handle').first();
    if (await header.isVisible()) {
      await header.click();
    } else {
      await firstNode.click();
    }

    // Selected nodes get the "selected" class in React Flow
    await expect(firstNode).toHaveClass(/selected/, { timeout: 3000 });
  });

  test('URL has ?doc= param after first visit', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // URL should contain a document ID for persistence
    expect(page.url()).toContain('?doc=');
  });

  test('returning visit reopens last document', async ({ page }) => {
    const carta = new CartaPage(page);

    // First: get to the canvas (create document if needed via current flow)
    await carta.goto();
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Capture the document URL
    const firstUrl = page.url();
    expect(firstUrl).toContain('?doc=');

    // Reload from root (no ?doc= param) — should redirect back
    await page.goto('/');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('?doc=');
  });
});
