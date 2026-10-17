import { BasePage } from './base.page';

export class HomePage extends BasePage {
  private readonly learnMore = this.page.getByRole('link', { name: 'Learn more' });

  async open(): Promise<void> {
    await this.goto('/');
  }

  async expectLoaded(): Promise<void> {
    await this.actions.shouldBeVisible(this.learnMore);
  }
}
