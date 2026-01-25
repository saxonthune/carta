import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Clear Functionality - Schema Groups UI', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('schema groups tab should show empty state after clearing everything', async ({ page }) => {
    // First, navigate to the Groups tab to verify initial state
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    const drawerContent = carta.getDrawerContent();

    // Initially should have built-in groups (software architecture, etc.)
    await expect(drawerContent).toContainText('Software Architecture');

    // Close drawer before opening settings menu (backdrop blocks clicks)
    await carta.closeDrawer();

    // Now clear everything
    await carta.openClearModal();
    await carta.clearEverything();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Wait a moment for Yjs to propagate changes
    await page.waitForTimeout(300);

    // Re-open the Groups tab to verify empty state
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    // Should now show "No schema groups" message (empty message from CollapsibleSelector)
    await expect(drawerContent).toContainText('No schema groups');

    // Verify Software Architecture group is gone
    await expect(drawerContent).not.toContainText('Software Architecture');
  });

  test('schema groups tab should preserve groups when clearing only instances', async ({ page }) => {
    // Navigate to the Groups tab
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    const drawerContent = carta.getDrawerContent();

    // Verify Software Architecture group exists initially
    await expect(drawerContent).toContainText('Software Architecture');

    // Close drawer before opening settings menu
    await carta.closeDrawer();

    // Clear only instances
    await carta.openClearModal();
    await carta.clearInstances();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Re-open Groups tab to verify groups preserved
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    // Verify Groups tab still has groups
    await expect(drawerContent).toContainText('Software Architecture');

    // Should NOT show empty state message
    await expect(drawerContent).not.toContainText('No schema groups');
  });

  test('clear everything and restore defaults should restore schema groups', async ({ page }) => {
    // Navigate to the Groups tab
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    const drawerContent = carta.getDrawerContent();

    // Verify Software Architecture group exists initially
    await expect(drawerContent).toContainText('Software Architecture');

    // Close drawer before opening settings menu
    await carta.closeDrawer();

    // Clear everything and restore defaults
    await carta.clearAndRestoreDefaults();

    // Wait for the modal to close
    await expect(carta.clearModal).not.toBeVisible();

    // Wait for Yjs to propagate changes
    await page.waitForTimeout(300);

    // Re-open Groups tab to verify groups restored
    await carta.openDrawerTab('groups');
    await carta.waitForDrawerContent();

    // Verify Groups tab has groups again
    await expect(drawerContent).toContainText('Software Architecture');
    await expect(drawerContent).toContainText('Database');
    await expect(drawerContent).toContainText('API');
    await expect(drawerContent).toContainText('UI');
  });
});
