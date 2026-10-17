import { After, Before } from '@cucumber/cucumber';
import type { AppWorld } from '../support/world';

Before(async function (this: AppWorld) {
  await this.browserManager.launch();
});

After(async function (this: AppWorld) {
  await this.browserManager.close();
});
