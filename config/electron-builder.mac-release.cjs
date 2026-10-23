const base = require('./electron-builder.mac.cjs');
module.exports = {
  ...base,
  extraResources: [
    ...base.extraResources.filter(item => item.to !== 'ffmpeg'),
    { from: 'vendor/ffmpeg-release', to: 'ffmpeg' },
    { from: 'node_modules/electron/dist/LICENSE', to: 'LICENSE.electron.txt' },
    { from: 'node_modules/electron/dist/LICENSES.chromium.html', to: 'LICENSES.chromium.html' },
    { from: 'MAC_RELEASE.md', to: 'MAC_RELEASE.md' },
    { from: 'config/mac-media-sources.json', to: 'mac-media-sources.json' },
    { from: 'config/mac-runtime-sources.json', to: 'mac-runtime-sources.json' },
  ],
};
