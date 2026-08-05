const { Then, When } = require('@cucumber/cucumber');
const { HomePage } = require('../pages/homePage');

function home(world) {
  return new HomePage(world.page, world.settings);
}

Then('the home page should be visible', async function () {
  await home(this).expectLoaded();
});

Then('the lounge search widget should be visible', async function () {
  await home(this).expectSearchWidgetVisible();
});

When('I navigate to the {string} menu', async function (menuLabel) {
  await home(this).navigateToMenu(menuLabel);
});

When('I search for lounges in {string}', async function (location) {
  await home(this).searchLounges({ location });
});
