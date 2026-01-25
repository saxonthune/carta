import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Clear Functionality', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('opens clear modal from settings menu', async () => {
    await carta.openClearModal();
    await expect(carta.clearModal).toBeVisible();
    await expect(carta.clearCancelButton).toBeVisible();
    await expect(carta.clearInstancesButton).toBeVisible();
    await expect(carta.clearEverythingButton).toBeVisible();
  });

  test('closes clear modal on cancel', async () => {
    await carta.openClearModal();
    await carta.closeClearModalWithCancel();
    await expect(carta.clearModal).not.toBeVisible();
  });

  test('closes clear modal on backdrop click', async () => {
    await carta.openClearModal();
    await carta.closeClearModalWithBackdrop();
    await expect(carta.clearModal).not.toBeVisible();
  });

  test('preserves title after clear instances', async ({ page }) => {
    // Get the initial title
    const initialTitle = await carta.getTitle();

    await carta.openClearModal();
    await carta.clearInstances();

    // Wait for page reload
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="settings-menu-button"]');

    // Verify title is preserved
    const newTitle = await carta.getTitle();
    expect(newTitle).toBe(initialTitle);
  });

  test('preserves title after clear everything', async ({ page }) => {
    // Get the initial title
    const initialTitle = await carta.getTitle();

    await carta.openClearModal();
    await carta.clearEverything();

    // Wait for page reload
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="settings-menu-button"]');

    // Verify title is preserved
    const newTitle = await carta.getTitle();
    expect(newTitle).toBe(initialTitle);
  });

  test('handles clearing empty document', async ({ page }) => {
    // Document should be empty by default in fresh state
    await carta.openClearModal();
    await carta.clearInstances();

    // Wait for page reload - should not throw errors
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="settings-menu-button"]');

    // App should still be functional
    await carta.openSettingsMenu();
    await expect(carta.settingsMenu).toBeVisible();
  });

  test('clear modal shows correct options', async () => {
    await carta.openClearModal();

    // Verify the modal content
    await expect(carta.page.getByText('Clear workspace')).toBeVisible();
    // Use test-id selectors to avoid matching description text
    await expect(carta.clearInstancesButton).toBeVisible();
    await expect(carta.clearEverythingButton).toBeVisible();
    await expect(carta.clearCancelButton).toBeVisible();
  });

  test('settings menu shows clear option', async () => {
    await carta.openSettingsMenu();
    await expect(carta.settingsClearButton).toBeVisible();
    await expect(carta.settingsClearButton).toHaveText('Clear');
  });
});
