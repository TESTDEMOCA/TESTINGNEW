#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { resolveDevice } = require('../src/config/devices');

const REPO_ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const deviceName = String(process.env.DEVICE || process.argv[2] || 'mobile').toLowerCase();
const device = resolveDevice(deviceName);
const baseUrl = (process.env.BASE_URL || 'https://www.ppl2-stg.plazapremiumlounge.com/en-uk').replace(
  /\/$/,
  '',
);
const outDir = path.join(REPO_ROOT, 'fixtures', 'codegen');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultOut = path.join(outDir, `${deviceName}-flow-${stamp}.js`);
const output = process.env.CODEGEN_OUT || process.argv[3] || defaultOut;

// Use Chromium for both so it matches launch:web / launch:mobile (no WebKit install needed).
const args = [
  'codegen',
  '--browser=chromium',
  '--target=javascript',
  `--output=${output}`,
  `--viewport-size=${device.viewport.width},${device.viewport.height}`,
  `--user-agent=${device.userAgent}`,
  baseUrl,
];

console.log(`Starting Playwright codegen (${deviceName})`);
console.log(`URL: ${baseUrl}`);
console.log(`Browser: chromium`);
console.log(`Viewport: ${device.viewport.width}x${device.viewport.height}${device.isMobile ? ' (mobile)' : ''}`);
console.log(`Output: ${output}`);
console.log('Record the flow, then close the browser to save the script.\n');

const playwrightCli = path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const fallbackCli = path.join(REPO_ROOT, 'node_modules', 'playwright', 'cli.js');
const cli = fs.existsSync(playwrightCli) ? playwrightCli : fallbackCli;

const child = spawn(process.execPath, [cli, ...args], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});
