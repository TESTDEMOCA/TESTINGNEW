const path = require('path');

const workers = Math.max(1, Number(process.env.WORKERS || '1') || 1);
const device = String(process.env.DEVICE || 'desktop').toLowerCase();
const browser = String(process.env.BROWSER || 'chromium').toLowerCase();
const reportSuffix = process.env.REPORT_SUFFIX || `${browser}-${device}`;

const common = {
  require: [
    'src/support/world.js',
    'src/hooks/hooks.js',
    'src/steps/login.steps.js',
    'src/steps/home.steps.js',
    'src/steps/bookNow.steps.js',
    'src/steps/locations.steps.js',
    'src/steps/booking.steps.js',
    'src/steps/checkout.steps.js',
    'src/steps/payment.steps.js',
    'src/steps/lms.steps.js',
  ],
  format: [
    'progress-bar',
    `html:${path.join(__dirname, `reports/html/cucumber-report-${reportSuffix}.html`)}`,
    `json:${path.join(__dirname, `reports/cucumber-json/cucumber-report-${reportSuffix}.json`)}`,
    `@cucumber/junit-xml-formatter:${path.join(__dirname, `reports/junit/cucumber-results-${reportSuffix}.xml`)}`,
  ],
  formatOptions: { snippetInterface: 'async-await' },
  parallel: workers,
};

module.exports = {
  default: {
    ...common,
    paths: [path.join(__dirname, 'features/**/*.feature')],
  },
  desktop: {
    ...common,
    paths: [path.join(__dirname, 'features/**/*.feature')],
  },
  mobile: {
    ...common,
    paths: [path.join(__dirname, 'features/**/*.feature')],
  },
  xray: {
    ...common,
    paths: [path.join(__dirname, 'features/xray-generated/**/*.feature')],
  },
};
