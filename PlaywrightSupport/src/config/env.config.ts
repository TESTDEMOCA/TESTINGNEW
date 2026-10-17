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

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing. Set it in .env`);
  }
  return value;
}

const baseUrl = required('BASE_URL').replace(/\/$/, '');
const rawPath = process.env.APP_PATH?.trim() || '/';
const appPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

export const env = {
  baseUrl,
  appPath,
  launchUrl: new URL(appPath, `${baseUrl}/`).href,
  browser: browserName(process.env.BROWSER),
  channel: process.env.BROWSER_CHANNEL?.trim() || undefined,
  headless: bool(process.env.HEADLESS, true),
  slowMo: int(process.env.SLOW_MO, 0),
  timeout: int(process.env.TIMEOUT, 30_000),
  video: bool(process.env.VIDEO, false),
};
