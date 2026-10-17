import { expect, type Download, type Locator, type Page } from '@playwright/test';
import { env } from '../config/env.config';
import { describe, resolve, type Target } from './locator.util';
import { logger } from './logger';
import { Waits } from './waits';

export class UiActions {
  readonly waits: Waits;

  constructor(private readonly page: Page) {
    this.waits = new Waits(page, env.timeout);
  }

  byRole(role: Parameters<Page['getByRole']>[0], options?: Parameters<Page['getByRole']>[1]): Locator {
    return this.page.getByRole(role, options);
  }

  byLabel(text: string | RegExp): Locator {
    return this.page.getByLabel(text);
  }

  byText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  byTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  byPlaceholder(text: string | RegExp): Locator {
    return this.page.getByPlaceholder(text);
  }

  async navigate(url: string = env.launchUrl): Promise<void> {
    logger.step(`navigate >> ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: env.timeout });
  }

  async reload(): Promise<void> {
    logger.step('reload');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  async click(target: Target): Promise<void> {
    logger.step(`click >> ${describe(target)}`);
    await (await this.waits.visible(target)).click();
  }

  async doubleClick(target: Target): Promise<void> {
    logger.step(`doubleClick >> ${describe(target)}`);
    await (await this.waits.visible(target)).dblclick();
  }

  async rightClick(target: Target): Promise<void> {
    logger.step(`rightClick >> ${describe(target)}`);
    await (await this.waits.visible(target)).click({ button: 'right' });
  }

  async hover(target: Target): Promise<void> {
    logger.step(`hover >> ${describe(target)}`);
    await (await this.waits.visible(target)).hover();
  }

  async fill(target: Target, value: string, options?: { mask?: boolean }): Promise<void> {
    logger.step(`fill >> ${describe(target)} = ${options?.mask ? '****' : value}`);
    await (await this.waits.visible(target)).fill(value);
  }

  async type(target: Target, value: string, delay = 50): Promise<void> {
    logger.step(`type >> ${describe(target)}`);
    await (await this.waits.visible(target)).pressSequentially(value, { delay });
  }

  async clear(target: Target): Promise<void> {
    logger.step(`clear >> ${describe(target)}`);
    await (await this.waits.visible(target)).clear();
  }

  async select(target: Target, value: string | { label?: string; value?: string; index?: number }): Promise<void> {
    logger.step(`select >> ${describe(target)}`);
    await (await this.waits.visible(target)).selectOption(value);
  }

  async setChecked(target: Target, checked: boolean): Promise<void> {
    logger.step(`setChecked >> ${describe(target)} = ${checked}`);
    await resolve(this.page, target).setChecked(checked);
  }

  async pressKey(key: string): Promise<void> {
    logger.step(`press >> ${key}`);
    await this.page.keyboard.press(key);
  }

  async upload(target: Target, files: string | string[]): Promise<void> {
    logger.step(`upload >> ${describe(target)}`);
    await resolve(this.page, target).setInputFiles(files);
  }

  async text(target: Target): Promise<string> {
    return (await this.waits.visible(target)).innerText();
  }

  async allText(target: Target): Promise<string[]> {
    return resolve(this.page, target).allInnerTexts();
  }

  async inputValue(target: Target): Promise<string> {
    return resolve(this.page, target).inputValue();
  }

  async attribute(target: Target, name: string): Promise<string | null> {
    return resolve(this.page, target).getAttribute(name);
  }

  async count(target: Target): Promise<number> {
    return resolve(this.page, target).count();
  }

  async isVisible(target: Target): Promise<boolean> {
    return resolve(this.page, target).isVisible();
  }

  async scrollTo(target: Target): Promise<void> {
    await resolve(this.page, target).scrollIntoViewIfNeeded();
  }

  async highlight(target: Target): Promise<void> {
    await resolve(this.page, target).evaluate((element) => {
      const node = element as HTMLElement;
      const previous = node.style.outline;
      node.style.outline = '3px solid #e11d48';
      setTimeout(() => {
        node.style.outline = previous;
      }, 800);
    });
  }

  async download(target: Target): Promise<Download> {
    logger.step(`download >> ${describe(target)}`);
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.click(target)]);
    return download;
  }

  async acceptDialog(target: Target, promptText?: string): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept(promptText));
    await this.click(target);
  }

  async dismissDialog(target: Target): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.dismiss());
    await this.click(target);
  }

  async shouldBeVisible(target: Target): Promise<void> {
    await expect(resolve(this.page, target)).toBeVisible();
  }

  async shouldBeHidden(target: Target): Promise<void> {
    await expect(resolve(this.page, target)).toBeHidden();
  }

  async shouldHaveText(target: Target, text: string | RegExp): Promise<void> {
    await expect(resolve(this.page, target)).toHaveText(text);
  }

  async shouldHaveValue(target: Target, value: string | RegExp): Promise<void> {
    await expect(resolve(this.page, target)).toHaveValue(value);
  }

  async shouldContainUrl(fragment: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(fragment);
  }
}
