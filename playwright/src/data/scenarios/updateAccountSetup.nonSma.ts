import type { ScenarioData } from '../types';

export const updateAccountSetupNonSma: ScenarioData = {
    accountType: 'Non-SMA',
    requestType: 'Update Account Setup',
    requestFor: 'Add New Pricing',
    clientType: 'PB',
    products: ['Physicals'],
    configurations: ['Account Setup'],
    eqmApprovalRequired: 'Yes',
    effectiveFrom: 'today',
    clientDomicile: 'Americas',
    eqmRegion: 'Americas',
    primarySalesPerson: {
        search: 'sril',
        name: 'Thumati, Srilatha [GBM Public]',
    },
    csCoverage: {
        search: 'sril',
        name: 'Thumati, Srilatha [GBM Public]',
    },
    client: {
        pricingType: 'Fund Manager',
        fundManagerSearch: 'gsec tes',
        fundManagerOption: '1200118674 | GSEC TEST',
    },
    rates: {
        accountSetup: { getData: true },
    },
    approval: {
        comment: 'approve',
        checkboxes: ['Account Setup'],
    },
};
