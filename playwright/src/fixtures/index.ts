import { test as base, createBdd } from 'playwright-bdd';
import { Pages } from '../pages';
import { World } from './world';

export type Fixtures = {
    world: World;
    pages: Pages;
};

export const test = base.extend<Fixtures>({
    world: async ({ page }, use) => {
        await use(new World(page));
    },
    pages: async ({ world }, use) => {
        await use(new Pages(world));
    },
});

export const { Given, When, Then, Before, After } = createBdd(test);
