import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import { BrowserManager } from './browser.manager';

export class AppWorld extends World {
  readonly browserManager = new BrowserManager();

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(AppWorld);
