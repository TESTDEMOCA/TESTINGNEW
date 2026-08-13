const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');
const { resolveDestination } = require('../config/destinations');

class BookNowPage extends BasePage {
  bookNowSection() {
    return this.page.locator('section').filter({ hasText: 'Book Now Your destination' });
  }

  /** Crawled: main Book Now Where field (not the popout duplicate). */
  whereInput() {
    return this.page
      .locator('input#location[name="booknow-location-search"]')
      .or(this.page.getByRole('textbox', { name: /Where/i }))
      .first();
  }

  selectedAirportInput() {
    return this.bookNowSection().locator('#selectedAirport').first();
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

  viewAllPropertiesButton(destination) {
    const dest = destination ? resolveDestination(destination) : null;
    const byId = this.page.locator('#booking-widget-more-properties-btn');
    if (!dest) {
      return byId.or(
        this.page.getByRole('button', { name: /View all properties in .+ Airport/i }),
      );
    }
    return byId.or(this.page.getByRole('button', { name: dest.viewAllProperties }));
  }

  async expectViewAllPropertiesVisible(destination = 'HKG', timeout = 30_000) {
    const dest = resolveDestination(destination);
    await expect(this.viewAllPropertiesButton(dest.code).first()).toBeVisible({ timeout });
    console.log(
      `[book-now] Validated view-all properties for ${dest.code} (${dest.currency})`,
    );
  }

  async #dismissLanguageCurrencyModal() {
    await this.page.evaluate(() => {
      const modal = document.querySelector('#languageCurrency');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    });
  }

  async #isDestinationAlreadySelected(dest) {
    const where = this.whereInput();
    const value = ((await where.inputValue().catch(() => '')) || '').trim();
    const airport = (
      (await this.selectedAirportInput().inputValue().catch(() => '')) || ''
    )
      .trim()
      .toUpperCase();

    if (airport === dest.code) return true;
    if (value && dest.selectedValue.test(value)) return true;
    return false;
  }

  /**
   * Select a Book Now destination (HKG / KUL / SIN).
   * Skips typing when Where / #selectedAirport already match the target.
   * After select, asserts lounge price text starts with the destination currency
   * (HKG → HKD, KUL → MYR, SIN → SGD).
   */
  async fillDestination(destinationInput) {
    const dest = resolveDestination(destinationInput);
    this.activeDestination = dest;

    const section = this.bookNowSection();
    await section.scrollIntoViewIfNeeded();
    await this.#dismissLanguageCurrencyModal();

    const where = this.whereInput();
    await expect(where).toBeVisible({ timeout: 60_000 });

    if (await this.#isDestinationAlreadySelected(dest)) {
      console.log(`[book-now] Where already set to ${dest.code} — skip typing`);
    } else {
      console.log(`[book-now] Typing destination: ${dest.typeText} (${dest.code})`);
      await where.click();
      await where.fill('');
      await where.fill(dest.typeText);
      await this.settle(800);
      const suggestion = this.page.getByRole('link', { name: dest.suggestion }).first();
      await expect(suggestion).toBeVisible({ timeout: 20_000 });
      await suggestion.click();
      await this.settle(1_500);
      await this.#dismissLanguageCurrencyModal();
    }

    await expect(where).toHaveValue(dest.selectedValue, { timeout: 15_000 });
    await expect(this.selectedAirportInput()).toHaveValue(dest.code, { timeout: 15_000 });
    await this.expectCurrencyMatchesDestination(dest.code);
    return dest;
  }

  async fillDestinationHongKong() {
    return this.fillDestination('HKG');
  }

  /**
   * Assert only the currency code on Book Now price text (not the amount).
   * Default: HKG → HKD, KUL → MYR, SIN → SGD.
   * If this.selectedCurrency is set (Language modal), assert that instead.
   */
  async expectCurrencyMatchesDestination(destinationInput, timeout = 25_000) {
    const dest = resolveDestination(destinationInput);
    const expectedCurrency = (
      this.selectedCurrency ||
      dest.currency
    )
      .toString()
      .trim()
      .toUpperCase();
    const priceNodes = this.page.locator(
      [
        '.bw-group-price-current',
        '.bw-group-price-discounted',
        '.bw-featured-footer__price',
        '.bw-group-price-line',
      ].join(', '),
    );

    const readCurrencyCodes = async () => {
      const texts = await priceNodes.allTextContents().catch(() => []);
      return texts
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .map((t) => {
          const m = t.match(/^([A-Za-z]{3})\b/);
          return m ? m[1].toUpperCase() : null;
        })
        .filter(Boolean);
    };

    const deadline = Date.now() + timeout;
    let lastCodes = [];
    while (Date.now() < deadline) {
      lastCodes = await readCurrencyCodes();
      if (lastCodes.some((code) => code === expectedCurrency)) {
        console.log(
          `[book-now] Currency OK for ${dest.code}: ${expectedCurrency}` +
            `${this.selectedCurrency ? ' (selected)' : ''} (amount ignored)`,
        );
        return;
      }
      await this.settle(500);
    }

    throw new Error(
      `Expected currency code ${expectedCurrency} for ${dest.code}, got: ${
        lastCodes.length ? [...new Set(lastCodes)].join(', ') : '(none)'
      }`,
    );
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
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  async searchDestinationInternational(destinationInput, { time = '1000' } = {}) {
    const dest = await this.fillDestination(destinationInput);
    await this.setBookNowNextDay();
    await this.setBookNowTime(time);
    await this.clickSearchLounges();
    const more = this.page
      .getByRole('button', { name: dest.moreAt })
      .or(this.page.getByRole('link', { name: dest.moreAt }))
      .or(this.viewAllPropertiesButton(dest.code));
    await expect(more.first()).toBeVisible({ timeout: 60_000 });
    await this.expectCurrencyMatchesDestination(dest.code);
  }

  async searchHongKongInternational({ time = '1000' } = {}) {
    return this.searchDestinationInternational('HKG', { time });
  }

  /**
   * Stop as soon as an enabled Book Now is available:
   * 1) Current date @ 11:00
   * 2) Next day @ 11:00
   * 3) Same day @ 23:30
   * 4) Next day again @ 11:00
   */
  async searchUntilBookNowAvailable(destinationInput = 'HKG') {
    const dest = await this.fillDestination(destinationInput);

    console.log(`[book-now] Search current date @ 11:00 (${dest.code})`);
    await this.setBookNowTime('1100');
    await this.clickSearchLounges();

    if (await this.hasBookNowOption(20_000)) {
      console.log('[book-now] Book Now found — stop retries (current date @ 11:00)');
      return dest;
    }

    console.log('[book-now] No Book Now on current date — validate View all properties');
    await this.expectViewAllPropertiesVisible(dest.code);

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
        return dest;
      }
      console.log(`[book-now] No Book Now after ${attempt.label}`);
    }

    await expect(this.enabledBookNowCta().first()).toBeVisible({ timeout: 60_000 });
    await expect(this.enabledBookNowCta().first()).toBeEnabled({ timeout: 30_000 });
    return dest;
  }

  async searchHongKongUntilBookNowAvailable() {
    return this.searchUntilBookNowAvailable('HKG');
  }

  async clickBookNowArrow() {
    const dest = this.activeDestination || resolveDestination('HKG');
    const target = this.enabledBookNowCta();
    const visitAll = this.viewAllPropertiesButton(dest.code).or(
      this.page.getByRole('link', { name: dest.visitAllLounges }),
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

  async clickMoreAtAirport(destinationInput = 'HKG') {
    const dest = resolveDestination(destinationInput);
    const more = this.page
      .getByRole('button', { name: dest.moreAt })
      .or(this.page.getByRole('link', { name: dest.moreAt }))
      .or(this.viewAllPropertiesButton(dest.code))
      .or(this.page.locator('#booking-widget-more-properties-btn'));
    await expect(more.first()).toBeVisible({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await more.first().click();
  }

  async clickMoreAtHkg() {
    return this.clickMoreAtAirport('HKG');
  }

  async clickSearchResultBookNow() {
    const dest = this.activeDestination || resolveDestination('HKG');
    const addCart = this.page.locator(
      '#booking-widget-group-addcart-btn:not([disabled]):not([aria-disabled="true"])',
    );
    const bookNowArrow = this.page.getByRole('button', { name: /Book Now→/i });
    const visitAll = this.viewAllPropertiesButton(dest.code).or(
      this.page.getByRole('link', { name: dest.visitAllLounges }),
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

  async hasGateLoungeVisible(gate = '35', timeout = 15_000) {
    const gateRe = new RegExp(`Near\\s+Gate\\s*${gate}\\b|Gate\\s*${gate}\\b`, 'i');
    const loc = this.page.getByText(gateRe).first();
    return loc.isVisible({ timeout }).catch(() => false);
  }

  /**
   * Search Book Now (next day + opening-hour style times) until Gate 35/60 lounge is visible.
   */
  async searchUntilGateLoungeAvailable(destinationInput = 'HKG', gate = '35') {
    const dest = await this.fillDestination(destinationInput);
    const attempts = [
      { label: 'next day @ 11:00', nextDay: true, time: '1100' },
      { label: 'next day @ 14:00', nextDay: false, time: '1400' },
      { label: 'same day @ 17:00', nextDay: false, time: '1700' },
      { label: 'next day again @ 11:00', nextDay: true, time: '1100' },
      { label: 'same day @ 23:30', nextDay: false, time: '2330' },
    ];

    for (const attempt of attempts) {
      console.log(`[book-now] Search for Gate ${gate}: ${attempt.label}`);
      if (attempt.nextDay) await this.setBookNowNextDay();
      await this.setBookNowTime(attempt.time);
      await this.clickSearchLounges();
      if (await this.hasGateLoungeVisible(gate, 20_000)) {
        console.log(`[book-now] Gate ${gate} lounge found after ${attempt.label}`);
        this.lmsGate = String(gate);
        return dest;
      }
    }

    await expect(this.page.getByText(new RegExp(`Gate\\s*${gate}\\b`, 'i')).first()).toBeVisible({
      timeout: 30_000,
    });
    this.lmsGate = String(gate);
    return dest;
  }

  /**
   * On lounge listing after More at HKG, keep / open Gate 35 lounges only.
   */
  async selectGateOnLoungeListing(gate = '35') {
    const gateRe = new RegExp(`Gate\\s*${gate}\\b`, 'i');
    const tabOrFilter = this.page
      .getByRole('tab', { name: gateRe })
      .or(this.page.getByRole('button', { name: gateRe }))
      .or(this.page.getByRole('link', { name: gateRe }))
      .or(this.page.getByText(new RegExp(`Near\\s+Gate\\s*${gate}\\b`, 'i')));

    await expect(tabOrFilter.first()).toBeVisible({ timeout: 60_000 });
    await tabOrFilter.first().click().catch(() => {});
    await this.settle(1_000);
    await expect(this.page.getByText(gateRe).first()).toBeVisible({ timeout: 30_000 });
    console.log(`[book-now] Lounge listing filtered/selected for Gate ${gate}`);
  }

  /**
   * Click View on a Plaza Premium Lounge card associated with the target gate.
   */
  async openPlazaPremiumLoungeViewForGate(gate = '35') {
    const gateRe = new RegExp(`Near\\s+Gate\\s*${gate}\\b|Gate\\s*${gate}\\b`, 'i');
    await expect(this.page.getByText(gateRe).first()).toBeVisible({ timeout: 60_000 });

    const card = this.page
      .locator('article, .lounge-card, .card, .property, li, section, div')
      .filter({ hasText: gateRe })
      .filter({ has: this.page.getByRole('link', { name: /^View$/i }) })
      .first();

    await this.waitBeforeTransition();
    if (await card.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await card.getByRole('link', { name: /^View$/i }).first().click();
    } else {
      await this.page.getByText(gateRe).first().click().catch(() => {});
      await this.page.getByRole('link', { name: 'View' }).first().click();
    }

    await expect(
      this.page
        .getByRole('heading', { name: /Book your visit/i })
        .or(this.page.getByRole('button', { name: 'Get Price' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
    console.log(`[book-now] Opened PPL View for Gate ${gate}`);
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

  async applyPromoCodeAndVerifyPrice(code) {
    const promoInput = this.page.locator('#minicart-bookingcartsumpromocode');
    // minicart-checkpromobtn is the actual Apply button; lblValPromoCode is the result label
    const applyBtn = this.page.locator('#minicart-checkpromobtn');

    await expect(promoInput).toBeVisible({ timeout: 30_000 });

    const readTotal = () =>
      this.page.evaluate(() => {
        const section = document.getElementById('minicart-bookingsummarysection');
        const root = section || document;
        const el = root.querySelector('.total-amt');
        return el ? el.textContent.trim() : null;
      });

    const priceBefore = await readTotal();
    console.log(`[promo] Cart total before promo: ${priceBefore ?? '(element not identified)'}`);

    await promoInput.fill(code);
    await promoInput.press('Enter');
    await this.settle(1_000);
    await applyBtn.click().catch(() => {});
    await this.settle(2_000);

    const priceAfter = await readTotal();
    console.log(`[promo] Code "${code}" applied — ${priceBefore ?? '?'} → ${priceAfter ?? '?'}`);
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
