#!/usr/bin/env node
/**
 * Run payment-bound tags one-by-one on mobile; print first failure step / pass.
 * Usage: node scripts/mobile-payment-gate.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TAGS = [
  '@TC01_pass',
  '@TC02_pass',
  '@TC03_pass',
  '@TC03_pass_new',
  '@TC01',
  '@TC02',
  '@TC03',
  '@TC04',
  '@TC05',
  '@TC06',
  '@TC07',
  '@QA-HKG-LOGIN',
  '@QA-HKG-GUEST',
];

function runTag(tag) {
  const suffix = `chromium-mobile-gate-${tag.replace(/[@\s]/g, '')}`;
  const env = {
    ...process.env,
    DEVICE: 'mobile',
    BROWSER: 'chromium',
    HEADLESS: process.env.HEADLESS || 'true',
    REPORT_SUFFIX: suffix,
    WORKERS: '1',
  };
  console.log(`\n======== MOBILE RUN ${tag} ========`);
  const result = spawnSync(
    'npx',
    [
      'cross-env',
      `DEVICE=mobile`,
      `BROWSER=chromium`,
      `REPORT_SUFFIX=${suffix}`,
      `HEADLESS=${env.HEADLESS}`,
      'cucumber-js',
      '--config',
      'cucumber.cjs',
      '--profile',
      'mobile',
      '--tags',
      tag,
    ],
    { cwd: REPO, env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const out = `${result.stdout || ''}\n${result.stderr || ''}`;
  const failedStep =
    out.match(/✖ ([^\n]+)/)?.[1] ||
    out.match(/Error: ([^\n]+)/)?.[1] ||
    (result.status === 0 ? null : 'unknown failure');
  const passed =
    result.status === 0 &&
    /scenarios? \(\d+ passed\)/.test(out) &&
    !/scenarios? \(\d+ failed\)/.test(out);
  const reachedPaymentClick =
    /Soft-pass|Payment handoff|click Payment|Confirm and Proceed|Payment Method|reach payment|uat-booking DNS|ERR_NAME_NOT_RESOLVED/i.test(
      out,
    );
  console.log(out.split('\n').filter((l) => /\[|scenario|✖|✔ And I click Payment|✔ And I click Confirm|Failures:|Error:|Payment navigation/i.test(l)).slice(-40).join('\n'));
  return {
    tag,
    status: result.status,
    passed,
    failedStep: failedStep && failedStep.slice(0, 180),
    reachedPaymentClick,
  };
}

const summary = [];
for (const tag of TAGS) {
  summary.push(runTag(tag));
}

console.log('\n\n======== SUMMARY (mobile → payment gate) ========');
for (const row of summary) {
  const gate = row.passed
    ? 'PASSED full'
    : row.reachedPaymentClick
      ? 'REACHED payment step/handoff'
      : 'STOPPED before payment';
  console.log(`${row.tag.padEnd(18)} | ${gate} | ${row.failedStep || 'ok'}`);
}
