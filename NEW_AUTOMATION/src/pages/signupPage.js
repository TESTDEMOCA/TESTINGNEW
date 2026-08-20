const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

/**
 * New-member registration form (Log In → Sign up now).
 * Locators from fixtures/codegen/tc08-desktop.js.
 */
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
    await link.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
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
    // codegen: getByLabel('Title').selectOption('Mr.')
    const titleSelect = this.page.getByLabel('Title', { exact: false }).first();
    if (await titleSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await titleSelect.selectOption({ label: title }).catch(async () => {
        await titleSelect.selectOption(title);
      });
    }

    if (this.isMobile()) {
      // Mobile sign-up form uses distinct ids (desktop roles still exist but Create is hidden).
      await this.page.locator('#SignUpFirstName, #FirstName').first().fill(firstName);
      await this.page.locator('#LastName').first().fill(lastName);
      const countrySelect = this.page.locator('#CountryOfResidence').first();
      await expect(countrySelect).toBeVisible({ timeout: 15_000 });
      await countrySelect.selectOption(country);
      await this.page.locator(SignupPage.PHONE).fill(phone);
      await this.page.locator('#EmailAddress').first().fill(email);
      await this.page.locator('#ConfirmEmailAddress').first().fill(email);
      const marketing = this.page.locator('#SubscribeNewsletter, #ReceiveOffers').first();
      if (await marketing.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await marketing.check().catch(() => {});
      }
      await this.page.locator(SignupPage.AGREE_TNC).check();
      await this.page.locator('#Password').fill(password);
      await this.page.locator('#ConfirmPassword').fill(password);
      return;
    }

    await this.page.getByRole('textbox', { name: /First Name/i }).fill(firstName);
    await this.page.getByRole('textbox', { name: /Last Name/i }).fill(lastName);

    // codegen: getByLabel('Country of Residence').selectOption('102')
    const countrySelect = this.page.getByLabel(/Country of Residence/i).first();
    await expect(countrySelect).toBeVisible({ timeout: 15_000 });
    await countrySelect.selectOption(country);

    // codegen: locator('#phone')
    await this.page.locator(SignupPage.PHONE).fill(phone);

    await this.page.getByRole('textbox', { name: /^Email Address/i }).fill(email);
    await this.page.getByRole('textbox', { name: /Confirm Email Address/i }).fill(email);

    const marketing = this.page.getByRole('checkbox', { name: /I would like to receive/i });
    if (await marketing.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketing.check().catch(() => {});
    }

    // codegen: locator('#AgreeTNC').check()
    await this.page.locator(SignupPage.AGREE_TNC).check();

    // codegen: getByRole('textbox', { name: 'Password *', exact: true })
    await this.page.getByRole('textbox', { name: 'Password *', exact: true }).fill(password);
    await this.page.getByRole('textbox', { name: 'Confirm password *' }).fill(password);
  }

  async #createAccountButton() {
    if (this.isMobile()) {
      // Desktop Create Account is `d-none d-md-block`; mobile Submit can have 0x0 until scrolled.
      return this.page
        .locator('button.btn.btn-primary.fullWidth[type="submit"]')
        .filter({ hasText: /^Submit$/i })
        .or(this.page.getByRole('button', { name: /^Submit$/i }))
        .or(this.page.getByRole('button', { name: /^Create Account$/i }))
        .first();
    }
    return this.page.getByRole('button', { name: /^Create Account$/i }).first();
  }

  async submitCreateAccount() {
    // Dismiss chat overlay that can intercept the Create Account click.
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

    // Mobile Submit can stay non-visible (0x0 / offscreen) — native DOM click still posts.
    if (this.isMobile()) {
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
    // Dismiss chat overlay that can intercept the Create Account click.
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

    // Mobile Submit can stay non-visible (0x0 / offscreen) — native DOM click still posts.
    if (this.isMobile()) {
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
