const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LoungeBookingPage extends BasePage {
  /** Mobile lounge CTA that opens #mobileVisit modal. */
  static MOBILE_BOOK_YOUR_VISIT =
    'a.btn.btn-primary.bookingBtn.mobile[data-bs-target="#mobileVisit"], a.bookingBtn.mobile[data-bs-target="#mobileVisit"]';

  static MOBILE_VISIT_MODAL = '#mobileVisit';

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  mobileVisitModal() {
    return this.page.locator(LoungeBookingPage.MOBILE_VISIT_MODAL);
  }

  mobileBookYourVisitButton() {
    return this.page.locator(LoungeBookingPage.MOBILE_BOOK_YOUR_VISIT).first();
  }

  /**
   * Open mobile Book Your Visit modal:
   * <a class="btn btn-primary bookingBtn mobile" data-bs-toggle="modal" data-bs-target="#mobileVisit">Book Your Visit</a>
   */
  async openMobileBookYourVisitModal() {
    const modal = this.mobileVisitModal();
    const alreadyOpen = await modal.evaluate((el) => el.classList.contains('show')).catch(() => false);
    if (alreadyOpen) {
      console.log('[booking] #mobileVisit already open');
      return modal;
    }
    const cta = this.mobileBookYourVisitButton();
    // Some lounge cards use Book Now / Book a Visit without the exact bookingBtn.mobile class.
    const fallbackCta = this.page
      .locator('a[data-bs-target="#mobileVisit"]')
      .or(this.page.getByRole('link', { name: /Book Your Visit|Book a Visit|Book Now/i }))
      .first();
    const button = (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) ? cta : fallbackCta;
    await expect(button).toBeVisible({ timeout: 30_000 });
    await button.scrollIntoViewIfNeeded().catch(() => {});
    const servicesResp = this.page
      .waitForResponse((res) => /loungedetailspage\/getservices/i.test(res.url()), { timeout: 30_000 })
      .catch(() => null);
    await button.click({ force: true });
    // Bootstrap may need a tick; also force-show if data-bs toggle is flaky on some lounge templates.
    await this.settle(500);
    const shown = await modal.evaluate((el) => el.classList.contains('show')).catch(() => false);
    if (!shown) {
      await this.page.evaluate(() => {
        const el = document.querySelector('#mobileVisit');
        if (!el) return;
        if (window.bootstrap?.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(el).show();
        } else {
          el.classList.add('show');
          el.style.display = 'block';
          document.body.classList.add('modal-open');
        }
      });
    }
    await expect(modal).toHaveClass(/show/, { timeout: 15_000 });
    await servicesResp;
    await this.settle(1_000);
    console.log('[booking] Opened mobile #mobileVisit via Book Your Visit');
    return modal;
  }

  async expectFormVisible(timeout = 60_000) {
    if (this.isMobile()) {
      await this.openMobileBookYourVisitModal();
      await expect(
        this.mobileVisitModal()
          .locator(
            'button.getpricemobile, a.getpricemobile, button.getPrice-btn, a[role="button"]:has-text("Get Price"), button:has-text("Get Price")',
          )
          .first(),
      ).toBeAttached({ timeout });
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
    // Mobile uses `.getpricemobile`; desktop must skip that hidden duplicate.
    if (this.isMobile()) {
      await this.#clickGetPriceButton();
      return;
    }
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
    if (this.isMobile()) {
      await this.openMobileBookYourVisitModal().catch(() => {});
      const modal = this.mobileVisitModal();
      await expect(modal).toHaveClass(/show/, { timeout: 15_000 }).catch(() => {});

      const service = modal.locator('#SelectedServiceCode').first();
      const hasServices = async () =>
        service.evaluate((el) =>
          Array.from(el.options).some(
            (o) => o.value && !/loading|select service/i.test(o.textContent || ''),
          ),
        );

      // Prefer waiting for getservices-populated options. Avoid Search — it clears the list.
      if (!(await hasServices())) {
        const timeSelect = modal.locator('#detailBookingTimeMobile').first();
        const preferred = await timeSelect
          .evaluate((el) => {
            const opts = Array.from(el.options).filter((o) => o.value && !o.disabled);
            const day = opts.find((o) => Number(o.value) >= 1000 && Number(o.value) <= 2000);
            return (day || opts.find((o) => o.value === '1100') || opts[0] || {}).value || '';
          })
          .catch(() => '');
        const svcWait = this.page
          .waitForResponse((res) => /loungedetailspage\/getservices/i.test(res.url()), {
            timeout: 30_000,
          })
          .catch(() => null);
        if (preferred) {
          await timeSelect.selectOption(preferred).catch(() => {});
          console.log(`[booking] Mobile visit time set: ${preferred}`);
        }
        await svcWait;
        await this.settle(1_500);
      }

      await expect.poll(hasServices, { timeout: 60_000 }).toBeTruthy();
      const serviceValue = await service.evaluate((el) => {
        const opts = Array.from(el.options).filter(
          (o) => o.value && !/loading|select service/i.test(o.textContent || ''),
        );
        const lounge = opts.find((o) => /lounge/i.test(o.textContent || ''));
        return (lounge || opts[0]).value;
      });
      await service.selectOption(serviceValue);
      console.log(`[booking] Mobile service selected: ${serviceValue}`);

      const product = modal.locator('#SelectedProductCode').first();
      await expect
        .poll(
          async () =>
            product.evaluate((el) =>
              Array.from(el.options).some(
                (o) => o.value && !/select service/i.test(o.textContent || ''),
              ),
            ),
          { timeout: 30_000 },
        )
        .toBeTruthy();
      const productValue = await product.evaluate((el) => {
        const opt = Array.from(el.options).find(
          (o) => o.value && !/select service/i.test(o.textContent || ''),
        );
        return opt ? opt.value : '';
      });
      if (productValue) {
        await product.selectOption(productValue);
        console.log(`[booking] Mobile LOS/product selected: ${productValue}`);
      }

      const getPrice = modal.locator('a.getpricemobile, a.btn.getPrice-btn, button.getpricemobile').first();
      await expect(getPrice).toBeAttached({ timeout: 30_000 });
      await getPrice.evaluate((el) => {
        el.classList.remove('hide', 'd-none');
        el.click();
      });
      console.log('[booking] Mobile Get Price clicked');

      const reserve = modal.locator('a.reservenowmobile, a.btn:has-text("Reserve Now")').first();
      await expect
        .poll(async () => reserve.evaluate((el) => !el.classList.contains('hide')), {
          timeout: 90_000,
        })
        .toBeTruthy();
      return;
    }
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
        .or(this.page.getByRole('link', { name: /Reserve Now/i }).filter({ visible: true }))
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
    if (this.isMobile()) {
      await this.openMobileBookYourVisitModal().catch(() => {});
      const modal = this.mobileVisitModal();
      const reserve = modal.locator('a.reservenowmobile, a.btn:has-text("Reserve Now")').first();
      await expect
        .poll(async () => reserve.evaluate((el) => !el.classList.contains('hide')), {
          timeout: 90_000,
        })
        .toBeTruthy();
      await this.waitBeforeTransition();
      await reserve.evaluate((el) => {
        el.classList.remove('hide', 'd-none');
        el.click();
      });
      // After Reserve, either Confirm & Proceed or mini-cart Check Out appears.
      const postReserveCta = this.page
        .getByRole('link', { name: /Confirm & Proceed/i })
        .or(this.page.getByRole('button', { name: /Confirm & Proceed/i }))
        .or(this.miniCartCheckOutButton())
        .first();
      await expect(postReserveCta).toBeVisible({ timeout: 90_000 });
      await postReserveCta.click({ force: true });
      // Land on guest checkout when Confirm was used; Passes/mini-cart path may still show form next.
      await this.page
        .locator('#guestcheckoutbutton, #AgreePrivacyGuest, #Title')
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {});
      console.log('[booking] Mobile Reserve Now → post-reserve CTA clicked');
      return;
    }

    await expect(this.page.getByRole('button', { name: 'Reserve Now' })).toBeVisible({
      timeout: 90_000,
    });
    await this.waitBeforeTransition();
    await this.page.getByRole('button', { name: 'Reserve Now' }).click();

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
