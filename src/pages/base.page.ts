import type { Page } from '@playwright/test';
import { env } from '../config/env.config';
import { UiActions } from '../utils/actions';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly actions = new UiActions(page),
  ) {}

  async goto(url: string = '/'): Promise<void> {
    await this.actions.navigate(url);
  }

  async reload(): Promise<void> {
    await this.actions.reload();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async openApp(path = '/'): Promise<void> {
    const target = path.startsWith('http') ? path : new URL(path, env.baseUrl).toString();
    await this.goto(target);
  }
}
