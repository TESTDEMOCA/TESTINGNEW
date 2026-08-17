const { When, Then } = require('@cucumber/cucumber');
const { LoginPage } = require('../pages/loginPage');
const { SignupPage } = require('../pages/signupPage');
const { YopmailPage } = require('../pages/yopmailPage');

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
  this.yopmailPage = await this.context.newPage();
  this.yopmailPage.setDefaultTimeout(90_000);
  this.yopmailPage.setDefaultNavigationTimeout(90_000);
  const yop = new YopmailPage(this.yopmailPage);
  const { email, mailbox } = await yop.openGeneratedInbox();
  this.signupEmail = email;
  this.signupMailbox = mailbox;
  this.signupPassword = DEFAULT_SIGNUP_PASSWORD;
  console.log(`[tc08] Generated Yopmail: ${email}`);
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

  // Keep focus on the PPL signup tab
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

  // Keep focus on the PPL signup tab
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
  if (!this.yopmailPage) {
    throw new Error('Yopmail page was not opened. Run the generate-email step first.');
  }
  await this.yopmailPage.bringToFront();
  const yop = new YopmailPage(this.yopmailPage);
  await yop.openActivationLinkAndConfirm(this.context);
  await this.page.bringToFront();
});

When('I redirect to Yopmail and refresh the inbox', async function () {
  if (!this.yopmailPage) {
    throw new Error('Yopmail page was not opened. Run the generate-email step first.');
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
      throw new Error('Yopmail page was not opened. Run the generate-email step first.');
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

When('I log in with the newly registered credentials', async function () {
  if (!this.signupEmail || !this.signupPassword) {
    throw new Error('Missing newly registered credentials on the world.');
  }
  await this.page.bringToFront();
  await login(this).submitLogin(this.signupEmail, this.signupPassword);
});
