const { When, Then } = require('@cucumber/cucumber');
const { BookNowPage } = require('../pages/bookNowPage');
const { GuestCheckoutPage } = require('../pages/guestCheckoutPage');
const { LoungeBookingPage } = require('../pages/loungeBookingPage');
const { PaymentPage } = require('../pages/paymentPage');
const { captureAndSetLmsGate } = require('../support/lmsGate');

function bookNow(world) {
  return new BookNowPage(world.page, world.settings);
}

function booking(world) {
  return new LoungeBookingPage(world.page, world.settings);
}

function checkout(world) {
  return new GuestCheckoutPage(world.page, world.settings);
}

function payment(world) {
  return new PaymentPage(world.page, world.settings);
}

When('I search Book Now for Hong Kong International with defaults', async function () {
  const pageObj = bookNow(this);
  await pageObj.searchHongKongInternational({ time: '1000' });
  await captureAndSetLmsGate(this, pageObj, 'Book Now search defaults');
});

When('I search Book Now for Hong Kong International until Book Now is available', async function () {
  const pageObj = bookNow(this);
  await pageObj.searchHongKongUntilBookNowAvailable();
  await captureAndSetLmsGate(this, pageObj, 'Book Now search until available');
});

When('I click Book Now arrow on the Book Now widget', async function () {
  const pageObj = bookNow(this);
  await captureAndSetLmsGate(this, pageObj, 'Book Now widget before arrow');
  await pageObj.clickBookNowArrow();
  await captureAndSetLmsGate(this, pageObj, 'Book Now cart after arrow');
});

When('I click More at HKG', async function () {
  await bookNow(this).clickMoreAtHkg();
});

When('I click Book Now on the search result lounge', async function () {
  const pageObj = bookNow(this);
  await pageObj.clickSearchResultBookNow();
  await captureAndSetLmsGate(this, pageObj, 'Book Now search result lounge');
});

When('I open lounge View option {int}', async function (nth) {
  const pageObj = bookNow(this);
  await pageObj.openLoungeView(nth);
  await captureAndSetLmsGate(this, pageObj, `lounge View option ${nth}`);
});

When('I select lounge duration PRD3352 and get price', async function () {
  const pageObj = booking(this);
  await captureAndSetLmsGate(this, pageObj, 'before PRD3352 get price');
  await pageObj.selectLosAndGetPrice('PRD3352');
});

When('I click Get Price leaving Services defaults', async function () {
  const pageObj = booking(this);
  await captureAndSetLmsGate(this, pageObj, 'before Get Price defaults');
  await pageObj.clickGetPriceLeavingDefaults();
});

When('I add Shower 30 mins addon on the cart', async function () {
  await booking(this).addShowerThirtyMinsAddon();
});

When('I select shower service and get price', async function () {
  await booking(this).selectShowerServiceAndGetPrice();
});

When('I click Check Out on Book Now flow', async function () {
  const pageObj = bookNow(this);
  await captureAndSetLmsGate(this, pageObj, 'Book Now cart before Check Out');
  await pageObj.clickCheckOut();
});

When('I complete guest checkout for TC01', async function () {
  const data = {
    title: 'Mr.',
    firstName: 'TEST',
    lastName: 'DEMO',
    country: '102',
    phone: '8899003322',
    email: 'test@www.com',
  };
  await checkout(this).fillGuestCheckoutForm(data);
  await checkout(this).acceptCheckoutRadiosAndTerms({
    expectButton: 'payment',
    clickLabels: true,
  });
});

When('I complete guest checkout for TC03', async function () {
  const data = {
    title: 'Mr.',
    firstName: 'TEST',
    lastName: 'DUMMY',
    country: '102',
    phone: '8899007766',
    email: 'testd@www.com',
  };
  await checkout(this).fillGuestCheckoutForm(data);
  await checkout(this).acceptCheckoutRadiosAndTerms({
    expectButton: 'payment',
    clickLabels: true,
  });
});

When('I complete guest checkout for TC04', async function () {
  const data = {
    title: 'Mr.',
    firstName: 'TEST',
    lastName: 'SHOWER',
    country: '102',
    phone: '8877445566',
    email: 'shower@www.com',
  };
  await checkout(this).fillGuestCheckoutForm(data);
  await checkout(this).acceptCheckoutRadiosAndTerms({
    expectButton: 'payment',
    clickLabels: true,
  });
});

When('I log in from guest checkout with configured credentials', async function () {
  this.settings.requireCredentials();
  await checkout(this).loginFromCheckout(this.settings.appUsername, this.settings.appPassword);
});

When('I complete member checkout for TC02', async function () {
  const data = {
    country: '102',
    phone: '9900887766',
  };
  await checkout(this).fillMemberCheckoutMissingFields(data);
  await checkout(this).acceptCheckoutRadiosAndTerms({
    expectButton: 'confirm',
    clickLabels: true,
  });
});

When('I click Payment for Book Now guest flow', async function () {
  const pageObj = checkout(this);
  await pageObj.clickPaymentAndKeepSession();
  this.page = pageObj.page;
});

When('I click Confirm and Proceed for Book Now member flow', async function () {
  const pageObj = checkout(this);
  await pageObj.clickConfirmAndProceed();
  this.page = pageObj.page;
});

Then('I should reach payment and confirm booking for Book Now flow', async function () {
  const pay = payment(this);
  await pay.expectPaymentMethodVisible();
  await pay.fillCardDetails({
    number: '3700 000000 00002',
    expiry: '03/30',
    cvc: '7373',
    name: 'TEST',
  });
  await pay.clickConfirmAndPay();
  this.orderNo = await pay.expectBookingConfirmed();
  if (!this.orderNo) {
    throw new Error('Booking order number was not captured');
  }
  console.log(`[booking] Order No: ${this.orderNo}`);
  console.log(`[gate] LMS gate for booking ${this.orderNo}: ${this.lmsGate || '(fallback via resolveGate)'}`);
  if (this.attach) await this.attach(`Order No: ${this.orderNo}`, 'text/plain');
});
