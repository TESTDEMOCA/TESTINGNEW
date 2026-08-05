const { Then } = require('@cucumber/cucumber');
const { LmsPage } = require('../pages/lmsPage');

function lms(world) {
  return new LmsPage(world.page, world.settings);
}

Then('I should see the captured booking in LMS Bookings', async function () {
  this.settings.requireLmsCredentials();
  const pageObj = lms(this);
  await pageObj.verifyCapturedBookingInLms(
    this.orderNo,
    this.settings.lmsUsername,
    this.settings.lmsPassword,
  );
  this.page = pageObj.page;
});
