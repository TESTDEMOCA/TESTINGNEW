import type { Target } from '../utils/locator.util';
import type { UiActions } from '../utils/actions';

export const commonSteps = {
  async open(actions: UiActions, url?: string): Promise<void> {
    await actions.navigate(url);
  },

  async click(actions: UiActions, target: Target): Promise<void> {
    await actions.click(target);
  },

  async enterText(actions: UiActions, target: Target, value: string, mask = false): Promise<void> {
    await actions.fill(target, value, { mask });
  },

  async verifyVisible(actions: UiActions, target: Target): Promise<void> {
    await actions.shouldBeVisible(target);
  },

  async verifyText(actions: UiActions, target: Target, text: string | RegExp): Promise<void> {
    await actions.shouldHaveText(target, text);
  },

  async verifyUrl(actions: UiActions, fragment: string | RegExp): Promise<void> {
    await actions.shouldContainUrl(fragment);
  },
};
