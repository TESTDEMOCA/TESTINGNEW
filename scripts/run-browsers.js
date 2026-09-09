#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);

const browsers = (process.env.BROWSERS || 'chromium,firefox,webkit')
  .split(',')
  .map((b) => b.trim().toLowerCase())
  .filter(Boolean);

const device = process.env.DEVICE || 'desktop';
const workers = process.env.WORKERS || '1';
const headless = process.env.HEADLESS || 'false';

if (!browsers.length) {
  console.error('Set BROWSERS=chromium,firefox,webkit');
  process.exit(1);
}

function runBrowser(browser) {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['cucumber-js', '--config', 'cucumber.cjs', ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          BROWSER: browser,
          DEVICE: device,
          REPORT_SUFFIX: `${browser}-${device}`,
          WORKERS: workers,
          HEADLESS: headless,
        },
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );

    child.on('exit', (code) => resolve(code ?? 1));
  });
}

(async () => {
  const codes = await Promise.all(browsers.map((browser) => runBrowser(browser)));
  process.exit(codes.some((code) => code !== 0) ? 1 : 0);
})();
