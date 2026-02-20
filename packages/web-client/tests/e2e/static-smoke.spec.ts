import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Static build smoke test.
 *
 * Runs against the production build (vite preview) to verify
 * the static/demo mode app loads and renders without crashing.
 */
test.describe('Static Build Smoke', () => {
  test('app loads and renders canvas', async ({ page }) => {
    const carta = new CartaPage(page);
    await carta.gotoFresh();

    // Canvas should be visible
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Settings button should be accessible (app chrome loaded)
    await expect(page.getByTestId('settings-menu-button')).toBeVisible();
  });

  test('starter content renders with nodes and edges', async ({ page }) => {
    const carta = new CartaPage(page);
    await carta.gotoFresh();

    // Wait for canvas
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Should have construct nodes (starter document)
    const constructNodes = page.locator('.react-flow__node-construct');
    await expect(constructNodes.first()).toBeVisible({ timeout: 5000 });
    const nodeCount = await constructNodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Should have edges
    const edges = page.locator('.react-flow__edge');
    await expect(edges.first()).toBeVisible({ timeout: 5000 });
  });

  test('no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const carta = new CartaPage(page);
    await carta.gotoFresh();

    // Wait for app to fully load
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000); // Let async init settle

    // Filter out known benign errors (e.g., favicon 404, service worker)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('service-worker') &&
      !e.includes('Failed to load resource') // network requests expected to fail in static mode
    );

    expect(criticalErrors).toEqual([]);
  });
});
