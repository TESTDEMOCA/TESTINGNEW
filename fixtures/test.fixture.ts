import { test as base, expect } from '@playwright/test';
import { HomePage } from '../src/pages/home.page';
import { BrowserManager } from '../src/support/browser.manager';
import { UiActions } from '../src/utils/actions';
import { logger } from '../src/utils/logger';

type FrameworkFixtures = {
  browserManager: BrowserManager;
  actions: UiActions;
  homePage: HomePage;
};

export const test = base.extend<FrameworkFixtures>({
  browserManager: async ({ browser, context, page }, use) => {
    await use(BrowserManager.attach(browser, context, page));
  },
  actions: async ({ page }, use) => {
    await use(new UiActions(page));
  },
  homePage: async ({ page, actions }, use) => {
    await use(new HomePage(page, actions));
  },
});

test.afterEach(async ({ page }, testInfo) => {
  const status = testInfo.status ?? 'unknown';
  logger.info(`${status.toUpperCase()} :: ${testInfo.title}`);

  if (testInfo.status !== testInfo.expectedStatus) {
    const file = testInfo.outputPath('failure.png');
    await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  }
});

export { expect };
