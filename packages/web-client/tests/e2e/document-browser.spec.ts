import { test, expect } from '@playwright/test';

/**
 * Document Browser Modal E2E Tests
 *
 * These tests verify the folder navigation and persistence behavior
 * in the document browser modal.
 *
 * IMPORTANT: These tests require the app to be built with VITE_SYNC_URL set.
 * The sync URL is a build-time environment variable, so we can't inject it
 * at runtime. Run these tests with:
 *   VITE_SYNC_URL=http://localhost:3001 pnpm test:e2e
 *
 * The tests will skip if the document browser modal doesn't appear (demo mode).
 */

interface MockDocument {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
  nodeCount: number;
}

test.describe('Document Browser Modal', () => {
  // Mock documents for testing
  const mockDocuments: MockDocument[] = [
    { id: 'doc-1', title: 'Project Alpha', folder: '/', updatedAt: new Date().toISOString(), nodeCount: 5 },
    { id: 'doc-2', title: 'Project Beta', folder: '/work', updatedAt: new Date().toISOString(), nodeCount: 10 },
    { id: 'doc-3', title: 'Personal Notes', folder: '/personal', updatedAt: new Date().toISOString(), nodeCount: 3 },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock the documents API
    await page.route('**/api/documents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documents: mockDocuments }),
        });
      } else if (route.request().method() === 'POST') {
        // Mock document creation
        const body = JSON.parse(route.request().postData() || '{}');
        const newDoc = {
          id: `doc-${Date.now()}`,
          title: body.title || 'Untitled',
          folder: body.folder || '/',
          updatedAt: new Date().toISOString(),
          nodeCount: 0,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ document: newDoc }),
        });
      }
    });
  });

  /**
   * Helper to check if we're in server mode (document browser modal appears).
   * Skips the test if in local mode.
   */
  async function ensureServerMode(page: import('@playwright/test').Page) {
    await page.goto('/');

    // Wait a bit for either canvas or modal to appear
    const modal = page.getByRole('heading', { name: /Documents|Select a Document/i });
    const canvas = page.locator('.react-flow');

    const firstVisible = await Promise.race([
      modal.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'modal' as const),
      canvas.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'canvas' as const),
    ]).catch(() => 'neither' as const);

    if (firstVisible !== 'modal') {
      test.skip(true, 'Document browser only appears in sync mode (VITE_SYNC_URL must be set at build time)');
    }

    return modal;
  }

  test('should show breadcrumb navigation', async ({ page }) => {
    await ensureServerMode(page);

    // Should show root breadcrumb
    const rootBreadcrumb = page.locator('button', { hasText: '/' }).first();
    await expect(rootBreadcrumb).toBeVisible();
  });

  test('should show folders derived from documents', async ({ page }) => {
    await ensureServerMode(page);

    // Should show folders from document paths
    await expect(page.locator('button', { hasText: 'work' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'personal' })).toBeVisible();
  });

  test('should navigate into folder and show breadcrumb', async ({ page }) => {
    await ensureServerMode(page);

    // Click on 'work' folder
    await page.locator('button', { hasText: 'work' }).click();

    // Breadcrumb should now show 'work'
    const workBreadcrumb = page.locator('button', { hasText: 'work' });
    await expect(workBreadcrumb).toBeVisible();
  });

  test('should show back button when not at root', async ({ page }) => {
    await ensureServerMode(page);

    // Navigate into a folder
    await page.locator('button', { hasText: 'work' }).click();

    // Should show back button (..)
    await expect(page.locator('button', { hasText: '..' })).toBeVisible();
  });

  test('should navigate back up via back button', async ({ page }) => {
    await ensureServerMode(page);

    // Navigate into a folder
    await page.locator('button', { hasText: 'work' }).click();
    await expect(page.locator('button', { hasText: '..' })).toBeVisible();

    // Click back
    await page.locator('button', { hasText: '..' }).click();

    // Should be back at root - 'work' folder should be visible again
    await expect(page.locator('button', { hasText: 'work' })).toBeVisible();
  });

  test('should navigate via breadcrumb', async ({ page }) => {
    await ensureServerMode(page);

    // Navigate into a folder
    await page.locator('button', { hasText: 'work' }).click();

    // Click root breadcrumb
    await page.locator('button', { hasText: '/' }).first().click();

    // Should be back at root
    await expect(page.locator('button', { hasText: 'work' })).toBeVisible();
  });

  test.describe('Folder Persistence', () => {
    test('created folder persists after navigating back up', async ({ page }) => {
      await ensureServerMode(page);

      // Click "New Folder" button
      await page.locator('button', { hasText: 'New Folder' }).click();

      // Enter folder name and submit
      const folderInput = page.locator('input[placeholder="Folder name"]');
      await folderInput.fill('test-folder');
      await page.locator('button', { hasText: 'Go' }).click();

      // Should now be inside 'test-folder' - verify breadcrumb
      const breadcrumb = page.locator('button', { hasText: 'test-folder' });
      await expect(breadcrumb).toBeVisible();

      // Navigate back to root
      await page.locator('button', { hasText: '/' }).first().click();

      // The created folder should still be visible
      const folder = page.locator('button', { hasText: 'test-folder' });
      await expect(folder).toBeVisible();
    });

    test('created nested folder shows parent folders when navigating', async ({ page }) => {
      await ensureServerMode(page);

      // Create folder 'projects'
      await page.locator('button', { hasText: 'New Folder' }).click();
      await page.locator('input[placeholder="Folder name"]').fill('projects');
      await page.locator('button', { hasText: 'Go' }).click();

      // Should be in /projects - create another folder
      await page.locator('button', { hasText: 'New Folder' }).click();
      await page.locator('input[placeholder="Folder name"]').fill('webapp');
      await page.locator('button', { hasText: 'Go' }).click();

      // Should be in /projects/webapp - breadcrumb should show both
      await expect(page.locator('button', { hasText: 'projects' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'webapp' })).toBeVisible();

      // Navigate back to root
      await page.locator('button', { hasText: '/' }).first().click();

      // 'projects' folder should be visible at root
      await expect(page.locator('button', { hasText: 'projects' })).toBeVisible();

      // Navigate into projects
      await page.locator('button', { hasText: 'projects' }).click();

      // 'webapp' folder should be visible
      await expect(page.locator('button', { hasText: 'webapp' })).toBeVisible();
    });

    test('multiple created folders at same level all persist', async ({ page }) => {
      await ensureServerMode(page);

      // Create first folder
      await page.locator('button', { hasText: 'New Folder' }).click();
      await page.locator('input[placeholder="Folder name"]').fill('folder-a');
      await page.locator('button', { hasText: 'Go' }).click();

      // Go back
      await page.locator('button', { hasText: '/' }).first().click();

      // Create second folder
      await page.locator('button', { hasText: 'New Folder' }).click();
      await page.locator('input[placeholder="Folder name"]').fill('folder-b');
      await page.locator('button', { hasText: 'Go' }).click();

      // Go back
      await page.locator('button', { hasText: '/' }).first().click();

      // Both folders should be visible
      await expect(page.locator('button', { hasText: 'folder-a' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'folder-b' })).toBeVisible();
    });
  });
});
