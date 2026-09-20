import type { Page } from '@playwright/test';
import { getScenario } from '../data/scenarios';
import type { ScenarioData } from '../data/types';

export class World {
    formPage?: Page;
    requestId?: string;
    recordSummaryUrl?: string;
    data?: ScenarioData;

    constructor(public page: Page) {}

    form(): Page {
        if (!this.formPage) {
            throw new Error('Create Pricing/Config form is not open');
        }
        return this.formPage;
    }

    loadScenario(key: string): ScenarioData {
        this.data = getScenario(key);
        return this.data;
    }

    requireData(): ScenarioData {
        if (!this.data) {
            throw new Error('No test data loaded');
        }
        return this.data;
    }

    setRequest(requestId: string, recordSummaryUrl?: string): void {
        this.requestId = requestId;
        if (recordSummaryUrl) this.recordSummaryUrl = recordSummaryUrl;
    }
}
