const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class LocationsPage extends BasePage {
  static MOBILE_NAV_TOGGLE = '#wsnavtoggle';

  isMobile() {
    return Boolean(this.settings?.device?.isMobile || this.settings?.deviceName === 'mobile');
  }

  async acceptTrackingConsentIfPresent() {
    const agree = this.page
      .locator('#tracking-consent-submit')
      .or(this.page.getByRole('button', { name: 'I agree' }))
      .first();
    if (await agree.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await agree.click();
    }
  }

  async openHome() {
    await this.gotoPath('/');
    await this.acceptTrackingConsentIfPresent();
    if (this.isMobile()) {
      await expect(this.page.locator(LocationsPage.MOBILE_NAV_TOGGLE)).toBeVisible({
        timeout: 60_000,
      });
    } else {
      await expect(this.page.getByRole('link', { name: 'Locations' })).toBeVisible({
        timeout: 60_000,
      });
    }
  }

  async openLocationsMenu() {
    if (this.isMobile()) {
      await this.openLocationsMenuMobile();
      return;
    }
    await this.openLocationsMenuDesktop();
  }

  async openLocationsMenuDesktop() {
    await this.page.getByRole('link', { name: 'Locations' }).click();
  }

  async openLocationsMenuMobile() {
    // codegen: #wsnavtoggle -> Locations
    await this.page.locator(LocationsPage.MOBILE_NAV_TOGGLE).click();
    await this.page.getByRole('link', { name: /Locations/i }).click();
    await expect(
      this.page.getByRole('button', { name: /Chinese Mainland, Hong Kong/i }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async selectCountryTabHongKongSar() {
    if (this.isMobile()) {
      await this.selectCountryTabHongKongSarMobile();
      return;
    }
    await this.selectCountryTabHongKongSarDesktop();
  }

  async selectCountryTabHongKongSarDesktop() {
    await this.page.getByRole('tab', { name: 'Chinese Mainland, Hong Kong,' }).click();
    await this.page.getByRole('tab', { name: 'Hong Kong SAR' }).click();
  }

  async selectCountryTabHongKongSarMobile() {
    // codegen: button Chinese Mainland..., button Hong Kong SAR
    await this.page.getByRole('button', { name: /Chinese Mainland, Hong Kong/i }).click();
    await this.page.getByRole('button', { name: /Hong Kong SAR/i }).click();
    await expect(this.page.getByRole('link', { name: 'Hong Kong (HKG)' })).toBeVisible({
      timeout: 15_000,
    });
  }

  async selectCityHongKong() {
    if (this.isMobile()) {
      await this.selectCityHongKongMobile();
      return;
    }
    await this.selectCityHongKongDesktop();
  }

  async selectCityHongKongDesktop() {
    await this.waitBeforeTransition();
    await this.page.getByRole('link', { name: 'Hong Kong (HKG)' }).click();
    await expect(this.page).toHaveURL(/\/find\/.*hong-kong/i, { timeout: 60_000 });
  }

  async selectCityHongKongMobile() {
    await this.waitBeforeTransition();
    await this.page.getByRole('link', { name: 'Hong Kong (HKG)' }).click();
    await expect(this.page).toHaveURL(/\/find\/.*hong-kong/i, { timeout: 60_000 });
  }

  async navigateToHongKongHkg() {
    await this.openLocationsMenu();
    await this.selectCountryTabHongKongSar();
    await this.selectCityHongKong();
  }

  async expectHongKongKowloonLoungeTitle(timeout = 60_000) {
    await expect(this.page.getByText(/Near Gate 60,\s*Departures/i).first()).toBeVisible({
      timeout,
    });
  }

  async openPlazaPremiumLoungeDeparturesNearGateSixty() {
    await this.expectHongKongKowloonLoungeTitle();

    await this.page.getByText(/Near Gate 60,\s*Departures/i).first().click();
    await this.waitBeforeTransition();
    await this.page.getByRole('link', { name: 'View' }).nth(5).click();

    // mobile codegen: I agree (consent), then Book Your Visit
    const iAgree = this.page.getByRole('button', { name: 'I agree' });
    if (await iAgree.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await iAgree.click();
    }

    if (this.isMobile()) {
      const loungeTab = this.page.locator('#collapseThree').getByText('Lounge', { exact: true });
      if (await loungeTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await loungeTab.click().catch(() => {});
      }

      // <a class="btn btn-primary bookingBtn mobile" data-bs-target="#mobileVisit">Book Your Visit</a>
      const { LoungeBookingPage } = require('./loungeBookingPage');
      const lounge = new LoungeBookingPage(this.page, this.settings);
      await lounge.openMobileBookYourVisitModal();
    }

    await this.expectBookYourVisitHeader(60_000);
  }

  async expectBookYourVisitHeader(timeout = 60_000) {
    if (this.isMobile()) {
      await expect(
        this.page
          .locator('#mobileVisit.show, #mobileVisit')
          .filter({ has: this.page.getByRole('button', { name: /Get Price/i }) })
          .or(this.page.locator('#mobileVisit .getPrice-btn, #mobileVisit button:has-text("Get Price")'))
          .or(this.page.getByRole('button', { name: /Get Price/i }))
          .first(),
      ).toBeVisible({ timeout });
      return;
    }
    await expect(this.page.getByRole('heading', { name: 'Book your visit' })).toBeVisible({
      timeout,
    });
  }
}

module.exports = { LocationsPage };
