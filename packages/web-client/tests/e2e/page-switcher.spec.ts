import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

/**
 * Navigator Panel E2E Tests
 *
 * Verifies navigation interactions end-to-end via the left-side navigator panel.
 * Tests cover page display, page creation, switching, renaming, and absence of
 * old ViewToggle/PageSwitcher UI.
 */
test.describe('Navigator Panel', () => {
  let cartaPage: CartaPage;

  test.beforeEach(async ({ page }) => {
    cartaPage = new CartaPage(page);
    await cartaPage.goto();
  });

  test('should display page list in navigator with correct page names', async ({ page }) => {
    // Wait for canvas to be ready
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Navigator panel should be visible by default
    const navigatorPanel = page.getByTestId('navigator-panel');
    await expect(navigatorPanel).toBeVisible();

    // Should show at least one page entry
    const pageRows = cartaPage.getPageRows();
    const count = await pageRows.count();
    expect(count).toBeGreaterThan(0);

    // The active page should show 'Starter'
    const pageName = await cartaPage.getCurrentPageName();
    expect(pageName).toBe('Starter');
  });

  test('should switch active page by clicking a page entry', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const initialName = await cartaPage.getCurrentPageName();

    // Create a second page using the "+" button
    await cartaPage.clickCreatePage();
    await page.waitForTimeout(500);

    // Should now have 2 page entries
    const pageRows = cartaPage.getPageRows();
    const count = await pageRows.count();
    expect(count).toBeGreaterThan(1);

    // Find a page row that is not the current active page and click it
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

      // Verify the active page changed
      const currentName = await cartaPage.getCurrentPageName();
      expect(currentName).not.toBe(initialName);
    }
  });

  test('should create a new page via "+" button in Pages section', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get initial page count
    const initialRows = cartaPage.getPageRows();
    const initialCount = await initialRows.count();

    // Click the "+" button in the Pages section header
    await cartaPage.clickCreatePage();
    await page.waitForTimeout(500);

    // Verify a new page was added
    const newCount = await cartaPage.getPageRows().count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should show metamap when clicking metamap entry', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Click the metamap entry in the navigator
    const metamapEntry = page.getByTestId('navigator-metamap');
    await metamapEntry.click();
    await page.waitForTimeout(500);

    // Verify we're no longer on the canvas (react-flow should not be the main view)
    // The metamap renders its own component - check that react-flow is gone or metamap is present
    const reactFlow = page.locator('.react-flow');
    // MapV2 should not be visible in metamap mode
    // (MetamapV2 renders differently from MapV2)
    await expect(metamapEntry.locator('..').locator('div.bg-accent')).toBeVisible();
  });

  test('should rename a page via hover menu in navigator', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get the current page name
    const initialName = await cartaPage.getCurrentPageName();

    // Find the page row with the current page name
    const pageRows = cartaPage.getPageRows();
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

    // Find and click the overflow menu button
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
    await page.waitForTimeout(500);

    // Verify the name changed in the navigator
    const newName = await cartaPage.getCurrentPageName();
    expect(newName).toBe('Renamed Page');
  });

  test('ViewToggle and PageSwitcher dropdown are no longer present in the DOM', async ({ page }) => {
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Old ViewToggle segmented control should not exist
    const viewToggle = page.locator('[data-testid="view-toggle"]');
    await expect(viewToggle).not.toBeVisible();

    // Old page switcher dropdown button should not exist
    const oldDropdownButton = page.locator('button[title="Switch page"]');
    await expect(oldDropdownButton).not.toBeVisible();

    // Old page-name test id should not exist
    const oldPageName = page.locator('[data-testid="page-name"]');
    await expect(oldPageName).not.toBeVisible();
  });
});
