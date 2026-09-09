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
    if (this.isMobile()) {
      await this.openMobileNavIfNeeded();
    }
    const item = this.page.getByRole('link', { name: menuLabel }).or(
      this.page.getByRole('button', { name: menuLabel }),
    );
    const target = item.first();
    await target.waitFor({ state: 'visible', timeout: 30_000 });
    await target.click();
  }

  /**
   * Open Language & currency modal, select a currency code, Apply.
   * Desktop: Language link → #languageCurrency
   * Mobile: hamburger → #MobileCurrency (desktop Language lives under .tablet-hide)
   */
  async openLanguageCurrencyModal() {
    if (this.isMobile()) {
      return this.openMobileCurrencyModal();
    }

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

  async openMobileCurrencyModal() {
    const modal = this.page.locator('#MobileCurrency');
    if (await modal.isVisible({ timeout: 1_500 }).catch(() => false)) {
      return modal;
    }
    await this.openMobileNavIfNeeded();
    const currencyTrigger = this.page.locator('a[data-bs-target="#MobileCurrency"]').first();
    await expect(currencyTrigger).toBeVisible({ timeout: 15_000 });
    await currencyTrigger.click();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    return modal;
  }

  async selectCurrency(currencyCode) {
    const code = String(currencyCode || '').trim().toUpperCase();
    if (!code) {
      throw new Error('Currency code is required (e.g. HKD, INR, USD).');
    }

    if (this.isMobile()) {
      await this.selectCurrencyMobile(code);
      return;
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

  async selectCurrencyMobile(code) {
    const modal = await this.openMobileCurrencyModal();
    const option = modal.getByText(code, { exact: true });
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();

    const apply = modal
      .locator('a.mobile-currency-submit')
      .or(modal.getByRole('link', { name: /^Apply$/i }))
      .or(modal.getByRole('button', { name: /^Apply$/i }))
      .first();
    await expect(apply).toBeVisible({ timeout: 10_000 });
    await apply.click();
    await expect(modal).toBeHidden({ timeout: 15_000 }).catch(() => {});
    console.log(`[home] Mobile currency selected: ${code}`);
  }
}

module.exports = { HomePage };
