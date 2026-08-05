const { When, Then } = require('@cucumber/cucumber');
const { LoungeBookingPage } = require('../pages/loungeBookingPage');

function booking(world) {
  return new LoungeBookingPage(world.page, world.settings);
}

Then('the lounge booking form should be visible', async function () {
  await booking(this).expectFormVisible();
});

When('I fill the lounge booking form with defaults', async function () {
  const data = this.testData?.booking || {};
  await booking(this).fillBookingForm(data);
});

When('I click Get Price on the lounge booking form', async function () {
  await booking(this).clickGetPrice();
});

When('I click Reserve Now on the lounge booking form', async function () {
  await booking(this).clickReserveNow();
});

When('I click Check Out', async function () {
  await booking(this).clickCheckOut();
});
