const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LmsPage extends BasePage {
  async openLogin() {
    const base = this.settings?.lmsBaseUrl || 'https://lms-uat.plaza-network.com';
    await this.page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
    await expect(
      this.page
        .getByRole('button', { name: /Sign in/i })
        .or(this.page.locator('button[type="submit"]'))
        .first(),
    ).toBeVisible({ timeout: 60_000 });
  }

  async signIn(username, password) {
    // Codegen: getByRole('textbox', { name: 'User name' }) / 'Password'
    const user = this.page.getByRole('textbox', { name: 'User name' });
    const pass = this.page.getByRole('textbox', { name: 'Password' });

    await expect(user).toBeVisible({ timeout: 30_000 });
    await user.click();
    await user.fill(String(username));
    await pass.click();
    await pass.fill(String(password));
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  async openBookings() {
    // Codegen: getByRole('link', { name: ' Bookings' })
    const bookings = this.page
      .getByRole('link', { name: /Bookings/i })
      .or(this.page.locator('a[routerlink="/bookings"]'))
      .first();
    await expect(bookings).toBeVisible({ timeout: 90_000 });
    await bookings.click();
    await expect(this.page).toHaveURL(/\/bookings/i, { timeout: 60_000 });

    // Codegen: getByRole('alertdialog', { name: 'Fetched bookings' }).click()
    await this.#dismissOverlays();
  }

  async ensureOnBookings() {
    if (!/\/bookings/i.test(this.page.url())) {
      console.log(`[lms] Not on Bookings (${this.page.url()}) — navigating back`);
      await this.openBookings();
    }
    await this.waitForBookingsTable();
  }

  async waitForBookingsTable() {
    await this.#waitForFetchingBookingsGone();
    const table = this.page.locator('table.mat-table, table[mat-table]').first();
    await expect(table).toBeVisible({ timeout: 90_000 });
    await this.page.waitForTimeout(300);
  }

  /** Dismiss ngx-toastr / alertdialog overlays that block Outlet + #txtSearch. */
  async #dismissOverlays(timeout = 20_000) {
    const overlays = this.page.locator(
      [
        '[role="alertdialog"]',
        'toast-component',
        '.ngx-toastr',
        '.toast-container .ngx-toastr',
        '.overlay-container toast-component',
      ].join(', '),
    );
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const count = await overlays.count().catch(() => 0);
      let anyVisible = false;
      for (let i = 0; i < count; i++) {
        const el = overlays.nth(i);
        if (await el.isVisible().catch(() => false)) {
          anyVisible = true;
          await el.click({ force: true }).catch(() => {});
        }
      }
      if (!anyVisible) {
        console.log('[lms] Overlays cleared');
        return;
      }
      await this.page.waitForTimeout(300);
    }
    // Last resort: hide leftover overlays so clicks can proceed
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll(
            'toast-component, .ngx-toastr, [role="alertdialog"], .overlay-container toast-component',
          )
          .forEach((el) => {
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
          });
      })
      .catch(() => {});
    console.log('[lms] Overlays force-hidden');
  }

  /**
   * Codegen: getByRole('heading', { name: 'Fetching Bookings' })
   * Wait until the loading heading is gone so #txtSearch is usable.
   */
  async #waitForFetchingBookingsGone(timeout = 60_000) {
    const fetching = this.page.getByRole('heading', { name: /Fetching Bookings/i });
    if (await fetching.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fetching.click({ force: true }).catch(() => {});
      await expect(fetching).toBeHidden({ timeout }).catch(() => {});
      console.log('[lms] Fetching Bookings cleared');
    }
  }

  /**
   * Select LMS outlet:
   * 1) Open Outlet dropdown
   * 2) Search outlet (G60 / G35) → press Enter
   * 3) Wait for a.dropdown-item[title="HKG - PPL - G60"] → click
   * @param {'35'|'60'|string} gate
   */
  async selectOutletByGate(gate) {
    const gateNum = String(gate || '').replace(/\D/g, '');
    if (gateNum !== '35' && gateNum !== '60') {
      throw new Error(`LMS outlet gate must be 35 or 60, got: ${gate}`);
    }
    const query = `G${gateNum}`;
    const expectedOutlet = `HKG - PPL - G${gateNum}`;

    await this.#dismissOverlays();

    const outletToggle = this.page
      .locator('a.nav-link[data-toggle="dropdown"]')
      .filter({ hasText: /Outlet/i })
      .or(this.page.getByText(/Outlet\s+HKG\s*-\s*PPL\s*-\s*G\d+/i))
      .first();
    await expect(outletToggle).toBeVisible({ timeout: 30_000 });

    const currentLabel = outletToggle.locator('span.nav-link-inner--text b').first();
    const current = ((await currentLabel.textContent().catch(() => '')) || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (current === expectedOutlet) {
      console.log(`[lms] Outlet already set: ${current}`);
      return;
    }

    await this.#dismissOverlays(10_000);
    await outletToggle.click({ force: true });

    const menu = this.page.locator('.dropdown-menu.outlet-dropdown-menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    const outletSearch = menu
      .getByPlaceholder('Search outlet')
      .or(this.page.getByPlaceholder('Search outlet'))
      .first();
    await expect(outletSearch).toBeVisible({ timeout: 15_000 });
    await outletSearch.click();
    await outletSearch.fill('');
    await outletSearch.fill(query);
    await outletSearch.press('Enter');
    console.log(`[lms] Searched outlet + Enter: ${query}`);

    // Wait for: <a class="dropdown-item" title="HKG - PPL - G60">…</a>
    const item = menu.locator(`a.dropdown-item[title="${expectedOutlet}"]`);
    await expect(item).toBeVisible({ timeout: 20_000 });
    await item.click();
    console.log(`[lms] Selected outlet: ${expectedOutlet}`);

    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays(15_000);
    await expect(currentLabel).toContainText(expectedOutlet, { timeout: 20_000 });
    await this.waitForBookingsTable();
    console.log(`[lms] Gate selection done: ${expectedOutlet}`);
  }

  /**
   * After gate selection: enter captured booking id in #txtSearch → Enter → validate.
   */
  async searchAndValidateBooking(orderNo, timeout = 60_000) {
    const id = String(orderNo || '').trim();
    if (!id) throw new Error('No booking order number to search in LMS');

    await this.ensureOnBookings();
    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays(8_000);

    const search = this.page.locator('#txtSearch');
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.click();
    await search.fill('');
    await search.fill(id);
    await expect(search).toHaveValue(id, { timeout: 5_000 });
    await search.press('Enter');
    console.log(`[lms] Entered booking id and pressed Enter: ${id}`);

    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays(5_000);

    const cell = this.bookingNumberCell(id);
    await expect(cell).toBeVisible({ timeout });
    console.log(`[lms] Validated booking in LMS table: ${id}`);
    return cell;
  }

  bookingNumberCell(orderNo) {
    const id = String(orderNo);
    return this.page
      .locator('td.mat-column-bookingNumber, td.cdk-column-bookingNumber, td')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(id)}\\s*$`, 'i') })
      .or(this.page.getByRole('cell', { name: id, exact: true }))
      .or(this.page.getByText(id, { exact: true }))
      .first();
  }

  /** Fallback when page gate was not captured: 10240→35, else 60. */
  resolveGate(orderNo, capturedGate) {
    if (capturedGate === '35' || capturedGate === '60') return capturedGate;
    if (/HKBC-10240/i.test(String(orderNo || ''))) return '35';
    return '60';
  }

  /**
   * 1) Login → Bookings
   * 2) Change gate/outlet (G35 / G60) for HKG only
   * 3) Enter booking id in #txtSearch, search, validate row
   */
  async verifyCapturedBookingInLms(
    orderNo,
    username,
    password,
    capturedGate = null,
    destinationCode = 'HKG',
  ) {
    if (!orderNo) {
      throw new Error('No booking order number on world to verify in LMS');
    }
    const airport = String(destinationCode || 'HKG').toUpperCase();

    await this.openLogin();
    await this.signIn(username, password);
    await this.openBookings();
    await this.waitForBookingsTable();

    if (airport === 'HKG') {
      const gate = this.resolveGate(orderNo, capturedGate);
      console.log(`[lms] Using outlet gate G${gate} for booking ${orderNo}`);
      await this.selectOutletByGate(gate);
    } else {
      console.log(
        `[lms] Skipping HKG outlet change for destination ${airport}; searching booking ${orderNo} directly`,
      );
    }

    const attempts = 4;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.searchAndValidateBooking(orderNo, i === attempts ? 45_000 : 20_000);
        return;
      } catch (err) {
        if (i === attempts) throw err;
        console.log(`[lms] Search/validate attempt ${i}/${attempts} missed ${orderNo}`);
        await this.page.waitForTimeout(2_500);
      }
    }
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { LmsPage };
