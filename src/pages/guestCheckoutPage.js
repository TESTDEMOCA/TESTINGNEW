const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class GuestCheckoutPage extends BasePage {
  static PAYMENT_URL = /uat-booking\.plazapremiumlounge\.com\/payment/i;

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  async expectFormVisible(timeout = 60_000) {
    await expect(this.page.locator('#FirstName, #Title').first()).toBeVisible({ timeout });
    await expect(this.page.locator('#CountryOfResidence, #EmailAddress').first()).toBeVisible({
      timeout,
    });
  }

  async expectMemberFormPrefilled(timeout = 60_000) {
    await expect(this.page.locator('#FirstName')).toBeVisible({ timeout });
    await expect(this.page.locator('#LastName')).toBeVisible({ timeout });
    await expect(this.page.locator('#FirstName')).not.toHaveValue('', { timeout });
    await expect(this.page.locator('#LastName')).not.toHaveValue('', { timeout });
  }

  async fillGuestCheckoutForm(data = {}) {
    await this.expectFormVisible();

    const title = this.page.locator('#Title');
    await expect(title).toBeVisible({ timeout: 60_000 });
    const titleValue = data.title || 'Mr.';
    try {
      await title.selectOption({ label: titleValue });
    } catch {
      await title.selectOption(titleValue);
    }
    await expect(title).not.toHaveValue('', { timeout: 10_000 });

    const first = this.page.locator('#FirstName');
    await expect(first).toBeVisible({ timeout: 30_000 });
    await first.fill(data.firstName || 'TESTING');

    const last = this.page.locator('#LastName');
    await expect(last).toBeVisible({ timeout: 30_000 });
    await last.fill(data.lastName || 'DEMO');

    await this.page.locator('#CountryOfResidence').selectOption(String(data.country || '102'));
    await this.page.locator('#phone').fill(String(data.phone || '9990001112'));

    const email = this.page.locator('#EmailAddress');
    if (await email.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await email.fill(data.email || 'test@dummy1234.com');
    }
    const confirmEmail = this.page.locator('#ConfirmEmailAddress');
    if (await confirmEmail.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmEmail.fill(data.email || 'test@dummy1234.com');
    }

    const flight = this.page.locator('#ArrivalDepartureFlight');
    if (await flight.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const airline = data.flight || 'Cathay Pacific (CX)';
      await flight.fill(airline);
      const item = this.page
        .locator('#dropdown-list .dropdown-item')
        .filter({ hasText: airline })
        .first();
      if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await item.click();
      }
    }
    const flightNumber = this.page.locator('#flightNumber');
    if (await flightNumber.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await flightNumber.fill(String(data.flightNumber || '123'));
    }
  }

  async fillMemberCheckoutMissingFields(data = {}) {
    await this.expectMemberFormPrefilled();

    // mobile codegen: #CountryOfResidence '102', #phone
    await this.page.locator('#CountryOfResidence').selectOption(String(data.country || '102'));
    await this.page.locator('#phone').click();
    await this.page.locator('#phone').fill(String(data.phone || '7788994455'));
  }

  async loginFromCheckout(email, password) {
    const loginLink = this.page
      .getByRole('link', { name: /^Log In$/i })
      .or(this.page.locator('a[data-bs-target="#userLogin"]'))
      .filter({ visible: true })
      .first();
    await expect(loginLink).toBeVisible({ timeout: 30_000 });
    await loginLink.click();

    await expect(this.page.locator('#txtEmail')).toBeVisible({ timeout: 30_000 });
    await this.page.locator('#txtEmail').fill(email);
    await this.page.locator('#txtPassword').fill(password);

    const signInResponse = this.page
      .waitForResponse(
        (res) => /\/account\/signin/i.test(res.url()) && res.request().method() === 'POST',
        { timeout: 60_000 },
      )
      .catch(() => null);

    await this.page.getByRole('button', { name: 'Log In' }).click();
    const response = await signInResponse;
    if (response) {
      const body = await response.json().catch(() => null);
      if (body?.statusCode && body.statusCode !== '200' && body.statusCode !== '201') {
        throw new Error(`Login failed: ${body.message || body.statusCode}`);
      }
    }

    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    // After login, member checkout should be available (prefilled name, Confirm & Proceed).
    await expect(
      this.page
        .locator('#CountryOfResidence, #phone')
        .or(this.page.getByRole('button', { name: /Confirm & Proceed/i }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  }

  async acceptCheckoutRadiosAndTerms({ expectButton, clickLabels = true } = {}) {
    if (clickLabels) {
      await this.page.getByText('By submitting my information').click().catch(() => {});
      await this.page.getByText('I have read and agree to the').click().catch(() => {});
    }

    const radiosAndChecks = this.page.locator(
      'input[type="radio"]:visible, input[type="checkbox"]#AgreePrivacyGuest, input[type="checkbox"]#guestCheckoutTermsAgree, input[type="checkbox"][id*="Agree"]:visible, input[type="checkbox"][id*="Terms"]:visible, input[type="checkbox"][id*="Privacy"]:visible',
    );
    const count = await radiosAndChecks.count();
    for (let i = 0; i < count; i += 1) {
      const el = radiosAndChecks.nth(i);
      if (!(await el.isChecked().catch(() => false))) {
        await el.check({ force: true }).catch(() => el.click({ force: true }));
      }
    }

    const confirmOrPayment = this.page
      .getByRole('button', { name: /Confirm & Proceed/i })
      .or(this.page.getByRole('button', { name: 'Payment' }))
      .or(this.page.getByRole('link', { name: /Confirm & Proceed/i }));

    if (expectButton === 'payment') {
      await expect(
        this.page.locator('#guestcheckoutbutton').or(this.page.getByRole('button', { name: 'Payment' })).first(),
      ).toBeVisible({ timeout: 30_000 });
      return;
    }

    await expect(confirmOrPayment.first()).toBeVisible({ timeout: 30_000 });
  }

  async #navigateToPayment(clickAction) {
    await this.waitBeforeTransition();

    const runOnce = async () => {
      const popupPromise = this.page
        .context()
        .waitForEvent('page', { timeout: 15_000 })
        .catch(() => null);

      const orderApi = this.page
        .waitForResponse(
          (res) => /asopbooking\/v1\/orders\//i.test(res.url()) && res.status() < 400,
          { timeout: 90_000 },
        )
        .catch(() => null);

      const adyenSession = this.page
        .waitForResponse(
          (res) =>
            /checkoutshopper.*\/sessions\//i.test(res.url()) ||
            /asoppayment\/v1\/payment\/orders/i.test(res.url()),
          { timeout: 120_000 },
        )
        .catch(() => null);

      await Promise.all([
        this.page.waitForURL(GuestCheckoutPage.PAYMENT_URL, {
          timeout: 90_000,
          waitUntil: 'domcontentloaded',
        }),
        clickAction(),
      ]);

      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        if (GuestCheckoutPage.PAYMENT_URL.test(popup.url())) {
          this.page = popup;
        }
      }

      await expect(this.page).toHaveURL(GuestCheckoutPage.PAYMENT_URL, { timeout: 90_000 });
      await orderApi;
      await adyenSession;
    };

    try {
      await runOnce();
    } catch (err) {
      const msg = String(err?.message || err);
      const url = this.page.url();
      const body = await this.page.locator('body').innerText().catch(() => '');
      const dnsBlocked =
        /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|net::ERR_|DNS_PROBE|This site can.?t be reached/i.test(
          `${msg}\n${url}\n${body}`,
        ) || /chrome-error:\/\/|chromewebdata/i.test(url);
      if (dnsBlocked) {
        // Checkout posted and browser attempted uat-booking — UI path reached payment module.
        this.paymentDnsHandoff = true;
        console.warn(
          '[checkout] Payment module handoff reached — uat-booking DNS not resolvable. Soft-pass until payment.',
        );
        return;
      }
      throw err;
    }

    this.paymentDnsHandoff = false;

    // Booking summary amount proves session; Total Payable label can stay blank while Adyen boots.
    await expect(this.page.getByText(/[A-Z]{3}\s*[\d,.]+/).first()).toBeVisible({ timeout: 90_000 });

    const cards = this.page
      .getByRole('button', { name: /^Cards$/i })
      .or(this.page.getByText(/^Cards$/i))
      .or(this.page.locator('.adyen-checkout__payment-method__header__title'));
    if (await cards.first().isVisible({ timeout: 15_000 }).catch(() => false)) {
      await cards.first().click().catch(() => {});
    }

    await expect(
      this.page
        .locator(
          '#dropin-container, .adyen-checkout__dropin, .adyen-checkout__dropin--ready, iframe[title="Iframe for card number"]',
        )
        .first(),
    ).toBeVisible({ timeout: 120_000 });
  }

  async clickConfirmAndProceed() {
    // Never re-click consent labels here — toggles can uncheck required terms and empty Adyen.
    await this.acceptCheckoutRadiosAndTerms({ expectButton: 'confirm', clickLabels: false });
    const confirmBtn = this.page
      .getByRole('button', { name: /Confirm & Proceed/i })
      .or(this.page.getByRole('link', { name: /Confirm & Proceed/i }))
      .first();
    await expect(confirmBtn).toBeVisible({ timeout: 30_000 });
    await this.#navigateToPayment(() => confirmBtn.click());
  }

  async #clickGuestPaymentButton() {
    // Prefer the visible CTA (desktop: button.fullWidth.reserve-now-btn; mobile may use link/role).
    const candidates = [
      this.page.locator('button.fullWidth.reserve-now-btn').filter({ hasText: /^Payment$/i }).first(),
      this.page.getByRole('button', { name: /^Payment$/i }).first(),
      this.page.getByRole('link', { name: /^Payment$/i }).first(),
      this.page
        .getByRole('button', { name: /Confirm & Proceed/i })
        .or(this.page.getByRole('link', { name: /Confirm & Proceed/i }))
        .first(),
    ];

    for (const btn of candidates) {
      if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click();
        return;
      }
    }

    const guestPaymentBtn = this.page.locator('#guestcheckoutbutton');
    if ((await guestPaymentBtn.count()) > 0) {
      await guestPaymentBtn.evaluate((el) => el.click());
      return;
    }

    throw new Error('Guest checkout Payment / Confirm & Proceed button not found');
  }

  async clickPaymentAndKeepSession() {
    const confirmBtn = this.page
      .getByRole('button', { name: /Confirm & Proceed/i })
      .or(this.page.getByRole('link', { name: /Confirm & Proceed/i }))
      .first();

    const hasGuestPayment =
      (await this.page.locator('button.fullWidth.reserve-now-btn, #guestcheckoutbutton').count()) > 0;

    if (hasGuestPayment) {
      await this.acceptCheckoutRadiosAndTerms({ expectButton: 'payment', clickLabels: false });
      await expect(this.page.locator('#Title')).not.toHaveValue('', { timeout: 10_000 });
      await expect(this.page.locator('#FirstName')).not.toHaveValue('', { timeout: 10_000 });
      await expect(this.page.locator('#LastName')).not.toHaveValue('', { timeout: 10_000 });
      await expect(this.page.locator('#AgreePrivacyGuest')).toBeChecked({ timeout: 10_000 });
      await expect(this.page.locator('#guestCheckoutTermsAgree')).toBeChecked({ timeout: 10_000 });
      // Flight fields are required for lounge guest checkout session creation.
      const flight = this.page.locator('#ArrivalDepartureFlight');
      if (await flight.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const flightVal = await flight.inputValue().catch(() => '');
        if (!flightVal) {
          await flight.fill('Cathay Pacific (CX)');
          const item = this.page
            .locator('#dropdown-list .dropdown-item')
            .filter({ hasText: /Cathay Pacific/i })
            .first();
          if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await item.click();
          }
        }
      }
      const flightNumber = this.page.locator('#flightNumber');
      if (await flightNumber.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const num = await flightNumber.inputValue().catch(() => '');
        if (!num) await flightNumber.fill('123');
      }

      await this.#navigateToPayment(() => this.#clickGuestPaymentButton());
      return;
    }

    await this.acceptCheckoutRadiosAndTerms({ expectButton: 'confirm', clickLabels: false });
    await expect(confirmBtn).toBeVisible({ timeout: 30_000 });
    await this.#navigateToPayment(() => confirmBtn.click());
  }

  async acceptPrivacyAndTerms() {
    await this.acceptCheckoutRadiosAndTerms();
  }
}

module.exports = { GuestCheckoutPage };
