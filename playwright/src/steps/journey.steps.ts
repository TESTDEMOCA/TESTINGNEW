import { When } from '../fixtures';

When('I complete the request form from the test data', async ({ world, pages }) => {
    const data = world.requireData();
    await pages.request.fillFromData(data);
    await pages.client.fillFromData(data);
    await pages.configuration.fillFromData(data);
});
