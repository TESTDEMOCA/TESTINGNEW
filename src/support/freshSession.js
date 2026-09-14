const fs = require('fs');
const os = require('os');
const path = require('path');

const STAMP_PATH = path.join(os.tmpdir(), 'ppl-browser-launch.stamp');
const LOCK_DIR = path.join(os.tmpdir(), 'ppl-browser-launch.lockdir');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDirLock(fn) {
  const started = Date.now();

  for (;;) {
    try {
      fs.mkdirSync(LOCK_DIR);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      try {
        const stat = fs.statSync(LOCK_DIR);
        if (Date.now() - stat.mtimeMs > 30_000) {
          fs.rmdirSync(LOCK_DIR);
          continue;
        }
      } catch {
        // Lock dir vanished between exists and stat.
      }

      if (Date.now() - started > 60_000) {
        throw new Error('[session] Timed out waiting for browser launch lock');
      }

      await sleep(50);
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.rmdirSync(LOCK_DIR);
    } catch {
      // Lock dir already gone.
    }
  }
}

/**
 * Stagger browser launches across scenarios, workers, and device/browser
 * processes so a new instance starts only after INSTANCE_LAUNCH_GAP_MS.
 * The first instance in a batch does not wait.
 */
async function waitBeforeNewBrowserInstance(gapMs) {
  const gap = Math.max(0, Number(gapMs) || 0);
  if (!gap) return;

  await withDirLock(async () => {
    let last = 0;
    try {
      last = Number(fs.readFileSync(STAMP_PATH, 'utf8')) || 0;
    } catch {
      last = 0;
    }

    const wait = last ? last + gap - Date.now() : 0;
    if (wait > 0) {
      console.log(
        `[session] Waiting ${Math.ceil(wait / 1000)}s before launching a new browser instance`
      );
      await sleep(wait);
    }

    fs.writeFileSync(STAMP_PATH, String(Date.now()));
  });
}

function appBrowserLaunchOptions({ headless, slowMo } = {}) {
  return {
    headless: Boolean(headless),
    slowMo: Math.max(0, Number(slowMo) || 0),
    args: [
      // Keep cross-subdomain checkout cookies usable
      // during guest -> uat-booking handoff.
      '--disable-features=ThirdPartyStoragePartitioning',
      // Avoid stale currency/destination from prior runs.
      '--disable-application-cache',
      '--disk-cache-size=1',
      '--media-cache-size=1',
    ],
  };
}

module.exports = {
  sleep,
  waitBeforeNewBrowserInstance,
  appBrowserLaunchOptions,
};

