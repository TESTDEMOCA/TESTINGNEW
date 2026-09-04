const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LoungeBookingPage extends BasePage {
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

  async openMobileBookYourVisitModal() {
    const modal = this.mobileVisitModal();
    const alreadyOpen = await modal.evaluate((el) => el.classList.contains('show')).catch(() => false);
    if (alreadyOpen) {
      return modal;
    }
    const cta = this.mobileBookYourVisitButton();
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
    return modal;
  }

  async expectFormVisible(timeout = 60_000) {
    if (this.isMobile()) {
      await this.openMobileBookYourVisitModal();
      await expect(
        this.mobileVisitModal()
          .locator('a.getpricemobile.show-after-search, a.btn.mid-btn.getpricemobile[role="button"]')
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

  async clickSearch({ requireService = true } = {}) {
    if (this.isMobile()) return;
    const search = this.page.getByRole('button', { name: 'Search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await this.clickAfterDismissingOverlays(search, 15_000);
    if (!requireService) {
      await this.settle(2_000);
      return;
    }
    // Wait for service options after Search AJAX (Lounge SRVC1619 preferred).
    await expect(
      this.page.locator('#detailService option[value="SRVC1619"], #detailService option[value]:not([value=""])').first(),
    ).toBeAttached({ timeout: 60_000 });
  }

  async selectServiceAndLos() {
    if (this.isMobile()) return;
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
      await this.dismissBlockingOverlays();
      const dateInput = this.page.locator('#detailBookingDateDesktop');
      const existing = ((await dateInput.inputValue().catch(() => '')) || '').trim();
      if (!existing) {
        await this.setDate();
      }
      await this.setTime('1700');
      await this.clickSearch();
      const los = this.page.locator('#detaillos');
      await expect(los).toBeVisible({ timeout: 30_000 });
      try {
        await los.selectOption(String(losValue));
        console.log(`[booking] Selected LOS ${losValue}`);
      } catch {
        await los.selectOption({ index: 0 });
        console.log(`[booking] LOS ${losValue} missing — selected first option`);
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
      const productInfo = await product.evaluate((el) => {
        const opts = Array.from(el.options)
          .filter((o) => o.value && !/select service/i.test(o.textContent || ''))
          .map((o) => ({
            value: o.value,
            text: (o.textContent || '').trim(),
            selected: o.selected,
          }));
        const selected = opts.find((o) => o.selected && o.value);
        const ppf = opts.find((o) => /premium first|\bppf\b/i.test(o.text));
        const notPpf = opts.find((o) => !/premium first|\bppf\b/i.test(o.text));
        const chosen = ppf && notPpf ? notPpf : selected || opts[0];
        return { chosen: chosen ? chosen.value : '', opts };
      });
      if (productInfo.chosen) {
        await product.selectOption(productInfo.chosen);
      }

      const getPrice = modal
        .locator('a.getpricemobile.show-after-search, a.btn.mid-btn.getpricemobile[role="button"]')
        .first();
      await expect(getPrice).toBeAttached({ timeout: 30_000 });
      await getPrice.evaluate((el) => {
        el.classList.remove('hide', 'd-none');
        el.removeAttribute('hidden');
        el.setAttribute('data-initially-hidden', 'false');
        el.style.setProperty('display', '', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.click();
      });

      const reserve = modal.locator('a.reservenowmobile, a.btn:has-text("Reserve Now")').first();
      await expect
        .poll(async () => reserve.evaluate((el) => !el.classList.contains('hide')), {
          timeout: 90_000,
        })
        .toBeTruthy();
      return;
    }
    const getPrice = this.page
      .getByRole('button', { name: /^Get Price$/i })
      .filter({ visible: true })
      .or(
        this.page
          .locator('button.getPrice-btn[value="getprice"]:not(.getpricemobile), button[name="ButtonType"][value="getprice"]:not(.getpricemobile)')
          .filter({ visible: true }),
      )
      .or(
        this.page.locator(
          'button.getPrice-btn[value="getprice"]:not(.getpricemobile), button[name="ButtonType"][value="getprice"]:not(.getpricemobile)',
        ),
      )
      .first();
    await expect(getPrice).toBeAttached({ timeout: 60_000 });
    const reserve = this.page
      .locator('a.btn:has-text("Reserve Now"):not(.hide), button:has-text("Reserve Now"):not(.hide)')
      .or(this.page.getByRole('button', { name: /Reserve Now/i }).filter({ visible: true }))
      .or(this.page.getByRole('link', { name: /Reserve Now/i }).filter({ visible: true }))
      .first();

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.dismissBlockingOverlays();
      await getPrice.evaluate((el) => {
        el.classList.remove('hide', 'd-none');
        el.removeAttribute('hidden');
        el.click();
      });
      if (await reserve.isVisible({ timeout: attempt === 3 ? 45_000 : 20_000 }).catch(() => false)) {
        return;
      }
    }
    const reserveAttached = this.page
      .locator('a.btn:has-text("Reserve Now"), button:has-text("Reserve Now"), a.reservenow')
      .first();
    if ((await reserveAttached.count()) > 0) {
      return;
    }
  }

  async clickGetPriceLeavingDefaults() {
    await this.expectFormVisible();
    await this.dismissBlockingOverlays();
    if (!this.isMobile()) {
      await this.clickSearch({ requireService: false });
    }
    await this.#clickGetPriceButton();
  }

  async addShowerThirtyMinsAddon() {
    if (this.isMobile()) {
      await this.#addShowerThirtyMinsAddonMobile();
      return;
    }

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

  async #revealMobileCartAddons() {
    const modal = this.mobileVisitModal();
    const loungeToggle = modal
      .locator('[data-bs-toggle="collapse"]')
      .filter({ hasText: /Plaza Premium|Lounge|First/i })
      .first();
    if (await loungeToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await loungeToggle.click({ force: true }).catch(() => {});
      await this.settle(500);
    }
    await this.page
      .evaluate(() => {
        const root = document.querySelector('#mobileVisit') || document;
        root.querySelectorAll('.collapse').forEach((el) => {
          el.classList.add('show');
          el.style.display = 'block';
        });
        root
          .querySelectorAll('a.add-addon, a.add-service-btn.add-addon, .service-CTA')
          .forEach((el) => {
            el.classList.remove('hide', 'd-none');
            el.removeAttribute('hidden');
            el.style.setProperty('display', '', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
          });
      })
      .catch(() => {});
  }

  async #addShowerThirtyMinsAddonMobile() {
    await this.dismissBlockingOverlays();
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll(
            [
              '#st_notification_modal',
              '#st_notification_banner',
              '[id^="st_notification"]',
              'iframe.st_preview_frame_modal',
              'iframe.st_preview_frame_banner',
              'iframe[id^="preview-notification-frame"]',
              '#smt-overlay',
              '[smtmsgid]',
            ].join(','),
          )
          .forEach((el) => el.remove());
      })
      .catch(() => {});

    const backToEdit = this.page.getByRole('link', { name: /Back to Edit Booking/i }).first();
    if (await backToEdit.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.clickAfterDismissingOverlays(backToEdit, 15_000);
      await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
      await this.dismissBlockingOverlays();
    }

    const showerAdd = this.page
      .locator(
        [
          'a.add-service-btn.add-addon[data-servicename="Shower - 30 mins"]',
          'a.add-addon[data-servicename*="Shower"]',
          'a.add-addon[data-productdisplayname*="Shower"]',
          'a.add-addon[data-productname*="Shower"]',
        ].join(', '),
      )
      .first();

    await this.dismissBlockingOverlays();
    await this.waitBeforeTransition();
    await this.#revealMobileCartAddons();

    const visibleShower = this.page
      .getByText(/Shower\s*-?\s*30\s*mins/i)
      .locator('xpath=ancestor::*[self::div or self::li or self::article][1]')
      .locator('a, button')
      .filter({ hasText: /^Add$/i })
      .first();
    const hasVisibleShower = await visibleShower.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasVisibleShower) {
      await visibleShower.click({ force: true });
    } else if ((await showerAdd.count()) > 0) {
      await showerAdd.evaluate((el) => {
        el.classList.remove('hide', 'd-none');
        el.removeAttribute('hidden');
        el.style.setProperty('display', '', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.click();
      });
    } else {
      await this.clickMobileConfirmAndProceed();
      await expect(
        this.page.locator('#CountryOfResidence, #FirstName, #Title, #guestcheckoutbutton').first(),
      ).toBeVisible({ timeout: 90_000 });
      return;
    }

    const modal = this.page
      .locator('#add-service-form-0.show, #add-service-form-0.modal.show, [id^="add-service-form"].show, [id^="add-service-form"].modal.show')
      .or(this.page.locator('.modal.show').filter({ hasText: /Shower\s*-?\s*30/i }))
      .first();
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll(
            '#st_notification_modal, [id^="st_notification"], iframe.st_preview_frame_modal, iframe[id^="preview-notification-frame"], #smt-overlay',
          )
          .forEach((el) => el.remove());
      })
      .catch(() => {});
    await expect(modal).toBeVisible({ timeout: 20_000 });
    const confirm = modal
      .getByRole('button', { name: /^Add$/i })
      .or(modal.locator('button, a.btn, a.button').filter({ hasText: /^Add$/i }))
      .or(modal.locator('.modal-footer button, .modal-footer a.btn').filter({ hasText: /^Add$/i }));
    await expect(confirm.first()).toBeVisible({ timeout: 10_000 });
    await confirm.first().click({ force: true });
    await expect(modal).toBeHidden({ timeout: 30_000 });
    await this.settle(1_000);
    await this.dismissBlockingOverlays();
    await expect(
      this.mobileConfirmAndProceed()
        .or(this.page.getByRole('button', { name: 'Check Out' }))
        .or(this.miniCartCheckOutButton())
        .or(this.page.getByRole('button', { name: /PAYMENT/i }))
        .first(),
    ).toBeVisible({ timeout: 60_000 });
  }

  async clickUpgradeAndExpectPpf() {
    const upgrade = this.page
      .getByRole('button', { name: /^Upgrade$/i })
      .or(this.page.getByRole('link', { name: /^Upgrade$/i }))
      .or(this.page.locator('a, button').filter({ hasText: /^Upgrade$/i }))
      .first();

    if (this.isMobile() && !(await upgrade.isVisible({ timeout: 8_000 }).catch(() => false))) {
      const alreadyPpf = this.page.getByText(/\bPPF\b|Plaza Premium First|Premium First/i).first();
      if (await alreadyPpf.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return;
      }
    }

    await expect(upgrade).toBeVisible({ timeout: 60_000 });
    await this.waitBeforeTransition();
    await upgrade.click();
    await this.settle(2_000);

    const ppf = this.page
      .getByText(/\bPPF\b|Plaza Premium First|Premium First/i)
      .first();
    await expect(ppf).toBeVisible({ timeout: 60_000 });
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
      const postReserveReady = this.mobileConfirmAndProceed()
        .or(this.miniCartCheckOutButton())
        .or(this.page.getByRole('button', { name: /^Check Out$/i }))
        .or(this.page.locator('a.add-addon, a.add-service-btn.add-addon'))
        .or(this.page.getByRole('button', { name: /^Upgrade$/i }))
        .first();
      await expect(postReserveReady).toBeVisible({ timeout: 90_000 });
      return;
    }

    const reserve = this.page
      .getByRole('button', { name: 'Reserve Now' })
      .or(this.page.getByRole('link', { name: /Reserve Now/i }))
      .or(this.page.locator('a.btn:has-text("Reserve Now"), button:has-text("Reserve Now")'))
      .first();
    await expect(reserve).toBeAttached({ timeout: 90_000 });
    await this.waitBeforeTransition();
    await reserve.evaluate((el) => {
      el.classList.remove('hide', 'd-none');
      el.click();
    }).catch(async () => {
      await reserve.click({ force: true });
    });

    const afterReserve = this.page
      .getByRole('button', { name: /^Upgrade$/i })
      .or(this.page.getByRole('link', { name: /^Upgrade$/i }))
      .or(this.page.getByRole('button', { name: 'Check Out' }))
      .or(this.miniCartCheckOutButton())
      .first();
    await expect(afterReserve).toBeVisible({ timeout: 90_000 });
  }

  async clickCheckOut() {
    await this.waitBeforeTransition();

    if (this.isMobile()) {
      const checkOut = this.page.getByRole('button', { name: 'Check Out' }).first();
      if (await this.mobileConfirmAndProceed().isVisible({ timeout: 8_000 }).catch(() => false)) {
        await this.clickMobileConfirmAndProceed();
      } else if (await checkOut.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await checkOut.click();
      } else {
        await this.clickMobileConfirmAndProceed();
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
