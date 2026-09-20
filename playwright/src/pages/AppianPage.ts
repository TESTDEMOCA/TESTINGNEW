import type { Locator } from '@playwright/test';
import { constants } from '../data/constants';
import { TIMEOUT } from '../data/timeouts';
import type { World } from '../fixtures/world';
import {
    clickButton,
    selectDropdown,
    selectTypeahead,
} from '../helpers/appian';

export abstract class AppianPage {
    constructor(protected world: World) {}

    protected get page() {
        return this.world.form();
    }

    protected settle(): Promise<void> {
        return this.page
            .waitForLoadState('networkidle', { timeout: TIMEOUT.MEDIUM })
            .catch(() => {});
    }

    async openSideTab(name: string): Promise<void> {
        const tab = this.page
            .getByRole('link', { name, exact: true })
            .filter({ visible: true })
            .first();
        await tab.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await tab.click();
        await this.page.waitForTimeout(400);
    }

    async selectRadio(name: string): Promise<void> {
        await this.setOption('radio', name, true);
        await this.settle();
    }

    async setCheckbox(name: string, desired: boolean, exact = true): Promise<void> {
        await this.setOption('checkbox', name, desired, exact);
        await this.settle();
    }

    async selectDropdown(label: string, value: string): Promise<void> {
        await selectDropdown(this.page, label, value);
        await this.settle();
    }

    async selectTypeahead(
        label: string,
        search: string,
        exactName: string
    ): Promise<void> {
        await selectTypeahead(this.page, label, search, exactName);
        await this.settle();
    }

    async clickNamedButton(name: RegExp): Promise<void> {
        await clickButton(this.page, name);
    }

    protected async setOption(
        role: 'radio' | 'checkbox',
        name: string,
        desired: boolean,
        exact = true
    ): Promise<void> {
        const control = this.page
            .getByRole(role, { name, exact })
            .filter({ visible: true })
            .first();

        const label = this.page
            .getByText(name, { exact })
            .filter({ visible: true })
            .first();

        const visibleControl = await control
            .waitFor({ state: 'visible', timeout: TIMEOUT.SHORT })
            .then(() => true)
            .catch(() => false);

        if (visibleControl) {
            const isChecked = await control.isChecked().catch(() => false);
            if (isChecked === desired) return;

            if (desired) {
                await control.check({ force: true }).catch(async () => {
                    await label.click();
                });
            } else {
                await control.uncheck({ force: true }).catch(async () => {
                    await label.click();
                });
            }
            return;
        }

        await label.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });

        const inputId = await label.getAttribute('for');
        let isChecked = false;
        if (inputId) {
            isChecked = await this.page
                .locator(`input[id="${inputId}"]`)
                .evaluate(
                    (el: HTMLInputElement) =>
                        el.checked || el.getAttribute('aria-checked') === 'true'
                )
                .catch(() => false);
        }

        if (isChecked === desired) return;
        await label.click();
    }

    protected async fillDateInput(value: string, nth = 0): Promise<void> {
        const input = this.page
            .locator('input[placeholder="mm/dd/yyyy"]')
            .nth(nth);
        await input.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await input.fill(value);
        await input.press('Tab');
    }

    protected async pickFirstCalendarDay(): Promise<void> {
        const calendarBtn = this.page
            .getByTestId('DatePickerWidget-calendarButton')
            .filter({ visible: true })
            .first();
        await calendarBtn.click();

        const day = this.page
            .getByTestId('DatePicker-focusableDay')
            .filter({ visible: true })
            .first();
        await day.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await day.click();
    }

    protected async blurCommit(fallback?: Locator): Promise<void> {
        if (fallback) await fallback.click().catch(() => {});
        await this.page.keyboard.press('Tab').catch(() => {});
    }

    protected productNames(): readonly string[] {
        return constants.products;
    }
}
