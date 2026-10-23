const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verify } = require('../../scripts/verify-mac-release-media');

test('release verification rejects the self-use Homebrew manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'videocull-release-guard-'));
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ platform: 'darwin', arch: 'arm64', files: [] }));
    assert.throws(() => verify(dir), /provenance does not match/);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ kind: 'source-built-release', sources: {} }));
    assert.throws(() => verify(dir), /provenance does not match/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('public packaging selects only release media and ships Electron legal files', () => {
  const config = require('../../config/electron-builder.mac-release.cjs');
  assert.deepEqual(config.extraResources.filter(x => x.to === 'ffmpeg'), [{ from: 'vendor/ffmpeg-release', to: 'ffmpeg' }]);
  for (const name of ['LICENSE.electron.txt', 'LICENSES.chromium.html', 'EXTENSION-PERMISSION.md', 'NOTICE_MAC.md', 'MAC_RELEASE.md']) {
    assert.ok(config.extraResources.some(x => x.to === name), name);
  }
  assert.equal(config.publish, null);
  assert.equal(config.mac.identity, '-');
});
