const { When, Then } = require('@cucumber/cucumber');
const { LoginPage } = require('../pages/loginPage');
const { SignupPage } = require('../pages/signupPage');
const { YopmailPage } = require('../pages/yopmailPage');
const { PassesPage } = require('../pages/passesPage');
const { openYopmailSession } = require('../support/yopmailSession');

const DEFAULT_SIGNUP_PASSWORD = 'Test@1234';

function signup(world) {
  return new SignupPage(world.page, world.settings);
}

function login(world) {
  return new LoginPage(world.page, world.settings);
}

When('I start sign up from the login modal', async function () {
  await signup(this).startSignUpFromLoginModal();
});

When('I start sign up from the login modal after selecting a product', async function () {
  await signup(this).startSignUpFromLoginModal_afterSelectingProduct();
});

When('I generate a temporary email via Yopmail', async function () {
  // Separate browser (not a tab) so Yopmail steps are captured in their own video.
  await openYopmailSession(this);
  const yop = new YopmailPage(this.yopmailPage);
  const { email, mailbox } = await yop.openGeneratedInbox();
  this.signupEmail = email;
  this.signupMailbox = mailbox;
  this.signupPassword = DEFAULT_SIGNUP_PASSWORD;
  console.log(`[yopmail] Generated mailbox in separate browser: ${email}`);
  // Return focus to the app browser for signup / checkout steps.
  await this.page.bringToFront().catch(() => {});
});

When('I complete new account registration with the generated Email after product selection', async function () {
  if (!this.signupEmail || !this.signupPassword) {
    throw new Error('Generate a temporary Yopmail address before completing registration.');
  }

  const data = this.testData || {};
  // Names must be letters only (site validation rejects digits).
  const suffix = String(data.token || 'USER')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 6)
    .padEnd(4, 'X');
  const firstName = `Test${suffix}`;
  const lastName = `Dummy${suffix.slice(0, 4)}`;
  const phone = data.phone || data.guest?.phone || '7894563210';

  // Keep focus on the PPL app browser
  await this.page.bringToFront();
  await signup(this).fillRegistrationForm({
    title: 'Mr.',
    firstName,
    lastName,
    country: '102',
    phone,
    email: this.signupEmail,
    password: this.signupPassword,
  });
  await signup(this).submitCreateAccount_afterproductSelection();
  //await signup(this).backToHomeFromThankYou();
});

When('I complete new account registration with that email', async function () {
  if (!this.signupEmail || !this.signupPassword) {
    throw new Error('Generate a temporary Yopmail address before completing registration.');
  }

  const data = this.testData || {};
  // Names must be letters only (site validation rejects digits).
  const suffix = String(data.token || 'USER')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 6)
    .padEnd(4, 'X');
  const firstName = `Test${suffix}`;
  const lastName = `Dummy${suffix.slice(0, 4)}`;
  const phone = data.phone || data.guest?.phone || '7894563210';

  // Keep focus on the PPL app browser
  await this.page.bringToFront();
  await signup(this).fillRegistrationForm({
    title: 'Mr.',
    firstName,
    lastName,
    country: '102',
    phone,
    email: this.signupEmail,
    password: this.signupPassword,
  });
  await signup(this).submitCreateAccount();
  await signup(this).backToHomeFromThankYou();
});

When('I verify the account from the Yopmail activation email', async function () {
  if (!this.yopmailPage || !this.yopmailContext) {
    throw new Error('Yopmail browser was not opened. Run the generate-email step first.');
  }
  await this.yopmailPage.bringToFront();
  const yop = new YopmailPage(this.yopmailPage);
  await yop.openActivationLinkAndConfirm(this.yopmailContext);
  await this.page.bringToFront();

  // After activation, return to site home so Passes navigation is available.
  const backHome = this.page.getByRole('link', { name: /Back to Home/i }).first();
  if (await backHome.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await backHome.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
  }
});

When('I redirect to Yopmail and refresh the inbox', async function () {
  if (!this.yopmailPage) {
    throw new Error('Yopmail browser was not opened. Run the generate-email step first.');
  }
  if (!this.signupMailbox) {
    throw new Error('Yopmail mailbox is missing on the world. Run the generate-email step first.');
  }

  await this.yopmailPage.bringToFront();
  const yop = new YopmailPage(this.yopmailPage);
  await yop.openInboxForMailbox(this.signupMailbox);
  await yop.refreshInbox();
  console.log(`[yopmail] Opened and refreshed inbox for ${this.signupEmail || this.signupMailbox}`);
});

Then(
  'I should receive a Plaza Premium Lounge Booking Confirmation email in Yopmail with the captured booking id',
  async function () {
    if (!this.yopmailPage) {
      throw new Error('Yopmail browser was not opened. Run the generate-email step first.');
    }
    if (!this.signupMailbox) {
      throw new Error('Yopmail mailbox is missing on the world. Run the generate-email step first.');
    }
    if (!this.orderNo) {
      throw new Error('No booking order number captured from the confirmation page.');
    }

    await this.yopmailPage.bringToFront();
    const yop = new YopmailPage(this.yopmailPage);
    await yop.expectBookingConfirmationEmail(this.signupMailbox, this.orderNo);
    if (this.attach) {
      await this.attach(
        `Yopmail booking confirmation validated\nFrom: PPL UAT <uat.ibe@plazapremiumgroup.com>\nSubject contains: Plaza Premium Lounge Booking Confirmation ${this.orderNo}`,
        'text/plain',
      );
    }
  },
);

Then(
  'I should receive an Unlock Your PPL Pass email in Yopmail with the captured booking id',
  async function () {
    if (!this.yopmailPage) {
      throw new Error('Yopmail browser was not opened. Run the generate-email step first.');
    }
    if (!this.signupMailbox) {
      throw new Error('Yopmail mailbox is missing on the world. Run the generate-email step first.');
    }
    if (!this.orderNo) {
      throw new Error('No booking order number captured from the confirmation page.');
    }

    await this.yopmailPage.bringToFront();
    const yop = new YopmailPage(this.yopmailPage);
    await yop.expectUnlockYourPplPassEmail(this.signupMailbox, this.orderNo);
    if (this.attach) {
      await this.attach(
        `Yopmail Unlock Your PPL Pass validated\nFrom: PPL Pass IBE UAT\nSubject: Unlock Your PPL Pass\nOrder ID: ${this.orderNo}`,
        'text/plain',
      );
    }
  },
);

When('I log in with the newly registered credentials', async function () {
  if (!this.signupEmail || !this.signupPassword) {
    throw new Error('Missing newly registered credentials on the world.');
  }
  await this.page.bringToFront();
  await login(this).submitLogin(this.signupEmail, this.signupPassword);

  // TC03 Smart Traveller: exclusive → login should land with mini-cart Check Out ready.
  if (this.passProduct || this.passProducts?.length) {
    const passesPage = new PassesPage(this.page, this.settings);
    await passesPage.ensureCheckOutAfterExclusiveLogin();
  }
});
