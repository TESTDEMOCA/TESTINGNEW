import type { Page, Response } from '@playwright/test';
import { env } from '../config/env.config';
import { describe, resolve, type Target } from './locator.util';
import { logger } from './logger';

export class Waits {
  constructor(
    private readonly page: Page,
    private readonly timeout = env.timeout,
  ) {}

  async visible(target: Target) {
    logger.step(`wait visible >> ${describe(target)}`);
    const locator = resolve(this.page, target);
    await locator.waitFor({ state: 'visible', timeout: this.timeout });
    return locator;
  }

  async hidden(target: Target) {
    logger.step(`wait hidden >> ${describe(target)}`);
    const locator = resolve(this.page, target);
    await locator.waitFor({ state: 'hidden', timeout: this.timeout });
    return locator;
  }

  async urlContains(fragment: string | RegExp) {
    logger.step(`wait url >> ${fragment}`);
    await this.page.waitForURL(fragment, { timeout: this.timeout });
  }

  async response(urlPart: string | RegExp): Promise<Response> {
    logger.step(`wait response >> ${urlPart}`);
    return this.page.waitForResponse(
      (response) =>
        typeof urlPart === 'string' ? response.url().includes(urlPart) : urlPart.test(response.url()),
      { timeout: this.timeout },
    );
  }

  async loadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded') {
    await this.page.waitForLoadState(state, { timeout: this.timeout });
  }
}
