import type { FullConfig } from '@playwright/test';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  logger.info(`base url: ${env.baseUrl}`);
  logger.info(`browser: ${env.browser}, headless: ${env.headless}`);
}
