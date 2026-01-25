import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Restore Default Schemas', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('should open restore defaults modal from settings menu', async () => {
    await carta.openRestoreDefaultsModal();
    await expect(carta.restoreDefaultsModal).toBeVisible();
    await expect(carta.page.getByRole('heading', { name: 'Restore default schemas' })).toBeVisible();
  });

  test('should close restore defaults modal on cancel', async () => {
    await carta.openRestoreDefaultsModal();
    await carta.closeRestoreDefaultsModalWithCancel();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();
  });

  test('should close restore defaults modal on backdrop click', async () => {
    await carta.openRestoreDefaultsModal();
    await carta.closeRestoreDefaultsModalWithBackdrop();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();
  });

  test('should show warning about overwriting existing schemas', async () => {
    await carta.openRestoreDefaultsModal();
    await expect(
      carta.page.getByText(/Existing schemas with matching types will be overwritten/)
    ).toBeVisible();
  });

  test('should restore defaults when confirm is clicked', async ({ page }) => {
    // Open the restore defaults modal and confirm
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // App should still be functional
    await expect(page.locator('[data-testid="settings-menu-button"]')).toBeVisible();

    // Verify schemas were restored by opening constructs tab
    await carta.openDrawerTab('constructs');
    await carta.waitForDrawerContent();

    const drawerContent = carta.getDrawerContent();
    await expect(drawerContent).toContainText('Constructs');
  });

  test('settings menu shows restore default schemas option', async () => {
    await carta.openSettingsMenu();
    await expect(
      carta.page.getByText('Restore Default Schemas')
    ).toBeVisible();
  });

  test('modal explains what restore defaults does', async () => {
    await carta.openRestoreDefaultsModal();

    // Check for informative text in the modal
    await expect(
      carta.page.getByText(/add any missing default schemas/)
    ).toBeVisible();

    // Should have cancel and restore buttons
    await expect(carta.restoreDefaultsCancelButton).toBeVisible();
    await expect(carta.restoreDefaultsConfirmButton).toBeVisible();
  });

  test('restore button is green/active in modal', async () => {
    await carta.openRestoreDefaultsModal();

    const restoreButton = carta.restoreDefaultsConfirmButton;
    // Check button has emerald/green styling by class or computed color
    const hasEmeraldClass = await restoreButton.evaluate((el) => {
      return el.className.includes('emerald');
    });

    expect(hasEmeraldClass).toBe(true);
  });

  test('closes settings menu after restore action', async () => {
    await carta.openSettingsMenu();
    await expect(carta.settingsMenu).toBeVisible();

    // Click on Restore Default Schemas
    await carta.page.getByText('Restore Default Schemas').click();
    await expect(carta.restoreDefaultsModal).toBeVisible();

    // Confirm restore
    await carta.confirmRestoreDefaults();

    // Settings menu should be closed
    await expect(carta.settingsMenu).not.toBeVisible();
  });

  test('preserves title when restoring defaults', async () => {
    // Get the initial title
    const initialTitle = await carta.getTitle();

    // Open and confirm restore
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Verify title is preserved
    const newTitle = await carta.getTitle();
    expect(newTitle).toBe(initialTitle);
  });

  test('can restore multiple times', async ({ page }) => {
    // First restore
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    await expect(carta.restoreDefaultsModal).not.toBeVisible();
    await page.waitForLoadState('networkidle');

    // Second restore
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // App should still be functional
    await expect(page.locator('[data-testid="settings-menu-button"]')).toBeVisible();
  });
});
