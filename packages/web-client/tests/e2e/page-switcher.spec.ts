import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Page Switcher E2E Tests
 *
 * Verifies page switching UI interactions end-to-end.
 * Tests cover trigger bar, dropdown, page creation, switching, and renaming.
 */
test.describe('Page Switcher', () => {
  let cartaPage: CartaPage;

  test.beforeEach(async ({ page }) => {
    cartaPage = new CartaPage(page);
    await cartaPage.goto();
  });

  test('should display page name in trigger bar', async ({ page }) => {
    // Wait for canvas to be ready
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // The page switcher should show the default "Main" page name
    const pageName = await cartaPage.getCurrentPageName();
    expect(pageName).toBe('Main');
  });

  test('should open dropdown and show page list', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Open the page dropdown
    await cartaPage.openPageDropdown();

    // Verify the dropdown is visible (contains page rows)
    const pageRows = await cartaPage.getPageRows();
    const count = await pageRows.count();
    expect(count).toBeGreaterThan(0);

    // Should show "New Page" button
    const newPageButton = page.getByText('+ New Page');
    await expect(newPageButton).toBeVisible();
  });

  test('should create a new page', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Open dropdown
    await cartaPage.openPageDropdown();

    // Click "New Page"
    const newPageButton = page.getByText('+ New Page');
    await newPageButton.click();

    // Wait for dropdown to close and new page to appear
    await page.waitForTimeout(500);

    // Open dropdown again to verify new page
    await cartaPage.openPageDropdown();
    const pageRows = await cartaPage.getPageRows();
    const count = await pageRows.count();
    expect(count).toBe(2); // Original "Main" + new page
  });

  test('should switch active page', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Create a second page first
    await cartaPage.openPageDropdown();
    const newPageButton = page.getByText('+ New Page');
    await newPageButton.click();
    await page.waitForTimeout(500);

    // Verify we're on "Page 2" (newly created pages auto-switch)
    let currentName = await cartaPage.getCurrentPageName();
    expect(currentName).toBe('Page 2');

    // Open dropdown and click on "Main" to switch back
    await cartaPage.openPageDropdown();
    const pageRows = await cartaPage.getPageRows();

    // Find and click the "Main" page row (not the trigger bar)
    const mainPageRow = pageRows.filter({ hasText: 'Main' }).first();
    await mainPageRow.click();

    // Wait for dropdown to close
    await page.waitForTimeout(500);

    // Verify we switched to "Main"
    currentName = await cartaPage.getCurrentPageName();
    expect(currentName).toBe('Main');
  });

  test('should rename a page via inline edit', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Click the page name to enter rename mode
    const pageName = cartaPage.getPageSwitcherTrigger().getByText('Main');
    await pageName.click();

    // Should show an input
    const input = cartaPage.getPageSwitcherTrigger().locator('input[value="Main"]');
    await expect(input).toBeVisible();

    // Type new name and press Enter
    await input.fill('Renamed Page');
    await input.press('Enter');

    // Wait for update
    await page.waitForTimeout(500);

    // Verify the name changed
    const newName = await cartaPage.getCurrentPageName();
    expect(newName).toBe('Renamed Page');
  });
});
