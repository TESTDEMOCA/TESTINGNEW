import type { Locator } from '@playwright/test';
import { TIMEOUT } from '../data/timeouts';
import type { ConfigurationRates, ScenarioData } from '../data/types';
import { AppianPage } from './AppianPage';

const PLACEHOLDER = '--- Select a value ---';

export class ConfigurationPage extends AppianPage {
    async openTab(name: string): Promise<void> {
        await this.openSideTab(name);
    }

    async getRateData(): Promise<void> {
        const getRate = this.page
            .getByRole('link', { name: /Get Rate Data/i })
            .filter({ visible: true })
            .first();

        try {
            await getRate.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
            await getRate.click();
        } catch {
            const refresh = this.page
                .getByTestId('SitesApp-scrollTopContainer')
                .getByRole('link')
                .filter({ hasText: /^$/ })
                .first();
            await refresh.click();
        }
        await this.page.waitForTimeout(800);
    }

    async setDefaultBenchmarkSpread(value: string): Promise<void> {
        const rate = this.page
            .getByRole('row', { name: /Default Benchmark Spread \(bps\)/i })
            .getByPlaceholder('###')
            .filter({ visible: true })
            .first();

        await rate.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

        for (let attempt = 1; attempt <= 2; attempt++) {
            await rate.click();
            await rate.fill(value);
            await this.blurCommit();
            const actual = await rate.inputValue().catch(() => '');
            if (actual === value) return;
            await this.page.waitForTimeout(800);
        }

        throw new Error(
            `Default Benchmark Spread did not stick (expected "${value}")`
        );
    }

    async fillAbfHierarchy(rates: NonNullable<ConfigurationRates['abf']>): Promise<void> {
        for (const rowData of rates.rows) {
            const row = this.page
                .getByRole('row', { name: new RegExp(rowData.name, 'i') })
                .first();

            await this.pickFromRowListbox(row, 'USD Benchmark', rates.usdBenchmark);
            await this.fillRowInput(row, 'USD Spread (bps)', rowData.usdSpread);
            await this.pickFromRowListbox(row, 'USD Flooring', rates.usdFlooring);
            await this.pickFromRowListbox(
                row,
                'Non USD Benchmark',
                rates.nonUsdBenchmark
            );
            await this.fillRowInput(row, 'Non USD Spread (bps)', rowData.nonUsdSpread);
            await this.pickFromRowListbox(
                row,
                'Non USD Flooring',
                rates.nonUsdFlooring
            );
        }
    }

    async setAmericasDmGcRate(value: string): Promise<void> {
        const rate = this.page
            .getByRole('row', { name: /Americas - DM GC Rate \(bps\)/i })
            .getByPlaceholder('###');
        await rate.click();
        await rate.fill(value);
    }

    async pickFirstAvailableDate(): Promise<void> {
        await this.pickFirstCalendarDay();
    }

    async selectDefaultSchedule(value: string): Promise<void> {
        const placeholder = this.page
            .getByText(PLACEHOLDER)
            .filter({ visible: true })
            .first();
        await placeholder.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await placeholder.click();

        const option = this.page
            .getByRole('option', { name: value })
            .filter({ visible: true })
            .first();

        try {
            await option.waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
            await option.click();
        } catch {
            await this.page
                .getByText(value, { exact: true })
                .filter({ visible: true })
                .last()
                .click();
        }
    }

    async apply(): Promise<void> {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.clickNamedButton(/^Apply$/i);
        await this.settle();
    }

    async getAccountSetupData(useDefault = false): Promise<void> {
        await this.openTab('Account Setup');

        const getData = this.page
            .getByRole('link', { name: /Get Account Setup Data/i })
            .filter({ visible: true })
            .first();
        await getData.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await getData.click();
        await this.page.waitForTimeout(1000);

        if (!useDefault) return;

        const useDefaultLink = this.page
            .getByRole('link', { name: /use default Account Setup/i })
            .filter({ visible: true })
            .first();
        await useDefaultLink.click();
        await this.settle();
    }

    async fillFromData(data: ScenarioData): Promise<void> {
        const rates = data.rates;
        if (!rates) return;

        const has = (name: string) => data.configurations.includes(name);

        if (has('Credit') && rates.credit) {
            await this.openTab('Credit');
            if (rates.credit.getRateData) await this.getRateData();
            await this.setDefaultBenchmarkSpread(
                rates.credit.defaultBenchmarkSpread
            );
        }

        if (has('Debit') && rates.debit) {
            await this.openTab('Debit');
            await this.setDefaultBenchmarkSpread(
                rates.debit.defaultBenchmarkSpread
            );
        }

        if (has('ABF') && rates.abf) {
            await this.openTab('ABF');
            await this.fillAbfHierarchy(rates.abf);
        }

        if (has('GC Shorts (Cash)') && rates.gcShortsCash) {
            await this.openTab('GC Shorts (Cash)');
            await this.setAmericasDmGcRate(rates.gcShortsCash.americasDmGcRate);
        }

        if (has('Credit Short')) {
            await this.openTab('Credit Short');
            if (rates.creditShort?.pickFirstAvailableDate) {
                await this.pickFirstAvailableDate();
            }
        }

        if (has('Trade Clearing & Other Fees') && rates.tradeClearingOtherFees) {
            await this.openTab('Trade Clearing & Other Fees');
            await this.selectDefaultSchedule(
                rates.tradeClearingOtherFees.defaultSchedule
            );
        }

        if (has('Credit') || has('Debit') || has('ABF')) {
            await this.apply();
        }

        if (rates.accountSetup?.getData) {
            await this.getAccountSetupData(Boolean(rates.accountSetup.useDefault));
        }
    }

    private async pickFromRowListbox(
        row: Locator,
        labelText: string,
        value: string
    ): Promise<void> {
        await row.getByLabel(labelText, { exact: true }).click();
        await this.page.getByRole('listbox').getByText(value).first().click();
    }

    private async fillRowInput(
        row: Locator,
        labelText: string,
        value: string
    ): Promise<void> {
        const input = row.getByLabel(labelText, { exact: true });
        await input.click();
        await input.fill(value);
    }
}
