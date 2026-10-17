import { defineConfig, devices } from '@playwright/test';
import { getContextOptions, getLaunchOptions } from './src/config/browser.config';
import { env } from './src/config/env.config';

export default defineConfig({
  testDir: './features',
  testMatch: '**/*.spec.ts',
  timeout: env.timeout,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './src/hooks/global.setup.ts',
  globalTeardown: './src/hooks/global.teardown.ts',
  use: {
    ...getContextOptions(),
    launchOptions: getLaunchOptions(),
    actionTimeout: 15_000,
    navigationTimeout: env.timeout,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
