const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class PaymentPage extends BasePage {
  async expectPaymentMethodVisible(timeout = 90_000) {
    await expect(this.page).toHaveURL(/uat-booking\.plazapremiumlounge\.com\/payment/i, {
      timeout,
    });
    await expect(this.page.getByText('Payment Method')).toBeVisible({ timeout });
    // Booking summary amount proves session (Total Payable label can lag).
    await expect(this.page.getByText(/[A-Z]{3}\s*[\d,.]+/).first()).toBeVisible({ timeout });
    await expect(this.visibleAdyenDropIn()).toBeVisible({ timeout });
  }

  visibleAdyenIframe(title) {
    return this.page.locator(`iframe[title="${title}"]`).filter({ visible: true }).first();
  }

  visibleAdyenDropIn() {
    return this.page.locator('#dropin-container, .adyen-checkout__dropin--ready').filter({ visible: true }).first();
  }

  visibleSecuredFieldIframe() {
    return this.page
      .locator('iframe[title="Iframe for card number"], iframe[title="Iframe for security code"]')
      .filter({ visible: true })
      .first();
  }

  async waitForAdyenDropIn(timeout = 120_000) {
    await expect(this.page.getByText(/[A-Z]{3}\s*[\d,.]+/).first()).toBeVisible({ timeout });
    await expect(this.visibleAdyenDropIn()).toBeVisible({ timeout });

    if (await this.visibleSecuredFieldIframe().isVisible({ timeout: 8_000 }).catch(() => false)) {
      return;
    }

    const stored = this.page.locator('.adyen-checkout__payment-method--storedCard').first();
    if (await stored.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await stored.click().catch(() => {});
      console.log('[payment] Expanded stored card for CVC');
    } else {
      const cards = this.page.getByRole('button', { name: /^Cards$/i });
      if (await cards.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cards.first().click().catch(() => {});
      }
    }

    await expect(this.visibleSecuredFieldIframe()).toBeVisible({ timeout });
  }

  async fillAdyenIframeTextbox(iframeTitle, textboxName, value) {
    const input = this.visibleAdyenIframe(iframeTitle)
      .contentFrame()
      .getByRole('textbox', { name: textboxName });
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    await input.fill(value);
  }

  async expandNewCardPaymentMethod() {
    const newCard = this.page
      .locator('.adyen-checkout__payment-method--card:not(.adyen-checkout__payment-method--storedCard)')
      .first();
    if (!(await newCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return;
    }
    await newCard.click().catch(() => {});
    console.log('[payment] Expanded new card form');
    await this.visibleAdyenIframe('Iframe for card number')
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  async fillCardDetails(card = {}) {
    await this.expectPaymentMethodVisible();
    await this.waitForAdyenDropIn();

    const number = String(card.number || '3700 000000 00002');
    const expiry = String(card.expiry || '03/30');
    const cvc = String(card.cvc || '7373');
    const name = String(card.name || 'TEST');

    if (card.saveForFuture) {
      await this.expandNewCardPaymentMethod();
    }

    const hasNewCardForm = await this.visibleAdyenIframe('Iframe for card number')
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (!hasNewCardForm) {
      console.log('[payment] Stored card already on file — CVV only');
      await this.fillAdyenIframeTextbox('Iframe for security code', 'Security code', cvc);
      return;
    }

    await this.fillAdyenIframeTextbox('Iframe for card number', 'Card number', number);
    await this.fillAdyenIframeTextbox('Iframe for expiry date', 'Expiry date', expiry);
    await this.fillAdyenIframeTextbox('Iframe for security code', 'Security code', cvc);

    const nameOnCard = this.page.getByRole('textbox', { name: 'Name on card' });
    if (await nameOnCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameOnCard.fill(name);
    } else if (this.isMobile()) {
      const holderName = this.page
        .locator(
          'input[name="holderName"], input.adyen-checkout__card__holderName__input, input[autocomplete="cc-name"][placeholder="J. Smith"]',
        )
        .first();
      await expect(holderName).toBeVisible({ timeout: 15_000 });
      await holderName.fill(name);
    }

    if (card.saveForFuture) {
      await this.checkSavePaymentDetailsForFuture();
    }
  }

  /**
   * Member first-time payment: tick "save payment details for future"
   * so later logins autofill card/expiry and only ask for CVV.
   */
  async checkSavePaymentDetailsForFuture() {
    const checkbox = this.page
      .locator('input[name="storeDetails"], input[name="storePaymentMethod"], input.adyen-checkout__checkbox__input')
      .or(
        this.page.getByRole('checkbox', {
          name: /save.*payment|save.*card|store.*detail|future|save for my next/i,
        }),
      )
      .first();

    const label = this.page
      .getByText(/save payment details for future|store details for future|save for my next payment|save card details/i)
      .first();

    if (await checkbox.isVisible({ timeout: 8_000 }).catch(() => false)) {
      const checked = await checkbox.isChecked().catch(() => false);
      if (!checked) {
        await checkbox.check({ force: true }).catch(async () => {
          await checkbox.click({ force: true });
        });
      }
      console.log('[payment] Checked save payment details for future');
      return;
    }

    if (await label.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await label.click();
      console.log('[payment] Clicked save payment details label');
      return;
    }

    throw new Error(
      'Could not find "save payment details for future" checkbox on payment page',
    );
  }

  /** Later member payments: card/expiry autofilled — enter CVV only. */
  async fillSavedCardSecurityCodeOnly(cvc = '7373') {
    await this.expectPaymentMethodVisible();
    await this.waitForAdyenDropIn();
    await this.fillAdyenIframeTextbox('Iframe for security code', 'Security code', String(cvc));
    console.log('[payment] Filled CVV only for saved card');
  }

  async clickConfirmAndPay() {
    await this.waitBeforeTransition();
    await this.page.getByRole('button', { name: 'Confirm & Pay' }).click();
  }

  async captureOrderNumber(timeout = 60_000) {
    const orderNoEl = this.page
      .locator('.order-no')
      .filter({ hasText: /Order\s*No:\s*[A-Z0-9-]+/i })
      .last();
    await orderNoEl.waitFor({ state: 'attached', timeout });
    // Angular may keep a duplicate .order-no in DOM as hidden; text is still present.
    const text = ((await orderNoEl.textContent()) || '').trim();
    const match = text.match(/Order\s*No:\s*([A-Z0-9-]+)/i);
    const orderNo = (match ? match[1] : text.replace(/Order\s*No:\s*/i, '')).trim();
    if (!orderNo) {
      throw new Error(`Could not parse order number from: "${text}"`);
    }
    return orderNo;
  }

  async expectBookingConfirmed(timeout = 120_000) {
    await expect(this.page.getByRole('heading', { name: /Booking Confirmed|Pass Confirmed/i })).toBeVisible({
      timeout,
    });
    return this.captureOrderNumber(timeout);
  }
}

module.exports = { PaymentPage };
