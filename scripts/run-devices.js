#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const { sleep } = require('../src/support/freshSession');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const args = process.argv.slice(2);

const devices = (process.env.DEVICES || 'desktop,mobile')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const browser = process.env.BROWSER || 'chromium';
const workers = process.env.WORKERS || '1';
const headless = process.env.HEADLESS || 'false';
const instanceGapMs = Math.max(
  0,
  Number(process.env.INSTANCE_LAUNCH_GAP_MS || '5000') || 0,
);

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
  const codes = [];

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];

    if (i > 0 && instanceGapMs > 0) {
      console.log(
        `[session] Waiting ${instanceGapMs / 1000}s before launching ${device} instance`,
      );
      await sleep(instanceGapMs);
    }

    codes.push(await runDevice(device));
  }

  process.exit(codes.some((code) => code !== 0) ? 1 : 0);
})();

