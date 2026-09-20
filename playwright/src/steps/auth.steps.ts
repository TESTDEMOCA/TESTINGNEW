import { Given, Then, When } from '../fixtures';
import { requireUser } from '../helpers/credentials';

Given('I open the Financing GO login page', async ({ pages }) => {
    await pages.login.open();
});

When('I log in as {string}', async ({ pages }, userKey: string) => {
    const user = requireUser(userKey);
    await pages.login.login(user.username, user.password);
});

Given('I am logged into Financing GO as {string}', async ({ pages }, userKey: string) => {
    await pages.loginAs(userKey);
});

Then('I should see the Financing GO dashboard', async ({ pages }) => {
    await pages.dashboard.expectLoaded();
});

Then('I should see the dashboard primary navigation', async ({ pages }) => {
    await pages.dashboard.expectPrimaryNavigation();
});
