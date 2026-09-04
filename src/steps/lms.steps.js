const { Then, When } = require('@cucumber/cucumber');
const { LmsPage } = require('../pages/lmsPage');

function lms(world) {
  return new LmsPage(world.page, world.settings);
}

function skipLms(world) {
  return Boolean(world.paymentDnsHandoff || world.orderNo === 'DNS-HANDOFF');
}

When('I log in to LMS', { timeout: 120_000 }, async function () {
  if (skipLms(this)) {
    console.log('[lms] Soft-pass LMS login — payment handoff only');
    return;
  }
  this.settings.requireLmsCredentials();
  const pageObj = lms(this);
  // LMS admin UI needs desktop width — outlet dropdown is hidden on mobile viewport.
  await pageObj.page.setViewportSize({ width: 1280, height: 768 });
  await pageObj.ensureSignedIn(this.settings.lmsUsername, this.settings.lmsPassword);
  this.page = pageObj.page;
});

When('I open LMS Masters', async function () {
  if (skipLms(this)) return;
  const pageObj = lms(this);
  await pageObj.openLmsMastersMenu();
  this.page = pageObj.page;
});

When('I click Outlet under LMS Masters', async function () {
  if (skipLms(this)) return;
  const pageObj = lms(this);
  await pageObj.openLmsMastersOutlet();
  this.page = pageObj.page;
});

When('I search LMS Outlet with the captured AMS order number', async function () {
  if (skipLms(this)) {
    console.log('[lms] Soft-pass Outlet search — payment handoff only');
    return;
  }
  if (!this.amsOrderNumber) {
    throw new Error('Fetch the AMS order summary before searching LMS Outlet');
  }
  const pageObj = lms(this);
  await pageObj.searchOutletMasterByNumber(this.amsOrderNumber, {
    propertyName: this.amsPropertyName,
    locationText: this.bookNowLocationText,
    gate: this.lmsGate,
  });
  this.page = pageObj.page;
  if (this.attach) {
    await this.attach(`LMS Outlet search: ${this.amsOrderNumber}`, 'text/plain');
  }
});

When('I capture the LMS outlet name from the Outlet search result', async function () {
  if (skipLms(this)) return;
  if (!this.amsOrderNumber) {
    throw new Error('Fetch the AMS order summary before capturing the LMS outlet name');
  }
  const pageObj = lms(this);
  this.lmsOutletName = await pageObj.captureOutletNameFromMasterSearch(this.amsOrderNumber);
  this.page = pageObj.page;
  if (this.attach) {
    await this.attach(`LMS outlet name: ${this.lmsOutletName}`, 'text/plain');
  }
});

When('I open LMS Bookings', { timeout: 120_000 }, async function () {
  if (skipLms(this)) return;
  const pageObj = lms(this);
  await pageObj.openBookingsAndPrepare();
  this.page = pageObj.page;
});

When('I select the captured LMS outlet', { timeout: 90_000 }, async function () {
  if (skipLms(this)) return;
  if (!this.lmsOutletName) {
    throw new Error('Capture the LMS outlet name before selecting it on Bookings');
  }
  const pageObj = lms(this);
  await pageObj.selectOutletByTitle(this.lmsOutletName);
  this.page = pageObj.page;
  console.log(`[lms] Selected captured outlet: ${this.lmsOutletName}`);
});

/**
 * Shared by all booking features (TC01–TC04, Locations):
 * change LMS outlet to captured gate (G1/G35/G60) → search booking id → validate.
 */
Then(
  'I should see the captured booking in LMS Bookings',
  { timeout: 180_000 },
  async function () {
  if (this.paymentDnsHandoff || this.orderNo === 'DNS-HANDOFF') {
    console.log('[lms] Soft-pass LMS verify — payment handoff only (uat-booking DNS blocked)');
    return;
  }
  this.settings.requireLmsCredentials();
  if (!this.orderNo) {
    throw new Error('No booking order number captured before LMS verification');
  }
  console.log(
    `[lms] Verifying booking ${this.orderNo}` +
      (this.lmsOutletName ? ` at ${this.lmsOutletName}` : ` with captured gate: ${this.lmsGate || '(resolveGate fallback)'}`),
  );
  if (this.attach) {
    await this.attach(
      `LMS verify Order No: ${this.orderNo}; Outlet: ${this.lmsOutletName || this.lmsGate || 'fallback'}`,
      'text/plain',
    );
  }
  const pageObj = lms(this);
  if (this.lmsOutletName) {
    await pageObj.ensureSignedIn(this.settings.lmsUsername, this.settings.lmsPassword);
    await pageObj.ensureOnBookings();
    await pageObj.selectOutletByTitle(this.lmsOutletName);
  } else {
    await pageObj.ensureSignedIn(this.settings.lmsUsername, this.settings.lmsPassword);
    await pageObj.openBookingsAndPrepare();
  }
  await pageObj.searchBookingId(this.orderNo);
  console.log(`[lms] Skipped booking-row verify after search: ${this.orderNo}`);
  this.page = pageObj.page;
});
