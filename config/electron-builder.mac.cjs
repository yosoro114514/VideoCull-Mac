const base = require('../package.json').build;
const mac = require('./electron-builder.mac.json');
module.exports = {
  ...base,
  ...mac,
  extraResources: [
    ...base.extraResources,
    { from: 'EXTENSION-PERMISSION.md', to: 'EXTENSION-PERMISSION.md' },
    { from: 'NOTICE_MAC.md', to: 'NOTICE_MAC.md' },
  ],
};
