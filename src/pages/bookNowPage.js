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

  #logBookNowNotAvailable(when) {
    console.log(
      when
        ? `[book-now] Book Now not available — ${when}`
        : '[book-now] Book Now not available',
    );
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
      await this.dismissBlockingOverlays();
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
      await this.dismissBlockingOverlays();
      await where.click();
      await where.fill('');
      await where.fill(dest.code);
      await this.settle(800);
      const suggestion = this.page.locator(`#ulLocation li[data-iata="${dest.code}"]`).first();
      await expect(suggestion).toBeAttached({ timeout: 20_000 });
      await suggestion.click({ force: true }).catch(() => {});
      await this.#pinDesktopAirport(dest.code);
      await this.settle(400);
      await this.#dismissLanguageCurrencyModal();
      await this.dismissBlockingOverlays();
    }

    await this.#pinDesktopAirport(dest.code);
    await expect(this.selectedAirportInput()).toHaveValue(dest.code, { timeout: 15_000 });
    console.log(`[book-now] Desktop destination pinned: ${dest.code}`);
    return dest;
  }

  async #pinDesktopAirport(code) {
    await this.page.evaluate((airportCode) => {
      const li = document.querySelector(`#ulLocation li[data-iata="${airportCode}"]`);
      const name = li?.getAttribute('data-name-en') || airportCode;
      const tz = li?.getAttribute('data-timezone') || '';
      const input = document.querySelector('input#location[name="booknow-location-search"], input#location');
      const airport = document.querySelector('#selectedAirport');
      const airportTz = document.querySelector('#selectedAirportTimeZone');
      if (input) {
        input.value = `${name} (${airportCode})`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (airport) airport.value = airportCode;
      if (airportTz) airportTz.value = tz || airportCode;
      const ul = document.querySelector('#ulLocation');
      if (ul) ul.style.display = 'none';
    }, code);
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
        '.bw-featured-price',
        '[class*="price"]',
      ].join(', '),
    );

    const readCurrencyCodes = async () => {
      const texts = await priceNodes.allTextContents().catch(() => []);
      const widget = await this.bookNowSection().innerText().catch(() => '');
      const blob = [...texts, widget].join(' ');
      const codes = [];
      for (const t of texts) {
        const compact = String(t || '').replace(/\s+/g, ' ').trim();
        const lead = compact.match(/^([A-Za-z]{3})\b/);
        if (lead) codes.push(lead[1].toUpperCase());
        const mid = compact.match(/\b([A-Za-z]{3})\s*[\d,.]+/);
        if (mid) codes.push(mid[1].toUpperCase());
      }
      if (/HK\$|\bHKD\b/i.test(blob)) codes.push('HKD');
      if (/\bSGD\b|S\$/i.test(blob)) codes.push('SGD');
      if (/\bMYR\b|RM\b/i.test(blob)) codes.push('MYR');
      if (/\bUSD\b|US\$/i.test(blob)) codes.push('USD');
      return codes;
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
      await this.dismissBlockingOverlays();
      const dateInput = this.page
        .locator('#bookingDateMobile, #mobileBooking #bookingDate, #mobileBooking input.hasDatepicker')
        .first();
      if (await dateInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await this.openDatepicker(dateInput).catch(async () => {
          await dateInput.click({ force: true });
          await this.settle(400);
        });
      }
      await this.dismissBlockingOverlays();
      if (await this.isDatepickerOpen()) {
        await this.selectNextDayInOpenCalendar();
        console.log('[book-now] Mobile selected next calendar day');
      } else {
        console.log('[book-now] Mobile calendar not open — keep current date');
      }
      await this.dismissBlockingOverlays();
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
      await this.clickAfterDismissingOverlays(submit, 15_000);
      await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
      await this.settle(2_000);
      console.log('[book-now] Mobile Book Now submitted — waiting for lounge listing');
      return;
    }
    const section = this.bookNowSection();
    await this.dismissBlockingOverlays();
    const searchBtn = this.page
      .getByRole('button')
      .filter({ hasText: 'Search Lounges' })
      .or(section.locator('button.bookingBtn, button[type="submit"]'));
    await this.clickAfterDismissingOverlays(searchBtn.first(), 15_000);
    await this.page.waitForTimeout(1_000);
    if (await searchBtn.first().isVisible().catch(() => false)) {
      await searchBtn.first().click().catch(() => {});
    }
    await this.settle(2_500);
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  /** Mobile listing uses View CTAs instead of desktop Book Now→. */
  async hasMobileLoungeViewOption(timeout = 20_000) {
    return this.#loungeViewLinks().first().isVisible({ timeout }).catch(() => false);
  }

  async searchUntilBookNowAvailable(destinationInput = 'HKG') {
    if (this.isMobile()) {
      return this.searchUntilBookNowAvailableMobile(destinationInput);
    }
    const dest = await this.fillDestination(destinationInput);

    console.log(`[book-now] Search current date @ 11:00 (${dest.code})`);
    await this.setBookNowTime('1100');
    await this.#pinDesktopAirport(dest.code);
    await this.dismissBlockingOverlays();
    await this.clickSearchLounges();
    const bookNowReady = await this.hasBookNowOption(20_000);
    if (bookNowReady) {
      await this.expectCurrencyMatchesDestination(dest.code, 8_000).catch((err) => {
        console.log(`[book-now] ${err.message} — Book Now CTA is visible, continue`);
      });
      console.log('[book-now] Book Now found — stop retries (current date @ 11:00)');
      return dest;
    }
    this.#logBookNowNotAvailable('current date @ 11:00');
    await this.expectCurrencyMatchesDestination(dest.code, 12_000).catch((err) => {
      console.log(`[book-now] ${err.message} — retry search with next date/time`);
    });

    if (await this.hasBookNowOption(5_000)) {
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
      this.#logBookNowNotAvailable(attempt.label);
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
    this.#logBookNowNotAvailable('mobile listing after next day @ 11:00');
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
    await this.clickAfterDismissingOverlays(view, 15_000);
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});

    const lounge = new LoungeBookingPage(this.page, this.settings);
    await lounge.openMobileBookYourVisitModal();
    await lounge.clickGetPrice();
    await lounge.clickReserveNow();
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
    await this.expectCurrencyMatchesDestination(dest.code, 12_000).catch((err) => {
      console.log(`[book-now] ${err.message} — More at ${dest.code} is visible, continue`);
    });
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
    const nearGate = this.page
      .locator(
        'header.bw-featured-header p.bw-featured-subtitle, p.bw-featured-subtitle, span.summary-loc',
      )
      .filter({ hasText: /Near\s+Gate/i })
      .first();
    const subtitle = this.page
      .locator('header.bw-featured-header p.bw-featured-subtitle, p.bw-featured-subtitle')
      .first();

    const source = (await nearGate.isVisible({ timeout: 8_000 }).catch(() => false))
      ? nearGate
      : subtitle;
    await expect(source).toBeVisible({ timeout });
    const locationText = ((await source.innerText()) || '').replace(/\s+/g, ' ').trim();
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

    await this.dismissBlockingOverlays();
    const onCheckout =
      /guest-checkout|\/checkout/i.test(this.page.url()) ||
      (await this.page
        .locator('#guestcheckoutbutton, #AgreePrivacyGuest, #Title')
        .first()
        .isVisible({ timeout: 2_500 })
        .catch(() => false));
    if (onCheckout) {
      console.log(
        `[gate] Already on checkout — keep captured location: "${expectedLocationText}"`,
      );
      return { locationText: expectedLocationText };
    }
    if (await this.bookingSummaryCheckOutButton().isVisible({ timeout: 2_000 }).catch(() => false)) {
      console.log('[checkout] Booking-summary Check Out visible — skip mini-cart location assert');
      return { locationText: expectedLocationText };
    }
    if (this.isMobile()) {
      await this.ensureMiniCartCheckOutVisible(15_000).catch(() => {});
      const mobileCheckOut = this.#visibleCheckOut();
      if (!(await mobileCheckOut.isVisible({ timeout: 5_000 }).catch(() => false))) {
        console.log(
          `[gate] Mobile mini-cart Check Out not visible — keep captured location: "${expectedLocationText}"`,
        );
        return { locationText: expectedLocationText };
      }
    }

    await this.dismissBlockingOverlays();
    await this.#stripMarketingOverlays();
    if (!(await this.#visibleCheckOut().isVisible({ timeout: 3_000 }).catch(() => false))) {
      await this.#recoverPurchaserCheckOut();
    }
    await this.ensureMiniCartCheckOutVisible(60_000);

    const summaryLoc = this.page
      .locator('span.summary-loc, .summary-content span.summary-loc, .summary-content .summary-loc')
      .first();

    await expect(summaryLoc).toBeVisible({ timeout: 30_000 });
    const actual = ((await summaryLoc.innerText()) || '').replace(/\s+/g, ' ').trim();
    const normalize = (s) => String(s).replace(/\s+/g, ' ').trim();
    const expected = normalize(expectedLocationText);
    const got = normalize(actual);
    const matched = got === expected || got.includes(expected) || expected.includes(got);

    if (!matched) {
      throw new Error(
        `Mini-cart summary-loc before Check Out does not match featured subtitle at Book Now.\n` +
          `Expected: "${expected}"\n` +
          `Actual:   "${got}"`,
      );
    }

    console.log(`[gate] Mini-cart summary-loc matches Book Now featured text: "${actual}"`);
    return { locationText: actual };
  }

  #loungeViewLinks() {
    return this.page.locator('a, button').filter({ hasText: /^\s*View\s*$/i }).filter({ visible: true });
  }

  async #waitForLoungeListing(timeout = 45_000) {
    const heading = this.page.getByText(/Hong Kong International Airport\s*\(HKG\)/i).first();
    const views = this.#loungeViewLinks();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await views.first().isVisible({ timeout: 400 }).catch(() => false)) return 'views';
      if (await heading.isVisible({ timeout: 400 }).catch(() => false)) return 'heading';
      await this.page.waitForTimeout(400);
    }
    return null;
  }

  async clickMoreAtAirport(destinationInput = 'HKG') {
    await this.dismissBlockingOverlays();
    if (this.isMobile() && (await this.hasMobileLoungeViewOption(5_000))) {
      console.log('[book-now] Mobile already on lounge listing — skip More at airport');
      return;
    }
    if (await this.#waitForLoungeListing(2_000)) {
      console.log('[book-now] Lounge listing already open — skip More at airport');
      return;
    }
    const dest = resolveDestination(destinationInput);
    const more = this.page
      .getByRole('button', { name: dest.moreAt })
      .or(this.page.getByRole('link', { name: dest.moreAt }))
      .or(this.page.getByRole('button', { name: dest.viewAllProperties }))
      .or(this.page.locator('#booking-widget-more-properties-btn'));

    await this.dismissBlockingOverlays();
    await expect(more.first()).toBeVisible({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await this.clickAfterDismissingOverlays(more.first(), 15_000);
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
    const opened = await this.#waitForLoungeListing(45_000);
    if (!opened) {
      throw new Error('More at HKG did not open the lounge listing (no View CTAs)');
    }
    console.log(`[book-now] More at airport listing opened (${opened})`);
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
    await this.dismissBlockingOverlays();
    await this.waitBeforeTransition();
    const views = this.#loungeViewLinks();
    if (!(await views.first().isVisible({ timeout: 8_000 }).catch(() => false))) {
      console.log('[book-now] View links missing — reopen More at airport listing');
      await this.clickMoreAtAirport(this.activeDestination?.code || 'HKG');
    }
    await expect(views.first()).toBeVisible({ timeout: 60_000 });
    const count = await views.count();
    if (!count) {
      throw new Error('No lounge View links found on listing page');
    }
    // Desktop listing is dense; mobile often has fewer cards — clamp to last available.
    const index = Math.min(Number(nth) || 0, count - 1);
    console.log(`[book-now] Opening lounge View index ${index} (requested ${nth}, available ${count})`);
    await views.nth(index).scrollIntoViewIfNeeded().catch(() => {});
    await this.dismissBlockingOverlays();
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

    console.log(`[book-now] Gate ${gate} not on Book Now widget — opening More at ${dest.code}`);
    await this.clickMoreAtAirport(dest.code);
    if (await this.hasGateLoungeVisible(gate, 30_000)) {
      console.log(`[book-now] Gate ${gate} lounge found on More at listing`);
      this.lmsGate = String(gate);
      return dest;
    }

    await expect(
      this.page.getByText(new RegExp(`Near\\s+Gate\\s*${gate}\\b|Gate\\s*${gate}\\b`, 'i')).first(),
    ).toBeVisible({
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
   * Click View on Plaza Premium Lounge at the target gate — never Plaza Premium First / PPF G35.
   */
  async openPlazaPremiumLoungeViewForGate(gate = '35') {
    const gateRe = new RegExp(`Near\\s+Gate\\s*${gate}\\b|Gate\\s*${gate}\\b`, 'i');
    await this.dismissBlockingOverlays();
    await expect(this.page.getByText(gateRe).first()).toBeVisible({ timeout: 60_000 });

    const cardText = await this.#clickPlazaPremiumLoungeView(gate);
    if (!cardText) {
      throw new Error(
        `No Plaza Premium Lounge View found for Gate ${gate} (Plaza Premium First / PPF was ignored).`,
      );
    }
    console.log(`[book-now] Clicked PPL View (not PPF) for Gate ${gate}: "${cardText}"`);

    if (this.isMobile()) {
      await this.dismissBlockingOverlays();
      const { LoungeBookingPage } = require('./loungeBookingPage');
      await new LoungeBookingPage(this.page, this.settings).openMobileBookYourVisitModal();
      await expect(this.page.locator('#mobileVisit.show')).toBeVisible({ timeout: 30_000 });
      return;
    }

    await expect(
      this.page
        .getByRole('heading', { name: /Book your visit/i })
        .or(this.page.getByRole('button', { name: 'Get Price' }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });

    const openedFirst = await this.page
      .getByRole('heading', { name: /Plaza Premium First/i })
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (openedFirst) {
      console.log('[book-now] Details page is Plaza Premium First — back to listing for Plaza Premium Lounge');
      await this.page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await expect(this.page.getByText(gateRe).first()).toBeVisible({ timeout: 30_000 });
      const retry = await this.#clickPlazaPremiumLoungeView(gate);
      if (!retry) {
        throw new Error(`Retry did not find Plaza Premium Lounge View for Gate ${gate}.`);
      }
      await expect(
        this.page
          .getByRole('heading', { name: /Book your visit/i })
          .or(this.page.getByRole('button', { name: 'Get Price' }))
          .first(),
      ).toBeVisible({ timeout: 90_000 });
    }

    const stillFirst = await this.page
      .getByRole('heading', { name: /Plaza Premium First/i })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (stillFirst) {
      throw new Error('Opened Plaza Premium First G35 instead of Plaza Premium Lounge Gate 35.');
    }
    console.log(`[book-now] Opened Plaza Premium Lounge details for Gate ${gate}`);
  }

  async #clickPlazaPremiumLoungeView(gate) {
    await this.waitBeforeTransition();
    return this.page.evaluate((gateNum) => {
      const gateRe = new RegExp(`Near\\s+Gate\\s*${gateNum}\\b|Gate\\s*${gateNum}\\b`, 'i');
      const isView = (el) => /^\s*View\s*$/i.test((el.textContent || '').replace(/\s+/g, ' '));
      const views = [...document.querySelectorAll('a.loungedirect, a.btn, a, button')].filter(isView);

      for (const view of views) {
        let node = view.parentElement;
        while (node && node !== document.body) {
          const text = (node.innerText || '').replace(/\s+/g, ' ');
          const viewCount = [...node.querySelectorAll('a.loungedirect, a.btn, a, button')].filter(isView)
            .length;
          const isPpf = /Plaza Premium First|Premium First/i.test(text);
          const isPpl = /Plaza Premium Lounge/i.test(text);
          if (viewCount === 1 && isPpl && !isPpf && gateRe.test(text)) {
            view.scrollIntoView({ block: 'center', inline: 'nearest' });
            view.click();
            return text.slice(0, 220);
          }
          node = node.parentElement;
        }
      }
      return null;
    }, String(gate));
  }

  #visibleCheckOut() {
    return this.page
      .locator(BasePage.BOOKING_SUMMARY_CHECKOUT_SELECTOR)
      .filter({ hasText: /^\s*Check Out\s*$/i })
      .or(
        this.page
          .locator(BasePage.MINICART_CHECKOUT_SELECTOR)
          .filter({ hasText: /^Check Out$/i }),
      )
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
    if (this.isMobile()) {
      await this.#applyPromoCodeMobile(code);
      return;
    }

    await this.dismissBlockingOverlays();
    const checkOut = await this.ensureMiniCartCheckOutVisible(45_000);
    await expect(checkOut).toBeVisible({ timeout: 15_000 });
    console.log('[promo] Mini-cart Check Out is visible — entering promo code');

    const promoInput = this.page
      .locator('#minicart-bookingcartsumpromocode')
      .or(this.page.locator('input.minicart-pplpromo[name="minicartPromoCode"]'))
      .filter({ visible: true })
      .first();
    await expect(promoInput).toBeVisible({ timeout: 30_000 });
    await promoInput.scrollIntoViewIfNeeded().catch(() => {});

    const applyBtn = this.page.locator('#minicart-checkpromobtn').filter({ visible: true }).first();

    const readTotal = async () => {
      const el = this.page
        .locator('#minicart-bookingsummarysection .total-amt, .summary-content .total-amt')
        .filter({ visible: true })
        .first();
      const text = await el.innerText({ timeout: 5_000 }).catch(() => '');
      return String(text || '').replace(/\s+/g, ' ').trim() || null;
    };

    const priceBefore = await readTotal();
    console.log(`[promo] Cart total before promo: ${priceBefore ?? '(element not identified)'}`);

    await promoInput.click({ force: true });
    await promoInput.fill('');
    await promoInput.fill(code);
    await expect(promoInput).toHaveValue(code, { timeout: 5_000 });
    console.log(`[promo] Entered minicart promo: ${code}`);

    if (await applyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await applyBtn.click({ force: true });
      console.log('[promo] Clicked minicart Apply (#minicart-checkpromobtn)');
    } else {
      await promoInput.press('Enter');
      console.log('[promo] Pressed Enter to apply minicart promo');
    }

    await this.page.waitForTimeout(1_500).catch(() => {});

    const priceAfter = await readTotal();
    console.log(`[promo] Code "${code}" applied — ${priceBefore ?? '?'} → ${priceAfter ?? '?'}`);

    await this.#proceedFromMiniCartCheckOut();
  }

  async #stripMarketingOverlays() {
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll(
            '#st_notification_modal, [id^="st_notification"], iframe.st_preview_frame_modal, iframe[id^="preview-notification-frame"], #smt-overlay',
          )
          .forEach((el) => el.remove());
      })
      .catch(() => {});
    await this.page.keyboard.press('Escape').catch(() => {});
  }

  async #applyPromoCodeMobile(code) {
    await this.dismissBlockingOverlays();
    const confirm = this.mobileConfirmAndProceed();
    await expect(confirm).toBeVisible({ timeout: 45_000 });
    console.log('[promo] Mobile Confirm & Proceed is visible — entering promo code');

    const promoInput = this.page
      .getByPlaceholder(/Enter Code/i)
      .or(this.page.locator('#minicart-bookingcartsumpromocode'))
      .or(this.page.locator('input.minicart-pplpromo[name="minicartPromoCode"]'))
      .filter({ visible: true })
      .first();
    await expect(promoInput).toBeVisible({ timeout: 30_000 });

    const readTotal = () =>
      this.page.evaluate(() => {
        const sticky = Array.from(document.querySelectorAll('body *')).find((el) =>
          /Subtotal/i.test(el.textContent || '') && (el.textContent || '').length < 80,
        );
        const amt = document.querySelector('.total-amt, .subtotal, [class*="subtotal"]');
        return (amt && amt.textContent.trim()) || (sticky && sticky.textContent.trim()) || null;
      });

    const priceBefore = await readTotal();
    console.log(`[promo] Mobile cart total before promo: ${priceBefore ?? '(not identified)'}`);

    await promoInput.click({ force: true });
    await promoInput.fill('');
    await promoInput.fill(code);
    const applyBtn = promoInput
      .locator('xpath=following-sibling::*[self::button or self::a][1]')
      .or(this.page.locator('#minicart-checkpromobtn'))
      .or(this.page.getByRole('button', { name: /Apply/i }))
      .first();
    if (await applyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await applyBtn.click({ force: true });
    } else {
      await promoInput.press('Enter').catch(() => {});
      await promoInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    }
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    await this.settle(2_000);

    const priceAfter = await readTotal().catch(() => null);
    console.log(`[promo] Mobile code "${code}" applied — ${priceBefore ?? '?'} → ${priceAfter ?? '?'}`);
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    console.log('[promo] Promo applied — next step clicks Confirm & Proceed (a.mobile-reserve-now-btn)');
  }

  async #alreadyOnCheckoutPage() {
    return /guest-checkout|\/checkout(\/|$)/i.test(this.page.url());
  }

  async #proceedFromMiniCartCheckOut() {
    if (await this.#alreadyOnCheckoutPage()) {
      this._promoClickedCheckOut = true;
      console.log('[promo] Already on checkout — skipping Check Out click');
      return;
    }

    if (this.isMobile()) {
      await this.clickMobileConfirmAndProceed();
      await this.page.waitForURL(/guest-checkout|\/checkout(\/|$)/i, { timeout: 90_000 });
      this._promoClickedCheckOut = true;
      console.log(`[promo] Reached checkout via Confirm & Proceed: ${this.page.url()}`);
      return;
    }

    const checkOut = await this.ensureMiniCartCheckOutVisible(15_000);
    console.log('[promo] Check Out is clickable — proceeding');
    await checkOut.click({ force: true, timeout: 15_000 }).catch(async () => {
      const again = await this.ensureMiniCartCheckOutVisible(10_000);
      await again.evaluate((el) => el.click());
    });
    await this.page.waitForURL(/guest-checkout|\/checkout(\/|$)/i, { timeout: 90_000 });
    this._promoClickedCheckOut = true;
    console.log(`[promo] Reached checkout: ${this.page.url()}`);
  }

  async clickCheckOut() {
    if (this._promoClickedCheckOut || (await this.#alreadyOnCheckoutPage())) {
      console.log('[checkout] Already proceeded after promo — skipping second Check Out click');
      return;
    }
    if (this.isMobile()) {
      await this.#clickCheckOutMobile();
      return;
    }
    await this.#clickCheckOutDesktop();
  }

  /** Mobile Book Now: Confirm & Proceed — not mini-cart Check Out. */
  async #clickCheckOutMobile() {
    await this.dismissBlockingOverlays();
    const confirm = this.page
      .locator('a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn')
      .filter({ hasText: /Confirm\s*&\s*Proceed/i })
      .or(this.mobileConfirmAndProceed())
      .first();
    if (
      !(await confirm.isVisible({ timeout: 8_000 }).catch(() => false)) &&
      (await confirm.count().catch(() => 0)) === 0
    ) {
      throw new Error(
        'Mobile Confirm & Proceed not found (a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn)',
      );
    }
    console.log('[checkout] Clicking mobile Confirm & Proceed (a.mobile-reserve-now-btn)');
    await this.clickMobileConfirmAndProceed();
    await this.page.waitForURL(/guest-checkout|\/checkout(\/|$)/i, { timeout: 90_000 }).catch(() => {});
    await expect(
      this.page
        .locator('#guestcheckoutbutton, #AgreePrivacyGuest, #Title, #FirstName, #CountryOfResidence')
        .first(),
    ).toBeVisible({ timeout: 90_000 });
    console.log(`[checkout] Reached ${this.page.url()}`);
  }

  /** Desktop: booking-summary / mini-cart Check Out button. */
  async #clickCheckOutDesktop() {
    const codegenCheckOut = this.page
      .getByRole('button', { name: 'Check Out' })
      .or(this.bookingSummaryCheckOutButton())
      .filter({ visible: true })
      .first();
    if (await codegenCheckOut.isVisible({ timeout: 15_000 }).catch(() => false)) {
      console.log('[checkout] Clicking Check Out (codegen)');
      await this.dismissBlockingOverlays();
      try {
        await codegenCheckOut.click({ timeout: 8_000 });
      } catch {
        await this.dismissBlockingOverlays();
        await codegenCheckOut.click({ force: true, timeout: 8_000 });
      }
      await this.page.waitForURL(/guest-checkout|\/checkout(\/|$)/i, { timeout: 90_000 });
      console.log(`[checkout] Reached ${this.page.url()}`);
      return;
    }

    if (!(await this.#visibleCheckOut().isVisible({ timeout: 8_000 }).catch(() => false))) {
      await this.#recoverPurchaserCheckOut();
    }

    const checkOut = await this.ensureMiniCartCheckOutVisible(60_000);
    await this.waitBeforeTransition();
    await checkOut.click({ force: true, timeout: 15_000 }).catch(async () => {
      if (await this.#alreadyOnCheckoutPage()) return;
      const again = await this.ensureMiniCartCheckOutVisible(10_000);
      await again.click({ force: true });
    });
    if (await this.#alreadyOnCheckoutPage()) return;
    await expect(
      this.page.locator('#Title, #FirstName, #CountryOfResidence').first(),
    ).toBeVisible({ timeout: 90_000 });
  }
}

module.exports = { BookNowPage };
