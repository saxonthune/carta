import { test, expect } from '@playwright/test';

/**
 * Drag Performance E2E Test
 *
 * Seeds 150 nodes, waits for full page load, then measures per-frame
 * drag latency. Each mouse move during drag should be near-instant.
 */
test.describe('Drag Performance (150 nodes)', () => {
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/?seed=perf-150', { waitUntil: 'commit' });
    await page.getByTestId('settings-menu-button').waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.locator('.react-flow__node-construct')).toHaveCount(150, { timeout: 15000 });
    // Let page fully settle — layout, paint, ResizeObserver, etc.
    await page.waitForTimeout(2000);
  });

  test('per-frame drag latency under 50ms after page settles', async ({ page }) => {
    const node = page.locator('.react-flow__node-construct').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('Node not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Start drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Warmup: first couple moves can spike from Playwright IPC overhead
    await page.mouse.move(startX + 5, startY + 5);
    await page.mouse.move(startX + 10, startY + 10);

    // Measure 10 individual moves
    const frameTimes: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const t0 = Date.now();
      await page.mouse.move(startX + 10 + i * 20, startY + 10 + i * 20);
      frameTimes.push(Date.now() - t0);
    }

    await page.mouse.up();

    const maxFrame = Math.max(...frameTimes);
    const avgFrame = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    console.log(`Per-frame: avg=${avgFrame.toFixed(1)}ms, max=${maxFrame}ms, all=[${frameTimes.join(', ')}]`);

    expect(maxFrame).toBeLessThan(50);
  });
});
