const { When, Then } = require('@cucumber/cucumber');
const { PassesPage } = require('../pages/passesPage');
const { PaymentPage } = require('../pages/paymentPage');

function passes(world) {
  return new PassesPage(world.page, world.settings);
}

function payment(world) {
  return new PaymentPage(world.page, world.settings);
}

When('I click on the Passes on the top menu', async function () {
  await passes(this).navigateToPasses();
});

When('I add one pass to the shopping cart', async function () {
  // Captures product name + price and stores on world for confirmation assertion
  this.passProduct = await passes(this).addFirstPassToCart();
  this.passProducts = [this.passProduct];
});

When('I close the mini cart and add one more same pass to the shopping cart', async function () {
  const existingProducts = Array.isArray(this.passProducts)
    ? this.passProducts
    : this.passProduct
      ? [this.passProduct]
      : [];

  this.passProducts = await passes(this).closeMiniCartAndAddAnotherPass(existingProducts);
});

Then('I verify Confirmation page should be displayed with the same product and price that the customer has paid and purchased', async function () {
  const expected = this.passProducts?.length
    ? { products: this.passProducts, orderNo: this.orderNo }
    : { ...(this.passProduct || {}), orderNo: this.orderNo };

  await passes(this).verifyConfirmationDetails(expected);

  if (this.attach && Array.isArray(this.passProducts) && this.passProducts.length) {
    const lines = this.passProducts.map(
      (p, idx) => `Pass ${idx + 1}: ${p?.name ?? 'N/A'} | Price: ${p?.price ?? 'N/A'}`,
    );
    if (this.orderNo) lines.push(`Order No: ${this.orderNo}`);
    await this.attach(lines.join('\n'), 'text/plain');
  } else if (this.attach && this.passProduct) {
    await this.attach(
      `Pass: ${this.passProduct.name ?? 'N/A'} | Price: ${this.passProduct.price ?? 'N/A'}${
        this.orderNo ? ` | Order No: ${this.orderNo}` : ''
      }`,
      'text/plain',
    );
  }
});
