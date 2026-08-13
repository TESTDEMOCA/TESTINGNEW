const { Then } = require('@cucumber/cucumber');
const { LmsPage } = require('../pages/lmsPage');

function lms(world) {
  return new LmsPage(world.page, world.settings);
}

/**
 * Shared by all booking features (TC01–TC04, Locations):
 * change LMS outlet to captured gate (G35/G60) → search booking id → validate.
 */
Then('I should see the captured booking in LMS Bookings', async function () {
  this.settings.requireLmsCredentials();
  if (!this.orderNo) {
    throw new Error('No booking order number captured before LMS verification');
  }
  console.log(
    `[lms] Verifying booking ${this.orderNo} with captured gate: ${this.lmsGate || '(resolveGate fallback)'}`,
  );
  if (this.attach) {
    await this.attach(
      `LMS verify Order No: ${this.orderNo}; Gate: ${this.lmsGate || 'fallback'}`,
      'text/plain',
    );
  }
  const pageObj = lms(this);
  await pageObj.verifyCapturedBookingInLms(
    this.orderNo,
    this.settings.lmsUsername,
    this.settings.lmsPassword,
    this.lmsGate,
    this.destinationCode || this.destination?.code || 'HKG',
  );
  this.page = pageObj.page;
});
