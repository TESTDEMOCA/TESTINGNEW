#!/usr/bin/env bash
# One-time setup for Shiva WebApp Playwright + Cucumber framework
set -euo pipefail
cd "$(dirname "$0")"

echo "==> npm install"
npm install

echo "==> Playwright Chromium"
npm run playwright:install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Created .env from .env.example — fill in BASE_URL, APP_USERNAME, APP_PASSWORD"
else
  echo "==> .env already exists"
fi

echo "==> Dry-run (validate steps)"
npx cucumber-js --config cucumber.cjs --dry-run --format summary

echo ""
echo "Setup complete. Next:"
echo "  1. Edit .env with real BASE_URL and credentials"
echo "  2. Update selectors in src/pages/*.js for your app"
echo "  3. npm run test:smoke"
