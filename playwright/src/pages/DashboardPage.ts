import { expect, type Locator } from '@playwright/test';
import { constants } from '../data/constants';
import { TIMEOUT } from '../data/timeouts';
import type { World } from '../fixtures/world';

export class DashboardPage {
    private readonly createPricingConfigLink: Locator;
    private readonly requestsLink: Locator;
    private readonly activeRatesLink: Locator;

    constructor(private world: World) {
        this.createPricingConfigLink = this.page.getByRole('link', {
            name: /Create Pricing\/Config/i,
        });
        this.requestsLink = this.page.getByRole('link', { name: /^Requests$/i });
        this.activeRatesLink = this.page.getByRole('link', {
            name: /Active Rates/i,
        });
    }

    private get page() {
        return this.world.page;
    }

    async expectLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(
            new RegExp(constants.urls.dashboard),
            { timeout: TIMEOUT.LONG }
        );
        await this.page
            .getByText(/Welcome Regression User/i)
            .first()
            .waitFor({ state: 'visible', timeout: TIMEOUT.LONG })
            .catch(() => {});
    }

    async expectPrimaryNavigation(): Promise<void> {
        await expect(this.requestsLink.first()).toBeVisible({
            timeout: TIMEOUT.MEDIUM,
        });
        await expect(this.activeRatesLink.first()).toBeVisible({
            timeout: TIMEOUT.MEDIUM,
        });
        await expect(this.createPricingConfigLink.first()).toBeVisible({
            timeout: TIMEOUT.MEDIUM,
        });
    }

    async openCreatePricingConfig(): Promise<void> {
        const popupPromise = this.page.waitForEvent('popup');
        await this.createPricingConfigLink.first().click();
        this.world.formPage = await popupPromise;
        await this.world.formPage.waitForLoadState('domcontentloaded');
    }
}
