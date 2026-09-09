const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { resolveDevice } = require('./devices');
const { resolveBrowser } = require('./browsers');

const REPO_ROOT = path.join(__dirname, '../..');
const DEFAULT_BASE = 'https://www.ppl2-stg.plazapremiumlounge.com/en-uk';

function loadEnvFiles() {
  const rootEnv = path.join(REPO_ROOT, '.env');
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  }
}

function env(key, defaultValue = '') {
  const v = process.env[key];
  return v == null ? defaultValue : String(v).trim();
}

class Settings {
  constructor() {
    loadEnvFiles();
    this.baseUrl = env('BASE_URL', DEFAULT_BASE).replace(/\/$/, '');
    this.appUsername = env('APP_USERNAME');
    this.appPassword = env('APP_PASSWORD');
    this.lmsUsername = env('LMS_USERNAME');
    this.lmsPassword = env('LMS_PASSWORD');
    this.lmsBaseUrl = env('LMS_BASE_URL', 'https://lms-uat.plaza-network.com').replace(/\/$/, '');
    this.amsBaseUrl = env('AMS_BASE_URL', 'https://ams-stg-api.allwaysvip.com').replace(/\/$/, '');
    this.amsClientKey = env('AMS_CLIENT_KEY');
    this.headless = ['1', 'true', 'yes'].includes(env('HEADLESS', 'false').toLowerCase());
    this.screenshotOnFailure = ['1', 'true', 'yes'].includes(
      env('SCREENSHOT_ON_FAILURE', 'true').toLowerCase(),
    );
    this.screenshotDir = env('SCREENSHOT_DIR', 'reports/screenshots');
    // RECORD_VIDEO=true|false — enable Playwright context video recording.
    // VIDEO_MODE=on|retain-on-failure|off — attach/keep videos:
    //   on                 → keep + attach for pass and fail (default)
    //   retain-on-failure  → keep + attach only when scenario fails
    //   off                → do not record (same as RECORD_VIDEO=false)
    this.videoMode = env('VIDEO_MODE', 'on').toLowerCase() || 'on';
    if (!['on', 'retain-on-failure', 'off'].includes(this.videoMode)) {
      this.videoMode = 'on';
    }
    const recordFlag = ['1', 'true', 'yes'].includes(env('RECORD_VIDEO', 'true').toLowerCase());
    this.recordVideo = recordFlag && this.videoMode !== 'off';
    this.attachVideoOnPass = this.videoMode === 'on';
    this.attachVideoOnFail =
      this.videoMode === 'on' || this.videoMode === 'retain-on-failure';
    this.videoDir = env('VIDEO_DIR', 'reports/videos');
    this.workers = Math.max(1, Number(env('WORKERS', '1')) || 1);
    this.deviceName = env('DEVICE', 'desktop').toLowerCase() || 'desktop';
    this.device = resolveDevice(this.deviceName);
    this.browserName = env('BROWSER', 'chromium').toLowerCase() || 'chromium';
    this.browser = resolveBrowser(this.browserName);
  }

  requireCredentials() {
    if (!this.appUsername || !this.appPassword) {
      throw new Error('Set APP_USERNAME and APP_PASSWORD in a `.env` file at the repository root.');
    }
  }

  requireLmsCredentials() {
    if (!this.lmsUsername || !this.lmsPassword) {
      throw new Error('Set LMS_USERNAME and LMS_PASSWORD in a `.env` file at the repository root.');
    }
  }

  contextOptions() {
    const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = this.device;
    return {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      ignoreHTTPSErrors: true,
      // Avoid staging service-worker noise interfering with uat-booking session boot.
      serviceWorkers: 'block',
      // Do not set extraHTTPHeaders (especially Accept). Forcing text/html breaks
      // uat-booking/Adyen JSON APIs → payment page shell loads with no card fields.
    };
  }
}

function loadSettings() {
  return new Settings();
}

module.exports = { Settings, loadSettings };
