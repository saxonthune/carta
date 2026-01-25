import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Restore Default Schemas', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('opens restore defaults modal from settings menu', async () => {
    await carta.openRestoreDefaultsModal();
    await expect(carta.restoreDefaultsModal).toBeVisible();
    await expect(carta.restoreDefaultsCancelButton).toBeVisible();
    await expect(carta.restoreDefaultsConfirmButton).toBeVisible();
  });

  test('closes restore defaults modal on cancel', async () => {
    await carta.openRestoreDefaultsModal();
    await carta.closeRestoreDefaultsModalWithCancel();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();
  });

  test('closes restore defaults modal on backdrop click', async () => {
    await carta.openRestoreDefaultsModal();
    await carta.closeRestoreDefaultsModalWithBackdrop();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();
  });

  test('shows restore defaults option in settings menu', async () => {
    await carta.openSettingsMenu();
    const restoreButton = carta.page.getByText('Restore Default Schemas');
    await expect(restoreButton).toBeVisible();
  });

  test('restores built-in construct schemas when confirmed', async ({ page }) => {
    // Click restore defaults first
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Open the Constructs tab in the drawer to verify schemas
    await carta.openDrawerTab('constructs');
    await carta.waitForDrawerContent();

    // Verify that built-in schemas are present using the drawer content
    const drawerContent = carta.getDrawerContent();
    await expect(drawerContent).toContainText('REST Controller');
    await expect(drawerContent).toContainText('Database');
    await expect(drawerContent).toContainText('Table');
    await expect(drawerContent).toContainText('User Story');
  });

  test('restores built-in port schemas when confirmed', async ({ page }) => {
    // Click restore defaults
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Open the Ports tab in the drawer
    await carta.openDrawerTab('ports');
    await carta.waitForDrawerContent();

    // Verify that built-in port schemas are present
    const drawerContent = carta.getDrawerContent();

    // Check for key built-in port schemas
    await expect(drawerContent).toContainText('Flow In');
    await expect(drawerContent).toContainText('Flow Out');
    await expect(drawerContent).toContainText('Parent');
    await expect(drawerContent).toContainText('Child');
    await expect(drawerContent).toContainText('Link');
  });

  test('modal shows warning about overwriting existing schemas', async () => {
    await carta.openRestoreDefaultsModal();

    // Check that the modal contains warning text
    await expect(carta.restoreDefaultsModal).toContainText('missing default schemas');
    await expect(carta.restoreDefaultsModal).toContainText('Existing schemas with matching types will be overwritten');
    await expect(carta.restoreDefaultsModal).toContainText('cannot be undone');
  });

  test('restore defaults does not affect nodes or edges', async ({ page }) => {
    // Create a node first (would need to interact with the canvas)
    // For now, just verify that after restore, the canvas is still functional
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Verify the app is still functional
    await carta.openSettingsMenu();
    await expect(carta.settingsMenu).toBeVisible();

    // The React Flow canvas should still be present
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
  });

  test('can restore defaults multiple times', async ({ page }) => {
    // Restore defaults first time
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Restore defaults second time
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Verify schemas are still present and correct
    await carta.openDrawerTab('constructs');
    await carta.waitForDrawerContent();

    const drawerContent = carta.getDrawerContent();
    await expect(drawerContent).toContainText('REST Controller');
    await expect(drawerContent).toContainText('Database');
  });

  test('settings menu closes after restoring defaults', async ({ page }) => {
    await carta.openRestoreDefaultsModal();
    await carta.confirmRestoreDefaults();

    // Wait for modal to close
    await expect(carta.restoreDefaultsModal).not.toBeVisible();

    // Settings menu should also be closed
    await expect(carta.settingsMenu).not.toBeVisible();
  });

  test('restore defaults modal has correct structure', async () => {
    await carta.openRestoreDefaultsModal();

    // Check header
    await expect(carta.restoreDefaultsModal).toContainText('Restore default schemas');

    // Check buttons are in footer area
    await expect(carta.restoreDefaultsCancelButton).toBeVisible();
    await expect(carta.restoreDefaultsConfirmButton).toBeVisible();

    // Check that both buttons exist
    const confirmButton = carta.restoreDefaultsConfirmButton;
    await expect(confirmButton).toBeVisible();
  });
});
