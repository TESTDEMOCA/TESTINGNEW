const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../src/config/xray.env') });

const DEFAULT_AUTH_URL = 'https://xray.cloud.getxray.app/api/v2/authenticate';
const outputDir = path.join(__dirname, '../features/xray-generated');
const zipPath = path.join(outputDir, 'features.zip');

function apiBaseFromAuthUrl(authUrl) {
  const u = authUrl.trim();
  return u.replace(/\/authenticate\/?$/i, '') || 'https://xray.cloud.getxray.app/api/v2';
}

async function authenticate(clientId, clientSecret, authUrl) {
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xray authenticate failed HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  let token = text.trim();
  try {
    token = JSON.parse(token);
  } catch {}
  if (typeof token !== 'string' || !token) {
    throw new Error('Xray authenticate: unexpected response');
  }
  return token;
}

async function exportCucumberFeatures(apiBase, token, keys) {
  const url = new URL(`${apiBase}/export/cucumber`);
  url.searchParams.set('keys', keys);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/zip',
    },
  });
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Error(`Xray Cucumber export failed HTTP ${res.status}: ${body.toString('utf8').slice(0, 1000)}`);
  }
  return body;
}

function prepareOutputDir() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
}

function unzipFeatures() {
  execFileSync('unzip', ['-o', zipPath, '-d', outputDir], { stdio: 'pipe' });
  const files = fs.readdirSync(outputDir).filter((name) => name.endsWith('.feature'));
  if (files.length === 0) {
    throw new Error(`No .feature files in ${outputDir}`);
  }
}

async function main() {
  const clientId = process.env.XRAY_CLIENT_ID || '';
  const secret = process.env.XRAY_CLIENT_SECRET || '';
  const authUrl = (process.env.XRAY_AUTH_URL || DEFAULT_AUTH_URL).trim();
  const apiBase = apiBaseFromAuthUrl(authUrl);
  const keys = (process.env.XRAY_TEST_EXECUTION_KEY || process.env.XRAY_EXPORT_KEYS || '').trim();

  if (!clientId || !secret) {
    throw new Error('Missing XRAY_CLIENT_ID or XRAY_CLIENT_SECRET.');
  }
  if (!keys) {
    throw new Error('Set XRAY_TEST_EXECUTION_KEY or XRAY_EXPORT_KEYS before exporting features.');
  }

  prepareOutputDir();
  const token = await authenticate(clientId, secret, authUrl);
  const zip = await exportCucumberFeatures(apiBase, token, keys);
  fs.writeFileSync(zipPath, zip);
  unzipFeatures();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
