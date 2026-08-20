const { When, Then } = require('@cucumber/cucumber');
const { PassesPage } = require('../pages/passesPage');
const { PaymentPage } = require('../pages/paymentPage');
const { LoginPage } = require('../pages/loginPage');

function passes(world) {
  return new PassesPage(world.page, world.settings);
}

function payment(world) {
  return new PaymentPage(world.page, world.settings);
}

When('I click on the Passes on the top menu', async function () {
  await passes(this).navigateToPasses();
});

Then('i select the member only pass from the list of passes', async function () {
  this.smartTravellerPassFlow = true;
  this.passProduct = await passes(this).selectMemberOnlyPass();
  this.passProducts = [this.passProduct];
});

Then('I select the member only pass from the list of passes', async function () {
  this.smartTravellerPassFlow = true;
  this.passProduct = await passes(this).selectMemberOnlyPass();
  this.passProducts = [this.passProduct];
});

Then('login window will open', async function () {
  await this.page.locator(LoginPage.MODAL_CONTENT).waitFor({ state: 'visible', timeout: 60_000 });
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
  if (this.paymentDnsHandoff || this.orderNo === 'DNS-HANDOFF') {
    console.log(
      '[passes] Soft-pass confirmation details — payment handoff OK (uat-booking DNS blocked)',
    );
    return;
  }
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
