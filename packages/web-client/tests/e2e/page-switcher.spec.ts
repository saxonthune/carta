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

    // The page switcher should show the starter page name
    const pageName = await cartaPage.getCurrentPageName();
    expect(pageName).toBe('Starter');
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

    // Get initial page count
    await cartaPage.openPageDropdown();
    const initialPageRows = await cartaPage.getPageRows();
    const initialCount = await initialPageRows.count();

    // Click "New Page"
    const newPageButton = page.getByText('+ New Page');
    await newPageButton.click();

    // Wait for dropdown to close and new page to appear
    await page.waitForTimeout(500);

    // Open dropdown again to verify new page was created
    await cartaPage.openPageDropdown();
    const pageRows = await cartaPage.getPageRows();
    const newCount = await pageRows.count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should switch active page', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get the initial page name
    const initialName = await cartaPage.getCurrentPageName();

    // Create a second page
    await cartaPage.openPageDropdown();
    const newPageButton = page.getByText('+ New Page');
    await newPageButton.click();
    await page.waitForTimeout(1000);

    // Open dropdown and verify we have 2 pages now
    await cartaPage.openPageDropdown();
    const pageRows = await cartaPage.getPageRows();
    const count = await pageRows.count();
    expect(count).toBeGreaterThan(1);

    // Find a page row that's not the current page and click it
    const allRows = await pageRows.all();
    let targetRow = null;
    for (const row of allRows) {
      const text = await row.textContent();
      if (text && !text.includes(initialName)) {
        targetRow = row;
        break;
      }
    }

    if (targetRow) {
      await targetRow.click();
      await page.waitForTimeout(500);

      // Verify we switched pages
      const currentName = await cartaPage.getCurrentPageName();
      expect(currentName).not.toBe(initialName);
    }
  });

  test('should rename a page via overflow menu', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get the current page name
    const initialName = await cartaPage.getCurrentPageName();

    // Open the page dropdown
    await cartaPage.openPageDropdown();

    // Find a page row with the initial name
    const pageRows = await cartaPage.getPageRows();
    const allRows = await pageRows.all();
    let targetRow = null;
    for (const row of allRows) {
      const text = await row.textContent();
      if (text && text.includes(initialName)) {
        targetRow = row;
        break;
      }
    }

    expect(targetRow).not.toBeNull();

    // Hover over the row to reveal the overflow menu button (...)
    await targetRow!.hover();
    await page.waitForTimeout(300);

    // Find and click the overflow menu button (has 3 vertical dots)
    const overflowButton = targetRow!.locator('button[title="Page actions"]');
    await overflowButton.click();
    await page.waitForTimeout(300);

    // Click "Rename" in the popover menu
    const renameButton = page.getByText('Rename');
    await renameButton.click();
    await page.waitForTimeout(300);

    // The input should now be visible in the row
    const input = page.locator('input[value="' + initialName + '"]');
    await expect(input).toBeVisible();

    // Clear and type new name, then press Enter
    await input.fill('Renamed Page');
    await page.keyboard.press('Enter');

    // Wait for update
    await page.waitForTimeout(500);

    // Close the dropdown by clicking elsewhere or pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify the name changed
    const newName = await cartaPage.getCurrentPageName();
    expect(newName).toBe('Renamed Page');
  });
});
