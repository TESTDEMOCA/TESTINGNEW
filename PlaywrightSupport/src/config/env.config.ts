import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return value.toLowerCase() === 'true';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function browserName(value: string | undefined): BrowserName {
  if (value === 'firefox' || value === 'webkit' || value === 'chromium') return value;
  return 'chromium';
}

export const env = {
  baseUrl: process.env.BASE_URL?.trim() || 'https://example.com',
  browser: browserName(process.env.BROWSER),
  channel: process.env.BROWSER_CHANNEL?.trim() || undefined,
  headless: bool(process.env.HEADLESS, true),
  slowMo: int(process.env.SLOW_MO, 0),
  timeout: int(process.env.TIMEOUT, 30_000),
  video: bool(process.env.VIDEO, false),
};
