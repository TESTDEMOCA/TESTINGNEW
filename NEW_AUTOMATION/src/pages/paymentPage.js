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
    await expect(
      this.page
        .locator(
          '#dropin-container, .adyen-checkout__dropin--ready, iframe[title="Iframe for card number"]',
        )
        .first(),
    ).toBeVisible({ timeout });
  }

  async waitForAdyenDropIn(timeout = 120_000) {
    await expect(this.page.getByText(/[A-Z]{3}\s*[\d,.]+/).first()).toBeVisible({ timeout });

    const cards = this.page
      .getByRole('button', { name: /^Cards$/i })
      .or(this.page.getByText(/^Cards$/i));
    if (await cards.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      await cards.first().click().catch(() => {});
    }

    await expect(this.page.locator('iframe[title="Iframe for card number"]')).toBeVisible({
      timeout,
    });
  }

  async fillCardDetails(card = {}) {
    await this.expectPaymentMethodVisible();
    await this.waitForAdyenDropIn();

    const number = String(card.number || '3700 000000 00002');
    const expiry = String(card.expiry || '03/30');
    const cvc = String(card.cvc || '7373');
    const name = String(card.name || 'TEST');

    const cardNumber = this.page
      .locator('iframe[title="Iframe for card number"]')
      .contentFrame()
      .getByRole('textbox', { name: 'Card number' });
    await cardNumber.click();
    await cardNumber.fill(number);

    const expiryInput = this.page
      .locator('iframe[title="Iframe for expiry date"]')
      .contentFrame()
      .getByRole('textbox', { name: 'Expiry date' });
    await expiryInput.click();
    await expiryInput.fill(expiry);

    const security = this.page
      .locator('iframe[title="Iframe for security code"]')
      .contentFrame()
      .getByRole('textbox', { name: 'Security code' });
    await security.click();
    await security.fill(cvc);

    const nameOnCard = this.page.getByRole('textbox', { name: 'Name on card' });
    if (await nameOnCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameOnCard.fill(name);
    }
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
    await expect(this.page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
      timeout,
    });
    return this.captureOrderNumber(timeout);
  }
}

module.exports = { PaymentPage };
