import { defineConfig, devices } from '@playwright/test';

// Static build smoke tests run against vite preview (production build)
// on port 5473 to avoid conflicts with dev server (5173) and E2E tests (5273)
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'static-smoke.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5473',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'vite preview --port 5473',
    url: 'http://localhost:5473',
    reuseExistingServer: !process.env.CI,
  },
});
