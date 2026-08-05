const {
  BeforeAll,
  AfterAll,
  Before,
  After,
  AfterStep,
  Status,
  setDefaultTimeout,
} = require('@cucumber/cucumber');
const path = require('path');
const fs = require('fs');
const { loadSettings } = require('../config/settings');
const { generateTestData } = require('../utils/testData');
const { ensureDir } = require('../utils/helpers');

const REPO_ROOT = path.join(__dirname, '../..');
const isDebug = ['1', 'true', 'yes'].includes(String(process.env.PWDEBUG || '').toLowerCase());
const slowMo = Math.max(0, Number(process.env.SLOW_MO || (isDebug ? 1000 : 0)) || 0);

setDefaultTimeout((isDebug ? 600 : 180) * 1000);

let sharedBrowser;
/** @type {{ status: string, scenario: string, filePath: string, relativePath: string }[]} */
const videoIndex = [];

function safeFilePart(text, max = 80) {
  return String(text || 'scenario')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max) || 'scenario';
}

function writeVideoGalleryHtml(settings) {
  if (!videoIndex.length) return;
  const outDir = path.resolve(REPO_ROOT, 'reports/html');
  ensureDir(outDir);
  const suffix = process.env.REPORT_SUFFIX || `${settings.browserName}-${settings.deviceName}`;
  const outPath = path.join(outDir, `playwright-video-report-${suffix}.html`);

  const rows = videoIndex
    .map((entry) => {
      // Paths relative to reports/html so the gallery can open videos next to cucumber HTML.
      const href = path
        .relative(outDir, entry.filePath)
        .split(path.sep)
        .join('/');
      const badge =
        entry.status === 'FAILED'
          ? '<span style="color:#b00020;font-weight:600">FAILED</span>'
          : '<span style="color:#0a7a32;font-weight:600">PASSED</span>';
      return `<section class="card">
  <h2>${badge} — ${escapeHtml(entry.scenario)}</h2>
  <p class="meta">${escapeHtml(entry.relativePath)}</p>
  <video controls preload="metadata" src="${href}"></video>
</section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Playwright video report — ${escapeHtml(suffix)}</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f4f6f8; color: #1a1a1a; }
    header { background: #111827; color: #fff; padding: 1.25rem 1.5rem; }
    header h1 { margin: 0; font-size: 1.25rem; font-weight: 650; }
    header p { margin: 0.35rem 0 0; opacity: 0.8; font-size: 0.9rem; }
    main { max-width: 960px; margin: 0 auto; padding: 1.25rem; display: grid; gap: 1rem; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; }
    .card h2 { margin: 0 0 0.35rem; font-size: 1rem; }
    .meta { margin: 0 0 0.75rem; color: #6b7280; font-size: 0.8rem; word-break: break-all; }
    video { width: 100%; max-height: 540px; background: #000; border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>Playwright video report</h1>
    <p>${videoIndex.length} scenario recording(s) · ${escapeHtml(suffix)}</p>
  </header>
  <main>
${rows}
  </main>
</body>
</html>
`;
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`[video] Playwright video report: ${outPath}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

BeforeAll(async function () {
  const settings = loadSettings();
  sharedBrowser = await settings.browser.type.launch({
    headless: isDebug ? false : settings.headless,
    slowMo,
    args: [
      // Keep cross-subdomain checkout cookies usable during guest -> uat-booking handoff.
      '--disable-features=ThirdPartyStoragePartitioning',
    ],
  });
});

AfterAll(async function () {
  const settings = loadSettings();
  try {
    writeVideoGalleryHtml(settings);
  } catch (err) {
    console.warn(`[video] Could not write video gallery: ${err.message}`);
  }
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
});

Before(async function () {
  this.settings = loadSettings();
  this.testData = generateTestData();
  this.device = this.settings.deviceName;
  this.browserName = this.settings.browser.name;

  const contextOptions = this.settings.contextOptions();
  const artifactKey = `${this.settings.browser.name}-${this.settings.deviceName}`;

  if (this.settings.recordVideo) {
    const videoDir = path.resolve(REPO_ROOT, this.settings.videoDir, artifactKey);
    ensureDir(videoDir);
    this._videoDir = videoDir;
    contextOptions.recordVideo = {
      dir: videoDir,
      size: this.settings.device.viewport,
    };
  }

  this.context = await sharedBrowser.newContext(contextOptions);
  this.page = await this.context.newPage();
  this.page.setDefaultTimeout(90_000);
  this.page.setDefaultNavigationTimeout(90_000);
});

After(async function ({ result, pickle }) {
  const failed = result?.status === Status.FAILED;
  const statusLabel = failed ? 'FAILED' : 'PASSED';
  const scenarioName = pickle?.name || 'scenario';
  const video = this.page ? this.page.video() : null;
  const settings = this.settings;
  const shouldAttach =
    settings?.recordVideo &&
    ((failed && settings.attachVideoOnFail) || (!failed && settings.attachVideoOnPass));

  if (this.context) {
    await this.context.close();
    this.context = null;
    this.page = null;
  }

  if (!video || !settings?.recordVideo) {
    return;
  }

  try {
    const rawPath = await video.path();
    if (!rawPath || !fs.existsSync(rawPath)) {
      return;
    }

    if (!shouldAttach) {
      fs.unlinkSync(rawPath);
      return;
    }

    const artifactKey = `${settings.browser.name}-${settings.deviceName}`;
    const videoDir =
      this._videoDir || path.resolve(REPO_ROOT, settings.videoDir, artifactKey);
    ensureDir(videoDir);

    const namedPath = path.join(
      videoDir,
      `${statusLabel}-${safeFilePart(scenarioName)}-${Date.now()}.webm`,
    );
    fs.renameSync(rawPath, namedPath);

    const relativePath = path.relative(REPO_ROOT, namedPath);
    videoIndex.push({
      status: statusLabel,
      scenario: scenarioName,
      filePath: namedPath,
      relativePath,
    });

    if (typeof this.attach === 'function') {
      // Embedded in Cucumber HTML report for pass and fail.
      await this.attach(
        fs.readFileSync(namedPath),
        'video/webm',
      );
      await this.attach(`Video (${statusLabel}): ${relativePath}`, 'text/plain');
    }
    console.log(`[video] ${statusLabel} ${scenarioName} → ${relativePath}`);
  } catch (err) {
    console.warn(`[video] Failed to persist/attach recording: ${err.message}`);
  }
});

AfterStep(async function ({ pickleStep, result }) {
  if (result.status !== Status.FAILED || !this.page) {
    return;
  }
  const settings = this.settings || loadSettings();
  if (!settings.screenshotOnFailure) {
    return;
  }
  const dir = path.resolve(
    REPO_ROOT,
    settings.screenshotDir,
    `${settings.browser.name}-${settings.deviceName}`,
  );
  ensureDir(dir);
  const safeName = pickleStep.text.replace(/[^\w.-]+/g, '_').slice(0, 120);
  const filePath = path.join(dir, `failed-${Date.now()}-${safeName}.png`);
  try {
    await this.page.screenshot({ path: filePath, fullPage: true });
    if (typeof this.attach === 'function') {
      await this.attach(fs.readFileSync(filePath), 'image/png');
    }
  } catch {}
});
