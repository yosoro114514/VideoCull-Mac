const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function verify(dir = path.join(root, 'vendor/ffmpeg-release')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const pins = require('../config/mac-media-sources.json');
  if (manifest.kind !== 'source-built-release' || JSON.stringify(manifest.sources) !== JSON.stringify(pins)) {
    throw new Error('Release media provenance does not match the pinned sources. Rebuild release media.');
  }
  for (const pin of Object.values(pins)) {
    if (sha256(path.join(root, 'artifacts/release-sources', pin.file)) !== pin.sha256) throw new Error('Missing or incorrect corresponding source');
  }
  for (const name of ['ffmpeg', 'ffprobe']) {
    const file = path.join(dir, name);
    if (sha256(file) !== manifest.binaries[name].sha256) throw new Error(`${name}: binary checksum mismatch`);
    const loads = execFileSync('/usr/bin/otool', ['-L', file], { encoding: 'utf8' }).split('\n').slice(1).map(s => s.trim()).filter(Boolean);
    if (loads.some(s => !s.startsWith('/usr/lib/') && !s.startsWith('/System/Library/'))) throw new Error(`${name}: external dynamic library dependency`);
    execFileSync('/usr/bin/codesign', ['--verify', '--strict', file]);
  }
  for (const name of ['LICENSE.txt', 'README.txt', 'licenses/ffmpeg.txt', 'licenses/x264.txt', 'licenses/dav1d.txt']) {
    if (!fs.statSync(path.join(dir, name)).size) throw new Error(`Missing license: ${name}`);
  }
  console.log('Verified release media, source hashes, system-only links and licenses.');
  return manifest;
}
if (require.main === module) verify();
module.exports = { verify };
