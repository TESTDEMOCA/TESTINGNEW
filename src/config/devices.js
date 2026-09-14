const DEVICES = {
  desktop: {
    name: 'desktop',
    viewport: { width: 1280, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  },
  mobile: {
    name: 'mobile',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
};

function resolveDevice(deviceName = 'desktop') {
  const key = String(deviceName || 'desktop').trim().toLowerCase();
  const device = DEVICES[key];
  if (!device) {
    throw new Error(`Unknown DEVICE "${deviceName}". Use: ${Object.keys(DEVICES).join(', ')}`);
  }
  return device;
}

function listDevices() {
  return Object.keys(DEVICES);
}

module.exports = { DEVICES, resolveDevice, listDevices };
