# VideoCull Mac — unofficial Apple Silicon fork

[简体中文](README.md) · [Upstream](https://github.com/StippieDot/VideoCull) · [Issues](https://github.com/yosoro114514/VideoCull-Mac/issues)

This is an **unofficial macOS community fork** of VideoCull, originally developed by **StippieDot and upstream contributors**, maintained here by [yosoro114514](https://github.com/yosoro114514). It is not an official or endorsed Mac release.

Review local video collections with a multi-frame grid, embedded playback, Keep / Delete / Skip decisions, undo, and saved progress. Videos stay local. The interface is currently in English.

**Status:** experimental source release `2.4.0-mac.1`; tested on Apple Silicon with macOS 15. No prebuilt downloads are published by this fork yet. Maintained on a best-effort basis.

## What changed

Based on upstream commit [`c7eacd5`](https://github.com/StippieDot/VideoCull/commit/c7eacd5f0e87eff4874b55fc70cb914839353343), retaining upstream Git history:

- Apple Silicon FFmpeg/FFprobe, relocated shared libraries, native SQLite and Mac packaging checks.
- Command shortcuts, native window controls, close-to-hide, Dock restoration, Finder and Trash integration.
- Exclude source/dependency directories; distinguish `.ts`/`.mts` source text from binary video.
- Avoid probing empty files and generating frames for failed media probes.
- Conservative Mac concurrency and complete previews for the first batch of up to 16 files before processing the rest of a large metadata queue.
- Centralised cache only; upstream auto-updates and post-processing shutdown/sleep actions disabled.

There is no dynamic viewport-based scheduling. Ratings, favourites, filtering and duplicate comparison are inherited features, with narrower validation than the core review flow.

## Build from source

Requires Apple Silicon, macOS 15 or newer, Xcode Command Line Tools, Homebrew, Node.js **24.21.0**, and preferably npm **11.19.0+**. macOS 15 is the tested baseline; other versions still need testing.

```sh
xcode-select --install  # Only if Command Line Tools are not installed.
brew install ffmpeg
git clone --branch mac https://github.com/yosoro114514/VideoCull-Mac.git
cd VideoCull-Mac
# With nvm: nvm install && nvm use
npm ci
npm run dev
```

The install script downloads Electron and copies locally installed Homebrew FFmpeg/FFprobe and their non-system libraries into ignored `vendor/ffmpeg/`. It relocates load paths and applies ad-hoc signatures. Homebrew inputs are not yet pinned for reproducible builds; your local tool versions affect the output.

```sh
npm run test:mac
npm run test:mac:e2e
npm run package:mac
```

Local outputs: `artifacts/packages/mac-arm64/VideoCull.app` and `artifacts/packages/VideoCull-Mac-arm64-2.4.0-mac.1.dmg`. These are ad-hoc signed and **not notarised**. GitHub Actions runs Mac validation without publishing binaries. The inherited Windows publishing jobs are disabled in this fork.

Tests use generated media and isolated profiles. Coverage includes mixed-library scanning, failed media, early previews, cache reuse, playback, decisions, undo, persistence, window lifecycle and Trash deletion. GUI tests may leave generated clips in Trash.

## Usage and deletion

Select **Open Directory**. Initial previews are generated in the background and reused later.

- `K`: keep; `D`: mark for deletion; `S`: skip; `Z` / `⌘Z`: undo a review decision.
- Space: play/pause; `⌘O`: open; `⌘F`: search; `⌘K`: command palette.
- Red close button hides the session; the Dock restores it. `⌘Q` saves and quits. Reopen the original folder from recent folders to resume.

**Marking Delete does not remove a file.** Inspect and confirm the batch to move files to Trash. If that fails, permanent deletion requires a separate confirmation. Review undo does not restore physically deleted files; use Finder to restore from Trash. Permanent deletion cannot be undone by the app.

## Data and limitations

Settings and default cache live under `~/Library/Application Support/VideoCull`; development uses `VideoCull-dev`. The upstream profile name is retained, so do not run different editions against the same profile simultaneously. The app does not provide cloud video analysis; dependency downloads and user-opened external links need network access.

The scanner skips `.git`, `node_modules`, `.app` bundles and directories containing `.videocull-ignore`. Intel Macs, network shares, all external-drive filesystems and all codecs are not validated. Unsupported playback can be handed to an external player. Performance depends on codecs, seeking cost, storage and system load.

## Contributing and attribution

Report Mac-fork issues [here](https://github.com/yosoro114514/VideoCull-Mac/issues), with OS/chip details and redacted logs. Do not upload private media. See [Contributing](.github/CONTRIBUTING.md), [Security](.github/SECURITY.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md).

Original VideoCull is by **StippieDot and upstream contributors**, whose copyright and history are retained. The original README is preserved in [README_UPSTREAM.md](README_UPSTREAM.md); its download and support links refer to upstream. Existing sponsorship links support **StippieDot**, not the fork maintainer.

Licensed under [AGPL-3.0-only](LICENSE), retaining the upstream [Additional Permission for Extensions](EXTENSION-PERMISSION.md). Third-party components retain their own licenses. See [NOTICE_MAC.md](NOTICE_MAC.md) for dated modification notices and the source-only publication boundary.
