const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class BookNowPage extends BasePage {
  bookNowSection() {
    return this.page.locator('section').filter({ hasText: 'Book Now Your destination' });
  }

  enabledBookNowCta() {
    return this.page
      .locator('#booking-widget-group-addcart-btn:not([disabled]):not([aria-disabled="true"])')
      .or(this.page.getByRole('button', { name: /Book Now\s*→/i }))
      .or(this.page.locator('button').filter({ hasText: /Book Now\s*→/i }));
  }

  async hasBookNowOption(timeout = 20_000) {
    const checkOnce = () =>
      this.page.evaluate(() => {
        const isEnabledVisible = (el) => {
          if (!el) return false;
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
          if (el.classList.contains('disabled')) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (el.offsetParent === null) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const addCart = document.querySelector('#booking-widget-group-addcart-btn');
        if (isEnabledVisible(addCart)) return true;

        // Real CTA uses Book Now→ — ignore disabled plain "Book Now" placeholder.
        return [...document.querySelectorAll('button, a')].some((el) => {
          if (el.id === 'booking-widget-group-addcart-btn') return false;
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!/Book Now\s*→/i.test(text)) return false;
          return isEnabledVisible(el);
        });
      });

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await checkOnce()) {
        await this.settle(1_000);
        if (await checkOnce()) return true;
      }
      await this.settle(500);
    }
    return false;
  }

  viewAllPropertiesButton() {
    return this.page
      .locator('#booking-widget-more-properties-btn')
      .or(
        this.page.getByRole('button', {
          name: /View all properties in Hong Kong International Airport/i,
        }),
      );
  }

  async expectViewAllPropertiesVisible(timeout = 30_000) {
    await expect(this.viewAllPropertiesButton().first()).toBeVisible({ timeout });
    console.log(
      '[book-now] Validated "View all properties in Hong Kong International Airport (HKG)"',
    );
  }

  async fillDestinationHongKong() {
    const section = this.bookNowSection();
    await section.scrollIntoViewIfNeeded();
    const where = this.page.getByRole('textbox', { name: /Where/i }).first();
    await expect(where).toBeVisible({ timeout: 60_000 });
    await where.click();
    await where.fill('Hong Kong');
    await this.page.getByRole('link', { name: /Hong Kong International/i }).click();
  }

  async setBookNowNextDay() {
    const section = this.bookNowSection();
    await this.openDatepicker(section.locator('#bookingDate'));
    await this.selectNextDayInOpenCalendar();
  }

  async setBookNowTime(time) {
    const section = this.bookNowSection();
    await section.locator('#bookingTime').click();
    await this.page.getByRole('link', { name: String(time), exact: true }).click({ force: true });
  }

  async clickSearchLounges() {
    const section = this.bookNowSection();
    const searchBtn = this.page
      .getByRole('button')
      .filter({ hasText: 'Search Lounges' })
      .or(section.locator('button.bookingBtn, button[type="submit"]'));
    await searchBtn.first().click();
    await this.page.waitForTimeout(1_000);
    if (await searchBtn.first().isVisible().catch(() => false)) {
      await searchBtn.first().click().catch(() => {});
    }
    await this.settle(2_500);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async searchHongKongInternational({ time = '1000' } = {}) {
    await this.fillDestinationHongKong();
    const where = this.page.getByRole('textbox', { name: /Where/i }).first();
    await expect(where).toHaveValue(/Hong Kong International/i, { timeout: 15_000 });
    await this.setBookNowNextDay();
    await this.setBookNowTime(time);
    await this.clickSearchLounges();
    // Wait until search results render More at HKG / View all properties
    const more = this.page
      .getByRole('button', { name: /More at HKG/i })
      .or(this.page.getByRole('link', { name: /More at HKG/i }))
      .or(this.viewAllPropertiesButton());
    await expect(more.first()).toBeVisible({ timeout: 60_000 });
  }

  /**
   * TC01/TC02 — stop as soon as an enabled Book Now is available:
   * 1) Current date @ 11:00
   *    - if Book Now missing, validate "View all properties…" then retry dates/times
   * 2) Next day @ 11:00
   * 3) Same day @ 23:30
   * 4) Next day again @ 11:00
   */
  async searchHongKongUntilBookNowAvailable() {
    await this.fillDestinationHongKong();

    console.log('[book-now] Search current date @ 11:00');
    await this.setBookNowTime('1100');
    await this.clickSearchLounges();

    if (await this.hasBookNowOption(20_000)) {
      console.log('[book-now] Book Now found — stop retries (current date @ 11:00)');
      return;
    }

    console.log('[book-now] No Book Now on current date — validate View all properties');
    await this.expectViewAllPropertiesVisible();

    const retries = [
      { label: 'next day @ 11:00', nextDay: true, time: '1100' },
      { label: 'same day @ 23:30', nextDay: false, time: '2330' },
      { label: 'next day again @ 11:00', nextDay: true, time: '1100' },
    ];

    for (const attempt of retries) {
      console.log(`[book-now] Search ${attempt.label}`);
      if (attempt.nextDay) {
        await this.setBookNowNextDay();
      }
      await this.setBookNowTime(attempt.time);
      await this.clickSearchLounges();

      if (await this.hasBookNowOption(20_000)) {
        console.log(`[book-now] Book Now found — stop retries (${attempt.label})`);
        return;
      }
      console.log(`[book-now] No Book Now after ${attempt.label}`);
    }

    await expect(this.enabledBookNowCta().first()).toBeVisible({ timeout: 60_000 });
    await expect(this.enabledBookNowCta().first()).toBeEnabled({ timeout: 30_000 });
  }

  async clickBookNowArrow() {
    const target = this.enabledBookNowCta();
    const visitAll = this.viewAllPropertiesButton().or(
      this.page.getByRole('link', { name: /Visit All Lounges in Hong Kong/i }),
    );

    if (!(await this.hasBookNowOption(15_000))) {
      if (await visitAll.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await visitAll.first().click();
      }
    }

    await expect(target.first()).toBeVisible({ timeout: 90_000 });
    await expect(target.first()).toBeEnabled({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await target.first().click();

    await expect(
      this.page
        .locator(
          'button.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]',
        )
        .or(this.page.getByRole('button', { name: 'Check Out' }))
        .or(this.page.getByRole('heading', { name: 'Cart' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }

  async clickMoreAtHkg() {
    const more = this.page
      .getByRole('button', { name: /More at HKG/i })
      .or(this.page.getByRole('link', { name: /More at HKG/i }))
      .or(this.viewAllPropertiesButton())
      .or(this.page.locator('#booking-widget-more-properties-btn'));
    await expect(more.first()).toBeVisible({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await more.first().click();
  }

  async clickSearchResultBookNow() {
    const addCart = this.page.locator(
      '#booking-widget-group-addcart-btn:not([disabled]):not([aria-disabled="true"])',
    );
    const bookNowArrow = this.page.getByRole('button', { name: /Book Now→/i });
    const visitAll = this.viewAllPropertiesButton().or(
      this.page.getByRole('link', { name: /Visit All Lounges in Hong Kong/i }),
    );

    await expect(addCart.or(bookNowArrow).or(visitAll).first()).toBeVisible({ timeout: 90_000 });

    if (
      (await visitAll.first().isVisible().catch(() => false)) &&
      !(await addCart.isVisible().catch(() => false)) &&
      !(await bookNowArrow.isVisible().catch(() => false))
    ) {
      await visitAll.first().click();
      await expect(addCart.or(bookNowArrow).first()).toBeVisible({ timeout: 90_000 });
    }

    const bookNow = addCart.or(bookNowArrow).first();
    await expect(bookNow).toBeVisible({ timeout: 90_000 });
    await expect(bookNow).toBeEnabled({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await bookNow.click();
    await expect(
      this.page.locator(
        'button.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]',
      ),
    ).toBeVisible({ timeout: 90_000 });
  }

  async openLoungeView(nth = 4) {
    await this.waitBeforeTransition();
    await this.page.getByRole('link', { name: 'View' }).nth(nth).click();
  }

  #visibleCheckOut() {
    return this.page
      .locator(
        'button.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]',
      )
      .or(this.page.getByRole('button', { name: 'Check Out' }))
      .filter({ visible: true })
      .first();
  }

  async #recoverPurchaserCheckOut() {
    // Upsell/addon modal can leave Check Out in DOM but hidden — go back to purchaser cart.
    const blockingModal = this.page.locator('#add-service-form-0.show, .modal.show').first();
    if (await blockingModal.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await expect(blockingModal).toBeHidden({ timeout: 10_000 }).catch(() => {});
    }

    if (await this.#visibleCheckOut().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    const back = this.page
      .locator(
        'a.desktop-back-btn[href*="ClearGuestInfoAndRedirectToPurchaserInfo"], a.desktop-back-btn[title="back"], a[href*="ClearGuestInfoAndRedirectToPurchaserInfo"]',
      )
      .first();
    await expect(back).toBeVisible({ timeout: 30_000 });
    await back.click();
    console.log('[book-now] Clicked desktop back to restore purchaser Check Out');
  }

  async clickCheckOut() {
    if (!(await this.#visibleCheckOut().isVisible({ timeout: 8_000 }).catch(() => false))) {
      await this.#recoverPurchaserCheckOut();
    }

    const checkOut = this.#visibleCheckOut();
    await expect(checkOut).toBeVisible({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await checkOut.click();
    await expect(
      this.page
        .locator('#Title, #FirstName, #CountryOfResidence')
        .or(this.page.getByRole('link', { name: 'Log In' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }
}

module.exports = { BookNowPage };
