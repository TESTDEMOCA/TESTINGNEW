import { env } from '../src/config/env.config';
import { BrowserManager } from '../src/support/browser.manager';
import { logger } from '../src/utils/logger';

async function main(): Promise<void> {
  const manager = new BrowserManager();

  try {
    const page = await manager.launch();
    await manager.goto(env.baseUrl);
    logger.info(`title: ${await page.title()}`);
    logger.info(`url: ${page.url()}`);
    await manager.screenshot('launch');

    if (!env.headless) {
      await page.waitForTimeout(5_000);
    }
  } finally {
    await manager.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  logger.error(message);
  process.exit(1);
});
