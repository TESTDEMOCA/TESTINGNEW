const { When, Then } = require('@cucumber/cucumber');
const { GuestCheckoutPage } = require('../pages/guestCheckoutPage');

function checkout(world) {
  return new GuestCheckoutPage(world.page, world.settings);
}

Then('the guest checkout form should be visible', async function () {
  await checkout(this).expectFormVisible();
});

Then('the member checkout form should be visible', async function () {
  await checkout(this).expectMemberFormPrefilled();
});

When('I fill the guest checkout form with defaults', async function () {
  const data = this.testData?.guest || {};
  await checkout(this).fillGuestCheckoutForm(data);
});

When('I fill the member checkout form with country and contact number', async function () {
  const data = this.testData?.guest || {};
  await checkout(this).fillMemberCheckoutMissingFields(data);
});

When('I accept the guest checkout privacy policy and terms', async function () {
  await checkout(this).acceptCheckoutRadiosAndTerms({ expectButton: 'payment' });
});

When('I accept the checkout privacy policy and terms', async function () {
  await checkout(this).acceptCheckoutRadiosAndTerms({ expectButton: 'confirm' });
});

When('I click Confirm and Proceed', async function () {
  const pageObj = checkout(this);
  await pageObj.clickConfirmAndProceed();
  this.page = pageObj.page;
});

When('I click Payment', async function () {
  const pageObj = checkout(this);
  await pageObj.clickPaymentAndKeepSession();
  this.page = pageObj.page;
});
