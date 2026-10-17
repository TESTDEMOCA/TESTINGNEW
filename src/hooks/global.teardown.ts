import type { FullConfig } from '@playwright/test';
import { logger } from '../utils/logger';

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  logger.info('test run finished');
}
