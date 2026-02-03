import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Carta application (local mode).
 * Encapsulates page interactions for E2E tests.
 */
export class CartaPage {
  readonly page: Page;

  // Header elements
  readonly settingsMenuButton: Locator;
  readonly settingsMenu: Locator;
  readonly settingsClearButton: Locator;

  // Clear modal elements
  readonly clearModal: Locator;
  readonly clearCancelButton: Locator;
  readonly clearInstancesButton: Locator;
  readonly clearEverythingButton: Locator;

  // Restore defaults modal elements
  readonly restoreDefaultsModal: Locator;
  readonly restoreDefaultsCancelButton: Locator;
  readonly restoreDefaultsConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header elements
    this.settingsMenuButton = page.getByTestId('settings-menu-button');
    this.settingsMenu = page.getByTestId('settings-menu');
    this.settingsClearButton = page.getByTestId('settings-clear-button');

    // Clear modal elements
    this.clearModal = page.getByTestId('clear-modal');
    this.clearCancelButton = page.getByTestId('clear-cancel-button');
    this.clearInstancesButton = page.getByTestId('clear-instances-button');
    this.clearEverythingButton = page.getByTestId('clear-everything-button');

    // Restore defaults modal elements
    this.restoreDefaultsModal = page.locator('div.bg-surface.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Restore default schemas' }) });
    this.restoreDefaultsCancelButton = this.restoreDefaultsModal.getByRole('button', { name: 'Cancel' });
    this.restoreDefaultsConfirmButton = this.restoreDefaultsModal.getByRole('button', { name: 'Restore' });
  }

  /**
   * Navigate to the app and wait for the canvas to be ready.
   * In local mode, the app auto-creates a document and redirects if needed.
   * Falls back to handling the DocumentBrowserModal in server mode.
   */
  async goto() {
    await this.page.goto('/', { waitUntil: 'commit' });

    const settingsButton = this.page.getByTestId('settings-menu-button');

    // If the URL already has ?doc=, just wait for the canvas
    if (this.page.url().includes('?doc=')) {
      await settingsButton.waitFor({ state: 'visible', timeout: 15000 });
      return;
    }

    // Wait for either: redirect to ?doc= (local auto-create) or modal (server mode)
    const newDocButton = this.page.getByRole('button', { name: 'New Document' });

    const firstVisible = await Promise.race([
      this.page.waitForURL(/\?doc=/, { timeout: 15000 }).then(() => 'redirect' as const),
      newDocButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'modal' as const),
    ]);

    if (firstVisible === 'modal') {
      await newDocButton.click();
    }

    // Wait for the canvas to be ready after redirect
    await settingsButton.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Navigate to the app with a clean browser state (fresh context).
   * Each Playwright test gets a new browser context with empty IndexedDB
   * and localStorage, so this simulates a true first visit.
   *
   * In local mode, the app auto-creates a document and redirects to ?doc={id}.
   * We wait for the redirect to settle and the canvas to appear.
   */
  async gotoFresh() {
    // Navigate to / — in local mode this triggers auto-create + redirect
    // Use waitUntil: 'commit' since the redirect interrupts the initial load
    await this.page.goto('/', { waitUntil: 'commit' });
    // Wait for the auto-create redirect to settle
    await this.page.waitForURL(/\?doc=/, { timeout: 15000 });
    await this.page.getByTestId('settings-menu-button').waitFor({ state: 'visible', timeout: 15000 });
  }

  async openSettingsMenu() {
    await this.settingsMenuButton.click();
    await expect(this.settingsMenu).toBeVisible();
  }

  async openClearModal() {
    await this.openSettingsMenu();
    await this.settingsClearButton.click();
    await expect(this.clearModal).toBeVisible();
  }

  async closeClearModalWithCancel() {
    await this.clearCancelButton.click();
    await expect(this.clearModal).not.toBeVisible();
  }

  async closeClearModalWithBackdrop() {
    await this.clearModal.click({ position: { x: 10, y: 10 } });
    await expect(this.clearModal).not.toBeVisible();
  }

  async clearInstances() {
    await this.clearInstancesButton.click();
  }

  async clearEverything() {
    await this.clearEverythingButton.click();
  }

  async getTitle(): Promise<string> {
    const titleElement = this.page.locator('header h1');
    return titleElement.textContent() ?? '';
  }

  async getNodeCount(): Promise<number> {
    const nodes = this.page.locator('.react-flow__node');
    return nodes.count();
  }

  async getEdgeCount(): Promise<number> {
    const edges = this.page.locator('.react-flow__edge');
    return edges.count();
  }

  async openRestoreDefaultsModal() {
    await this.openSettingsMenu();
    await this.page.getByText('Restore Default Schemas').click();
    await expect(this.restoreDefaultsModal).toBeVisible();
  }

  async confirmRestoreDefaults() {
    await this.restoreDefaultsConfirmButton.click();
  }

  async clearAndRestoreDefaults() {
    await this.openClearModal();
    await this.page.getByTestId('clear-and-restore-button').click();
  }

  /**
   * Right-click on the canvas center to open the pane context menu.
   */
  async openCanvasContextMenu() {
    const canvas = this.page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    await this.page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await this.page.mouse.down({ button: 'right' });
    await this.page.mouse.up({ button: 'right' });
    await this.page.waitForTimeout(300);
  }

  /**
   * Right-click on canvas at the given position and add the first available
   * construct type from the context menu's "Add Node Here" submenu.
   */
  async addConstructViaContextMenu(x: number, y: number) {
    const canvas = this.page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Right-click on canvas
    await this.page.mouse.move(canvasBox.x + x, canvasBox.y + y);
    await this.page.mouse.down({ button: 'right' });
    await this.page.mouse.up({ button: 'right' });
    await this.page.waitForTimeout(300);

    // Click "Add Node Here" parent menu item (has count suffix when schemas exist)
    const addNodeButton = this.page.locator('button').filter({ hasText: /Add Node Here/i }).first();
    await addNodeButton.hover();
    await this.page.waitForTimeout(300);

    // Click the first construct type in the submenu
    // The submenu items are nested buttons; pick the first leaf button
    const submenuButtons = this.page.locator('button').filter({ hasNotText: /Add Node Here/i });
    const firstOption = submenuButtons.first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }
    await this.page.waitForTimeout(300);
  }
}
