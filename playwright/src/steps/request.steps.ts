import { DataTable } from 'playwright-bdd';
import { Given, When } from '../fixtures';
import { columnValues } from '../helpers/data-table';

Given('I load test data {string}', async ({ world }, key: string) => {
    world.loadScenario(key);
});

When('I open Create Pricing\\/Config', async ({ pages }) => {
    await pages.dashboard.openCreatePricingConfig();
});

When('I open the Request tab', async ({ pages }) => {
    await pages.request.openRequestTab();
});

When('I open the {string} tab', async ({ pages }, name: string) => {
    if (name === 'Request') {
        await pages.request.openRequestTab();
        return;
    }
    if (name === 'Client') {
        await pages.client.openClientTab();
        return;
    }
    await pages.configuration.openTab(name);
});

When('I select account type {string}', async ({ pages }, accountType: string) => {
    await pages.request.selectAccountType(accountType);
});

When('I select request type {string}', async ({ pages }, requestType: string) => {
    await pages.request.selectRequestType(requestType);
});

When('I select request for {string}', async ({ pages }, requestFor: string) => {
    await pages.request.selectRequestFor(requestFor);
});

When('I select client type {string}', async ({ pages }, clientType: string) => {
    await pages.request.selectClientType(clientType);
});

When('I select the following products:', async ({ pages }, table: DataTable) => {
    await pages.request.selectProducts(columnValues(table));
});

When(
    'I select the following configurations:',
    async ({ pages }, table: DataTable) => {
        await pages.request.selectConfigurations(columnValues(table));
    }
);

When('I set edit account setup to {string}', async ({ pages }, value: string) => {
    await pages.request.setEditAccountSetup(value);
});

When(
    'I set EQM approval required to {string}',
    async ({ pages }, value: string) => {
        await pages.request.setEqmApprovalRequired(value);
    }
);

When('I set effective from to {string}', async ({ pages }, value: string) => {
    await pages.request.setEffectiveFrom(value);
});

When('I set the end date to {string}', async ({ pages }, value: string) => {
    await pages.request.setEndDate(value);
});

When('I select client domicile {string}', async ({ pages }, value: string) => {
    await pages.request.selectClientDomicile(value);
});

When('I select EQM region {string}', async ({ pages }, value: string) => {
    await pages.request.selectEqmRegion(value);
});

When(
    'I search {string} and select {string} for {string}',
    async ({ pages }, search: string, name: string, label: string) => {
        await pages.request.selectTypeahead(label, search, name);
    }
);

When(
    'I enter primary sales person {string} and select {string}',
    async ({ pages }, search: string, name: string) => {
        await pages.request.enterPrimarySalesPerson(search, name);
    }
);

When(
    'I enter CS coverage {string} and select {string}',
    async ({ pages }, search: string, name: string) => {
        await pages.request.enterCsCoverage(search, name);
    }
);

When(
    'I enter optional CS coverage {string} and select {string}',
    async ({ pages }, search: string, name: string) => {
        await pages.request.enterCsCoverage(search, name, true);
    }
);

When('I fill request details from the test data', async ({ world, pages }) => {
    await pages.request.fillFromData(world.requireData());
});
