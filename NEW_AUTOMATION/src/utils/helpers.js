const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  const p = path.resolve(dirPath);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

module.exports = { ensureDir };
