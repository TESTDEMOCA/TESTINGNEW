import { BrowserManager } from '../src/support/browser.manager';
import { expect, test } from '../fixtures/test.fixture';

test('launches a browser and opens the base url', async () => {
  const manager = new BrowserManager();

  try {
    const page = await manager.launch({ headless: true });
    await manager.goto('https://example.com');
    expect(await page.title()).toBe('Example Domain');
    const screenshot = await manager.screenshot('example');
    expect(screenshot).toContain('example-');
  } finally {
    await manager.close();
  }
});
