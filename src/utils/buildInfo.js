const { request } = require('@playwright/test');

async function getBuildInfo() {
  const baseURL = process.env.BASE_URL;

  const apiContext = await request.newContext({
    baseURL,
    ignoreHTTPSErrors: true,

    httpCredentials: {
      username: process.env.PPL_BASIC_USER,
      password: process.env.PPL_BASIC_PASSWORD,
    },
  });

  try {
    const response = await apiContext.get('/api/build-info');

    if (!response.ok()) {
      throw new Error(
        `Build Info API failed: ${response.status()} ${response.statusText()}`
      );
    }

    const buildInfo = await response.json();



    return buildInfo;
  } finally {
    await apiContext.dispose();
  }
}

module.exports = { getBuildInfo };