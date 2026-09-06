const { When, Then } = require('@cucumber/cucumber');
const { LoungeBookingPage } = require('../pages/loungeBookingPage');
const { captureAndSetLmsGate } = require('../support/lmsGate');

function booking(world) {
  return new LoungeBookingPage(world.page, world.settings);
}

Then('the lounge booking form should be visible', async function () {
  const pageObj = booking(this);
  await pageObj.expectFormVisible();
  await captureAndSetLmsGate(this, pageObj, 'lounge booking form');
});

When('I fill the lounge booking form with defaults', async function () {
  const data = this.testData?.booking || {};
  await booking(this).fillBookingForm(data);
});

When('I click Get Price on the lounge booking form', async function () {
  await booking(this).clickGetPrice();
});

When('I click Reserve Now on the lounge booking form', async function () {
  const pageObj = booking(this);
  await captureAndSetLmsGate(this, pageObj, 'before Reserve Now');
  await pageObj.clickReserveNow();
});

When('I click Check Out', async function () {
  const pageObj = booking(this);
  if (this.selectedCurrency) {
    await pageObj.assertMiniCartCurrency(this.selectedCurrency);
  }
  await captureAndSetLmsGate(this, pageObj, 'cart before Check Out');
  await pageObj.clickCheckOut();
});
