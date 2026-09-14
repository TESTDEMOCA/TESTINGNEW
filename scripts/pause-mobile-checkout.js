#!/usr/bin/env node
/**
 * Drive mobile TC01 up to the failing Check Out step, then pause
 * so the locator can be picked in Playwright Inspector.
 */
process.env.DEVICE = 'mobile';
process.env.HEADLESS = 'false';

const { chromium } = require('playwright');
const { loadSettings } = require('../src/config/settings');
const { LoginPage } = require('../src/pages/loginPage');
const { HomePage } = require('../src/pages/homePage');
const { BookNowPage } = require('../src/pages/bookNowPage');
const { installSalesManagoAutoClose } = require('../src/support/salesManago');

(async () => {
  const settings = loadSettings();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ...settings.contextOptions(),
    httpCredentials: {
      username: process.env.PPL_BASIC_USER || '',
      password: process.env.PPL_BASIC_PASSWORD || '',
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  await installSalesManagoAutoClose(page);

  const login = new LoginPage(page, settings);
  const home = new HomePage(page, settings);
  const bookNow = new BookNowPage(page, settings);

  console.log('[pause] Home page (mobile 390x844)');
  await login.open();
  console.log('[pause] Currency HKD');
  await home.selectCurrency('HKD');
  bookNow.selectedCurrency = 'HKD';
  console.log('[pause] Search HKG until Book Now');
  await bookNow.searchUntilBookNowAvailable('HKG');
  console.log('[pause] Book Now arrow (View → Get Price → Reserve Now)');
  await bookNow.clickBookNowArrow();

  console.log('');
  console.log('============================================================');
  console.log('STOPPED at the failing step: Check Out on Book Now flow');
  console.log('In Playwright Inspector: Pick locator → click Check Out');
  console.log('Paste the locator here when you have it.');
  console.log('============================================================');
  console.log('');

  await page.pause();
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
