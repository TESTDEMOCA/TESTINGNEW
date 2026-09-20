import type { ScenarioData } from '../data/types';
import { resolveDate } from '../helpers/appian';
import { AppianPage } from './AppianPage';

export class RequestDetailsPage extends AppianPage {
    async openRequestTab(): Promise<void> {
        await this.openSideTab('Request');
    }

    async selectAccountType(accountType: string): Promise<void> {
        await this.selectRadio(accountType);
    }

    async selectRequestType(requestType: string): Promise<void> {
        await this.selectRadio(requestType);
    }

    async selectRequestFor(requestFor: string): Promise<void> {
        await this.selectRadio(requestFor);
    }

    async selectClientType(clientType: string): Promise<void> {
        await this.selectRadio(clientType);
    }

    async selectProducts(wanted: string[]): Promise<void> {
        const wantedSet = new Set(wanted);
        for (const product of this.productNames()) {
            await this.setCheckbox(product, wantedSet.has(product));
        }
    }

    async selectConfigurations(names: string[]): Promise<void> {
        for (const name of names) {
            const exact = ['Credit', 'Debit', 'GC Shorts (Cash)'].includes(name);
            await this.setCheckbox(name, true, exact);
        }
    }

    async setEditAccountSetup(value: string): Promise<void> {
        await this.selectRadio(value);
    }

    async setEqmApprovalRequired(value: string): Promise<void> {
        await this.selectRadio(value);
    }

    async setEffectiveFrom(value: 'today' | string): Promise<void> {
        await this.fillDateInput(resolveDate(value));
    }

    async setEndDate(value: 'today' | string): Promise<void> {
        await this.fillDateInput(resolveDate(value));
    }

    async selectClientDomicile(value: string): Promise<void> {
        await this.selectDropdown('Client Domicile', value);
    }

    async selectEqmRegion(value: string): Promise<void> {
        await this.selectDropdown('EQM Region', value);
    }

    async enterPrimarySalesPerson(search: string, name: string): Promise<void> {
        await this.selectTypeahead('Primary Sales Person', search, name);
    }

    async enterCsCoverage(search: string, name: string, optional = false): Promise<void> {
        try {
            await this.selectTypeahead('CS Coverage', search, name);
        } catch (error) {
            if (!optional) throw error;
        }
    }

    async fillFromData(data: ScenarioData): Promise<void> {
        await this.openRequestTab().catch(() => {});
        await this.selectAccountType(data.accountType);
        await this.selectRequestType(data.requestType);

        if (data.requestFor) await this.selectRequestFor(data.requestFor);
        if (data.clientType) await this.selectClientType(data.clientType);
        if (data.products.length) await this.selectProducts(data.products);
        if (data.configurations.length) {
            await this.selectConfigurations(data.configurations);
        }
        if (data.editAccountSetup) {
            await this.setEditAccountSetup(data.editAccountSetup);
        }
        if (data.eqmApprovalRequired) {
            await this.setEqmApprovalRequired(data.eqmApprovalRequired);
        }
        if (data.effectiveFrom) await this.setEffectiveFrom(data.effectiveFrom);
        if (data.endDate) await this.setEndDate(data.endDate);
        if (data.clientDomicile) {
            await this.selectClientDomicile(data.clientDomicile);
        }
        if (data.eqmRegion) await this.selectEqmRegion(data.eqmRegion);
        if (data.primarySalesPerson) {
            await this.enterPrimarySalesPerson(
                data.primarySalesPerson.search,
                data.primarySalesPerson.name
            );
        }
        if (data.csCoverage) {
            await this.enterCsCoverage(
                data.csCoverage.search,
                data.csCoverage.name,
                true
            );
        }
    }
}
