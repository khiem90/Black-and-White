import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3004',
    trace: 'on-first-retry',
    // Disable CSS animations so Playwright doesn't wait for infinite animations
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 3004',
    url: 'http://localhost:3004',
    reuseExistingServer: true,
  },
});
