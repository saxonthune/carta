import { defineConfig, devices } from '@playwright/test';

// E2E tests run on port 5273 to avoid conflicts with dev server (5173)
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5273',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'vite --port 5273',
    url: 'http://localhost:5273',
    reuseExistingServer: !process.env.CI,
  },
});
