const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LoungeBookingPage extends BasePage {
  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  async expectFormVisible(timeout = 60_000) {
    if (this.isMobile()) {
      await expect(this.page.getByRole('button', { name: 'Get Price' })).toBeVisible({ timeout });
      return;
    }
    await expect(this.page.getByRole('heading', { name: 'Book your visit' })).toBeVisible({
      timeout,
    });
    await expect(this.page.locator('#detailBookingDateDesktop')).toBeVisible({ timeout });
  }

  async setDate(day) {
    if (this.isMobile()) return;
    const dateInput = this.page.locator('#detailBookingDateDesktop');
    await this.openDatepicker(dateInput);
    if (day != null && day !== '') {
      await this.page.getByRole('link', { name: String(day), exact: true }).click({ force: true });
    } else {
      await this.selectNextDayInOpenCalendar();
    }
    await this.settle(500);
  }

  async setTime(timeValue) {
    if (this.isMobile()) return;
    const select = this.page.locator('#detailBookingTimeDesktop');
    await expect(select).toBeVisible({ timeout: 30_000 });
    const wanted = String(timeValue || '1700');
    try {
      await select.selectOption(wanted, { timeout: 5_000 });
    } catch {
      const enabledValue = await select.evaluate((el) => {
        const opt = Array.from(el.options).find((o) => o.value && !o.disabled);
        return opt ? opt.value : '';
      });
      if (!enabledValue) {
        throw new Error('No enabled booking time options are available');
      }
      await select.selectOption(enabledValue);
    }
  }

  async setAdults(count) {
    if (this.isMobile()) return;
    const desired = Number(count);
    if (!desired || desired <= 1) return;
    for (let i = 1; i < desired; i += 1) {
      await this.page.getByText('+').nth(2).click();
      await this.settle(200);
    }
  }

  async clickSearch() {
    if (this.isMobile()) return;
    const search = this.page.getByRole('button', { name: 'Search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.click();
    // Wait for service options after Search AJAX (Lounge SRVC1619 preferred).
    await expect(
      this.page.locator('#detailService option[value="SRVC1619"], #detailService option[value]:not([value=""])').first(),
    ).toBeAttached({ timeout: 60_000 });
  }

  async selectServiceAndLos() {
    if (this.isMobile()) return;
    // <select id="detailService" name="SelectedServiceCode">
    //   <option value="SRVC1619" data-type="LOUNGE">Lounge</option>
    //   <option value="SRVC1620" data-type="SHOWER">Shower</option>
    // </select>
    const service = this.page.locator('select#detailService[name="SelectedServiceCode"]');
    await expect(service).toBeVisible({ timeout: 60_000 });
    await expect(service.locator('option[value="SRVC1619"]')).toHaveCount(1, { timeout: 60_000 });

    await service.selectOption('SRVC1619');
    await service.dispatchEvent('change');
    await this.settle(1_000);

    const los = this.page.locator('select#detaillos');
    await expect(los).toBeVisible({ timeout: 30_000 });
    await this.page.waitForFunction(
      () => {
        const s = document.querySelector('#detaillos');
        return Boolean(
          s &&
            Array.from(s.options).some(
              (o) => o.value && /PRD3353|PRD3352|PRD3769|lounge/i.test(`${o.value} ${o.textContent}`),
            ),
        );
      },
      undefined,
      { timeout: 30_000 },
    );
    try {
      await los.selectOption('PRD3353');
    } catch {
      await los.selectOption({ label: /Lounge Use - 5 Hours/i }).catch(async () => {
        await los.selectOption({ index: 0 });
      });
    }
    await los.dispatchEvent('change');
    await this.settle(1_000);
  }

  async clickGetPrice() {
    await this.expectFormVisible();
    if (!this.isMobile()) {
      const dateInput = this.page.locator('#detailBookingDateDesktop');
      const existing = ((await dateInput.inputValue().catch(() => '')) || '').trim();
      // Re-opening the lounge datepicker after fillBookingForm often fails; only set when empty.
      if (!existing) {
        await this.setDate();
      }
      await this.setTime('1700');
      await this.clickSearch();
      if ((await this.page.locator('#detailService option[value="SRVC1619"]').count()) === 0) {
        await this.setDate();
        await this.setTime('1700');
        await this.clickSearch();
      }
      await this.selectServiceAndLos();
    }
    await this.waitBeforeTransition();
    // Desktop Get Price only — skip hidden mobile `.getpricemobile.hide`.
    const getPrice = this.page.locator(
      'button.getPrice-btn[value="getprice"]:not(.getpricemobile), button[name="ButtonType"][value="getprice"]:not(.getpricemobile)',
    );
    await expect(getPrice.first()).toBeAttached({ timeout: 60_000 });
    try {
      await getPrice.filter({ visible: true }).first().click({ timeout: 10_000 });
    } catch {
      await getPrice.first().click({ force: true });
    }
    await expect(
      this.page
        .locator('a.btn:has-text("Reserve Now"):not(.hide), button:has-text("Reserve Now"):not(.hide)')
        .or(this.page.getByRole('button', { name: /Reserve Now/i }).filter({ visible: true }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }

  async selectLosAndGetPrice(losValue = 'PRD3352') {
    await this.expectFormVisible();
    if (!this.isMobile()) {
      const los = this.page.locator('#detaillos');
      await expect(los).toBeVisible({ timeout: 30_000 });
      try {
        await los.selectOption(String(losValue));
      } catch {
        await los.selectOption({ index: 0 });
      }
      await los.dispatchEvent('change');
      await this.settle(500);
    }
    await this.#clickGetPriceButton();
  }

  async selectShowerServiceAndGetPrice() {
    await this.expectFormVisible();
    if (!this.isMobile()) {
      const service = this.page.locator('select#detailService[name="SelectedServiceCode"]');
      await expect(service).toBeVisible({ timeout: 60_000 });
      await expect(service.locator('option[value="SRVC1620"]')).toHaveCount(1, { timeout: 60_000 });
      await service.selectOption('SRVC1620');
      await service.dispatchEvent('change');
      await this.settle(1_000);

      const los = this.page.locator('#detaillos');
      await expect(los).toBeVisible({ timeout: 30_000 });
      await this.page.waitForFunction(
        () => {
          const s = document.querySelector('#detaillos');
          return Boolean(s && Array.from(s.options).some((o) => o.value));
        },
        undefined,
        { timeout: 30_000 },
      );
      try {
        await los.selectOption({ label: /Shower|30/i });
      } catch {
        await los.selectOption({ index: 0 });
      }
      await los.dispatchEvent('change');
      await this.settle(500);
    }
    await this.#clickGetPriceButton();
  }

  async #clickGetPriceButton() {
    await this.waitBeforeTransition();
    const getPrice = this.page.locator(
      'button.getPrice-btn[value="getprice"]:not(.getpricemobile), button[name="ButtonType"][value="getprice"]:not(.getpricemobile)',
    );
    await expect(getPrice.first()).toBeAttached({ timeout: 60_000 });
    try {
      await getPrice.filter({ visible: true }).first().click({ timeout: 10_000 });
    } catch {
      await getPrice.first().click({ force: true });
    }
    await expect(
      this.page
        .locator('a.btn:has-text("Reserve Now"):not(.hide), button:has-text("Reserve Now"):not(.hide)')
        .or(this.page.getByRole('button', { name: /Reserve Now/i }).filter({ visible: true }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }

  async clickGetPriceLeavingDefaults() {
    // Do not touch Services / Service Details — use page defaults.
    await this.expectFormVisible();
    await this.#clickGetPriceButton();
  }

  async addShowerThirtyMinsAddon() {
    const addBtn = this.page
      .locator(
        'a.add-service-btn.add-addon[data-servicename="Shower - 30 mins"], a.add-addon[data-productdisplayname="Shower - 30 mins"], a.add-addon[data-productname="Shower - 30 mins"]',
      )
      .or(this.page.locator('.service-CTA a.add-addon').filter({ hasText: /^Add$/i }));
    await expect(addBtn.first()).toBeVisible({ timeout: 60_000 });
    await this.waitBeforeTransition();
    await addBtn.first().click();

    const modal = this.page.locator('#add-service-form-0.show, #add-service-form-0.modal.show').first();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    const confirm = modal
      .getByRole('button', { name: /^Add$/i })
      .or(modal.locator('button, a.btn, a.button').filter({ hasText: /^Add$/i }))
      .or(modal.locator('.modal-footer button, .modal-footer a.btn').filter({ hasText: /^Add$/i }));
    await expect(confirm.first()).toBeVisible({ timeout: 10_000 });
    await confirm.first().click();
    await expect(modal).toBeHidden({ timeout: 30_000 });
    await this.settle(1_000);
    await expect(this.page.getByRole('button', { name: 'Check Out' })).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Upgrade lounge product to PPF on Book your visit / cart — cart should show PPF.
   */
  async clickUpgradeAndExpectPpf() {
    const upgrade = this.page
      .getByRole('button', { name: /^Upgrade$/i })
      .or(this.page.getByRole('link', { name: /^Upgrade$/i }))
      .or(this.page.locator('a, button').filter({ hasText: /^Upgrade$/i }))
      .first();

    await expect(upgrade).toBeVisible({ timeout: 60_000 });
    await this.waitBeforeTransition();
    await upgrade.click();
    await this.settle(2_000);

    const ppf = this.page
      .getByText(/\bPPF\b|Plaza Premium First|Premium First/i)
      .first();
    await expect(ppf).toBeVisible({ timeout: 60_000 });
    console.log('[booking] Upgrade clicked — cart/page shows PPF');
  }

  async clickReserveNow() {
    await expect(this.page.getByRole('button', { name: 'Reserve Now' })).toBeVisible({
      timeout: 90_000,
    });
    await this.waitBeforeTransition();
    await this.page.getByRole('button', { name: 'Reserve Now' }).click();

    if (this.isMobile()) {
      // mobile codegen uses Confirm & Proceed (link) instead of Check Out
      await expect(
        this.page
          .getByRole('link', { name: /Confirm & Proceed/i })
          .or(this.page.getByRole('button', { name: /Confirm & Proceed|Check Out/i }))
          .first(),
      ).toBeVisible({ timeout: 90_000 });
      return;
    }

    await expect(this.page.getByRole('button', { name: 'Check Out' })).toBeVisible({
      timeout: 90_000,
    });
  }

  async clickCheckOut() {
    await this.waitBeforeTransition();

    if (this.isMobile()) {
      // codegen: getByRole('link', { name: 'Confirm & Proceed' })
      const confirmLink = this.page.getByRole('link', { name: /Confirm & Proceed/i }).first();
      const confirmBtn = this.page.getByRole('button', { name: /Confirm & Proceed/i }).first();
      const checkOut = this.page.getByRole('button', { name: 'Check Out' }).first();

      if (await confirmLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await confirmLink.click();
      } else if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmBtn.click();
      } else {
        await checkOut.click();
      }
    } else {
      await expect(this.page.getByRole('button', { name: 'Check Out' })).toBeVisible({
        timeout: 90_000,
      });
      await this.page.getByRole('button', { name: 'Check Out' }).click();
    }

    await expect(
      this.page.locator('#CountryOfResidence, #FirstName, #Title').first(),
    ).toBeVisible({ timeout: 90_000 });
  }

  async fillBookingForm(data = {}) {
    await this.expectFormVisible();
    if (this.isMobile()) return;
    await this.setDate(data.day);
    if (data.time) await this.setTime(data.time);
    else await this.setTime('1700');
    if (data.adults != null) await this.setAdults(data.adults);
  }
}

module.exports = { LoungeBookingPage };
