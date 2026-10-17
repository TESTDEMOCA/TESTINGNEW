import { Given } from '@cucumber/cucumber';
import { env } from '../config/env.config';
import type { AppWorld } from '../support/world';

Given('I launch the application', async function (this: AppWorld) {
  await this.browserManager.goto(env.launchUrl);
});

Given('I launch the url {string}', async function (this: AppWorld, url: string) {
  await this.browserManager.goto(url);
});
