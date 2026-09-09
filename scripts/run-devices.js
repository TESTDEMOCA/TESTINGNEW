#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);

const devices = (process.env.DEVICES || 'desktop,mobile')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const browser = process.env.BROWSER || 'chromium';
const workers = process.env.WORKERS || '1';
const headless = process.env.HEADLESS || 'false';

if (!devices.length) {
  console.error('Set DEVICES=desktop,mobile');
  process.exit(1);
}

function runDevice(device) {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['cucumber-js', '--config', 'cucumber.cjs', '--profile', device, ...args],
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
  const codes = await Promise.all(devices.map((device) => runDevice(device)));
  process.exit(codes.some((code) => code !== 0) ? 1 : 0);
})();
