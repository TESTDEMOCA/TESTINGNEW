const path = require('path');
const { ensureDir } = require('../utils/helpers');

const REPO_ROOT = path.join(__dirname, '../..');

function isDebugMode() {
  return ['1', 'true', 'yes'].includes(String(process.env.PWDEBUG || '').toLowerCase());
}

function slowMoMs() {
  return Math.max(0, Number(process.env.SLOW_MO || (isDebugMode() ? 1000 : 0)) || 0);
}

/**
 * Open Yopmail in a separate Chromium browser (not a tab of the app context)
 * so its actions get their own Playwright video recording.
 * @param {object} world Cucumber world
 */
async function openYopmailSession(world) {
  await closeYopmailSession(world);

  const settings = world.settings;
  if (!settings?.browser?.type) {
    throw new Error('World settings/browser are required before opening Yopmail.');
  }

  const yopBrowser = await settings.browser.type.launch({
    headless: isDebugMode() ? false : settings.headless,
    slowMo: slowMoMs(),
    args: ['--disable-application-cache', '--disk-cache-size=1', '--media-cache-size=1'],
  });

  // Always desktop so Yopmail stays on ifinbox/ifmail (mobile viewport opens ifmobmail and breaks refresh).
  const yopViewport = { width: 1280, height: 720 };
  const contextOptions = {
    viewport: yopViewport,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  };

  if (settings.recordVideo) {
    const artifactKey = `${settings.browser.name}-${settings.deviceName}`;
    const videoDir = path.resolve(REPO_ROOT, settings.videoDir, artifactKey, 'yopmail');
    ensureDir(videoDir);
    world._yopmailVideoDir = videoDir;
    contextOptions.recordVideo = {
      dir: videoDir,
      size: yopViewport,
    };
  }

  const yopContext = await yopBrowser.newContext(contextOptions);
  const yopPage = await yopContext.newPage();
  yopPage.setDefaultTimeout(90_000);
  yopPage.setDefaultNavigationTimeout(90_000);

  world.yopmailBrowser = yopBrowser;
  world.yopmailContext = yopContext;
  world.yopmailPage = yopPage;

  console.log('[yopmail] Opened separate browser for Yopmail (independent video recording)');
  return yopPage;
}

/**
 * Close the dedicated Yopmail browser/context.
 * Returns the raw video path (if any) after context close — Playwright finalizes video on close.
 * @param {object} world
 * @returns {Promise<string|null>}
 */
async function closeYopmailSession(world) {
  const page = world.yopmailPage;
  const video = page && typeof page.video === 'function' ? page.video() : null;

  if (world.yopmailContext) {
    await world.yopmailContext.close().catch(() => {});
  }
  if (world.yopmailBrowser) {
    await world.yopmailBrowser.close().catch(() => {});
  }

  world.yopmailPage = null;
  world.yopmailContext = null;
  world.yopmailBrowser = null;

  if (!video) return null;
  try {
    const rawPath = await video.path();
    return rawPath || null;
  } catch {
    return null;
  }
}

module.exports = { openYopmailSession, closeYopmailSession };
