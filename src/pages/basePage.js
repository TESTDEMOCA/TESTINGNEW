const { expect } = require('@playwright/test');
const { ActionEngine } = require('../utils/actionEngine');
const { clickSalesManagoClose, isCheckOutClickable } = require('../support/salesManago');

class BasePage {
  static AFTER_SELECT_SETTLE_MS = 300;
  static TRANSITION_WAIT_MIN_MS = 2_000;
  static TRANSITION_WAIT_MAX_MS = 5_000;

  /**
   * Mini-cart Check Out CTA:
   * <button type="button" class="btn btn-primary fullWidth flat-btn js-minicart-checkout-upsell mb-0"
   *   data-guest-checkout-url="/en-uk/guest-checkout">Check Out</button>
   */
  static MINICART_CHECKOUT_SELECTOR =
    'button.btn.btn-primary.fullWidth.flat-btn.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"], button.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]';

  /**
   * Lounge booking-summary Check Out (not Reserve Now):
   * <button type="button" class="btn btn-primary fullWidth reserve-now-btn">Check Out</button>
   */
  static BOOKING_SUMMARY_CHECKOUT_SELECTOR =
    'button.btn.btn-primary.fullWidth.reserve-now-btn';

  /** Mobile hamburger used across locations / home / passes. */
  static MOBILE_NAV_TOGGLE = '#wsnavtoggle';

  static MOBILE_CONFIRM_PROCEED =
    'a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn, a.mobile-reserve-now-btn';

  constructor(page, settings) {
    this.page = page;
    this.settings = settings;
    this.actions = new ActionEngine(page);
  }

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  mobileConfirmAndProceed() {
    return this.page
      .locator('a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn')
      .filter({ hasText: /Confirm\s*&\s*Proceed/i })
      .or(this.page.locator('a.mobile-reserve-now-btn').filter({ hasText: /Confirm\s*&\s*Proceed/i }))
      .first();
  }

  async clickMobileConfirmAndProceed(timeout = 30_000) {
    if (!this.isMobile()) {
      throw new Error('Confirm & Proceed (a.mobile-reserve-now-btn) is mobile-only');
    }
    const el = this.mobileConfirmAndProceed();
    await expect(el).toBeAttached({ timeout });
    await this.dismissBlockingOverlays();
    const clicked = await this.page.evaluate(() => {
      const match = (node) =>
        /confirm\s*&\s*proceed/i.test((node.textContent || '').replace(/\s+/g, ' '));
      const node =
        document.querySelector('a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn') ||
        document.querySelector('a.mobile-reserve-now-btn');
      if (!node || !match(node)) return false;
      node.classList.remove('hide', 'd-none');
      node.removeAttribute('hidden');
      node.style.setProperty('display', '', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      node.click();
      return true;
    });
    if (!clicked) {
      await el.evaluate((node) => node.click());
    }
  }

  /** Open the mobile slide-out nav when needed (body gets class wsactive). */
  async openMobileNavIfNeeded() {
    if (!this.isMobile()) return;
    const toggle = this.page.locator(BasePage.MOBILE_NAV_TOGGLE).first();
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    const alreadyOpen = await this.page.locator('body.wsactive').count();
    if (alreadyOpen) return;
    await toggle.click();
    await expect(this.page.locator('body.wsactive')).toBeVisible({ timeout: 10_000 });
  }

  /** Booking-summary Check Out — class is reserve-now-btn but the label is Check Out, not Reserve Now. */
  bookingSummaryCheckOutButton() {
    return this.page
      .locator(BasePage.BOOKING_SUMMARY_CHECKOUT_SELECTOR)
      .filter({ hasText: /^\s*Check Out\s*$/i })
      .filter({ visible: true })
      .first();
  }

  /**
   * Mini-cart Check Out (Passes / cart drawer):
   * <button type="button" class="btn btn-primary fullWidth flat-btn js-minicart-checkout-upsell mb-0"
   *   data-guest-checkout-url="/en-uk/guest-checkout">Check Out</button>
   */
  upsellMiniCartCheckOutButton() {
    return this.page
      .locator(
        'button.btn.btn-primary.fullWidth.flat-btn.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]',
      )
      .filter({ hasText: /^\s*Check Out\s*$/i })
      .first();
  }

  /** Visible Check Out: mini-cart upsell first, then booking summary, then role fallback. */
  miniCartCheckOutButton() {
    return this.upsellMiniCartCheckOutButton()
      .or(
        this.page
          .locator(BasePage.BOOKING_SUMMARY_CHECKOUT_SELECTOR)
          .filter({ hasText: /^\s*Check Out\s*$/i }),
      )
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .filter({ visible: true })
      .first();
  }

  /**
   * Open mini-cart if needed and wait for the Check Out CTA.
   * Passes / exclusive-login flows often leave the cart closed after modal login.
   */
  async ensureMiniCartCheckOutVisible(timeoutMs = 45_000) {
    const upsell = this.upsellMiniCartCheckOutButton();
    if (await upsell.isVisible({ timeout: 1_500 }).catch(() => false)) {
      console.log('[cart] Mini-cart Check Out is visible (js-minicart-checkout-upsell)');
      return upsell;
    }

    if (this.isMobile()) {
      const confirm = this.mobileConfirmAndProceed();
      if (await confirm.isVisible({ timeout: 1_000 }).catch(() => false)) {
        console.log('[checkout] Mobile Confirm & Proceed is visible — skip mini-cart Check Out');
        return confirm;
      }
    }

    const summaryCheckOut = this.bookingSummaryCheckOutButton();
    if (await summaryCheckOut.isVisible({ timeout: 800 }).catch(() => false)) {
      console.log('[checkout] Booking-summary Check Out is visible (button.reserve-now-btn)');
      return summaryCheckOut;
    }

    const already = this.miniCartCheckOutButton();
    if (await already.isVisible({ timeout: 800 }).catch(() => false)) {
      console.log('[cart] Check Out button is visible');
      return already;
    }

    const deadline = Date.now() + timeoutMs;

    // Close leftover login / pass-error dialogs that intercept Check Out clicks.
    // Do not Escape first — that closes an already-open mini-cart.
    await this.page.keyboard.press('Escape').catch(() => {});
    const passErr = this.page.locator('#passPageErrorModal.show, #passPageErrorModal.modal.show').first();
    if (await passErr.isVisible({ timeout: 800 }).catch(() => false)) {
      await this.page
        .locator('#passPageErrorModal button, #passPageErrorModal [data-bs-dismiss="modal"]')
        .filter({ hasText: /^OK$/i })
        .or(this.page.locator('#passPageErrorModal [data-bs-dismiss="modal"]'))
        .first()
        .click({ force: true })
        .catch(() => {});
      await this.page.evaluate(() => {
        document.querySelectorAll('#passPageErrorModal, .modal-backdrop').forEach((el) => {
          el.classList.remove('show');
          el.style.display = 'none';
        });
        document.body.classList.remove('modal-open');
      });
    }
    await this.page
      .locator('#userLogin.show, .modal-backdrop')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {});

    while (Date.now() < deadline) {
      const summary = this.bookingSummaryCheckOutButton();
      if (await summary.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log('[checkout] Booking-summary Check Out is visible (button.reserve-now-btn)');
        return summary;
      }
      const checkOut = this.miniCartCheckOutButton();
      if (await checkOut.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log('[cart] Check Out button is visible');
        return checkOut;
      }

      const toggles = [
        this.page.locator('#minicart, a#minicart, button#minicart').first(),
        this.page.locator('[class*="minicart"] a, [class*="minicart"] button, a[class*="cart-icon"], button[class*="cart-icon"]').first(),
        this.page.locator('button[aria-label*="cart" i], a[aria-label*="cart" i]').first(),
        this.page
          .locator('button[class*="cart" i], a[class*="cart" i]')
          .filter({ hasNotText: /check\s*out/i })
          .first(),
      ];

      for (const toggle of toggles) {
        if (await toggle.isVisible({ timeout: 400 }).catch(() => false)) {
          await toggle.click().catch(() => {});
          const opened = this.miniCartCheckOutButton();
          if (await opened.isVisible({ timeout: 3_000 }).catch(() => false)) {
            console.log('[cart] Opened mini-cart — Check Out visible');
            return opened;
          }
        }
      }

      await this.page.waitForTimeout(1_000);
    }

    throw new Error(
      'Mini-cart Check Out button not visible ' +
        '(button.js-minicart-checkout-upsell[data-guest-checkout-url="/en-uk/guest-checkout"]).',
    );
  }

  /**
   * Fail when listing and/or mini-cart currency is not the Language-selected code.
   */
  async assertSelectedCurrency(expectedCurrency, listingPrice, { cart = false } = {}) {
    const expected = String(expectedCurrency || '').trim().toUpperCase();
    if (!expected) {
      throw new Error(
        'Select currency (e.g. HKD) before Passes so listing and cart currency can be validated',
      );
    }
    if (listingPrice != null && String(listingPrice).trim() !== '') {
      const listingCode = this.currencyCodeFromText(listingPrice);
      if (!listingCode) {
        throw new Error(`Pass listing currency not found; expected ${expected}`);
      }
      if (listingCode !== expected) {
        throw new Error(
          `Pass listing currency expected ${expected} after Language selection, got: ${listingCode}`,
        );
      }
      console.log(`[passes] Listing currency OK: ${expected} (${String(listingPrice).slice(0, 40)})`);
    }
    if (cart) {
      await this.assertMiniCartCurrency(expected);
    }
  }
  async assertMiniCartCurrency(expectedCurrency) {
    const expected = String(expectedCurrency || '').trim().toUpperCase();
    if (!expected) {
      throw new Error('Expected currency is required for mini-cart currency validation');
    }

    const totalAlreadyVisible = await this.page
      .locator(
        '#bookingsummarysection .total-amt, #minicart-bookingsummarysection .total-amt, .summary-content .total-amt, .total-amt',
      )
      .filter({ visible: true })
      .filter({ hasText: /[\d,.]+/ })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    const mobileTotalReady = await this.mobileConfirmAndProceed()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);
    const onCheckout = /guest-checkout|\/checkout(\/|$)/i.test(this.page.url());
    if (!totalAlreadyVisible && !mobileTotalReady && !onCheckout) {
      await this.ensureMiniCartCheckOutVisible(30_000);
    }

    const parsed = await this.#readVisibleCartTotalCurrency();
    if (!parsed.code) {
      console.log(`[cart] Currency not found in: "${parsed.raw}"`);
      throw new Error(`Mini-cart currency not found; expected ${expected}`);
    }
    if (parsed.code !== expected) {
      console.log(`[cart] Currency mismatch raw total: "${parsed.raw}"`);
      throw new Error(
        `Mini-cart currency expected ${expected} after Language selection, got: ${parsed.code}`,
      );
    }
    console.log(`[cart] Mini-cart currency OK: ${expected} (${parsed.raw.slice(0, 80)})`);
  }

  currencyCodeFromText(text) {
    const blob = String(text || '').replace(/\s+/g, ' ').trim();
    const matches = [...blob.matchAll(/\b([A-Z]{3})\s*[\d,.]+/g)];
    if (matches.length) return matches[matches.length - 1][1].toUpperCase();
    if (/HK\$/i.test(blob)) return 'HKD';
    if (/US\$/i.test(blob)) return 'USD';
    if (/S\$/i.test(blob)) return 'SGD';
    if (/\bRM\b/i.test(blob)) return 'MYR';
    if (/₹/.test(blob)) return 'INR';
    return '';
  }

  async #readVisibleCartTotalCurrency() {
    const checkOut = this.upsellMiniCartCheckOutButton()
      .or(this.bookingSummaryCheckOutButton())
      .or(this.page.getByRole('button', { name: /^\s*Check Out\s*$/i }))
      .or(this.mobileConfirmAndProceed())
      .filter({ visible: true })
      .first();

    let raw = '';
    if (await checkOut.isVisible({ timeout: 8_000 }).catch(() => false)) {
      raw = await checkOut
        .evaluate((btn) => {
          let node = btn;
          for (let i = 0; i < 15 && node && node !== document.body; i += 1) {
            const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
            if (
              text.length > 0 &&
              text.length < 1500 &&
              /\b[A-Z]{3}\s*[\d,.]+/.test(text) &&
              /Total|Subtotal|includes applicable/i.test(text)
            ) {
              return text;
            }
            node = node.parentElement;
          }
          return '';
        })
        .catch(() => '');
    }
    if (!raw) {
      raw = await this.page.evaluate(() => {
        const visible = (el) => {
          if (!el) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const pick = (selector) =>
          Array.from(document.querySelectorAll(selector)).find(
            (el) => visible(el) && /\d/.test(el.innerText || el.textContent || ''),
          );
        const el =
          pick('#minicart-bookingsummarysection .total-amt') ||
          pick('#bookingsummarysection .total-amt');
        return (el && (el.innerText || el.textContent || '').trim()) || '';
      });
    }

    const blob = String(raw || '').replace(/\s+/g, ' ').trim();
    const totalLine = blob.match(/Total[^\dA-Z]{0,40}([A-Z]{3})\s*[\d,.]+/i);
    const matches = [...blob.matchAll(/\b([A-Z]{3})\s*[\d,.]+/g)];
    let code = totalLine
      ? totalLine[1].toUpperCase()
      : matches.length
        ? matches[matches.length - 1][1].toUpperCase()
        : '';
    if (!code) {
      if (/HK\$/i.test(blob)) code = 'HKD';
      else if (/US\$/i.test(blob)) code = 'USD';
      else if (/S\$/i.test(blob)) code = 'SGD';
      else if (/\bRM\b/i.test(blob)) code = 'MYR';
      else if (/₹/.test(blob)) code = 'INR';
    }
    return { raw: blob.slice(0, 240), code };
  }

  async settle(ms = BasePage.AFTER_SELECT_SETTLE_MS) {
    await this.page.waitForTimeout(ms);
  }

  async waitBeforeTransition(ms) {
    const min = BasePage.TRANSITION_WAIT_MIN_MS;
    const max = BasePage.TRANSITION_WAIT_MAX_MS;
    const delay =
      ms != null
        ? Number(ms)
        : min + Math.floor(Math.random() * (max - min + 1));
    await this.settle(delay);
  }

  async gotoPath(pathSuffix = '/') {
    const url = pathSuffix.startsWith('http')
      ? pathSuffix
      : `${this.settings.baseUrl}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async dismissBlockingOverlays() {
    const agree = this.page
      .getByRole('button', { name: /^I AGREE$/i })
      .or(this.page.getByRole('link', { name: /^I AGREE$/i }))
      .or(this.page.locator('button, a.btn').filter({ hasText: /^I AGREE$/i }))
      .first();
    if (await agree.isVisible({ timeout: 800 }).catch(() => false)) {
      await agree.click({ force: true, timeout: 5_000 }).catch(() => {});
      console.log('[overlay] Accepted cookie banner (I AGREE)');
    }
    if (await isCheckOutClickable(this.page)) {
      return;
    }
    await clickSalesManagoClose(this.page);
    await this.page.keyboard.press('Escape').catch(() => {});
    const closeIframe = this.page.locator('iframe[title="Close message"]').first();
    if (await closeIframe.isVisible({ timeout: 400 }).catch(() => false)) {
      await closeIframe.click({ force: true, timeout: 1_000 }).catch(() => {});
    }
    await clickSalesManagoClose(this.page);
    await this.page
      .evaluate(() => {
        const hide = (el) => {
          if (!el) return;
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        };
        document
          .querySelectorAll(
            [
              '#ulLocation',
              '#ulLocationMobile',
              '.ui-autocomplete',
              'ul.ui-menu.ui-widget',
              '#st_notification_banner',
              '#st_notification_modal',
              '[id^="st_notification"]',
              'iframe.st_preview_frame_modal',
              '#smt-overlay',
              '#webmessagemodalbody',
              '#outercontainer',
              '[smtmsgid]',
              'iframe[title="Close message"]',
              'iframe[title*="message" i]',
              'iframe.st_preview_frame_banner',
              'iframe[id^="preview-notification-frame"]',
              '.st_preview_frame_banner',
            ].join(','),
          )
          .forEach(hide);
      })
      .catch(() => {});
  }

  async clickAfterDismissingOverlays(locator, timeout = 15_000) {
    await this.dismissBlockingOverlays();
    try {
      await locator.click({ timeout: Math.min(timeout, 8_000) });
    } catch {
      await this.dismissBlockingOverlays();
      await locator.click({ force: true, timeout });
    }
  }

  datepickerRoot() {
    return this.page
      .locator(
        '#ui-datepicker-div, #mobileBooking .ui-datepicker, #mobileBooking table.ui-datepicker-calendar',
      )
      .filter({ visible: true })
      .first();
  }

  async isDatepickerOpen() {
    return this.page.evaluate(() => {
      const nodes = [
        document.querySelector('#ui-datepicker-div'),
        document.querySelector('#mobileBooking .ui-datepicker'),
        document.querySelector('#mobileBooking table.ui-datepicker-calendar'),
      ].filter(Boolean);
      return nodes.some((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    });
  }

  async openDatepicker(inputLocator) {
    await expect(inputLocator).toBeVisible({ timeout: 30_000 });
    await inputLocator.scrollIntoViewIfNeeded();
    await this.dismissBlockingOverlays();
    await inputLocator.click({ timeout: 5_000 }).catch(async () => {
      await this.dismissBlockingOverlays();
      await inputLocator.click({ force: true });
    });
    await this.settle(400);
    if (!(await this.isDatepickerOpen())) {
      await inputLocator.evaluate((el) => {
        el.focus();
        el.click();
        if (window.jQuery) {
          try {
            window.jQuery(el).datepicker('show');
          } catch (_) {
            /* ignore */
          }
        }
      });
      await this.settle(500);
    }
    for (let i = 0; i < 30; i += 1) {
      if (await this.isDatepickerOpen()) return;
      await this.settle(200);
    }
    throw new Error('Datepicker did not open after clicking the date input');
  }

  /**
   * Pick the day after the currently selected date in an open jQuery UI datepicker.
   * At month end, advances to day 1 of the next month.
   */
  async selectNextDayInOpenCalendar() {
    for (let i = 0; i < 40; i += 1) {
      if (await this.isDatepickerOpen()) break;
      await this.settle(250);
    }
    if (!(await this.isDatepickerOpen())) {
      throw new Error('Datepicker is not open');
    }

    const calendar = this.datepickerRoot();
    const result = await calendar.evaluate((root) => {
      const cells = Array.from(
        root.querySelectorAll(
          'td:not(.ui-datepicker-other-month):not(.ui-datepicker-unselectable):not(.ui-state-disabled)',
        ),
      ).filter((td) => td.querySelector('a'));

      // Prefer actively selected day; do not use "today" marker (can skip an extra day).
      let selectedIdx = cells.findIndex((td) => Boolean(td.querySelector('a.ui-state-active')));
      if (selectedIdx < 0) {
        selectedIdx = cells.findIndex((td) => td.classList.contains('ui-datepicker-current-day'));
      }

      if (selectedIdx >= 0 && selectedIdx < cells.length - 1) {
        cells[selectedIdx + 1].querySelector('a').click();
        return 'next-in-month';
      }
      return 'need-next-month';
    });

    if (result === 'need-next-month') {
      await calendar.locator('.ui-datepicker-next').click({ force: true });
      const firstDay = calendar
        .locator('td:not(.ui-datepicker-other-month):not(.ui-datepicker-unselectable) a')
        .first();
      await firstDay.click({ force: true });
    }
  }

  /**
   * Parse lounge location copy, e.g. "Near Gate 60, Departures, Terminal 1, ..."
   * Used by all booking flows before LMS outlet change (G1 / G35 / G60).
   * Returns '1' | '35' | '60' | null.
   */
  async captureGateNumber(timeout = 8_000) {
    const loc = this.page
      .locator('div.font-light.font-opacity, .font-light.font-opacity')
      .filter({ hasText: /Gate\s*\d+/i })
      .or(this.page.getByText(/Near\s+Gate\s*\d+/i))
      .or(this.page.locator('body').getByText(/Near\s+Gate\s*(35|60|1)\b/i))
      .first();

    if (!(await loc.isVisible({ timeout }).catch(() => false))) {
      return null;
    }
    const text = ((await loc.textContent()) || '').trim();
    const match = text.match(/Gate\s*(\d+)/i);
    if (!match) return null;
    const gate = String(match[1]);
    if (['1', '35', '60'].includes(gate)) {
      console.log(`[gate] Captured Gate ${gate} from: ${text}`);
      return gate;
    }
    console.log(`[gate] Unsupported gate "${gate}" in: ${text}`);
    return null;
  }
}

module.exports = { BasePage };
