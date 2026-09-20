import { When } from '../fixtures';

When('I get rate data', async ({ pages }) => {
    await pages.configuration.getRateData();
});

When(
    'I set the default benchmark spread to {string}',
    async ({ pages }, value: string) => {
        await pages.configuration.setDefaultBenchmarkSpread(value);
    }
);

When('I fill the ABF hierarchy from the test data', async ({ world, pages }) => {
    const abf = world.requireData().rates?.abf;
    if (!abf) throw new Error('Test data has no ABF rates');
    await pages.configuration.fillAbfHierarchy(abf);
});

When(
    'I set Americas DM GC rate to {string}',
    async ({ pages }, value: string) => {
        await pages.configuration.setAmericasDmGcRate(value);
    }
);

When('I pick the first available date', async ({ pages }) => {
    await pages.configuration.pickFirstAvailableDate();
});

When('I select default schedule {string}', async ({ pages }, value: string) => {
    await pages.configuration.selectDefaultSchedule(value);
});

When('I apply the request', async ({ pages }) => {
    await pages.configuration.apply();
});

When('I get account setup data', async ({ pages }) => {
    await pages.configuration.getAccountSetupData();
});

When('I fill configuration tabs from the test data', async ({ world, pages }) => {
    await pages.configuration.fillFromData(world.requireData());
});
