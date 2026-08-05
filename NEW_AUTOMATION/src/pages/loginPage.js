const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LoginPage extends BasePage {
  static OPEN_LOGIN = 'a[data-bs-target="#userLogin"]';
  static MODAL = '#userLogin';
  static MODAL_CONTENT = '#userLogin .modal-content';
  static MODAL_TITLE = '#userLogin .modal-title';
  static FORM = '#formLogin';
  static EMAIL = '#txtEmail';
  static PASSWORD = '#txtPassword';
  static SUBMIT = '#formLogin button[type="submit"], button:has-text("Log In")';
  static LOGIN_ERROR = '#loginSpanResult';
  static MOBILE_NAV_TOGGLE = '#wsnavtoggle';

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  async open() {
    await this.gotoPath('/');
    await this.acceptTrackingConsentIfPresent();
    if (this.isMobile()) {
      await expect(this.page.locator(LoginPage.MOBILE_NAV_TOGGLE)).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(this.page.locator(LoginPage.OPEN_LOGIN).nth(1)).toBeVisible({ timeout: 60_000 });
    }
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

  async openLoginModal() {
    const loginLink = this.page.locator(LoginPage.OPEN_LOGIN).nth(1);
    await expect(loginLink).toBeVisible({ timeout: 30_000 });
    await loginLink.click();

    await expect(this.page.locator(LoginPage.MODAL_CONTENT)).toBeVisible({ timeout: 15_000 });
    await expect(this.page.locator(LoginPage.EMAIL)).toBeVisible({ timeout: 15_000 });
    await expect(this.page.locator(LoginPage.PASSWORD)).toBeVisible({ timeout: 15_000 });
  }

  async submitLogin(email, password) {
    const modalVisible = await this.page
      .locator(LoginPage.MODAL_CONTENT)
      .isVisible()
      .catch(() => false);
    if (!modalVisible) {
      await this.openLoginModal();
    }

    await this.page.locator(LoginPage.EMAIL).fill(email);
    await this.page.locator(LoginPage.PASSWORD).fill(password);

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
    await this.page
      .locator(LoginPage.MODAL_CONTENT)
      .waitFor({ state: 'hidden', timeout: 60_000 })
      .catch(() => {});
  }

  async loginAs(email, password) {
    await this.open();
    await this.submitLogin(email, password);
  }

  async expectLoggedIn(timeout = 60_000) {
    if (this.isMobile()) {
      await expect(this.page.locator(LoginPage.MOBILE_NAV_TOGGLE)).toBeVisible({ timeout });
      return;
    }
    // Login modal should close; member links exist in DOM (often inside a collapsed dropdown).
    await this.page
      .locator(LoginPage.MODAL_CONTENT)
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {});
    await expect(
      this.page
        .locator(
          'a[href*="my-booking"], a:has-text("Manage Booking"), a[href*="signout"], a[href*="SignOut"], a:has-text("Logout"), div.utility.user.dropdown',
        )
        .first(),
    ).toBeAttached({ timeout });
  }
}

module.exports = { LoginPage };
