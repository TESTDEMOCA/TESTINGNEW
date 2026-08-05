const { Given, When, Then } = require('@cucumber/cucumber');
const { LoginPage } = require('../pages/loginPage');

function login(world) {
  return new LoginPage(world.page, world.settings);
}

Given('the application home page is open', async function () {
  await login(this).open();
});

Given('the application login page is open', async function () {
  await login(this).open();
});

When('I open the login modal', async function () {
  await login(this).openLoginModal();
});

When('I sign in with configured credentials', async function () {
  this.settings.requireCredentials();
  await login(this).submitLogin(this.settings.appUsername, this.settings.appPassword);
});

When('I sign in with email {string} and password {string}', async function (email, password) {
  await login(this).submitLogin(email, password);
});

Then('I should leave the login screen', async function () {
  await login(this).expectLoggedIn();
});

Then('I should be logged in', async function () {
  await login(this).expectLoggedIn();
});
