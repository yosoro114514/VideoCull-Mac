// Personal Apple Silicon build: copy the installed Homebrew runtime and every non-system
// dylib into the application. Relocate load commands so the result does not need Homebrew.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function bundleMacMedia() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('The personal Mac bundle must be built on Apple Silicon.');
  }
  const root = path.resolve(__dirname, '..');
  const destination = path.join(root, 'vendor', 'ffmpeg');
  const staging = `${destination}.mac-staging`;
  const prefix = process.env.VIDEOCULL_HOMEBREW_PREFIX || '/opt/homebrew';
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.join(staging, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(staging, 'licenses'));
  const files = new Map();
  const names = new Map();
  const formulaRoots = new Set();
  const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const dependencies = (file) => run('/usr/bin/otool', ['-L', file]).split('\n').slice(1)
    .map(line => line.trim().split(' (')[0]).filter(Boolean);

  function collect(source, relative) {
    const real = fs.realpathSync(source);
    if (files.has(real)) return files.get(real);
    const targetName = relative || path.join('lib', path.basename(real));
    if (names.has(targetName) && names.get(targetName) !== real) {
      throw new Error(`Conflicting library names: ${targetName}`);
    }
    const architecture = run('/usr/bin/lipo', ['-archs', real]);
    if (!architecture.includes('arm64')) throw new Error(`Not an ARM64 binary: ${real}`);
    const record = { source: real, relative: targetName, dependencies: [], sha256: crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex') };
    files.set(real, record);
    names.set(targetName, real);
    const cellar = real.match(/^(.*\/Cellar\/[^/]+\/[^/]+)\//);
    if (cellar) formulaRoots.add(cellar[1]);
    fs.copyFileSync(real, path.join(staging, targetName));
    fs.chmodSync(path.join(staging, targetName), 0o755);
    for (const dependency of dependencies(real)) {
      if (dependency.startsWith('/usr/lib/') || dependency.startsWith('/System/Library/')) continue;
      if (!path.isAbsolute(dependency)) throw new Error(`Unsupported library load command: ${dependency} in ${real}`);
      const child = collect(dependency);
      record.dependencies.push({ original: dependency, relative: child.relative });
    }
    return record;
  }

  try {
    for (const name of ['ffmpeg', 'ffprobe']) collect(path.join(prefix, 'bin', name), name);
    for (const record of files.values()) {
      const target = path.join(staging, record.relative);
      // Relocate before re-signing; removing the old signature first can invalidate
      // LINKEDIT sizes for Apple's install_name_tool on older Xcode versions.
      const args = [];
      if (record.relative.startsWith('lib/')) args.push('-id', `@loader_path/${path.basename(record.relative)}`);
      for (const dependency of record.dependencies) {
        const relative = path.relative(path.dirname(record.relative), dependency.relative);
        args.push('-change', dependency.original, `@loader_path/${relative}`);
      }
      if (args.length) run('/usr/bin/install_name_tool', [...args, target]);
      run('/usr/bin/codesign', ['--force', '--sign', '-', target]);
      if (dependencies(target).some(dep => dep.startsWith(prefix))) throw new Error(`Unrelocated dependency in ${target}`);
    }
    for (const formula of formulaRoots) {
      const name = path.basename(path.dirname(formula));
      const texts = fs.readdirSync(formula).filter(name => /^(COPYING|LICENSE|LICENCE|NOTICE)/i.test(name))
        .filter(name => fs.statSync(path.join(formula, name)).isFile())
        .map(name => `=== ${name} ===\n${fs.readFileSync(path.join(formula, name), 'utf8')}`);
      if (texts.length) fs.writeFileSync(path.join(staging, 'licenses', `${name}.txt`), texts.join('\n\n'));
    }
    fs.copyFileSync(path.join(prefix, 'opt', 'ffmpeg', 'COPYING.GPLv3'), path.join(staging, 'LICENSE.txt'));
    fs.writeFileSync(path.join(staging, 'README.txt'), [
      'Apple Silicon personal-use runtime, bundled from the local Homebrew installation.',
      run(path.join(staging, 'ffmpeg'), ['-version']),
      'Original upstream source: https://ffmpeg.org/ and the Homebrew formulae recorded in manifest.json.',
      'Shared libraries are bundled and load paths relocated. This is a local self-use build, not an upstream VideoCull release.',
    ].join('\n'));
    run(path.join(staging, 'ffprobe'), ['-version']);
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify({ platform: 'darwin', arch: 'arm64', files: [...files.values()] }, null, 2));
    fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(staging, destination);
    console.log(`Bundled ${files.size} native executables/libraries for Apple Silicon.`);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) bundleMacMedia();
module.exports = { bundleMacMedia };
