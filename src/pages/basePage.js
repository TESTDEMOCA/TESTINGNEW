const { expect } = require('@playwright/test');
const { ActionEngine } = require('../utils/actionEngine');
const { clickSalesManagoClose } = require('../support/salesManago');

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
      .locator(BasePage.MOBILE_CONFIRM_PROCEED)
      .filter({ hasText: /Confirm\s*&\s*Proceed/i })
      .or(this.page.locator('a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn'))
      .or(this.page.locator('a.mobile-reserve-now-btn'))
      .or(this.page.locator('a.btn, button.btn, a, button').filter({ hasText: /Confirm\s*&\s*Proceed/i }))
      .first();
  }

  async clickMobileConfirmAndProceed(timeout = 30_000) {
    const el = this.mobileConfirmAndProceed();
    await expect(el).toBeAttached({ timeout });
    await this.dismissBlockingOverlays();
    const clicked = await this.page.evaluate(() => {
      const match = (node) =>
        /confirm\s*&\s*proceed/i.test((node.textContent || '').replace(/\s+/g, ' '));
      const node =
        document.querySelector('a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn') ||
        document.querySelector('a.mobile-reserve-now-btn') ||
        [...document.querySelectorAll('a.btn, button.btn, a, button')].find(match);
      if (!node) return false;
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

  /** Visible mini-cart Check Out button (preferred locator + text fallback). */
  miniCartCheckOutButton() {
    return this.page
      .locator(BasePage.MINICART_CHECKOUT_SELECTOR)
      .filter({ hasText: /^Check Out$/i })
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .filter({ visible: true })
      .first();
  }

  /**
   * Open mini-cart if needed and wait for the Check Out CTA.
   * Passes / exclusive-login flows often leave the cart closed after modal login.
   */
  async ensureMiniCartCheckOutVisible(timeoutMs = 45_000) {
    const deadline = Date.now() + timeoutMs;

    // Close leftover login / pass-error dialogs that intercept Check Out clicks.
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
   * Mini-cart item price / Total must use the currency selected in Language (e.g. HKD not INR).
   */
  async assertMiniCartCurrency(expectedCurrency) {
    const expected = String(expectedCurrency || '').trim().toUpperCase();
    if (!expected) return;

    await this.ensureMiniCartCheckOutVisible(30_000);

    const totalEl = this.page
      .locator('#minicart-bookingsummarysection .total-amt, .summary-content .total-amt, .total-amt')
      .filter({ hasText: /[\d,.]+/ })
      .first();
    const cartEl = this.page
      .locator('#minicart-bookingsummarysection, .summary-content')
      .first();

    let blob = '';
    if (await totalEl.isVisible({ timeout: 8_000 }).catch(() => false)) {
      blob = ((await totalEl.innerText()) || '').replace(/\s+/g, ' ').trim();
    }
    if (!blob && (await cartEl.isVisible({ timeout: 3_000 }).catch(() => false))) {
      blob = ((await cartEl.innerText()) || '').replace(/\s+/g, ' ').trim();
    }
    if (!blob) {
      throw new Error(`Mini-cart currency not found; expected ${expected}`);
    }

    const codes = [...blob.matchAll(/\b([A-Z]{3})\s*[\d,.]+/g)].map((m) => m[1].toUpperCase());
    const symbolOk =
      (expected === 'HKD' && /HK\$/i.test(blob)) ||
      (expected === 'USD' && /US\$/i.test(blob)) ||
      (expected === 'SGD' && /S\$/i.test(blob)) ||
      (expected === 'MYR' && /\bRM\b/i.test(blob)) ||
      (expected === 'INR' && /₹/.test(blob));
    const ok = codes.includes(expected) || new RegExp(`\\b${expected}\\b`).test(blob) || symbolOk;
    if (!ok) {
      throw new Error(
        `Mini-cart currency expected ${expected} after Language selection, got: ${
          codes.length ? [...new Set(codes)].join(', ') : blob.slice(0, 180)
        }`,
      );
    }
    console.log(`[cart] Mini-cart currency OK: ${expected} (${blob.slice(0, 80)})`);
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
