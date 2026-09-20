import type { Locator, Page } from '@playwright/test';
import { TIMEOUT } from '../data/timeouts';

export async function selectDropdown(
    page: Page,
    label: string,
    value: string
): Promise<void> {
    await page.keyboard.press('Escape').catch(() => {});

    const combo = page.getByRole('combobox', { name: label });
    await combo.scrollIntoViewIfNeeded();
    await combo.click();

    const listbox = page.getByRole('listbox').last();

    try {
        await listbox.waitFor({ state: 'visible', timeout: TIMEOUT.SHORT });
    } catch {
        const caret = page
            .getByLabel(label)
            .locator('.DropdownWidget---dropdown_caret')
            .first();
        await caret.click({ timeout: TIMEOUT.SHORT });
        await listbox.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
    }

    await listbox.getByText(value, { exact: true }).first().click();
}

export async function selectTypeahead(
    page: Page,
    label: string,
    search: string,
    exactName: string
): Promise<void> {
    await page.keyboard.press('Escape').catch(() => {});

    const combo = page.getByRole('combobox', { name: label });
    await combo.scrollIntoViewIfNeeded();
    await combo.click();
    await combo.pressSequentially(search, { delay: TIMEOUT.TYPE_DELAY });
    await page.waitForTimeout(1500);

    const optionByRole = page
        .getByRole('option')
        .filter({ hasText: exactName })
        .filter({ visible: true })
        .first();

    const optionByText = page
        .getByText(exactName, { exact: true })
        .filter({ visible: true })
        .first();

    try {
        await optionByRole.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await optionByRole.click();
    } catch {
        await optionByText.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await optionByText.click();
    }

    await page.keyboard.press('Escape').catch(() => {});
}

export async function clickButton(page: Page, name: RegExp): Promise<void> {
    const btn = page.getByRole('button', { name }).filter({ visible: true }).first();
    await btn.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
    await btn.click();
}

export async function waitUntilVisibleWithReload(
    page: Page,
    locator: Locator,
    label = 'element'
): Promise<void> {
    for (let attempt = 1; attempt <= TIMEOUT.POLL_MAX_ATTEMPTS; attempt++) {
        try {
            await locator.waitFor({
                state: 'visible',
                timeout: TIMEOUT.POLL_INTERVAL,
            });
            return;
        } catch {
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
        }
    }

    const totalSec = (TIMEOUT.POLL_MAX_ATTEMPTS * TIMEOUT.POLL_INTERVAL) / 1000;
    throw new Error(
        `${label} not visible after ${TIMEOUT.POLL_MAX_ATTEMPTS} attempts (${totalSec}s).`
    );
}

export function formatTodayMMDDYYYY(date: Date = new Date()): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${date.getFullYear()}`;
}

export function resolveDate(value: 'today' | string): string {
    return value === 'today' ? formatTodayMMDDYYYY() : value;
}
