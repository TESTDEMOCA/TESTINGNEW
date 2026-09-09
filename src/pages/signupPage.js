const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class SignupPage extends BasePage {
  static SIGN_UP_NOW = 'a:has-text("Sign up now"), a[href*="register"], a[href*="sign-up"]';
  static TITLE = 'select[name*="Title"], #Title, select:near(:text("Title"))';
  static FIRST_NAME = 'input[name*="FirstName"], #FirstName';
  static LAST_NAME = 'input[name*="LastName"], #LastName';
  static COUNTRY = '#CountryOfResidence, select[name*="CountryOfResidence"]';
  static PHONE = '#phone';
  static EMAIL = 'input[name*="Email"]:not([name*="Confirm"]), #Email';
  static CONFIRM_EMAIL = 'input[name*="ConfirmEmail"], #ConfirmEmail';
  static MARKETING = 'input[type="checkbox"][name*="Marketing"], #ReceiveOffers';
  static AGREE_TNC = '#AgreeTNC';
  static PASSWORD = 'input[name="Password"], #Password';
  static CONFIRM_PASSWORD = 'input[name*="ConfirmPassword"], #ConfirmPassword';
  static CREATE_ACCOUNT = 'button:has-text("Create Account"), input[value="Create Account"]';

  async startSignUpFromLoginModal() {
    const link = this.page.getByRole('link', { name: /Sign up now/i }).first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    await link.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    await expect(this.page.getByRole('textbox', { name: /First Name/i }).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  async startSignUpFromLoginModal_afterSelectingProduct() {
    const link = this.page.getByRole('link', { name: /Sign up now/i }).first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    if (this.isMobile()) {
      await this.clickAfterDismissingOverlays(link, 15_000);
    } else {
      await link.click();
    }
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    if (this.isMobile()) {
      await expect(
        this.page
          .getByRole('textbox', { name: /Password/i })
          .or(this.page.locator('#Password, #ConfirmPassword'))
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      return;
    }
    await expect(this.page.getByRole('textbox', { name: /First Name/i }).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  async fillRegistrationForm({
    title = 'Mr.',
    firstName,
    lastName,
    country = '102',
    phone,
    email,
    password,
  }) {
    const titleSelect = this.page.getByLabel('Title', { exact: false }).first();
    if (await titleSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await titleSelect.selectOption({ label: title }).catch(async () => {
        await titleSelect.selectOption(title);
      });
    }

    if (this.isMobile()) {
      await this.dismissBlockingOverlays();
      const firstNameBox = this.page
        .getByRole('textbox', { name: /First Name/i })
        .or(this.page.locator('#SignUpFirstName, #FirstName'))
        .first();
      const lastNameBox = this.page
        .getByRole('textbox', { name: /Last Name/i })
        .or(this.page.locator('#LastName'))
        .first();
      await firstNameBox.fill(firstName);
      await lastNameBox.fill(lastName);
      const countrySelect = this.page
        .getByLabel(/Country of Residence/i)
        .or(this.page.locator('#CountryOfResidence'))
        .first();
      await expect(countrySelect).toBeVisible({ timeout: 15_000 });
      await countrySelect.selectOption(country);
      await this.page.locator(SignupPage.PHONE).fill(phone);
      const emailBox = this.page
        .getByRole('textbox', { name: /^Email Address/i })
        .or(this.page.locator('#Email, #SignUpEmail'))
        .first();
      const confirmEmailBox = this.page
        .getByRole('textbox', { name: /Confirm Email Address/i })
        .or(this.page.locator('#ConfirmEmail, #SignUpConfirmEmail'))
        .first();
      await emailBox.fill(email);
      await confirmEmailBox.fill(email);
      const marketing = this.page.getByRole('checkbox', { name: /I would like to receive/i })
        .or(this.page.locator('#SubscribeNewsletter, #ReceiveOffers'))
        .first();
      if (await marketing.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await marketing.check().catch(() => {});
      }
      await this.page.locator(SignupPage.AGREE_TNC).check();
      const passwordBox = this.page
        .getByRole('textbox', { name: 'Password *', exact: true })
        .or(this.page.locator('#Password'))
        .first();
      const confirmPasswordBox = this.page
        .getByRole('textbox', { name: 'Confirm password *' })
        .or(this.page.locator('#ConfirmPassword'))
        .first();
      await passwordBox.fill(password);
      await confirmPasswordBox.fill(password);
      return;
    }

    await this.page.getByRole('textbox', { name: /First Name/i }).fill(firstName);
    await this.page.getByRole('textbox', { name: /Last Name/i }).fill(lastName);

    const countrySelect = this.page.getByLabel(/Country of Residence/i).first();
    await expect(countrySelect).toBeVisible({ timeout: 15_000 });
    await countrySelect.selectOption(country);

    await this.page.locator(SignupPage.PHONE).fill(phone);

    await this.page.getByRole('textbox', { name: /^Email Address/i }).fill(email);
    await this.page.getByRole('textbox', { name: /Confirm Email Address/i }).fill(email);

    const marketing = this.page.getByRole('checkbox', { name: /I would like to receive/i });
    if (await marketing.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketing.check().catch(() => {});
    }

    await this.page.locator(SignupPage.AGREE_TNC).check();

    await this.page.getByRole('textbox', { name: 'Password *', exact: true }).fill(password);
    await this.page.getByRole('textbox', { name: 'Confirm password *' }).fill(password);
  }

  async #createAccountButton() {
    if (this.isMobile()) {
      const create = this.page.getByRole('button', { name: /^Create Account$/i }).first();
      if (await create.count()) return create;
      return this.page
        .locator('form[action*="register"] button[type="submit"], button:has-text("Create Account")')
        .or(this.page.locator('button.btn.btn-primary.fullWidth[type="submit"]').filter({ hasText: /^Submit$/i }))
        .first();
    }
    return this.page.getByRole('button', { name: /^Create Account$/i }).first();
  }

  async submitCreateAccount() {
    const chatClose = this.page
      .locator('[aria-label*="Close" i], .chat-close, button:has-text("Close")')
      .first();
    if (await chatClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await chatClose.click().catch(() => {});
    }

    const createBtn = await this.#createAccountButton();
    await createBtn.scrollIntoViewIfNeeded().catch(() => {});
    await this.settle(300);
    await expect(createBtn).toBeAttached({ timeout: 30_000 });

    const registerResponse = this.page
      .waitForResponse(
        (res) =>
          /register|signup|sign-up|createaccount|account\/create/i.test(res.url()) &&
          res.request().method() === 'POST',
        { timeout: 90_000 },
      )
      .catch(() => null);

    if (this.isMobile()) {
      await this.dismissBlockingOverlays();
      await createBtn.evaluate((el) => el.click());
    } else {
      await createBtn.click({ force: true });
    }
    const response = await registerResponse;

    if (response) {
      const body = await response.json().catch(() => null);
      const status = response.status();
      const code = body?.statusCode != null ? String(body.statusCode) : '';
      if (status >= 400 || (code && code !== '200' && code !== '201')) {
        throw new Error(
          `Create Account failed (${status}${code ? ` / ${code}` : ''}): ${
            body?.message || body?.Message || JSON.stringify(body) || response.statusText()
          }`,
        );
      }
    }

    const thankYou = this.page
      .getByRole('heading', { name: /Thank You for Registration/i })
      .or(this.page.getByText(/Thank You for Registration/i))
      .or(this.page.getByText(/Verification Email Sent/i));

    try {
      await expect(thankYou.first()).toBeVisible({ timeout: 90_000 });
    } catch (err) {
      const fieldError = await this.page
        .locator('.field-validation-error, .validation-summary-errors, .text-danger, .error, .alert-danger')
        .allTextContents()
        .catch(() => []);
      const visibleError = fieldError.map((t) => t.trim()).filter(Boolean).join(' | ');
      throw new Error(
        `Registration thank-you page not shown.${visibleError ? ` Form errors: ${visibleError}` : ''} ${err.message}`,
      );
    }
  }

  async submitCreateAccount_afterproductSelection() {
    const chatClose = this.page
      .locator('[aria-label*="Close" i], .chat-close, button:has-text("Close")')
      .first();
    if (await chatClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await chatClose.click().catch(() => {});
    }

    const createBtn = await this.#createAccountButton();
    await createBtn.scrollIntoViewIfNeeded().catch(() => {});
    await this.settle(300);
    await expect(createBtn).toBeAttached({ timeout: 30_000 });

    const registerResponse = this.page
      .waitForResponse(
        (res) =>
          /register|signup|sign-up|createaccount|account\/create/i.test(res.url()) &&
          res.request().method() === 'POST',
        { timeout: 90_000 },
      )
      .catch(() => null);

    if (this.isMobile()) {
      await this.dismissBlockingOverlays();
      await createBtn.evaluate((el) => el.click());
    } else {
      await createBtn.click({ force: true });
    }
    const response = await registerResponse;

    if (response) {
      const body = await response.json().catch(() => null);
      const status = response.status();
      const code = body?.statusCode != null ? String(body.statusCode) : '';
      if (status >= 400 || (code && code !== '200' && code !== '201')) {
        throw new Error(
          `Create Account failed (${status}${code ? ` / ${code}` : ''}): ${
            body?.message || body?.Message || JSON.stringify(body) || response.statusText()
          }`,
        );
      }
    }

    if (this.isMobile()) {
      if (!response) {
        const fieldError = await this.page
          .locator('.field-validation-error, .validation-summary-errors, .text-danger, .error, .alert-danger')
          .allTextContents()
          .catch(() => []);
        const visibleError = fieldError.map((t) => t.trim()).filter(Boolean).join(' | ');
        throw new Error(
          `Mobile Create Account did not POST a register/signup request.${visibleError ? ` Form errors: ${visibleError}` : ''} URL: ${this.page.url()}`,
        );
      }
    }
  }

  async backToHomeFromThankYou() {
    await this.page.getByRole('link', { name: /Back to Home/i }).click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    await this.acceptTrackingConsentIfPresent();
  }

  async acceptTrackingConsentIfPresent() {
    const agree = this.page
      .locator('#tracking-consent-submit')
      .or(this.page.getByRole('button', { name: 'I agree' }))
      .first();
    if (await agree.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await agree.click();
    }
  }
}

module.exports = { SignupPage };
