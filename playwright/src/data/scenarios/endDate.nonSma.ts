import type { ScenarioData } from '../types';

export const endDateNonSma: ScenarioData = {
    accountType: 'Non-SMA',
    requestType: 'End Date',
    products: ['Physicals', 'Synthetics'],
    configurations: [],
    endDate: 'today',
    eqmRegion: 'Americas',
    client: {
        pricingType: 'Fund Manager',
        fundManagerSearch: 'gsec tes',
        fundManagerOption: '1200118674 | GSEC TEST',
        fund: 'GSEC TEST',
    },
    approval: {
        comment: 'approve',
        checkboxes: ['End Date'],
    },
};
