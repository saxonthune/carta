import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Tests for Clear Everything with IndexedDB persistence
 * These tests verify that clearing actually persists to IndexedDB
 * and that the UI properly reflects the cleared state
 */
test.describe('Clear Everything Persistence', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('should clear schemas and show empty state in UI', async ({ page }) => {
    // First verify schemas exist in the Constructs tab
    await carta.switchDockTab('constructs');
    await page.waitForTimeout(300);

    // Should have built-in schemas visible
    await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();

    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Verify schemas are cleared - the button should not exist
    await carta.switchDockTab('constructs');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'REST Controller' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Database' })).not.toBeVisible();
  });

  test('should clear port schemas and show empty state in UI', async ({ page }) => {
    // First verify port schemas exist
    await carta.switchDockTab('ports');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Flow In' })).toBeVisible();

    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Switch to Ports tab and verify cleared
    await carta.switchDockTab('ports');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Flow In' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Flow Out' })).not.toBeVisible();
  });

  test('should clear schema groups and show empty state in UI', async ({ page }) => {
    // First verify schema groups exist
    await carta.switchDockTab('groups');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Software Architecture' })).toBeVisible();

    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Switch to Groups tab and verify cleared
    await carta.switchDockTab('groups');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Software Architecture' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Database' }).first()).not.toBeVisible();
  });

  test('cleared state should persist after page reload', async ({ page }) => {
    // Clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu-button"]');

    // Verify schemas are still cleared (not re-seeded)
    await carta.switchDockTab('constructs');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'REST Controller' })).not.toBeVisible();
  });

  test('restore defaults after clear should bring back schemas', async ({ page }) => {
    // First clear everything
    await carta.openClearModal();
    await carta.clearEverything();
    await page.waitForTimeout(500);

    // Verify cleared
    await carta.switchDockTab('constructs');
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'REST Controller' })).not.toBeVisible();

    // Now restore defaults
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await page.waitForTimeout(500);

    // Verify schemas are back
    await carta.switchDockTab('constructs');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'REST Controller' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Database' }).first()).toBeVisible();
  });
});
