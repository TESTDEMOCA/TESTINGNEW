import type { ScenarioData } from '../types';

export const rerateNonSmaPhysicals: ScenarioData = {
    accountType: 'Non-SMA',
    requestType: 'Rerate',
    requestFor: 'Add New Pricing',
    clientType: 'PB',
    products: ['Physicals'],
    configurations: [
        'Credit',
        'Debit',
        'ABF',
        'GC Shorts (Cash)',
        'Credit Short',
        'Trade Clearing & Other Fees',
    ],
    editAccountSetup: 'Yes',
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
        credit: { defaultBenchmarkSpread: '10', getRateData: true },
        debit: { defaultBenchmarkSpread: '10' },
        abf: {
            usdBenchmark: 'Overnight Ref Rate',
            nonUsdBenchmark: 'Overnight Risk Free Rate',
            usdFlooring: 'Floor Spread',
            nonUsdFlooring: 'No Flooring',
            rows: [
                { name: 'Liquid', usdSpread: '1', nonUsdSpread: '4' },
                { name: 'Less Liquid', usdSpread: '2', nonUsdSpread: '5' },
                { name: 'Illiquid', usdSpread: '3', nonUsdSpread: '6' },
            ],
        },
        gcShortsCash: { americasDmGcRate: '20' },
        creditShort: { pickFirstAvailableDate: true },
        tradeClearingOtherFees: { defaultSchedule: 'Standard International' },
        accountSetup: { getData: true },
    },
    approval: {
        comment: 'approve',
        checkboxes: [
            'Credit',
            'Debit',
            'ABF',
            'GC Shorts (Cash)',
            'Credit Short',
            'Trade Clearing & Other Fees',
            'Account Setup',
        ],
    },
};
