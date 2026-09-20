import { expect } from '@playwright/test';
import { constants } from '../data/constants';
import { TIMEOUT } from '../data/timeouts';
import { waitUntilVisibleWithReload } from '../helpers/appian';
import { saveRunState } from '../helpers/run-state';
import { AppianPage } from './AppianPage';

const RECORD_SUMMARY_URL = /\/record\/.+\/view\/summary/;

export class RequestWorkflowPage extends AppianPage {
    async validate(): Promise<void> {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.clickNamedButton(/^Validate$/i);
    }

    async expectNoValidationIssues(): Promise<void> {
        await this.page
            .getByText(/No validation issues found/i)
            .first()
            .waitFor({ state: 'visible', timeout: TIMEOUT.LONG });
    }

    async submitForApproval(): Promise<void> {
        await this.clickNamedButton(/submit for approval/i);

        const confirmSubmit = this.page
            .getByRole('button', { name: /^Submit$/i })
            .first();

        try {
            await confirmSubmit.waitFor({
                state: 'visible',
                timeout: TIMEOUT.SHORT,
            });
            await confirmSubmit.click();
        } catch {
        }

        await this.page.waitForLoadState('domcontentloaded');
        await this.captureCreatedRequestId();
    }

    async openCreatedRequest(): Promise<void> {
        if (this.world.recordSummaryUrl) {
            await this.page.goto(this.world.recordSummaryUrl);
            await this.page.waitForLoadState('domcontentloaded');
            return;
        }

        const id = this.world.requestId;
        if (!id) {
            await this.openNewestRequestFromList();
            return;
        }

        await this.page.goto(constants.urls.rateRequestsList);
        await this.page.waitForLoadState('domcontentloaded');

        const requestIdCombo = this.page.getByRole('combobox', {
            name: 'Request ID',
        });
        if (await requestIdCombo.isVisible().catch(() => false)) {
            await requestIdCombo.click();
            await this.page
                .getByRole('listbox')
                .getByText(id, { exact: true })
                .click()
                .catch(() => {});
        }

        await this.page.getByRole('link', { name: id, exact: true }).click();
        await this.page.waitForLoadState('domcontentloaded');
        this.world.recordSummaryUrl = this.page.url();
        saveRunState({
            requestId: id,
            recordSummaryUrl: this.world.recordSummaryUrl,
        });
    }

    async waitForEqmApprovalAction(): Promise<void> {
        const eqmApprovalLink = this.page.getByRole('link', {
            name: /Perform EQM Approval/i,
        });
        await waitUntilVisibleWithReload(
            this.page,
            eqmApprovalLink,
            'Perform EQM Approval link'
        );
    }

    async performEqmApproval(
        comment: string,
        checkboxes: string[] = []
    ): Promise<void> {
        await this.waitForEqmApprovalAction();

        await this.page
            .getByRole('link', { name: /Perform EQM Approval/i })
            .click();
        await this.page.waitForLoadState('domcontentloaded');

        for (const name of checkboxes) {
            await this.setOption('checkbox', name, true).catch(() => {});
        }

        const commentBox = this.page.getByRole('textbox', { name: 'Comment' });
        await commentBox.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await commentBox.fill(comment);

        await this.clickNamedButton(/^Approve$/i);

        await this.page
            .waitForURL(RECORD_SUMMARY_URL, { timeout: TIMEOUT.NAV })
            .catch(() => {});

        await this.page.waitForTimeout(TIMEOUT.WORKFLOW_SYNC);
    }

    async expectPastPendingEqm(): Promise<void> {
        const pending = this.page.getByText(/Pending Action From:\s*EQM/i);
        await expect(pending).toBeHidden({ timeout: TIMEOUT.LONG }).catch(async () => {
            await expect(
                this.page.getByText(/Completed Step/i).first()
            ).toBeVisible({ timeout: TIMEOUT.LONG });
        });
    }

    private async captureCreatedRequestId(): Promise<void> {
        const created = this.page.getByText(/Request\s+\d+\s+created/i).first();
        if (await created.isVisible().catch(() => false)) {
            const text = (await created.textContent()) ?? '';
            const match = text.match(/Request\s+(\d+)/i);
            if (match) {
                this.world.setRequest(match[1], this.page.url());
                saveRunState({
                    requestId: match[1],
                    recordSummaryUrl: this.page.url(),
                });
                return;
            }
        }

        await this.openNewestRequestFromList();
    }

    private async openNewestRequestFromList(): Promise<void> {
        await this.page.goto(constants.urls.rateRequestsList);
        await this.page
            .waitForLoadState('networkidle', { timeout: TIMEOUT.NAV })
            .catch(() => {});

        const firstIdLink = this.page.getByRole('link', { name: /^\d+$/ }).first();
        await firstIdLink.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });

        const idText = ((await firstIdLink.textContent()) ?? '').trim();
        this.world.requestId = idText;
        saveRunState({ requestId: idText });

        await firstIdLink.click();
        await this.page.waitForURL(RECORD_SUMMARY_URL, { timeout: TIMEOUT.NAV });
        this.world.recordSummaryUrl = this.page.url();
        saveRunState({ recordSummaryUrl: this.world.recordSummaryUrl });
    }
}
