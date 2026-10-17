import { logger } from './logger';

export async function retry<T>(action: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      logger.warn(`attempt ${attempt}/${attempts} failed`);
      if (attempt < attempts) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
      }
    }
  }

  throw lastError;
}
