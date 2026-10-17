import fs from 'fs';
import path from 'path';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type LaunchOptions,
  type Page,
} from '@playwright/test';
import { getContextOptions, getLaunchOptions } from '../config/browser.config';
import { env, type BrowserName } from '../config/env.config';
import { logger } from '../utils/logger';
import { UiActions } from '../utils/actions';

const launchers = { chromium, firefox, webkit };

export type LaunchSettings = {
  browser?: BrowserName;
  headless?: boolean;
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
};

export class BrowserManager {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  private attached = false;

  static attach(browser: Browser, context: BrowserContext, page: Page): BrowserManager {
    const manager = new BrowserManager();
    manager.browser = browser;
    manager.context = context;
    manager.page = page;
    manager.attached = true;
    return manager;
  }

  async launch(settings: LaunchSettings = {}): Promise<Page> {
    if (this.attached) {
      throw new Error('This browser is owned by the test runner. Use launch() from scripts only.');
    }

    const browserName = settings.browser ?? env.browser;
    const launchOptions = getLaunchOptions(
      {
        ...(settings.headless === undefined ? {} : { headless: settings.headless }),
        ...settings.launchOptions,
      },
      browserName,
    );

    logger.info(`launch ${browserName} headless=${String(launchOptions.headless)}`);
    this.browser = await launchers[browserName].launch(launchOptions);
    this.context = await this.browser.newContext({
      ...getContextOptions(),
      ...settings.contextOptions,
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(env.timeout);
    this.page.setDefaultNavigationTimeout(env.timeout);
    return this.page;
  }

  get actions(): UiActions {
    return new UiActions(this.requirePage());
  }

  async goto(url: string = env.launchUrl): Promise<void> {
    logger.step(`goto >> ${url}`);
    await this.requirePage().goto(url, { waitUntil: 'domcontentloaded', timeout: env.timeout });
  }

  async newTab(): Promise<Page> {
    const context = this.requireContext();
    const tab = await context.newPage();
    tab.setDefaultTimeout(env.timeout);
    this.page = tab;
    await tab.bringToFront();
    return tab;
  }

  pages(): Page[] {
    return this.requireContext().pages();
  }

  async switchToTab(index: number): Promise<Page> {
    const tabs = this.pages();
    const tab = tabs[index];
    if (!tab) {
      throw new Error(`No tab at index ${index}. Open tabs: ${tabs.length}`);
    }
    await tab.bringToFront();
    this.page = tab;
    return tab;
  }

  async closeTab(): Promise<void> {
    const current = this.requirePage();
    const remaining = this.pages().filter((tab) => tab !== current);
    await current.close();
    this.page = remaining[remaining.length - 1];
  }

  async screenshot(name: string): Promise<string> {
    const file = path.join('test-results', 'screenshots', `${name}-${Date.now()}.png`);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await this.requirePage().screenshot({ path: file, fullPage: true });
    logger.info(`screenshot >> ${file}`);
    return file;
  }

  async saveStorageState(filePath: string): Promise<string> {
    const target = path.resolve(process.cwd(), filePath);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await this.requireContext().storageState({ path: target });
    logger.info(`storage state >> ${target}`);
    return target;
  }

  async blockUrls(patterns: Array<string | RegExp>): Promise<void> {
    const page = this.requirePage();
    for (const pattern of patterns) {
      await page.route(pattern, (route) => route.abort());
    }
  }

  async close(): Promise<void> {
    if (this.attached) return;

    await this.context?.close().catch((error: unknown) => {
      logger.warn(`context close failed: ${String(error)}`);
    });
    await this.browser?.close().catch((error: unknown) => {
      logger.warn(`browser close failed: ${String(error)}`);
    });
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }

  private requirePage(): Page {
    if (!this.page) throw new Error('Browser is not launched. Call launch() first.');
    return this.page;
  }

  private requireContext(): BrowserContext {
    if (!this.context) throw new Error('Browser is not launched. Call launch() first.');
    return this.context;
  }
}
