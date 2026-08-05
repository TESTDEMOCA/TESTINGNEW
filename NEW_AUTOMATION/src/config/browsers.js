const { chromium, firefox, webkit } = require('playwright');

const BROWSERS = {
  chromium,
  chrome: chromium,
  firefox,
  webkit,
  safari: webkit,
};

function resolveBrowser(browserName = 'chromium') {
  const key = String(browserName || 'chromium').trim().toLowerCase();
  const browserType = BROWSERS[key];
  if (!browserType) {
    throw new Error(
      `Unknown BROWSER "${browserName}". Use: chromium, firefox, webkit`,
    );
  }
  return { name: key === 'chrome' ? 'chromium' : key === 'safari' ? 'webkit' : key, type: browserType };
}

function listBrowsers() {
  return ['chromium', 'firefox', 'webkit'];
}

module.exports = { BROWSERS, resolveBrowser, listBrowsers };
