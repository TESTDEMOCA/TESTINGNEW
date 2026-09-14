const { When, Then } = require('@cucumber/cucumber');
const { LocationsPage } = require('../pages/locationsPage');
const { setLmsGate, captureAndSetLmsGate } = require('../support/lmsGate');

function locations(world) {
  return new LocationsPage(world.page, world.settings);
}

When('I open the Locations menu', async function () {
  await locations(this).openLocationsMenu();
});

When('I select the Hong Kong SAR country tab', async function () {
  await locations(this).selectCountryTabHongKongSar();
});

When('I select the Hong Kong HKG city', async function () {
  await locations(this).selectCityHongKong();
});

When('I navigate to Hong Kong HKG via Locations menu', async function () {
  await locations(this).navigateToHongKongHkg();
});

When('I open Plaza Premium Lounge departures near gate sixty', async function () {
  await locations(this).openPlazaPremiumLoungeDeparturesNearGateSixty();
  setLmsGate(this, '60', 'Locations Near Gate 60 flow');
});

Then('I should see the Book your visit header', async function () {
  const pageObj = locations(this);
  await pageObj.expectBookYourVisitHeader();
  await captureAndSetLmsGate(this, pageObj, 'Book your visit header');
});

Then('I should see the Hong Kong Kowloon High Speed Rail Terminal title', async function () {
  await locations(this).expectHongKongKowloonLoungeTitle();
});

Then('I should be on the Hong Kong find page', async function () {
  await locations(this).expectHongKongKowloonLoungeTitle();
});
