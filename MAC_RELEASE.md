# Mac binary release and corresponding source

This is an unofficial Apple Silicon fork of VideoCull by StippieDot. The app remains
AGPL-3.0-only with the upstream Additional Permission for Extensions. See LICENSE,
EXTENSION-PERMISSION.md and NOTICE_MAC.md. Third-party components retain their own terms.

## 安装 / Installation

- 需要 Apple Silicon（M1 或更新芯片）和 macOS 15 或更新版本；目前测试系统为 macOS 15。
- 从本仓库的 Releases 下载 `VideoCull-Mac-arm64-<version>.dmg`，打开后把 VideoCull 拖进 Applications。
- 用户不需要安装 Node.js、Homebrew、FFmpeg 或 Xcode。
- 当前预览包为 **ad-hoc 临时签名，未经过 Apple Developer ID 签名或公证**。
  首次启动可能被 macOS 拦截。确认下载来源和 SHA-256 后，在“系统设置 → 隐私与安全性”查看是否有“仍要打开”。
  如系统仍拒绝运行，请保留错误信息反馈；不需要关闭系统整体的安全保护。
- 默认缓存和进度位于 `~/Library/Application Support/VideoCull`；退出旧版后再启动新版。
  不要同时运行两个共用这一目录的版本。升级前可备份此目录。
- `D` 只标记删除；实际批量删除另行确认。撤销整理决定不等于恢复已删除的文件。

Download the DMG from this fork's GitHub release and drag VideoCull into Applications.
This preview is ad-hoc signed and **not notarized**. macOS may block the first launch;
after checking the origin and checksum, use the system's Privacy & Security controls
if offered. No developer tools or separately installed media tools are needed.

## Release assets

Every binary release must provide all of these together, free of charge:

| Asset | Contents |
| --- | --- |
| `VideoCull-Mac-arm64-<version>.dmg` | Application and bundled notices |
| `VideoCull-Mac-<version>-source.tar.gz` | Exact release Git tree, application source, lockfile, build and packaging scripts |
| `VideoCull-Mac-<version>-dependencies.tar.gz` | FFmpeg/x264/dav1d inputs, Electron source and patches, Node.js, Chromium FFmpeg, ICU, Eigen, npm runtime package distributions, notices and provenance |
| `chromium-152.0.7977.130.tar.gz` | Matching Chromium tree including Blink and vendored third-party code (large separate archive) |
| `RELEASE-MANIFEST.json` | Application commit, source hashes, runtime binary hashes, toolchain and npm inventory |
| `THIRD_PARTY_NOTICES.txt`, `LICENSES.chromium.html`, `LICENSE.electron.txt`, `LICENSE.txt`, `EXTENSION-PERMISSION.md`, `NOTICE_MAC.md` | Redistributed copyright and license notices |
| `SHA256SUMS` | SHA-256 of every other release asset |

Both binary and source downloads are hosted on the **same GitHub release**, not only
linked to upstream servers. Source archive hashes and original origins are pinned in
`config/mac-media-sources.json` and `config/mac-runtime-sources.json`.

The app uses FFmpeg under GPL-3.0-or-later for local media processing. Its matching
source is in the dependencies archive. Electron also uses a separate FFmpeg library
under LGPL-2.1-or-later; that library's source and Electron's patch are included too.
Blink/Chromium and other third-party notices are retained in LICENSES.chromium.html.

## Rebuild the application and public media runtime

Build on Apple Silicon with Xcode Command Line Tools, Node.js from `.nvmrc`, Python 3,
GNU Make (the system make is sufficient), and pkg-config (`brew install pkgconf`).
These are build tools; Homebrew media libraries are not copied into public packages.

```sh
# In an extracted application source tree, or the checked-out release tag:
npm ci
python3 -m venv artifacts/media-build-tools
artifacts/media-build-tools/bin/pip install meson==1.12.1 ninja==1.13.2

# Optional: unpack the dependencies asset into artifacts/release-sources first.
# Otherwise the builder downloads the three checksum-pinned media source archives.
npm run build:mac:media
npm run package:mac:release

# Run the core and UI regression checks against the public media build:
VIDEOCULL_FFMPEG_DIR="$PWD/vendor/ffmpeg-release" npm run test:mac
VIDEOCULL_FFMPEG_DIR="$PWD/vendor/ffmpeg-release" npm run test:mac:e2e
```

`npm ci` retains the developer build's Homebrew media setup; if Homebrew FFmpeg is not
installed, use `npm ci --ignore-scripts` followed by `npx install-electron` instead.
The public package command verifies `vendor/ffmpeg-release`; it never takes media from
the developer's `vendor/ffmpeg` folder. All public media binaries link only Apple system
libraries/frameworks; x264 and dav1d are built from the included source and linked statically.
The source is unmodified, with the exact configure options recorded in manifest.json.
FFmpeg networking is disabled. Optional Homebrew-only codecs/filters are not included;
normal H.264, HEVC, AV1, VP8/VP9 decoding and JPEG preview generation remain available.

For an offline media rebuild, extract the dependencies archive's `archives/` files
into `artifacts/release-sources/` before running the builder. The application rebuild
may still download npm build tools and Electron. The materials do not promise a fully
offline Electron build or bit-for-bit reproduction across different Xcode/SDK versions.

## Rebuilding Electron and its LGPL library

Electron is redistributed from the official `44.7.0` arm64 release without code changes.
Its `DEPS` pins Chromium `152.0.7977.130` and Node `24.21.0`. The matching Electron archive
contains its build instructions, GN arguments and all downstream patches. In particular:

- `patches/ffmpeg/link_with_loader_path.patch` changes the dylib install name.
- `patches/chromium/` contains Electron's Chromium changes.
- `docs/development/build-instructions-gn.md` and `build-instructions-macos.md` describe
  dependency checkout, patch application, Xcode requirements and the GN/Ninja build.
- Use `build/args/release.gn` with `target_cpu = "arm64"` for the Electron application.
  Preserve the full release codec configuration when rebuilding the app's `libffmpeg.dylib`;
  `build/args/ffmpeg.gn` is the separate non-proprietary-codec build, not a drop-in promise
  of identical H.264 playback capabilities.

Place the Chromium archive at `src`, Electron at `src/electron`, the Chromium FFmpeg
archive at `src/third_party/ffmpeg`, Eigen at `src/third_party/eigen3/src`, ICU at
`src/third_party/icu`, and Node at `src/third_party/electron_node`. The gclient/DEPS
workflow fetches the remaining pinned build dependencies and applies Electron's patches.
The bundled archives are source inputs, not preconfigured gclient Git checkouts; use
the upstream workflow for a full build, or initialize matching checkouts before syncing.

Users may modify/rebuild these components. For a local test copy, replace
`VideoCull.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib`
with a compatible rebuilt library, or replace the rebuilt Electron framework as needed,
then ad-hoc sign the modified copy (`codesign --force --deep --sign - VideoCull.app`).
Replacing binaries invalidates the existing signature; no publisher key is required
for a locally rebuilt ad-hoc signed copy. The same applies to replacing the separate
executables under `Contents/Resources/ffmpeg/`. Nothing in this project prohibits
reverse engineering for debugging modifications to the LGPL-covered components.

## Maintainer release procedure

1. Update package version and both source-pin files together when dependencies change.
2. Build the public media runtime; run core tests and package the DMG.
3. Run packaged E2E tests with `VC_TEST_EXECUTABLE` pointing to the packaged executable.
   The harness removes any media override from the launched app, so bundled media is tested.
4. Mount the final DMG read-only, verify its app signature and run a smoke test from it.
5. Commit the release tree. Run `python3 scripts/prepare-mac-release.py`; it requires a
   clean tracked tree, validates source hashes, and creates the asset directory and checksums.
6. Upload **all** assets to a draft GitHub prerelease targeting that commit. Check remote
   asset sizes/digests. Keep it a draft until the declared signing status and checks are reviewed.
7. Publish as a prerelease, clearly stating the ad-hoc/not-notarized status. Never upload
   a Homebrew self-use DMG or publish binaries while omitting the matching source assets.

Developer ID signing and notarization require the maintainer's Apple Developer account
and certificate; this repository contains no credentials. A future notarized release
needs a separate signing configuration and validation, not a change to this statement alone.

References: [FFmpeg distribution guidance](https://ffmpeg.org/legal.html),
[Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing),
[upstream Electron build instructions](https://github.com/electron/electron/blob/v44.7.0/docs/development/build-instructions-gn.md).
