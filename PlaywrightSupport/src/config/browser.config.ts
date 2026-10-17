import type { BrowserContextOptions, LaunchOptions } from '@playwright/test';
import { env, type BrowserName } from './env.config';

export function getLaunchOptions(
  overrides: LaunchOptions = {},
  browser: BrowserName = env.browser,
): LaunchOptions {
  const options: LaunchOptions = {
    headless: env.headless,
    slowMo: env.slowMo,
    args: ['--disable-dev-shm-usage'],
  };

  if (browser === 'chromium' && env.channel) {
    options.channel = env.channel;
  }

  return { ...options, ...overrides };
}

export function getContextOptions(overrides: BrowserContextOptions = {}): BrowserContextOptions {
  const options: BrowserContextOptions = {
    baseURL: env.baseUrl,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    viewport: env.headless ? { width: 1920, height: 1080 } : null,
    locale: 'en-US',
  };

  if (env.video) {
    options.recordVideo = { dir: 'test-results/videos' };
  }

  return { ...options, ...overrides };
}
