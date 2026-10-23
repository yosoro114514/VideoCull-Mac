#!/usr/bin/env python3
"""Collect verified sources and assemble release assets. Does not publish anything."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'artifacts/release-sources'


def digest(file, algorithm='sha256'):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).digest()


def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + '.partial')
    subprocess.run(['curl', '-fLsS', '--retry', '2', '--max-time', '900', '-o', str(partial), url], check=True)
    partial.replace(target)


def collect_sources():
    media = json.loads((ROOT / 'config/mac-media-sources.json').read_text())
    runtime = json.loads((ROOT / 'config/mac-runtime-sources.json').read_text())
    installed = json.loads((ROOT / 'node_modules/electron/package.json').read_text())
    if installed['version'] != runtime['electronVersion']:
        raise RuntimeError('Electron version changed: update and review runtime source pins first')
    inputs = list(media.values()) + runtime['sources']
    for item in inputs:
        target = SOURCES / item['file']
        if not target.exists():
            download(item['url'], target)
        if digest(target).hex() != item['sha256']:
            raise RuntimeError('Source hash mismatch: ' + item['file'])
    npm = []
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    seen = set()
    for location, package in lock['packages'].items():
        if not location or package.get('dev') or package.get('devOptional'):
            continue
        url, integrity = package.get('resolved', ''), package.get('integrity', '')
        if url in seen:
            continue
        if not url.startswith('https://registry.npmjs.org/') or not integrity.startswith('sha512-'):
            raise RuntimeError('Unreviewed npm source input: ' + location)
        seen.add(url)
        name = location.split('node_modules/')[-1]
        filename = name.replace('/', '__').replace('@', '') + '-' + package['version'] + '.tgz'
        target = SOURCES / 'npm' / filename
        if not target.exists():
            download(url, target)
        expected = base64.b64decode(integrity.removeprefix('sha512-'))
        if digest(target, 'sha512') != expected:
            raise RuntimeError('npm integrity mismatch: ' + name)
        npm.append({'name': name, 'version': package['version'], 'license': package.get('license'),
                    'file': 'npm/' + filename, 'url': url, 'integrity': integrity, 'sha256': digest(target).hex()})
    return inputs, npm


def link_or_copy(source, target):
    if target.exists():
        target.unlink()
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def public_tar_metadata(info):
    # Wrapper archives must not disclose the builder's local account name or IDs.
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    info.pax_headers = {}
    return info


def assemble(inputs, npm):
    subprocess.run(['node', 'scripts/verify-mac-release-media.js'], cwd=ROOT, check=True)
    if subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT).strip():
        raise RuntimeError('Commit the complete release tree before generating the application source archive')
    version = json.loads((ROOT / 'package.json').read_text())['version']
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    out = ROOT / 'artifacts/release' / ('v' + version)
    out.mkdir(parents=True, exist_ok=True)
    app = ROOT / 'artifacts/packages/mac-arm64/VideoCull.app'
    resources = app / 'Contents/Resources'
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    shipped = json.loads(subprocess.check_output(['node', '-e',
        "console.log(JSON.stringify(require('./scripts/generate-notices').readShippedPackages(process.argv[1]).map(p=>p.name+'@'+p.version)))",
        str(resources)], cwd=ROOT, text=True))
    supplied = {p['name'] + '@' + p['version'] for p in npm}
    if set(shipped) - supplied:
        raise RuntimeError('Shipped npm packages lack source inputs: ' + str(set(shipped) - supplied))
    # Check packed application code against the release checkout, not just its version label.
    subprocess.run(['node', '-e', '''
const fs=require('fs'),path=require('path'),asar=require('@electron/asar');
const archive=process.argv[1];
for(const file of asar.listPackage(archive).map(x=>x.replace(/^\\//,''))) {
  if((file.startsWith('electron/') && file.endsWith('.js')) || ['package.json','product.json'].includes(file)) {
    const actual=asar.extractFile(archive,file);
    if(file==='package.json') {
      if(JSON.parse(actual).version!==require('./package.json').version) throw Error('Stale package version');
    } else if(!actual.equals(fs.readFileSync(file))) throw Error('Stale packaged source: '+file);
  }
}
''', str(resources / 'app.asar')], cwd=ROOT, check=True)
    dmg = ROOT / 'artifacts/packages' / f'VideoCull-Mac-arm64-{version}.dmg'
    link_or_copy(dmg, out / dmg.name)
    app_source = out / f'VideoCull-Mac-{version}-source.tar.gz'
    subprocess.run(['git', 'archive', '--format=tar.gz', f'--prefix=VideoCull-Mac-{version}/',
                    '-o', str(app_source), commit], cwd=ROOT, check=True)
    binary_paths = {
        'Electron Framework': app / 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
        'Electron libffmpeg': app / 'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib',
        'ffmpeg': resources / 'ffmpeg/ffmpeg', 'ffprobe': resources / 'ffmpeg/ffprobe',
    }
    manifest = {'version': version, 'commit': commit, 'platform': 'darwin-arm64',
                'signing': 'ad-hoc; not Developer ID signed; not notarized',
                'buildEnvironment': {
                    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                    'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
                    'electronBuilder': json.loads((ROOT / 'node_modules/electron-builder/package.json').read_text())['version'],
                    'macOS': subprocess.check_output(['sw_vers', '-productVersion'], text=True).strip()},
                'sources': inputs, 'npmRuntimeSources': npm,
                'mediaBuild': json.loads((resources / 'ffmpeg/manifest.json').read_text()),
                'packagedBinarySha256': {name: digest(file).hex() for name, file in binary_paths.items()}}
    (out / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    legal = ['THIRD_PARTY_NOTICES.txt', 'LICENSES.chromium.html', 'LICENSE.electron.txt',
             'LICENSE.txt', 'EXTENSION-PERMISSION.md', 'NOTICE_MAC.md', 'MAC_RELEASE.md']
    for name in legal:
        shutil.copy2(resources / name, out / name)
    with tarfile.open(out / f'VideoCull-Mac-{version}-dependencies.tar.gz', 'w:gz') as archive:
        for item in inputs:
            if item.get('component', '').startswith('Chromium ('):
                link_or_copy(SOURCES / item['file'], out / item['file'])
            else:
                archive.add(SOURCES / item['file'], arcname='archives/' + item['file'], filter=public_tar_metadata)
        for item in npm:
            archive.add(SOURCES / item['file'], arcname=item['file'], filter=public_tar_metadata)
        for name in legal + ['RELEASE-MANIFEST.json']:
            archive.add(out / name, arcname='notices/' + name, filter=public_tar_metadata)
        for name in ['config/mac-media-sources.json', 'config/mac-runtime-sources.json',
                     'scripts/build-mac-release-media.js', 'scripts/verify-mac-release-media.js']:
            archive.add(ROOT / name, arcname='build-materials/' + name, filter=public_tar_metadata)
    files = sorted(p for p in out.iterdir() if p.is_file() and p.name != 'SHA256SUMS')
    (out / 'SHA256SUMS').write_text(''.join(f'{digest(p).hex()}  {p.name}\n' for p in files))
    for file in files:
        if file.stat().st_size >= 2 * 1024**3:
            raise RuntimeError('Asset exceeds GitHub per-file limit: ' + file.name)
    print('Release assets ready:', out)
    for file in files:
        print(f'  {file.name}: {file.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download-only', action='store_true')
    args = parser.parse_args()
    inputs, npm = collect_sources()
    print(f'Verified {len(inputs)} native source archives and {len(npm)} npm runtime inputs.')
    if not args.download_only:
        assemble(inputs, npm)
