import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Carta application.
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

  // Drawer elements (replaced Dock)
  readonly drawerPanel: Locator;

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

    // Restore defaults modal elements - use the modal content div that stops propagation
    this.restoreDefaultsModal = page.locator('div.bg-surface.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Restore default schemas' }) });
    this.restoreDefaultsCancelButton = this.restoreDefaultsModal.getByRole('button', { name: 'Cancel' });
    this.restoreDefaultsConfirmButton = this.restoreDefaultsModal.getByRole('button', { name: 'Restore' });

    // Drawer elements (floating tabs on right side)
    this.drawerPanel = page.locator('.fixed.right-0.bg-surface-depth-1');
  }

  async goto() {
    await this.page.goto('/');
    // Wait for app to initialize
    await this.page.waitForSelector('[data-testid="settings-menu-button"]');
  }

  async openSettingsMenu() {
    // Ensure drawer is closed first (backdrop blocks clicks)
    await this.closeDrawer();
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
    // Click on the backdrop (the modal overlay itself, not the content)
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

  async openRestoreDefaultsModal() {
    await this.openSettingsMenu();
    await this.page.getByText('Restore Default Schemas').click();
    await expect(this.restoreDefaultsModal).toBeVisible();
  }

  async closeRestoreDefaultsModalWithCancel() {
    await this.restoreDefaultsCancelButton.click();
    await expect(this.restoreDefaultsModal).not.toBeVisible();
  }

  async closeRestoreDefaultsModalWithBackdrop() {
    // Click on the backdrop overlay (the fixed inset-0 div with bg-black/50)
    const backdrop = this.page.locator('.fixed.inset-0.bg-black\\/50').filter({ has: this.page.getByRole('heading', { name: 'Restore default schemas' }) });
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(this.restoreDefaultsModal).not.toBeVisible();
  }

  async confirmRestoreDefaults() {
    await this.restoreDefaultsConfirmButton.click();
  }

  /**
   * Open a drawer tab. The drawer uses floating tab buttons on the right side.
   * Clicking a tab opens the drawer to that tab's content.
   */
  async openDrawerTab(tabName: 'constructs' | 'groups' | 'ports' | 'deployables') {
    // Drawer tabs have title attributes with capitalized names
    const titleMap: Record<string, string> = {
      constructs: 'Constructs',
      groups: 'Groups',
      ports: 'Ports',
      deployables: 'Deployables',
    };
    const title = titleMap[tabName];
    const tabButton = this.page.locator(`button[title="${title}"]`);
    await tabButton.click();
    // Wait for drawer to open
    await this.page.waitForTimeout(350); // Allow for animation
  }

  /**
   * @deprecated Use openDrawerTab instead. Dock was replaced with Drawer.
   */
  async switchDockTab(tabName: 'viewer' | 'constructs' | 'groups' | 'ports' | 'deployables') {
    // Redirect to drawer for backwards compatibility
    if (tabName === 'viewer') {
      // Viewer tab no longer exists in drawer - close drawer if open
      await this.closeDrawer();
      return;
    }
    await this.openDrawerTab(tabName);
  }

  async closeDrawer() {
    // Click the backdrop to close the drawer if it's open
    const backdrop = this.page.locator('.fixed.inset-0.bg-black\\/20');
    if (await backdrop.isVisible()) {
      await backdrop.click();
      await this.page.waitForTimeout(350);
    }
  }

  /**
   * Get the drawer content panel (the main sliding panel).
   * Use this for assertions about drawer content.
   */
  getDrawerContent() {
    return this.page.locator('.fixed.right-0.bg-surface-depth-1.border-l');
  }

  /**
   * Wait for drawer to be visible with content loaded.
   */
  async waitForDrawerContent() {
    await this.getDrawerContent().waitFor({ state: 'visible' });
    await this.page.waitForTimeout(100); // Allow content to render
  }

  async clearAndRestoreDefaults() {
    await this.openClearModal();
    // Click "Clear Everything and Restore Defaults"
    await this.page.getByTestId('clear-and-restore-button').click();
  }
}
