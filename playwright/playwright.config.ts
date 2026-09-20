import { defineConfig, devices } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

require('dotenv').config({ path: '.env' });

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['src/fixtures/index.ts', 'src/steps/**/*.ts'],
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 15_000 },
  reporter: [
    ['html', { open: 'never' }],
    cucumberReporter('html', { outputFile: 'cucumber-report/index.html' }),
  ],
  use: {
    baseURL: process.env.BASE_URL?.trim(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
});
