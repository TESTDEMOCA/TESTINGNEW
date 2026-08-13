const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class HomePage extends BasePage {
  static SEARCH_FORM = '#formBookNowSearch';
  static LOCATION = '#formBookNowSearch input[name="booknow-location-search"]';
  static BOOKING_DATE = '#formBookNowSearch #bookingDate';
  static BOOKING_TIME = '#formBookNowSearch #bookingTime';
  static ADULTS = '#formBookNowSearch #txtAdult';
  static CHILDREN = '#formBookNowSearch #txtChildren';
  static SEARCH_BUTTON = '#formBookNowSearch button.bookingBtn, #formBookNowSearch button[type="submit"]';
  static BOOK_NOW = 'a:has-text("Book Now")';
  static GROUP_BOOKING = 'a[href*="group-booking"]';
  // Prefer desktop search form; mobile Book Now link is in DOM but hidden on desktop.
  static HOME_MARKER = '#formBookNowSearch';

  async expectLoaded(timeout = 60_000) {
    // Assert one locator at a time — form.or(bookNow) can match both and trip strict mode.
    const form = this.page.locator(HomePage.HOME_MARKER).first();
    if (await form.isVisible({ timeout: Math.min(timeout, 15_000) }).catch(() => false)) {
      return;
    }
    await expect(this.page.locator(HomePage.BOOK_NOW).filter({ visible: true }).first()).toBeVisible({
      timeout,
    });
  }

  async expectSearchWidgetVisible(timeout = 30_000) {
    await this.actions.isVisible(HomePage.LOCATION, timeout);
    await this.actions.isVisible(HomePage.SEARCH_BUTTON, timeout);
  }

  async fillLocation(cityOrAirport) {
    const loc = this.page.locator(HomePage.LOCATION).first();
    await loc.waitFor({ state: 'visible' });
    await loc.fill('');
    await loc.fill(cityOrAirport);
    const suggestion = this.page
      .locator('#formBookNowSearch a, .ui-autocomplete li, .ui-menu-item')
      .filter({ hasText: new RegExp(cityOrAirport.split(/[\\s(]/)[0], 'i') })
      .first();
    if (await suggestion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await suggestion.click();
    }
  }

  async fillBookingDate(dateText) {
    await this.actions.fill(HomePage.BOOKING_DATE, dateText);
  }

  async fillBookingTime(timeText) {
    await this.actions.fill(HomePage.BOOKING_TIME, timeText);
  }

  async clickSearchLounges() {
    await this.actions.click(HomePage.SEARCH_BUTTON);
  }

  async searchLounges({ location, date, time } = {}) {
    if (location) await this.fillLocation(location);
    if (date) await this.fillBookingDate(date);
    if (time) await this.fillBookingTime(time);
    await this.clickSearchLounges();
  }

  async navigateToMenu(menuLabel) {
    await this.expectLoaded();
    const item = this.page.getByRole('link', { name: menuLabel }).or(
      this.page.getByRole('button', { name: menuLabel }),
    );
    const target = item.first();
    await target.waitFor({ state: 'visible', timeout: 30_000 });
    await target.click();
  }

  /**
   * Open Language & currency modal, select a currency code, Apply.
   * codegen: getByRole('link').filter({ hasText: 'Language' })
   *          #languageCurrency getByText('<CODE>') → Apply
   */
  async openLanguageCurrencyModal() {
    const modal = this.page.locator('#languageCurrency');
    if (await modal.isVisible({ timeout: 1_500 }).catch(() => false)) {
      return modal;
    }
    const languageLink = this.page.getByRole('link').filter({ hasText: 'Language' }).first();
    await expect(languageLink).toBeVisible({ timeout: 30_000 });
    await languageLink.click();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    return modal;
  }

  async selectCurrency(currencyCode) {
    const code = String(currencyCode || '').trim().toUpperCase();
    if (!code) {
      throw new Error('Currency code is required (e.g. HKD, INR, USD).');
    }

    const modal = await this.openLanguageCurrencyModal();
    const option = modal.getByText(code, { exact: true });
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();

    const apply = this.page.getByRole('button', { name: 'Apply' });
    await expect(apply).toBeVisible({ timeout: 10_000 });
    await apply.click();
    await expect(modal).toBeHidden({ timeout: 15_000 }).catch(() => {});
  }
}

module.exports = { HomePage };
