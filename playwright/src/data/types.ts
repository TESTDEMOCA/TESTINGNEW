export type AccountType = 'SMA' | 'Non-SMA';
export type PricingType = 'Fund Manager' | 'Fund' | 'Sub Accounts';

export interface PersonSearch {
    search: string;
    name: string;
}

export interface ClientDetails {
    pricingType: PricingType;
    fundManagerSearch: string;
    fundManagerOption: string;
    fund?: string;
    subAccount?: string;
}

export interface AbfRow {
    name: string;
    usdSpread: string;
    nonUsdSpread: string;
}

export interface ConfigurationRates {
    credit?: {
        defaultBenchmarkSpread: string;
        getRateData?: boolean;
    };
    debit?: {
        defaultBenchmarkSpread: string;
    };
    abf?: {
        usdBenchmark: string;
        nonUsdBenchmark: string;
        usdFlooring: string;
        nonUsdFlooring: string;
        rows: AbfRow[];
    };
    gcShortsCash?: {
        americasDmGcRate: string;
    };
    creditShort?: {
        pickFirstAvailableDate: boolean;
    };
    tradeClearingOtherFees?: {
        defaultSchedule: string;
    };
    accountSetup?: {
        getData: boolean;
        useDefault?: boolean;
    };
}

export interface ScenarioData {
    accountType: AccountType;
    requestType: string;
    requestFor?: string;
    clientType?: string;
    products: string[];
    configurations: string[];
    editAccountSetup?: string;
    eqmApprovalRequired?: string;
    effectiveFrom?: 'today' | string;
    endDate?: 'today' | string;
    clientDomicile?: string;
    eqmRegion?: string;
    primarySalesPerson?: PersonSearch;
    csCoverage?: PersonSearch;
    client: ClientDetails;
    rates?: ConfigurationRates;
    approval: {
        comment: string;
        checkboxes?: string[];
    };
}
