const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');
const { LMS_HKG_GATES } = require('../support/lmsGate');

class LmsPage extends BasePage {
  async openLogin() {
    const base = this.settings?.lmsBaseUrl || 'https://lms-uat.plaza-network.com';
    await this.#blockHelpDocs();
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

  async ensureSignedIn(username, password) {
    const url = this.page.url();
    const onLms = /plaza-network\.com/i.test(url) && !/\/login(?:\?|$)/i.test(url);
    if (onLms) {
      await this.#blockHelpDocs();
      console.log('[lms] Already signed in — skip login');
      return;
    }
    await this.openLogin();
    await this.signIn(username, password);
    await expect(
      this.page
        .locator('span.nav-label', { hasText: /^LMS Masters$/i })
        .or(this.page.getByRole('link', { name: /Bookings/i }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
    await this.#blockHelpDocs();
    console.log('[lms] Signed in');
  }

  /**
   * LMS header Help is target=_blank → /assets/help/docs/features.
   * Stop the tab from opening (do not click Help; abort popup + help URLs).
   */
  async #blockHelpDocs() {
    const ctx = this.page.context();
    if (!ctx._lmsHelpGuard) {
      ctx._lmsHelpGuard = true;
      await ctx.addInitScript(lmsHelpBlockerSource);
      await ctx.route('**/assets/help/**', (route) => route.abort()).catch(() => {});
      await ctx.route('**/help/docs/**', (route) => route.abort()).catch(() => {});
      ctx.on('page', (popup) => {
        const closeIfHelp = async () => {
          const url = popup.url() || '';
          if (/\/assets\/help\/|help\/docs/i.test(url)) {
            console.log(`[lms] Blocked help tab: ${url}`);
            await popup.close().catch(() => {});
          }
        };
        popup.on('framenavigated', closeIfHelp);
        closeIfHelp();
      });
    }
    await this.page.evaluate(lmsHelpBlockerSource).catch(() => {});
    await this.#neutralizeHelpLinks();
  }

  async #neutralizeHelpLinks() {
    await this.page
      .evaluate(() => {
        const isHelp = (url) => /\/assets\/help\/|help\/docs/i.test(String(url || ''));
        document.querySelectorAll('a[href], area[href], a[title], button[title], a[aria-label]').forEach((a) => {
          const href = a.getAttribute('href') || a.href || '';
          const label = `${a.getAttribute('title') || ''} ${a.getAttribute('aria-label') || ''}`;
          if (!isHelp(href) && !/^\s*help\s*$/i.test(label.trim())) return;
          if (a.hasAttribute('href')) a.setAttribute('href', '#');
          a.removeAttribute('target');
          a.style.pointerEvents = 'none';
        });
      })
      .catch(() => {});
  }

  lmsMastersToggle() {
    return this.page
      .locator('a[data-target="#products1"]')
      .or(this.page.locator('a').filter({ has: this.page.locator('span.nav-label', { hasText: /^LMS Masters$/i }) }))
      .first();
  }

  lmsMastersOutletLink() {
    return this.page.locator('a[routerlink="/lounge"], a[href="/lounge"]').first();
  }

  outletMasterSearchInput() {
    // Table filter is role=searchbox. Do not use placeholder "Search" — that is the header Outlet box.
    return this.page.getByRole('searchbox').filter({ visible: true }).first();
  }

  async openLmsMastersMenu() {
    await this.#dismissOverlays();
    const masters = this.lmsMastersToggle();
    await expect(masters).toBeVisible({ timeout: 30_000 });
    const expanded = String((await masters.getAttribute('aria-expanded')) || '').toLowerCase();
    const outletVisible = await this.lmsMastersOutletLink().isVisible({ timeout: 1_500 }).catch(() => false);
    if (expanded !== 'true' && !outletVisible) {
      await masters.click();
      console.log('[lms] Expanded LMS Masters');
    } else {
      console.log('[lms] LMS Masters already expanded');
    }
    await expect(this.lmsMastersOutletLink()).toBeVisible({ timeout: 15_000 });
  }

  async openLmsMastersOutlet() {
    await this.openLmsMastersMenu();
    await this.lmsMastersOutletLink().click();
    await expect(this.page).toHaveURL(/\/lounge(?:\/|\?|$)/i, { timeout: 30_000 });
    await expect(this.outletMasterSearchInput()).toBeVisible({ timeout: 30_000 });
    console.log('[lms] Outlet master page is open');
  }

  async searchOutletMasterByNumber(number, hints = {}) {
    const queries = this.#outletSearchQueries(number, hints);
    let lastErr;
    for (const query of queries) {
      try {
        await this.#typeOutletMasterSearch(query);
        const cell = this.#outletMasterResultCell(number);
        await expect(cell).toBeVisible({ timeout: 20_000 });
        this._outletSearchQuery = query;
        console.log(`[lms] Outlet master matched query: ${query}`);
        return;
      } catch (err) {
        lastErr = err;
        console.log(`[lms] Outlet search miss for "${query}"`);
      }
    }
    throw lastErr || new Error(`Outlet master has no row for queries: ${queries.join(' | ')}`);
  }

  #outletSearchQueries(number, { propertyName = '', locationText = '', gate = '' } = {}) {
    const queries = [];
    const code = String(number || '').trim();
    if (code) queries.push(code);
    const combined = `${locationText} ${propertyName}`.replace(/\s+/g, ' ');
    for (const hint of combined.match(/East Hall|West Hall|Plaza Premium First|PPF|G35|G60/gi) || []) {
      queries.push(hint);
    }
    const prop = String(propertyName || '').replace(/\s+/g, ' ').trim();
    if (/Plaza Premium First/i.test(prop)) {
      queries.push('Plaza Premium First', 'PPF', 'East Hall');
    } else if (/Plaza Premium Lounge/i.test(prop)) {
      queries.push('Plaza Premium Lounge', 'East Hall');
    }
    if (/East Hall/i.test(combined)) queries.push('East Hall');
    if (/West Hall/i.test(combined)) queries.push('West Hall');
    const gateOutlet = this.#outletHintForGate(gate, combined);
    if (gateOutlet) queries.push(gateOutlet);
    return [...new Set(queries.map((q) => String(q).trim()).filter(Boolean))];
  }

  #outletHintForGate(gate, locationText = '') {
    if (/East Hall/i.test(locationText)) return 'East Hall';
    if (/West Hall/i.test(locationText)) return 'West Hall';
    const gateNum = String(gate || '').replace(/\D/g, '');
    if (gateNum === '35') return 'G35';
    if (gateNum === '60') return 'G60';
    if (gateNum === '1') return 'East Hall';
    return '';
  }

  async #typeOutletMasterSearch(query) {
    await expect(this.page.locator('table.mat-table, table[mat-table]').first()).toBeVisible({
      timeout: 30_000,
    });
    const search = this.outletMasterSearchInput();
    await expect(search).toBeVisible({ timeout: 30_000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await search.click();
      await search.fill('');
      await search.fill(query);
      await expect(search).toHaveValue(query, { timeout: 5_000 });
      await search.dispatchEvent('input');
      await search.press('Enter');
      console.log(`[lms] Outlet search Enter: ${query}${attempt > 1 ? ` (retry ${attempt})` : ''}`);
      const matchRe = /^\d+$/.test(query)
        ? new RegExp(`^\\s*${escapeRegExp(query)}\\s*-`, 'i')
        : new RegExp(escapeRegExp(query), 'i');
      const cell = this.page
        .locator('td.mat-column-name, td.cdk-column-name')
        .filter({ hasText: matchRe })
        .first();
      if (await cell.isVisible({ timeout: attempt === 3 ? 8_000 : 4_000 }).catch(() => false)) {
        return;
      }
      await this.page.waitForTimeout(1_500);
    }
  }

  #outletMasterResultCell(amsOrderNumber) {
    return this.outletMasterNameCell(amsOrderNumber);
  }

  outletMasterNameCell(amsOrderNumber) {
    const code = String(amsOrderNumber || '').trim();
    if (!code) {
      return this.page.locator('td.mat-column-name, td.cdk-column-name').first();
    }
    const re = new RegExp(`^\\s*${escapeRegExp(code)}\\s*-`, 'i');
    return this.page
      .locator('td.mat-column-name, td.cdk-column-name, td[role="gridcell"]')
      .filter({ hasText: re })
      .first();
  }

  /**
   * "10218-HKG - PPL - East Hall (MAS)" → "HKG - PPL - East Hall (MAS)"
   */
  parseOutletNameFromMasterCell(rawText, amsOrderNumber) {
    const raw = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
      throw new Error('Outlet master name cell is empty');
    }
    const code = String(amsOrderNumber || '').trim();
    let name = raw;
    if (code && new RegExp(`^${escapeRegExp(code)}\\s*-\\s*`, 'i').test(raw)) {
      name = raw.replace(new RegExp(`^${escapeRegExp(code)}\\s*-\\s*`, 'i'), '').trim();
    } else {
      name = raw.replace(/^\d+\s*-\s*/, '').trim();
    }
    if (!name || /^\d+\s*-/.test(name)) {
      throw new Error(`Could not parse outlet name from "${raw}"`);
    }
    return name;
  }

  async captureOutletNameFromMasterSearch(amsOrderNumber) {
    const byCode = this.#outletMasterResultCell(amsOrderNumber);
    const firstName = this.page.locator('td.mat-column-name, td.cdk-column-name').first();
    const cell = (await byCode.isVisible({ timeout: 8_000 }).catch(() => false)) ? byCode : firstName;
    await expect(cell).toBeVisible({ timeout: 30_000 });
    const raw = ((await cell.innerText()) || '').replace(/\s+/g, ' ').trim();
    const name = this.parseOutletNameFromMasterCell(raw, amsOrderNumber);
    console.log(`[lms] Captured outlet name "${name}" from "${raw}"`);
    return name;
  }

  async openBookingsAndPrepare() {
    await this.openBookings();
    await this.waitForBookingsTable();
    await this.#ensureAllBookingsView();
  }

  async openBookings() {
    // Sidebar Bookings only — do not match Help docs links named "Features"/Outlet.
    const bookings = this.page.locator('a[routerlink="/bookings"], a[href="/bookings"]').first();
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

  /** Hide toasts — never click them (header Help sits under/near toasts). */
  async #dismissOverlays() {
    await this.#neutralizeHelpLinks();
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll('toast-component, .ngx-toastr, .toast-container .ngx-toastr')
          .forEach((el) => {
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
          });
      })
      .catch(() => {});
    console.log('[lms] Overlays cleared');
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
   * 2) Search outlet (G1 / G35 / G60) → press Enter
   * 3) Wait for a.dropdown-item[title="HKG - PPL - G60"] → click
   * @param {'1'|'35'|'60'|string} gate
   */
  async selectOutletByGate(gate) {
    const gateNum = String(gate || '').replace(/\D/g, '');
    if (!LMS_HKG_GATES.includes(gateNum)) {
      throw new Error(`LMS outlet gate must be ${LMS_HKG_GATES.join(', ')}, got: ${gate}`);
    }
    const query = gateNum === '1' ? 'HKG' : `G${gateNum}`;
    const expectedOutlet = `HKG - PPL - G${gateNum}`;

    await this.#dismissOverlays();

    const outletToggle = this.#outletToggle();
    await expect(outletToggle).toBeVisible({ timeout: 30_000 });

    const currentLabel = outletToggle.locator('span.nav-link-inner--text b').first();
    const current = ((await currentLabel.textContent().catch(() => '')) || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (current === expectedOutlet) {
      console.log(`[lms] Outlet already set: ${current}`);
      return;
    }

    await this.#dismissOverlays();
    await outletToggle.click({ force: true });

    const menu = this.page.locator('.dropdown-menu.outlet-dropdown-menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    const outletSearch = menu
      .getByPlaceholder('Search outlet')
      .or(this.page.getByPlaceholder('Search outlet'))
      .first();
    await expect(outletSearch).toBeVisible({ timeout: 15_000 });
    await outletSearch.click({ force: true });
    await outletSearch.fill('');
    await outletSearch.fill(query);
    await outletSearch.press('Enter');
    console.log(`[lms] Searched outlet + Enter: ${query}`);

    await this.#clickOutletItem(menu, expectedOutlet, gateNum);
    console.log(`[lms] Selected outlet: ${expectedOutlet}`);

    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays();
    await expect(currentLabel).toContainText(expectedOutlet, { timeout: 20_000 });
    await this.waitForBookingsTable();
    console.log(`[lms] Gate selection done: ${expectedOutlet}`);
  }

  #outletToggle() {
    return this.page
      .locator('li.nav-item.dropdown a.nav-link[data-toggle="dropdown"]')
      .filter({ has: this.page.locator('span.nav-link-inner--text', { hasText: /Outlet/i }) })
      .first();
  }

  #outletSearchInput(menu) {
    return (menu || this.page)
      .locator('input.suggestionInput, input[placeholder="Search outlet"]')
      .first();
  }

  async #currentBookingsOutletLabel() {
    const label = this.#outletToggle().locator('span.nav-link-inner--text b').first();
    return ((await label.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  }

  async #openOutletMenu() {
    await this.#dismissOverlays();
    await this.page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    const outletToggle = this.#outletToggle();
    await expect(outletToggle).toBeVisible({ timeout: 30_000 });
    await outletToggle.scrollIntoViewIfNeeded().catch(() => {});

    const navItem = this.page
      .locator('li.nav-item.dropdown')
      .filter({ has: this.page.locator('span.nav-link-inner--text', { hasText: /Outlet/i }) })
      .first();
    await navItem.hover({ force: true, timeout: 10_000 });

    const menu = this.page.locator('.dropdown-menu.outlet-dropdown-menu').first();
    const search = this.#outletSearchInput(menu);
    if (!(await search.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await navItem.hover({ force: true, timeout: 5_000 });
      await this.page.waitForTimeout(300);
    }
    await this.page.evaluate(() => {
      const menuEl = document.querySelector('.dropdown-menu.outlet-dropdown-menu');
      const item = menuEl?.closest('li.nav-item.dropdown, .dropdown');
      if (item) item.classList.add('show');
      if (menuEl) {
        menuEl.classList.add('show');
        menuEl.style.setProperty('display', 'block', 'important');
      }
    }).catch(() => {});
    if (!(await search.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await outletToggle.click({ force: true, timeout: 5_000 });
    }
    await expect(search).toBeVisible({ timeout: 15_000 });
    console.log('[lms] Outlet dropdown search input visible after hover');
    return { outletToggle, menu };
  }

  async #clickOutletItem(menu, expectedOutlet, gateNum = '') {
    const wanted = String(expectedOutlet || '').replace(/\s+/g, ' ').trim();
    const gateRe = gateNum
      ? new RegExp(`(?:G\\s*${gateNum}|Gate\\s*${gateNum})\\b`, 'i')
      : null;
    const loose = new RegExp(wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    const item = menu
      .locator(`a.dropdown-item[title="${wanted}"]`)
      .or(menu.locator('a.dropdown-item').filter({ hasText: loose }))
      .or(menu.locator('a.dropdown-item').filter({ hasText: wanted }))
      .or(
        gateRe
          ? menu.locator('a.dropdown-item').filter({ hasText: gateRe })
          : menu.locator('a.dropdown-item').filter({ hasText: wanted }),
      )
      .first();
    await expect(item).toBeAttached({ timeout: 12_000 });
    await item.click({ force: true });
  }

  async listOutletOptions(query = 'HKG') {
    const { menu } = await this.#openOutletMenu();
    const outletSearch = menu
      .getByPlaceholder('Search outlet')
      .or(this.page.getByPlaceholder('Search outlet'))
      .first();
    if (await outletSearch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await outletSearch.click({ force: true });
      await outletSearch.fill('');
      await outletSearch.fill(query);
      await outletSearch.press('Enter');
      await this.page.waitForTimeout(800);
    }
    const items = await menu.locator('a.dropdown-item').evaluateAll((els) =>
      els
        .map((el) => ({
          title: (el.getAttribute('title') || '').replace(/\s+/g, ' ').trim(),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
        .filter((item) => item.title || item.text),
    );
    await this.page.keyboard.press('Escape').catch(() => {});
    await expect(menu).toBeHidden({ timeout: 5_000 }).catch(() => {});
    const labels = items.map((item) => item.title || item.text);
    console.log(`[lms] Outlets matching "${query}": ${labels.join(' | ') || '(none)'}`);
    return items;
  }

  async selectOutletByTitle(title) {
    const wanted = String(title || '').replace(/\s+/g, ' ').trim();
    if (!wanted) throw new Error('Outlet title is required');

    await expect(this.#outletToggle()).toBeVisible({ timeout: 30_000 });
    const { menu } = await this.#openOutletMenu();
    const outletSearch = this.#outletSearchInput(menu);
    await expect(outletSearch).toBeVisible({ timeout: 15_000 });
    await outletSearch.click({ force: true, timeout: 5_000 });
    await outletSearch.fill('');
    await outletSearch.fill(wanted, { timeout: 5_000 });
    await outletSearch.dispatchEvent('input');
    await expect(outletSearch).toHaveValue(wanted, { timeout: 5_000 });
    console.log(`[lms] Pasted captured outlet: ${wanted}`);

    const item = menu
      .getByTitle(wanted, { exact: true })
      .or(menu.locator('a.dropdown-item').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(wanted)}\\s*$`) }))
      .first();
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.scrollIntoViewIfNeeded().catch(() => {});
    await item.click({ force: true, timeout: 8_000 });
    console.log(`[lms] Selected outlet: ${wanted}`);

    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays();
    await this.page.keyboard.press('Escape').catch(() => {});
    await expect(menu).toBeHidden({ timeout: 5_000 }).catch(() => {});
    await this.waitForBookingsTable();
    const after = await this.#currentBookingsOutletLabel();
    if (after !== wanted) {
      throw new Error(`LMS Bookings outlet is "${after || '(empty)'}", expected "${wanted}"`);
    }
    console.log(`[lms] Outlet confirmed: ${after}`);
  }

  primaryOutletForGate(capturedGate) {
    const gate = String(capturedGate || '').replace(/\D/g, '');
    if (gate === '35') return 'HKG - PPL - G35';
    if (gate === '60') return 'HKG - PPL - G60';
    // Featured "Near Gate 1, Departures" is West Hall — there is no HKG - PPL - G1 outlet.
    return 'HKG - PPL - West Hall';
  }

  orderHkgOutlets(items, capturedGate) {
    const available = new Set(
      (items || []).map((item) => item.title || item.text).filter(Boolean),
    );
    const primary = this.primaryOutletForGate(capturedGate);
    const fallbacks = ['HKG - PPL - West Hall', 'HKG - PPL - G35', 'HKG - PPL - G60', 'HKGPPF- G1'];
    const ordered = [primary, ...fallbacks.filter((title) => title !== primary)];
    const filtered = available.size ? ordered.filter((title) => available.has(title)) : ordered;
    return filtered.slice(0, 3);
  }

  /**
   * Guest IBE bookings are excluded while "Default view (Guaranteed Bookings)" is ON.
   */
  async #ensureAllBookingsView() {
    const label = this.page.getByText(/Default view\s*\(\s*Guaranteed Bookings\s*\)\s*:?/i).first();
    if (!(await label.isVisible({ timeout: 8_000 }).catch(() => false))) {
      console.log('[lms] Guaranteed Bookings toggle not found');
      return;
    }

    const state = await label.evaluate((el) => {
      const root =
        el.closest('mat-slide-toggle, .mat-slide-toggle, .toggle, .switch, label, .row, .col, div') ||
        el.parentElement;
      const scope = root?.parentElement || root || el;
      const text = String(scope.innerText || '').replace(/\s+/g, ' ').trim();
      const checkbox = scope.querySelector('input[type="checkbox"]');
      const sw = scope.querySelector('[role="switch"], button[role="switch"], .switch, .toggle-group');
      const on =
        Boolean(checkbox?.checked) ||
        sw?.getAttribute('aria-checked') === 'true' ||
        /\bON\b/.test(text) ||
        /checked|active|selected/i.test(`${checkbox?.className || ''} ${sw?.className || ''}`);
      return { on, text: text.slice(0, 120), hasCheckbox: Boolean(checkbox) };
    });
    console.log(`[lms] Guaranteed Bookings view: ${JSON.stringify(state)}`);

    if (!state.on) {
      console.log('[lms] Default view (Guaranteed Bookings) already off');
      return;
    }

    const switchCtl = label
      .locator(
        'xpath=following::input[@type="checkbox"][1] | following::*[@role="switch"][1] | following::*[contains(@class,"toggle") or contains(@class,"switch")][1]',
      )
      .or(this.page.locator('mat-slide-toggle').filter({ hasText: /Guaranteed Bookings/i }))
      .first();
    await switchCtl.click({ force: true });
    console.log('[lms] Turned off Default view (Guaranteed Bookings)');
    await this.#waitForFetchingBookingsGone();
    await this.waitForBookingsTable();
  }

  #bookingsSearchInput() {
    return this.page
      .locator('#txtSearch')
      .or(this.page.getByPlaceholder('Search Bookings'))
      .first();
  }

  async #selectSearchByBookingNumber() {
    const search = this.#bookingsSearchInput();
    await expect(search).toBeVisible({ timeout: 15_000 });
    const opened = await this.page
      .evaluate(() => {
        const input =
          document.querySelector('#txtSearch') ||
          document.querySelector('input[placeholder="Search Bookings"]');
        if (!input) return false;
        const root =
          input.closest('.input-group, .search-box, .search, .form-group') || input.parentElement;
        const caret = root?.querySelector(
          'button.dropdown-toggle, a.dropdown-toggle, .dropdown-toggle, .fa-angle-down, .fa-caret-down, button',
        );
        if (!caret) return false;
        caret.click();
        return true;
      })
      .catch(() => false);
    if (!opened) {
      console.log('[lms] Search-by caret not found — continue with Enter');
      return;
    }
    const option = this.page
      .locator(
        '.dropdown-menu:not(.outlet-dropdown-menu) a.dropdown-item, .dropdown-menu:not(.outlet-dropdown-menu) button.dropdown-item, mat-option, [role="option"]',
      )
      .filter({ hasText: /Booking Number/i })
      .first();
    if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await option.click({ force: true, timeout: 3_000 }).catch(() => {});
      console.log('[lms] Search-by set to Booking Number');
      return;
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    console.log('[lms] Booking Number option not visible — continue with Enter');
  }
  async searchBookingId(orderNo) {
    const id = String(orderNo || '').trim();
    if (!id) throw new Error('No booking order number to search in LMS');

    await this.ensureOnBookings();
    await this.#waitForFetchingBookingsGone();
    await this.#dismissOverlays();
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.#selectSearchByBookingNumber();

    const search = this.#bookingsSearchInput();
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.click({ force: true, timeout: 5_000 });
    await search.fill('');
    await search.fill(id);
    await expect(search).toHaveValue(id, { timeout: 5_000 });
    await search.press('Enter');
    await this.page.keyboard.press('Enter').catch(() => {});
    console.log(`[lms] Entered booking id and pressed Enter: ${id}`);

    await this.#waitForFetchingBookingsGone();
    if (!(await this.#hasSingleBookingResult(id))) {
      await search.click({ force: true, timeout: 3_000 });
      await search.press('Enter');
      await this.page.keyboard.press('Enter').catch(() => {});
      console.log(`[lms] Pressed Enter again to filter booking: ${id}`);
      await this.#waitForFetchingBookingsGone();
    }
    await this.#dismissOverlays();
    return id;
  }

  async #hasSingleBookingResult(orderNo) {
    const id = String(orderNo || '').trim();
    const pagerOne = this.page.getByText(/1\s*[-–]\s*1\s+of\s+1/i).first();
    if (await pagerOne.isVisible().catch(() => false)) return true;
    const rows = this.page.locator(
      'table.mat-table tbody tr.mat-row, table[mat-table] tbody tr.mat-row, table.mat-table tbody tr[role="row"]',
    );
    const matches = this.page
      .locator('td.mat-column-bookingNumber, td.cdk-column-bookingNumber')
      .filter({ hasText: id });
    const rowCount = await rows.count().catch(() => 0);
    const matchCount = await matches.count().catch(() => 0);
    return rowCount === 1 && matchCount === 1;
  }

  async #waitForSingleBookingResult(orderNo, timeout = 45_000) {
    const id = String(orderNo || '').trim();
    await expect
      .poll(async () => ((await this.#hasSingleBookingResult(id)) ? 'one' : 'many'), {
        timeout,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe('one');
    const cell = this.bookingNumberCell(id);
    await expect(cell).toBeVisible({ timeout: 10_000 });
    console.log(`[lms] Filtered to one booking row: ${id}`);
    return cell;
  }

  async searchAndValidateBooking(orderNo, timeout = 60_000) {
    const id = await this.searchBookingId(orderNo);
    const cell = await this.#waitForSingleBookingResult(id, timeout);
    console.log(`[lms] Validated booking in LMS table: ${id}`);
    return cell;
  }

  async refreshBookingsThenSearch(orderNo, timeout = 60_000) {
    await this.waitForBookingsTable();
    console.log('[lms] Bookings loaded after outlet — refreshing before search');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.#dismissOverlays();
    await this.ensureOnBookings();
    await this.#ensureAllBookingsView();
    return this.searchAndValidateBooking(orderNo, timeout);
  }

  bookingNumberCell(orderNo) {
    const id = String(orderNo);
    return this.page
      .locator('td.mat-column-bookingNumber, td.cdk-column-bookingNumber, td')
      .filter({ hasText: id })
      .or(this.page.getByRole('cell', { name: new RegExp(escapeRegExp(id), 'i') }))
      .or(this.page.getByText(id))
      .first();
  }

  async #bookingTablePreview() {
    const text = await this.page
      .locator('table.mat-table, table[mat-table]')
      .first()
      .innerText()
      .catch(() => '');
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  /** Prefer captured lounge gate; else 10240→35, else 60. */
  resolveGate(orderNo, capturedGate) {
    const gate = String(capturedGate || '').replace(/\D/g, '');
    if (LMS_HKG_GATES.includes(gate)) return gate;
    if (/HKBC-10240/i.test(String(orderNo || ''))) return '35';
    return '60';
  }

  hkgOutletsToTry(orderNo, capturedGate) {
    const preferred = this.resolveGate(orderNo, capturedGate);
    return [preferred, ...LMS_HKG_GATES.filter((gate) => gate !== preferred)];
  }

  /**
   * 1) Login → Bookings
   * 2) Change gate/outlet (G1 / G35 / G60) for HKG only
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

    await this.ensureSignedIn(username, password);
    await this.openBookings();
    await this.waitForBookingsTable();
    await this.#ensureAllBookingsView();

    if (airport !== 'HKG') {
      console.log(
        `[lms] Skipping HKG outlet change for destination ${airport}; searching booking ${orderNo} directly`,
      );
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
      return;
    }

    let lastErr;
    const listed = await this.listOutletOptions('HKG').catch((err) => {
      console.log(`[lms] Could not list HKG outlets: ${err.message}`);
      return [];
    });
    let outlets = this.orderHkgOutlets(listed, capturedGate);
    if (!outlets.length) {
      const fallbackGates = this.hkgOutletsToTry(orderNo, capturedGate);
      outlets = fallbackGates.map((gate) => `HKG - PPL - G${gate}`);
    }
    console.log(`[lms] Will try HKG outlets for ${orderNo}: ${outlets.join(' | ')}`);

    for (const outlet of outlets) {
      try {
        console.log(`[lms] Using outlet ${outlet} for booking ${orderNo}`);
        if (/^HKG - PPL - G(35|60)$/.test(outlet)) {
          await this.selectOutletByGate(outlet.replace(/\D/g, ''));
        } else {
          await this.selectOutletByTitle(outlet);
        }
        await this.#ensureAllBookingsView();
      } catch (err) {
        lastErr = err;
        console.log(`[lms] Outlet ${outlet} not available: ${err.message}`);
        continue;
      }

      const attempts = 2;
      for (let i = 1; i <= attempts; i++) {
        try {
          await this.searchAndValidateBooking(orderNo, i === attempts ? 18_000 : 8_000);
          return;
        } catch (err) {
          lastErr = err;
          const preview = await this.#bookingTablePreview();
          console.log(
            `[lms] Search/validate ${outlet} attempt ${i}/${attempts} missed ${orderNo}. Table: ${preview || '(empty)'}`,
          );
          await this.page.waitForTimeout(2_500);
        }
      }
    }
    throw lastErr || new Error(`Booking ${orderNo} not found in LMS HKG outlets ${outlets.join(', ')}`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Injected into LMS pages: block Help → Features docs tabs. */
function lmsHelpBlockerSource() {
  if (window.__lmsHelpBlockerInstalled) return;
  window.__lmsHelpBlockerInstalled = true;
  const isHelpUrl = (url) => /\/assets\/help\/|help\/docs/i.test(String(url || ''));
  const origOpen = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (isHelpUrl(url)) return null;
    return origOpen(url, ...rest);
  };
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target && e.target.closest && e.target.closest('a, area, button, [href]');
      if (!el) return;
      const href = el.getAttribute('href') || el.href || '';
      const label = `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`;
      if (isHelpUrl(href) || /^\s*help\s*$/i.test(label.trim())) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}

module.exports = { LmsPage };
