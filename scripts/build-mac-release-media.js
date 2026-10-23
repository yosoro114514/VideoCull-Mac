// Build the public runtime from checksum-pinned sources. Never copy Homebrew libraries.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pins = require('../config/mac-media-sources.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function build() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Build on an Apple Silicon Mac.');
  const sources = path.join(root, 'artifacts/release-sources');
  const work = path.join(root, 'artifacts/media-build');
  const toolBin = path.join(root, 'artifacts/media-build-tools/bin');
  const destdir = path.join(work, 'root');
  const prefix = path.join(destdir, 'videocull/media');
  const staging = path.join(root, 'vendor/ffmpeg-release.staging');
  const destination = path.join(root, 'vendor/ffmpeg-release');
  const env = { ...process.env, LC_ALL: 'C', MACOSX_DEPLOYMENT_TARGET: '15.0',
    PATH: `${toolBin}:${process.env.PATH}`, CC: '/usr/bin/clang',
    PKG_CONFIG_LIBDIR: path.join(prefix, 'lib/pkgconfig'), PKG_CONFIG_SYSROOT_DIR: destdir };
  const run = (cmd, args, cwd = work) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
  const output = (cmd, args) => execFileSync(cmd, args, { env, encoding: 'utf8' }).trim();
  fs.mkdirSync(sources, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  // Validate every input before extracting or executing any build recipe.
  for (const [name, pin] of Object.entries(pins)) {
    const archive = path.join(sources, pin.file);
    if (!fs.existsSync(archive)) run('/usr/bin/curl', ['-fL', '--retry', '2', '-o', archive, pin.url]);
    if (hash(archive) !== pin.sha256) throw new Error(`${name}: source checksum mismatch`);
    const src = path.join(work, name);
    fs.rmSync(src, { recursive: true, force: true });
    fs.mkdirSync(src);
    run('/usr/bin/tar', ['-xf', archive, '--strip-components=1', '-C', src]);
  }
  const jobs = String(Math.min(6, require('node:os').availableParallelism()));
  run('./configure', ['--prefix=/videocull/media', '--enable-static', '--disable-cli', '--disable-opencl', '--disable-asm'], path.join(work, 'x264'));
  run('/usr/bin/make', ['-j', jobs], path.join(work, 'x264'));
  run('/usr/bin/make', ['install', `DESTDIR=${destdir}`], path.join(work, 'x264'));
  run('meson', ['setup', 'build', '--prefix=/videocull/media', '--libdir=lib', '--buildtype=release', '--default-library=static', '-Denable_tools=false', '-Denable_tests=false'], path.join(work, 'dav1d'));
  run('meson', ['compile', '-C', 'build', '-j', jobs], path.join(work, 'dav1d'));
  run('meson', ['install', '-C', 'build', '--destdir', destdir], path.join(work, 'dav1d'));
  const configure = ['--prefix=/videocull/ffmpeg', '--cc=/usr/bin/clang', '--enable-static', '--disable-shared',
    '--disable-autodetect', '--disable-network', '--disable-doc', '--disable-debug', '--disable-ffplay',
    '--enable-gpl', '--enable-version3', '--enable-libx264', '--enable-libdav1d', '--pkg-config-flags=--static',
    '--enable-videotoolbox', '--enable-audiotoolbox', '--enable-pthreads', '--enable-neon',
    '--extra-cflags=-mmacosx-version-min=15.0', '--extra-ldflags=-mmacosx-version-min=15.0'];
  run('./configure', configure, path.join(work, 'ffmpeg'));
  run('/usr/bin/make', ['-j', jobs, 'ffmpeg', 'ffprobe'], path.join(work, 'ffmpeg'));
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.join(staging, 'licenses'), { recursive: true });
  const binaries = {};
  for (const name of ['ffmpeg', 'ffprobe']) {
    const target = path.join(staging, name);
    fs.copyFileSync(path.join(work, 'ffmpeg', name), target);
    run('/usr/bin/codesign', ['--force', '--sign', '-', target]);
    const loads = output('/usr/bin/otool', ['-L', target]).split('\n').slice(1).map(s => s.trim().split(' (')[0]);
    if (loads.some(s => !s.startsWith('/usr/lib/') && !s.startsWith('/System/Library/'))) throw new Error(`Non-system dependency in ${name}: ${loads}`);
    if (output('/usr/bin/lipo', ['-archs', target]) !== 'arm64') throw new Error('Unexpected architecture');
    binaries[name] = { sha256: hash(target), dependencies: loads };
  }
  for (const [name, license] of [['ffmpeg', 'COPYING.GPLv3'], ['x264', 'COPYING'], ['dav1d', 'COPYING']]) {
    fs.copyFileSync(path.join(work, name, license), path.join(staging, 'licenses', `${name}.txt`));
  }
  fs.copyFileSync(path.join(work, 'ffmpeg/COPYING.GPLv3'), path.join(staging, 'LICENSE.txt'));
  fs.writeFileSync(path.join(staging, 'README.txt'), [
    'VideoCull Mac public runtime: FFmpeg + x264 + dav1d, built from pinned unmodified sources.',
    'License: GPL-3.0-or-later for the combined executables; individual notices are in licenses/.',
    'Only Apple system frameworks/libraries are dynamically linked. Networking is disabled.',
    'Matching source archives and build scripts are supplied with the same GitHub release:',
    `https://github.com/yosoro114514/VideoCull-Mac/releases/tag/v${require('../package.json').version}`,
    'Rebuild: scripts/build-mac-release-media.js with config/mac-media-sources.json.',
    output(path.join(staging, 'ffmpeg'), ['-version']), '',
  ].join('\n'));
  const manifest = { kind: 'source-built-release', platform: 'darwin', arch: 'arm64', minimumSystemVersion: '15.0',
    sources: pins, configure, binaries, tools: { clang: output('/usr/bin/clang', ['--version']),
      sdk: output('/usr/bin/xcrun', ['--show-sdk-version']), meson: output('meson', ['--version']), ninja: output('ninja', ['--version']) } };
  fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(staging, destination);
  console.log('Release FFmpeg/FFprobe built and verified.');
}
if (require.main === module) build();
module.exports = { build };
