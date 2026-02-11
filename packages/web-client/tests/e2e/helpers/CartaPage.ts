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

  }

  /**
   * Navigate to the app and wait for the canvas to be ready.
   * In local mode, the app auto-creates a document (URL stays clean).
   * In server mode, shows document browser modal.
   */
  async goto() {
    await this.page.goto('/', { waitUntil: 'commit' });

    const settingsButton = this.page.getByTestId('settings-menu-button');
    const newDocButton = this.page.getByRole('button', { name: 'New Document' });

    // Wait for either: canvas ready (local mode) or modal (server mode)
    const firstVisible = await Promise.race([
      settingsButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'canvas' as const),
      newDocButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'modal' as const),
    ]);

    if (firstVisible === 'modal') {
      await newDocButton.click();
      await settingsButton.waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  /**
   * Navigate to the app with a clean browser state (fresh context).
   * Each Playwright test gets a new browser context with empty IndexedDB
   * and localStorage, so this simulates a true first visit.
   *
   * In local mode, the app auto-creates a document (URL stays clean, no ?doc=).
   * In server mode, shows document browser modal.
   * We wait for the canvas or modal to appear.
   */
  async gotoFresh() {
    await this.page.goto('/', { waitUntil: 'commit' });

    const settingsButton = this.page.getByTestId('settings-menu-button');
    const newDocButton = this.page.getByRole('button', { name: 'New Document' });

    // Wait for either: canvas ready (local mode) or modal (server mode)
    const firstVisible = await Promise.race([
      settingsButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'canvas' as const),
      newDocButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'modal' as const),
    ]);

    if (firstVisible === 'modal') {
      // In server mode, create a new document
      await newDocButton.click();
      await settingsButton.waitFor({ state: 'visible', timeout: 15000 });
    }
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
   * Get a specific node by index (includes all node types).
   */
  getNode(index: number): Locator {
    return this.page.locator('.react-flow__node').nth(index);
  }

  /**
   * Get a specific construct node by index (excludes visual groups).
   */
  getConstructNode(index: number): Locator {
    return this.page.locator('.react-flow__node-construct').nth(index);
  }

  /**
   * Get the port drawer element inside a node.
   */
  getPortDrawer(nodeIndex: number): Locator {
    return this.getNode(nodeIndex).locator('.port-drawer, [class*="port"]').first();
  }

  /**
   * Hover over a node's bottom area to expand the port drawer.
   * Returns the node's bounding box for subsequent operations.
   */
  async hoverNodeBottom(nodeIndex: number): Promise<{ x: number; y: number; width: number; height: number }> {
    const node = this.getNode(nodeIndex);
    await node.waitFor({ state: 'visible' });
    const box = await node.boundingBox();
    if (!box) throw new Error(`Node ${nodeIndex} not found`);

    // Hover near the bottom of the node to trigger port drawer
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height - 10);
    await this.page.waitForTimeout(200);
    return box;
  }

  /**
   * Drag from a source node to a target node to create a connection.
   * Starts from near the bottom of source node (port drawer area)
   * and drops on the target node.
   */
  async dragToConnect(sourceNodeIndex: number, targetNodeIndex: number): Promise<void> {
    const sourceNode = this.getNode(sourceNodeIndex);
    const targetNode = this.getNode(targetNodeIndex);

    await sourceNode.waitFor({ state: 'visible' });
    await targetNode.waitFor({ state: 'visible' });

    const sourceBox = await sourceNode.boundingBox();
    const targetBox = await targetNode.boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Nodes not found');

    // Start from bottom center of source (port drawer area)
    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height - 5;

    // End at center of target
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height / 2;

    // Hover to expand port drawer first
    await this.page.mouse.move(startX, startY);
    await this.page.waitForTimeout(300);

    // Now drag
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY, { steps: 10 });
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();
    await this.page.waitForTimeout(200);
  }

  /**
   * Check if drop zones are visible during a connection drag.
   */
  async hasVisibleDropZones(): Promise<boolean> {
    // Drop zones have the dropzone: prefix in their handle IDs
    const dropZones = this.page.locator('[data-handleid^="dropzone:"]');
    const count = await dropZones.count();
    return count > 0;
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

  /**
   * Get an organizer node by index (type='organizer').
   */
  getOrganizerNode(index: number): Locator {
    return this.page.locator('.react-flow__node-organizer').nth(index);
  }

  /**
   * Get the spread children button within an organizer.
   * Only visible when organizer is expanded and has 2+ children.
   */
  getOrganizerSpreadButton(organizerLocator: Locator): Locator {
    return organizerLocator.locator('button[title="Spread children"]');
  }

  /**
   * Get the collapse toggle button within an organizer.
   * Shows "Collapse organizer" when expanded, "Expand organizer" when collapsed.
   */
  getOrganizerCollapseButton(organizerLocator: Locator): Locator {
    return organizerLocator.locator('button[title="Collapse organizer"]');
  }

  /**
   * Get the child count badge text from an organizer.
   * Returns the text content of the badge (e.g., "2").
   */
  async getChildCountBadge(organizerLocator: Locator): Promise<string | null> {
    const badge = organizerLocator.locator('span.text-\\[10px\\].font-medium');
    const count = await badge.count();
    if (count === 0) return null;
    return badge.textContent();
  }

  /**
   * Get the page switcher trigger bar container.
   */
  getPageSwitcherTrigger(): Locator {
    // Look for the button with title "Switch page" and work up from there
    return this.page.locator('button[title="Switch page"]').locator('..');
  }

  /**
   * Get the current page name from the trigger bar.
   */
  async getCurrentPageName(): Promise<string> {
    // Find the span with data-testid="page-name"
    const nameSpan = this.page.locator('[data-testid="page-name"]');
    return (await nameSpan.textContent()) ?? '';
  }

  /**
   * Open the page dropdown by clicking the chevron button.
   */
  async openPageDropdown(): Promise<void> {
    // Click the button with title "Switch page"
    const chevronButton = this.page.locator('button[title="Switch page"]');
    await chevronButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get locators for page rows in the open dropdown.
   * Returns all page row elements that are NOT the "New Page" button.
   */
  getPageRows(): Locator {
    // Page rows are within the dropdown, excluding the "New Page" button row
    // They contain a 3px active indicator bar and page name
    return this.page.locator('div.flex.items-center.gap-2').filter({ has: this.page.locator('div.w-\\[3px\\]') });
  }
}
