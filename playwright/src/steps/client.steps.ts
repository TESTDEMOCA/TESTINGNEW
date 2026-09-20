import { When } from '../fixtures';

When('I open the Client tab', async ({ pages }) => {
    await pages.client.openClientTab();
});

When('I select pricing type {string}', async ({ pages }, pricingType: string) => {
    await pages.client.selectPricingType(pricingType);
});

When(
    'I enter fund manager {string} and select {string}',
    async ({ pages }, search: string, option: string) => {
        await pages.client.enterFundManager(search, option);
    }
);

When('I select the client fund {string}', async ({ pages }, fund: string) => {
    await pages.client.selectFund(fund);
});

When('I select the sub account {string}', async ({ pages }, subAccount: string) => {
    await pages.client.selectSubAccount(subAccount);
});

When('I fill client details from the test data', async ({ world, pages }) => {
    await pages.client.fillFromData(world.requireData());
});
