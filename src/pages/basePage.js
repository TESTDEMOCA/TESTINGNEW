const { expect } = require('@playwright/test');
const { ActionEngine } = require('../utils/actionEngine');

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

  constructor(page, settings) {
    this.page = page;
    this.settings = settings;
    this.actions = new ActionEngine(page);
  }

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
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

  async isDatepickerOpen() {
    return this.page.evaluate(() => {
      const el = document.querySelector('#ui-datepicker-div');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none';
    });
  }

  async openDatepicker(inputLocator) {
    await expect(inputLocator).toBeVisible({ timeout: 30_000 });
    await inputLocator.scrollIntoViewIfNeeded();
    await inputLocator.click();
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
    const calendar = this.page.locator('#ui-datepicker-div');
    for (let i = 0; i < 40; i += 1) {
      if (await this.isDatepickerOpen()) break;
      await this.settle(250);
    }
    if (!(await this.isDatepickerOpen())) {
      throw new Error('Datepicker is not open');
    }

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
      await calendar.locator('.ui-datepicker-next').click();
      const firstDay = calendar
        .locator('td:not(.ui-datepicker-other-month):not(.ui-datepicker-unselectable) a')
        .first();
      await firstDay.click({ force: true });
    }
  }

  /**
   * Parse lounge location copy, e.g. "Near Gate 60, Departures, Terminal 1, ..."
   * Used by all booking flows before LMS outlet change (G35 / G60).
   * Returns '35' | '60' | null.
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
    if (gate === '35' || gate === '60' || gate === '1') {
      console.log(`[gate] Captured Gate ${gate} from: ${text}`);
      return gate;
    }
    console.log(`[gate] Unsupported gate "${gate}" in: ${text}`);
    return null;
  }
}

module.exports = { BasePage };
