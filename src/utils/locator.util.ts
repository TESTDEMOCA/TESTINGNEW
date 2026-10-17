import type { Locator, Page } from '@playwright/test';

export type Target = string | Locator;

export function resolve(page: Page, target: Target): Locator {
  return typeof target === 'string' ? page.locator(target) : target;
}

export function describe(target: Target): string {
  return typeof target === 'string' ? target : String(target);
}
