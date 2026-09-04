const { When } = require('@cucumber/cucumber');
const { fetchAmsOrderSummary } = require('../support/amsOrder');

When(
  'I fetch the AMS order summary for the captured booking id',
  { timeout: 60_000 },
  async function () {
    if (this.paymentDnsHandoff || this.orderNo === 'DNS-HANDOFF') {
      console.log('[ams] Soft-pass AMS summary — payment handoff only');
      return;
    }
    if (!this.orderNo) {
      throw new Error('Capture the booking order number before the AMS order summary step');
    }

    const firstName = String(this.guestFirstName || 'test').trim().toLowerCase() || 'test';
    const result = await fetchAmsOrderSummary({
      orderNo: this.orderNo,
      firstName,
      clientKey: this.settings.amsClientKey,
      baseUrl: this.settings.amsBaseUrl,
    });

    this.amsOrderId = result.amsOrderId;
    this.amsOrderNumber = result.amsOrderNumber;
    this.amsPropertyName = result.orderItem?.propertyName || '';
    this.amsPropertyCode = result.orderItem?.propertyCode || '';
    console.log(
      `[ams] orderId=${this.amsOrderId} numeric=${this.amsOrderNumber} (from booking ${this.orderNo})` +
        (this.amsPropertyName ? ` property="${this.amsPropertyName.trim()}"` : ''),
    );
    if (this.attach) {
      await this.attach(
        `AMS orderId: ${this.amsOrderId}\nAMS numeric code: ${this.amsOrderNumber}`,
        'text/plain',
      );
    }
  },
);
