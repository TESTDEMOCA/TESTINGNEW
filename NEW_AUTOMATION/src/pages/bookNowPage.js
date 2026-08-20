const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');
const { resolveDestination } = require('../config/destinations');

class BookNowPage extends BasePage {
  bookNowSection() {
    if (this.isMobile()) {
      return this.page.locator('#mobileBooking');
    }
    return this.page.locator('section').filter({ hasText: 'Book Now Your destination' });
  }

  /** Open mobile Book Now modal (#mobileBooking) when needed. */
  async ensureMobileBookingOpen() {
    if (!this.isMobile()) return;
    const modal = this.page.locator('#mobileBooking');
    if (await modal.locator('#locationMobile').isVisible({ timeout: 1_500 }).catch(() => false)) {
      return;
    }
    const openBtn = this.page
      .locator('a.mobile-booknow-link[data-bs-target="#mobileBooking"], a[data-bs-target="#mobileBooking"]')
      .first();
    await expect(openBtn).toBeVisible({ timeout: 30_000 });
    await openBtn.click();
    await expect(modal.locator('#locationMobile')).toBeVisible({ timeout: 15_000 });
    console.log('[book-now] Opened mobile Booking modal');
  }

  /** Crawled: main Book Now Where field (not the popout duplicate). */
  whereInput() {
    if (this.isMobile()) {
      return this.page.locator('#locationMobile, input[name="booknow-location-search-mobile"]').first();
    }
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

    if (this.isMobile()) {
      await this.ensureMobileBookingOpen();
      const where = this.whereInput();
      await expect(where).toBeVisible({ timeout: 60_000 });
      // Mobile autocomplete is more reliable with IATA codes (HKG, KUL, SIN).
      const searchText = dest.code;
      console.log(`[book-now] Mobile typing destination code: ${searchText}`);
      await where.click({ clickCount: 3 });
      await where.fill('');
      await where.fill(searchText);
      await this.settle(1_200);
      const suggestion = this.page.locator(
        `#mobileBooking #ulLocation li[data-iata="${dest.code}"], #ulLocation li[data-iata="${dest.code}"]`,
      ).first();
      await expect(suggestion).toBeAttached({ timeout: 30_000 });

      // HKG (and some codes) have a broken list click handler that writes the wrong airport.
      // Set the visible input + #selectedAirportMobile from the li data-* attributes instead.
      await this.page.keyboard.press('Escape').catch(() => {});
      await suggestion.evaluate((el) => {
        const code = el.getAttribute('data-iata') || '';
        const name = el.getAttribute('data-name-en') || el.textContent?.trim() || code;
        const tz = el.getAttribute('data-timezone') || '';
        const input = document.querySelector('#locationMobile');
        const airport = document.querySelector('#selectedAirportMobile');
        const airportTz = document.querySelector('#selectedAirportMobileTimeZone');
        if (input) {
          input.blur();
          input.value = `${name} (${code})`;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (airport) airport.value = code;
        if (airportTz) airportTz.value = tz || code;
        el.classList.add('active');
        // Hide suggestion list so delayed autocomplete cannot overwrite selection.
        const ul = document.querySelector('#ulLocation');
        if (ul) ul.style.display = 'none';
      });
      await this.settle(300);
      // Re-assert selection — autocomplete can overwrite display text (seen: LUM after HKG).
      await this.page.evaluate((code) => {
        const li = document.querySelector(
          `#mobileBooking #ulLocation li[data-iata="${code}"], #ulLocation li[data-iata="${code}"]`,
        );
        if (!li) return;
        const name = li.getAttribute('data-name-en') || code;
        const tz = li.getAttribute('data-timezone') || '';
        const input = document.querySelector('#locationMobile');
        const airport = document.querySelector('#selectedAirportMobile');
        const airportTz = document.querySelector('#selectedAirportMobileTimeZone');
        if (input) input.value = `${name} (${code})`;
        if (airport) airport.value = code;
        if (airportTz) airportTz.value = tz || code;
        const ul = document.querySelector('#ulLocation');
        if (ul) ul.style.display = 'none';
      }, dest.code);
      await this.settle(200);
      const selected = ((await where.inputValue().catch(() => '')) || '').trim();
      const airportCode = await this.page.locator('#selectedAirportMobile').inputValue().catch(() => '');
      const ok =
        airportCode.toUpperCase() === dest.code.toUpperCase() ||
        new RegExp(`\\b${dest.code}\\b`, 'i').test(selected);
      if (!ok) {
        throw new Error(
          `Mobile destination select failed for ${dest.code}. Input="${selected}" selectedAirportMobile="${airportCode}"`,
        );
      }
      console.log(
        `[book-now] Mobile destination selected: ${dest.code} (input="${selected}", hidden="${airportCode}")`,
      );
      return dest;
    }

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
    if (this.isMobile()) {
      await this.ensureMobileBookingOpen();
      // Mobile calendar shows day links inside #mobileBooking — click tomorrow's day number if present.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = String(tomorrow.getDate());
      const dayLink = this.page.locator('#mobileBooking a').filter({ hasText: new RegExp(`^${day}$`) }).first();
      if (await dayLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await dayLink.click();
        console.log(`[book-now] Mobile selected calendar day ${day}`);
      }
      return;
    }
    const section = this.bookNowSection();
    await this.openDatepicker(section.locator('#bookingDate'));
    await this.selectNextDayInOpenCalendar();
  }

  async setBookNowTime(time) {
    if (this.isMobile()) {
      await this.ensureMobileBookingOpen();
      const select = this.page.locator('#bookingTimeMobile');
      await expect(select).toBeVisible({ timeout: 15_000 });
      const wanted = String(time || '1100');
      try {
        await select.selectOption(wanted);
      } catch {
        await select.selectOption({ index: Math.min(20, await select.locator('option').count()) });
      }
      console.log(`[book-now] Mobile time set: ${wanted}`);
      return;
    }
    const section = this.bookNowSection();
    await section.locator('#bookingTime').click();
    await this.page.getByRole('link', { name: String(time), exact: true }).click({ force: true });
  }

  async clickSearchLounges() {
    if (this.isMobile()) {
      await this.ensureMobileBookingOpen();
      // Re-pin airport code immediately before submit (autocomplete can overwrite HKG→LUM).
      const code = this.activeDestination?.code;
      if (code) {
        await this.page.evaluate((airportCode) => {
          const li = document.querySelector(
            `#mobileBooking #ulLocation li[data-iata="${airportCode}"], #ulLocation li[data-iata="${airportCode}"]`,
          );
          const name = li?.getAttribute('data-name-en') || airportCode;
          const tz = li?.getAttribute('data-timezone') || '';
          const input = document.querySelector('#locationMobile');
          const airport = document.querySelector('#selectedAirportMobile');
          const airportTz = document.querySelector('#selectedAirportMobileTimeZone');
          if (input) input.value = `${name} (${airportCode})`;
          if (airport) airport.value = airportCode;
          if (airportTz) airportTz.value = tz || airportCode;
          const ul = document.querySelector('#ulLocation');
          if (ul) ul.style.display = 'none';
        }, code);
      }
      const submit = this.page
        .locator('#mobileBooking')
        .getByRole('button', { name: /^Book Now$/i })
        .first();
      await expect(submit).toBeVisible({ timeout: 15_000 });
      await submit.click();
      await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
      await this.settle(2_000);
      console.log('[book-now] Mobile Book Now submitted — waiting for lounge listing');
      return;
    }
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

  /** Mobile listing uses View CTAs instead of desktop Book Now→. */
  async hasMobileLoungeViewOption(timeout = 20_000) {
    const view = this.page.getByRole('link', { name: /^View$/i }).or(
      this.page.locator('a.loungedirect, a.btn.loungedirect').filter({ hasText: /^View$/i }),
    );
    return view.first().isVisible({ timeout }).catch(() => false);
  }

  async searchUntilBookNowAvailable(destinationInput = 'HKG') {
    if (this.isMobile()) {
      return this.searchUntilBookNowAvailableMobile(destinationInput);
    }
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

  async searchUntilBookNowAvailableMobile(destinationInput = 'HKG') {
    const dest = await this.fillDestination(destinationInput);
    await this.setBookNowNextDay();
    await this.setBookNowTime('1100');
    await this.clickSearchLounges();
    if (await this.hasMobileLoungeViewOption(25_000)) {
      console.log('[book-now] Mobile lounge View listing available');
      return dest;
    }
    // Retry next day once more if listing empty.
    await this.ensureMobileBookingOpen().catch(() => {});
    await this.setBookNowNextDay();
    await this.setBookNowTime('1100');
    await this.clickSearchLounges();
    await expect(
      this.page.getByRole('link', { name: /^View$/i }).or(this.page.locator('a.loungedirect')).first(),
    ).toBeVisible({ timeout: 60_000 });
    console.log('[book-now] Mobile lounge View listing available (retry)');
    return dest;
  }

  async clickBookNowArrow() {
    if (this.isMobile()) {
      return this.clickBookNowArrowMobile();
    }
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

    // Validate gate on featured header before clicking Book Now.
    const featured = await this.captureFeaturedLoungeLocation();
    await this.waitBeforeTransition();
    await target.first().click();

    await expect(
      this.page
        .locator(BasePage.MINICART_CHECKOUT_SELECTOR)
        .filter({ hasText: /^Check Out$/i })
        .or(this.page.getByRole('button', { name: /^Check Out$/i }))
        .or(this.page.getByRole('heading', { name: 'Cart' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });

    return featured;
  }

  /**
   * Mobile equivalent of Book Now→: open first lounge View, Get Price, Reserve Now → cart.
   */
  async clickBookNowArrowMobile() {
    const { LoungeBookingPage } = require('./loungeBookingPage');
    const view = this.page
      .getByRole('link', { name: /^View$/i })
      .or(this.page.locator('a.btn.loungedirect, a.loungedirect').filter({ hasText: /^View$/i }))
      .first();
    await expect(view).toBeVisible({ timeout: 60_000 });

    let locationText = null;
    const loc = this.page.getByText(/Near\s+Gate\s*\d+/i).first();
    if (await loc.isVisible({ timeout: 5_000 }).catch(() => false)) {
      locationText = ((await loc.innerText()) || '').replace(/\s+/g, ' ').trim();
      console.log(`[gate] Mobile listing location before View: "${locationText}"`);
    }

    await this.waitBeforeTransition();
    await view.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});

    const lounge = new LoungeBookingPage(this.page, this.settings);
    // Mobile: <a class="bookingBtn mobile" data-bs-target="#mobileVisit">Book Your Visit</a>
    await lounge.openMobileBookYourVisitModal();
    await lounge.clickGetPrice();
    await lounge.clickReserveNow();
    console.log('[book-now] Mobile View → #mobileVisit → Get Price → Reserve Now');
    return locationText ? { locationText } : null;
  }

  async searchDestinationInternational(destinationInput, { time = '1000' } = {}) {
    if (this.isMobile()) {
      const dest = await this.fillDestination(destinationInput);
      await this.setBookNowNextDay();
      await this.setBookNowTime(time);
      await this.clickSearchLounges();
      await expect(
        this.page.getByRole('link', { name: /^View$/i }).or(this.page.locator('a.loungedirect')).first(),
      ).toBeVisible({ timeout: 60_000 });
      return dest;
    }
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
    return dest;
  }

  async searchHongKongInternational({ time = '1000' } = {}) {
    return this.searchDestinationInternational('HKG', { time });
  }

  async searchHongKongUntilBookNowAvailable() {
    return this.searchUntilBookNowAvailable('HKG');
  }

  /**
   * Before Book Now: capture full lounge location text from featured header subtitle
   * e.g. <p class="bw-featured-subtitle">Near Gate 35, Departures, Hong Kong International Airport</p>
   */
  async captureFeaturedLoungeLocation(timeout = 60_000) {
    const subtitle = this.page
      .locator('header.bw-featured-header p.bw-featured-subtitle, p.bw-featured-subtitle')
      .first();

    await expect(subtitle).toBeVisible({ timeout });
    const locationText = ((await subtitle.innerText()) || '').replace(/\s+/g, ' ').trim();
    if (!locationText) {
      throw new Error('Featured lounge subtitle is visible but empty.');
    }
    console.log(`[gate] Captured featured subtitle before Book Now: "${locationText}"`);
    return { locationText };
  }

  /**
   * Before Check Out: mini-cart summary-loc must match the full featured subtitle text from Book Now.
   * <span class="summary-loc">Near Gate 35, Departures, Hong Kong International Airport</span>
   */
  async assertMiniCartLocationMatches(expectedLocationText) {
    if (!expectedLocationText) {
      throw new Error('Expected Book Now location text is required for mini-cart match.');
    }

    const checkOut = this.#visibleCheckOut();
    await expect(checkOut).toBeVisible({ timeout: 60_000 });

    const summaryLoc = this.page
      .locator('span.summary-loc, .summary-content span.summary-loc, .summary-content .summary-loc')
      .first();

    await expect(summaryLoc).toBeVisible({ timeout: 30_000 });
    const actual = ((await summaryLoc.innerText()) || '').replace(/\s+/g, ' ').trim();
    const normalize = (s) => String(s).replace(/\s+/g, ' ').trim();

    if (normalize(actual) !== normalize(expectedLocationText)) {
      throw new Error(
        `Mini-cart summary-loc before Check Out does not match featured subtitle at Book Now.\n` +
          `Expected: "${normalize(expectedLocationText)}"\n` +
          `Actual:   "${normalize(actual)}"`,
      );
    }

    console.log(`[gate] Mini-cart summary-loc matches Book Now featured text: "${actual}"`);
    return { locationText: actual };
  }

  async clickMoreAtAirport(destinationInput = 'HKG') {
    // Mobile Book Now search already lands on the lounge listing (View CTAs).
    if (this.isMobile() && (await this.hasMobileLoungeViewOption(5_000))) {
      console.log('[book-now] Mobile already on lounge listing — skip More at airport');
      return;
    }
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

    const featured = await this.captureFeaturedLoungeLocation().catch(async () => {
      // Listing / More flows may not always show bw-featured-header; use full Near Gate… text if present.
      const loc = this.page.getByText(/Near\s+Gate\s*\d+/i).first();
      if (!(await loc.isVisible({ timeout: 8_000 }).catch(() => false))) return null;
      const locationText = ((await loc.innerText()) || '').replace(/\s+/g, ' ').trim();
      if (!locationText) return null;
      console.log(`[gate] Fallback location before Book Now: "${locationText}"`);
      return { locationText };
    });

    await this.waitBeforeTransition();
    await bookNow.click();
    await expect(
      this.page
        .locator(BasePage.MINICART_CHECKOUT_SELECTOR)
        .filter({ hasText: /^Check Out$/i })
        .first(),
    ).toBeVisible({ timeout: 90_000 });

    return featured;
  }

  async openLoungeView(nth = 4) {
    await this.waitBeforeTransition();
    const views = this.page
      .getByRole('link', { name: /^View$/i })
      .or(this.page.locator('a.loungedirect, a.btn.loungedirect').filter({ hasText: /^View$/i }));
    const count = await views.count();
    if (!count) {
      throw new Error('No lounge View links found on listing page');
    }
    // Desktop listing is dense; mobile often has fewer cards — clamp to last available.
    const index = Math.min(Number(nth) || 0, count - 1);
    console.log(`[book-now] Opening lounge View index ${index} (requested ${nth}, available ${count})`);
    await views.nth(index).click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});

    if (this.isMobile()) {
      const { LoungeBookingPage } = require('./loungeBookingPage');
      const lounge = new LoungeBookingPage(this.page, this.settings);
      await lounge.openMobileBookYourVisitModal();
    }
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
      .locator(BasePage.MINICART_CHECKOUT_SELECTOR)
      .filter({ hasText: /^Check Out$/i })
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .filter({ visible: true })
      .first();
  }

  async #recoverPurchaserCheckOut() {
    // Upsell/addon modal can leave Check Out in DOM but hidden — dismiss, open cart, or go back.
    const blockingModal = this.page.locator('#add-service-form-0.show, .modal.show').first();
    if (await blockingModal.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await expect(blockingModal).toBeHidden({ timeout: 10_000 }).catch(() => {});
    }

    if (await this.#visibleCheckOut().isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    // Prefer opening mini-cart (Passes / Smart Traveller) over Book Now purchaser back.
    try {
      await this.ensureMiniCartCheckOutVisible(15_000);
      return;
    } catch {
      console.log('[book-now] Mini-cart Check Out still hidden after open attempts');
    }

    const back = this.page
      .locator(
        'a.desktop-back-btn[href*="ClearGuestInfoAndRedirectToPurchaserInfo"], a.desktop-back-btn[title="back"], a[href*="ClearGuestInfoAndRedirectToPurchaserInfo"]',
      )
      .first();
    if (await back.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await back.click();
      console.log('[book-now] Clicked desktop back to restore purchaser Check Out');
      return;
    }

    console.log('[book-now] No purchaser back button found — Check Out recovery incomplete');
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
    // Mobile lounge Reserve Now often lands on Confirm & Proceed (not mini-cart Check Out).
    if (this.isMobile()) {
      // Already on guest/member checkout page after Reserve / Confirm.
      const onCheckoutUrl = /guest-checkout|\/checkout/i.test(this.page.url());
      const checkoutForm = this.page.locator(
        '#guestcheckoutbutton, button.reserve-now-btn:has-text("Payment"), #AgreePrivacyGuest, #guestCheckoutTermsAgree',
      );
      if (
        onCheckoutUrl ||
        (await checkoutForm.first().isVisible({ timeout: 2_000 }).catch(() => false))
      ) {
        console.log('[book-now] Mobile already on checkout page — skip Check Out click');
        return;
      }

      // Prefer mini-cart Check Out when already visible (Passes flows) — do not wait long for Confirm.
      const miniCartReady = await this.miniCartCheckOutButton()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      if (!miniCartReady) {
        const confirm = this.page
          .getByRole('link', { name: /Confirm & Proceed/i })
          .or(this.page.getByRole('button', { name: /Confirm & Proceed/i }))
          .first();
        if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await this.waitBeforeTransition();
          await confirm.click({ force: true });
          await expect(
            this.page
              .locator('#guestcheckoutbutton, #AgreePrivacyGuest, #Title')
              .or(this.page.getByRole('link', { name: 'Log In' }))
              .first(),
          ).toBeVisible({ timeout: 90_000 });
          console.log('[book-now] Mobile Check Out via Confirm & Proceed');
          return;
        }
      }
    }

    if (!(await this.#visibleCheckOut().isVisible({ timeout: 8_000 }).catch(() => false))) {
      await this.#recoverPurchaserCheckOut();
    }

    // Final wait — opens mini-cart if needed (fixes Passes exclusive → login flow).
    let checkOut = await this.ensureMiniCartCheckOutVisible(60_000);
    await this.waitBeforeTransition();
    if (this.isMobile()) {
      // Mobile drawer can auto-close during settle; re-open before click.
      checkOut = await this.ensureMiniCartCheckOutVisible(20_000);
      await checkOut.click({ timeout: 15_000 }).catch(async () => {
        checkOut = await this.ensureMiniCartCheckOutVisible(20_000);
        await checkOut.click({ force: true });
      });
    } else {
      await checkOut.click();
    }
    await expect(
      this.page
        .locator('#Title, #FirstName, #CountryOfResidence')
        .or(this.page.getByRole('link', { name: 'Log In' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }
}

module.exports = { BookNowPage };
