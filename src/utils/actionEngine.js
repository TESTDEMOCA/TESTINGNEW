const { expect } = require('@playwright/test');

class ActionEngine {
  constructor(page) {
    this.page = page;
  }

  async click(selector, timeout = 30_000) {
    const locator = this.page.locator(selector).first();
    await expect(locator).toBeVisible({ timeout });
    await locator.scrollIntoViewIfNeeded();
    try {
      await locator.click({ timeout: 10_000 });
    } catch {
      await locator.click({ force: true });
    }
  }

  async fill(selector, value, timeout = 30_000) {
    const loc = this.page.locator(selector).first();
    await expect(loc).toBeVisible({ timeout });
    await loc.fill(value);
  }

  async isVisible(selector, timeout = 30_000) {
    await expect(this.page.locator(selector).first()).toBeVisible({ timeout });
    return true;
  }
}

module.exports = { ActionEngine };
