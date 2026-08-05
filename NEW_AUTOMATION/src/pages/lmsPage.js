const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LmsPage extends BasePage {
  async openLogin() {
    const base = this.settings?.lmsBaseUrl || 'https://lms-uat.plaza-network.com';
    await this.page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
    await expect(
      this.page
        .getByRole('button', { name: /Sign In/i })
        .or(this.page.locator('button[type="submit"]'))
        .first(),
    ).toBeVisible({ timeout: 60_000 });
  }

  async signIn(username, password) {
    const user = this.page
      .getByLabel(/username|email|user/i)
      .or(this.page.locator('input[formcontrolname="username"], input[name="username"], input[type="email"], #username'))
      .first();
    const pass = this.page
      .getByLabel(/password/i)
      .or(this.page.locator('input[formcontrolname="password"], input[name="password"], input[type="password"], #password'))
      .first();

    await expect(user).toBeVisible({ timeout: 30_000 });
    await user.fill(String(username));
    await pass.fill(String(password));

    const signIn = this.page
      .getByRole('button', { name: /Sign In/i })
      .or(this.page.locator('button[type="submit"]'))
      .first();
    await signIn.click();
  }

  async openBookings() {
    const bookings = this.page
      .locator('a[routerlink="/bookings"]')
      .or(this.page.getByRole('link', { name: /Bookings/i }))
      .first();
    await expect(bookings).toBeVisible({ timeout: 90_000 });
    await bookings.click();
    await expect(this.page).toHaveURL(/\/bookings/i, { timeout: 60_000 });
  }

  async ensureOnBookings() {
    if (!/\/bookings/i.test(this.page.url())) {
      console.log(`[lms] Not on Bookings (${this.page.url()}) — navigating back`);
      await this.openBookings();
    }
    await this.waitForBookingsTable();
  }

  async waitForBookingsTable() {
    const table = this.page.locator('table.mat-table, table[mat-table]').first();
    await expect(table).toBeVisible({ timeout: 90_000 });
    // Rows may be empty after a bad filter — only require the table shell.
    await this.page.waitForTimeout(500);
  }

  async #searchInput() {
    return this.page.locator('#txtSearch, input[type="search"]').first();
  }

  async #paginationText() {
    return this.page.evaluate(() => {
      const body = document.body?.innerText || '';
      const m = body.match(/(\d+)\s*[–-]\s*(\d+)\s+of\s+(\d+)/i);
      return m ? m[0] : '';
    });
  }

  async searchBookingNumber(orderNo) {
    await this.ensureOnBookings();
    const search = await this.#searchInput();
    await expect(search).toBeVisible({ timeout: 30_000 });
    const before = await this.#paginationText();

    await search.click({ clickCount: 3 });
    await search.press('Backspace');
    await search.fill('');
    // Clear (x) control next to search if present
    const clearBtn = this.page
      .locator('#txtSearch')
      .locator('xpath=ancestor::*[contains(@class,"search") or contains(@class,"mat-form")][1]')
      .locator('button, .fa-times, .fa-xmark, mat-icon')
      .first();
    if (await clearBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await clearBtn.click().catch(() => {});
    }

    await search.click();
    await search.pressSequentially(String(orderNo), { delay: 35 });

    // Trigger filter: Enter + Angular input handlers + search icon click
    await search.press('Enter');
    await search.evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
    }, String(orderNo));

    const searchIcon = this.page
      .locator('#txtSearch')
      .locator('xpath=ancestor::*[1]')
      .locator('.fa-search, .fa-magnifying-glass, mat-icon, button')
      .or(this.page.locator('button:near(#txtSearch)').filter({ has: this.page.locator('.fa-search') }))
      .first();
    if (await searchIcon.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await searchIcon.click().catch(() => {});
    }

    // Wait briefly for client/server filter to shrink the page set
    await this.page
      .waitForFunction(
        ({ prev, order }) => {
          const text = document.body?.innerText || '';
          if (text.includes(order)) return true;
          const m = text.match(/(\d+)\s*[–-]\s*(\d+)\s+of\s+(\d+)/i);
          if (!m) return false;
          if (prev && m[0] !== prev) return true;
          return Number(m[3]) <= 5;
        },
        { prev: before, order: String(orderNo) },
        { timeout: 8_000 },
      )
      .catch(() => {});
  }

  bookingNumberCell(orderNo) {
    return this.page
      .locator('td.mat-column-bookingNumber, td.cdk-column-bookingNumber, table.mat-table td')
      .filter({ hasText: new RegExp(escapeRegExp(String(orderNo)), 'i') })
      .first();
  }

  async expectBookingNumberInTable(orderNo, timeout = 90_000) {
    await expect(this.bookingNumberCell(orderNo)).toBeVisible({ timeout });
  }

  async #openOutletMenu() {
    // Header shows: Country / Language / Outlet: HKG - PPL - G35
    const candidates = [
      this.page.getByText(/Outlet:\s*HKG\s*-\s*PPL/i).first(),
      this.page.locator('text=/Outlet:\\s*/i').first(),
      this.page.getByText(/HKG\s*-\s*PPL\s*-\s*G\d+/i).first(),
    ];
    for (const c of candidates) {
      if (await c.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await c.click({ force: true });
        await this.page.waitForTimeout(700);
        return true;
      }
    }
    return false;
  }

  async #outletOptions() {
    return this.page.locator(
      [
        '.cdk-overlay-container [role="option"]',
        '.cdk-overlay-container .mat-option',
        '.cdk-overlay-container .mat-mdc-option',
        '.cdk-overlay-container mat-option',
        '[role="listbox"] [role="option"]',
        '.dropdown-menu.show .dropdown-item',
        '.mat-menu-panel button, .mat-mdc-menu-panel button',
      ].join(', '),
    );
  }

  /**
   * Switch header outlet. Must stay on /bookings (never click sidebar).
   */
  async trySelectOutletMatchingBooking(orderNo) {
    if (!(await this.#openOutletMenu())) {
      console.log('[lms] Outlet menu trigger not found');
      return false;
    }

    const preferG60 = !/HKBC-10240/i.test(String(orderNo));
    const opts = await this.#outletOptions();
    const count = await opts.count().catch(() => 0);
    console.log(`[lms] Outlet menu options: ${count}`);

    if (count === 0) {
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    const preferred = [];
    const others = [];
    for (let i = 0; i < count; i++) {
      const text = ((await opts.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const isG60 = /G60|Gate\s*60/i.test(text);
      const isG35 = /G35/i.test(text);
      if (preferG60 ? isG60 : isG35) preferred.push({ i, text });
      else if (/HKG|PPL|G\d+/i.test(text)) others.push({ i, text });
    }

    const pick = preferred[0] || others.find((o) => /G60/i.test(o.text)) || others[0];
    if (!pick) {
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    await opts.nth(pick.i).click();
    console.log(`[lms] Switched outlet to: ${pick.text}`);
    await this.page.waitForTimeout(1_500);
    await this.ensureOnBookings();
    return true;
  }

  async #cycleOutletsAndSearch(orderNo) {
    if (!(await this.#openOutletMenu())) return false;
    const opts = await this.#outletOptions();
    const count = await opts.count().catch(() => 0);
    const labels = [];
    for (let i = 0; i < count; i++) {
      labels.push(((await opts.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim());
    }
    await this.page.keyboard.press('Escape').catch(() => {});

    for (let i = 0; i < Math.min(labels.length, 10); i++) {
      if (!labels[i] || !/HKG|PPL|G\d+/i.test(labels[i])) continue;
      if (!(await this.#openOutletMenu())) break;
      const fresh = await this.#outletOptions();
      const match = fresh.filter({ hasText: labels[i] }).first();
      if (!(await match.isVisible({ timeout: 2_000 }).catch(() => false))) {
        await this.page.keyboard.press('Escape').catch(() => {});
        continue;
      }
      await match.click();
      console.log(`[lms] Cycling outlet [${i + 1}]: ${labels[i]}`);
      await this.page.waitForTimeout(1_200);
      await this.ensureOnBookings();
      await this.searchBookingNumber(orderNo);
      if (await this.bookingNumberCell(orderNo).isVisible({ timeout: 10_000 }).catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  async #toggleDefaultViewOff() {
    const toggle = this.page
      .getByText(/Default view\s*\(Guaranteed Bookings\)/i)
      .locator('xpath=ancestor::*[contains(@class,"toggle") or contains(@class,"mat-slide") or self::label or self::div][1]')
      .locator('button, .mat-slide-toggle, input[type="checkbox"]')
      .first()
      .or(this.page.locator('mat-slide-toggle').first());
    if (await toggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const checked =
        (await toggle.getAttribute('aria-checked').catch(() => null)) === 'true' ||
        (await toggle.isChecked?.().catch(() => false));
      if (checked !== false) {
        await toggle.click().catch(() => {});
        console.log('[lms] Toggled Default view (Guaranteed Bookings)');
        await this.page.waitForTimeout(1_000);
      }
    }
  }

  async verifyCapturedBookingInLms(orderNo, username, password) {
    if (!orderNo) {
      throw new Error('No booking order number on world to verify in LMS');
    }
    await this.openLogin();
    await this.signIn(username, password);
    await this.openBookings();
    await this.waitForBookingsTable();

    if (!/HKBC-10240/i.test(String(orderNo))) {
      await this.trySelectOutletMatchingBooking(orderNo);
      await this.#toggleDefaultViewOff();
    }

    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
      await this.searchBookingNumber(orderNo);
      const found = await this.bookingNumberCell(orderNo)
        .isVisible({ timeout: 12_000 })
        .catch(() => false);
      if (found) {
        console.log(`[lms] Verified booking in LMS: ${orderNo}`);
        return;
      }
      console.log(`[lms] Search attempt ${i}/${attempts} missed ${orderNo}`);
      if (i === 1) {
        await this.trySelectOutletMatchingBooking(orderNo);
      }
      if (i === 2) {
        await this.#toggleDefaultViewOff();
      }
      await this.page.waitForTimeout(2_000);
    }

    if (await this.#cycleOutletsAndSearch(orderNo)) {
      console.log(`[lms] Verified booking in LMS after outlet cycle: ${orderNo}`);
      return;
    }

    await this.ensureOnBookings();
    await this.searchBookingNumber(orderNo);
    await this.expectBookingNumberInTable(orderNo, 20_000);
    console.log(`[lms] Verified booking in LMS: ${orderNo}`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { LmsPage };
