import { TIMEOUT } from '../data/timeouts';
import type { ScenarioData } from '../data/types';
import { AppianPage } from './AppianPage';

export class ClientDetailsPage extends AppianPage {
    async openClientTab(): Promise<void> {
        await this.openSideTab('Client');
    }

    async selectPricingType(pricingType: string): Promise<void> {
        const group = this.page.getByLabel('Pricing Type');
        const inGroup = group.getByText(pricingType, { exact: true }).first();

        if (await inGroup.isVisible().catch(() => false)) {
            await inGroup.click();
        } else {
            await this.selectRadio(pricingType);
        }
        await this.settle();
    }

    async enterFundManager(search: string, option: string): Promise<void> {
        const combo = this.page.getByRole('combobox', { name: 'Fund Manager' });
        await combo.click();
        await combo.pressSequentially(search, { delay: TIMEOUT.TYPE_DELAY });

        const suggestion = this.page.getByText(option, { exact: true }).first();
        try {
            await suggestion.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
            await suggestion.click();
        } catch {
            await combo.press('ArrowDown');
            await combo.press('Enter');
        }
        await this.settle();
    }

    async selectFund(fund: string): Promise<void> {
        const fundRowLabel = this.page
            .getByRole('row', { name: new RegExp(fund, 'i') })
            .locator('label')
            .first();

        try {
            await fundRowLabel.waitFor({
                state: 'visible',
                timeout: TIMEOUT.SHORT,
            });
            await fundRowLabel.click();
        } catch {
            const combo = this.page.getByRole('combobox', {
                name: 'Fund',
                exact: true,
            });
            if (await combo.isVisible().catch(() => false)) {
                await combo.click();
                await combo.pressSequentially(fund, {
                    delay: TIMEOUT.TYPE_DELAY,
                });
                await this.page
                    .getByText(new RegExp(fund, 'i'))
                    .first()
                    .click({ timeout: TIMEOUT.MEDIUM });
                return;
            }

            await this.page.locator('label').first().click();
        }
        await this.settle();
    }

    async selectSubAccount(subAccount: string): Promise<void> {
        const combo = this.page.getByRole('combobox', { name: /Sub Account/i });
        await combo.click();
        await combo.pressSequentially(subAccount, { delay: TIMEOUT.TYPE_DELAY });
        await this.page
            .getByText(new RegExp(subAccount, 'i'))
            .first()
            .click({ timeout: TIMEOUT.MEDIUM });
        await this.settle();
    }

    async fillFromData(data: ScenarioData): Promise<void> {
        await this.openClientTab();
        await this.selectPricingType(data.client.pricingType);
        await this.enterFundManager(
            data.client.fundManagerSearch,
            data.client.fundManagerOption
        );

        if (data.client.pricingType === 'Fund' && data.client.fund) {
            await this.selectFund(data.client.fund);
        }

        if (data.client.pricingType === 'Sub Accounts') {
            if (data.client.fund) await this.selectFund(data.client.fund);
            if (data.client.subAccount) {
                await this.selectSubAccount(data.client.subAccount);
            }
        }

        if (data.requestType === 'End Date' && data.client.fund) {
            await this.selectFund(data.client.fund);
        }
    }
}
