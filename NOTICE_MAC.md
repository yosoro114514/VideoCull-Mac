# Attribution and modification notice

## Original work

VideoCull was created by **StippieDot**, with contributions from the authors recorded in the upstream Git history.

- Upstream: https://github.com/StippieDot/VideoCull
- Fork base: `c7eacd5f0e87eff4874b55fc70cb914839353343` (upstream 2.4.0 development line)
- The original copyright notices, `LICENSE`, `EXTENSION-PERMISSION.md`, and upstream commit ancestry are retained.
- `README_UPSTREAM.md` preserves the upstream README as it appeared at the fork base. It describes upstream releases, not this Mac fork.

## Modified version

**VideoCull Mac**, maintained by **yosoro114514**, is an unofficial community fork. It is not an official release, endorsement, or support commitment from StippieDot.

Modifications made on **2026-10-22 and 2026-10-23**, published as source version **2.4.0-mac.1**:

- Apple Silicon media runtime bundling, relative dynamic-library load paths, ad-hoc signing, native SQLite packaging and macOS build configuration.
- Mac shortcuts, window lifecycle, Finder and Trash integration, centralized cache, and platform-specific settings.
- Source-directory exclusions, TS/MTS text detection, failed/empty-media handling, Mac concurrency and decoder tuning, and early batch previews.
- Regression tests, bilingual documentation, fork-specific support/source links and a Mac validation workflow.

The fork remains under AGPL-3.0-only with the upstream Additional Permission for Extensions. Copyright in modifications belongs to their respective contributors. Original branding/assets remain attributed to their original authors; no claim of exclusive ownership over the upstream work is made.

## Third-party software and source-only publication

This initial public version distributes source code, build recipes and the existing upstream assets. It does **not** publish the local application bundles, DMGs, FFmpeg executables, shared libraries, caches, private videos, or test outputs.

Local build scripts copy the builder's Homebrew FFmpeg and dependent libraries, preserving available license texts and recording versions/hashes in an ignored local manifest. This is a local build mechanism, **not a complete public binary-distribution compliance package**. A homepage link, hashes or license texts alone do not replace any required Corresponding Source.

Before publishing binary releases, the distributor must review each included component's license and provide the matching Corresponding Source and build materials as required, including the GPL-enabled FFmpeg build and relevant libraries. Binary release work also includes reproducible dependency inputs, release verification, macOS signing and notarisation. No prebuilt release is promised by this source publication.

Upstream documentation screenshots use Blender Open Movie footage under the applicable attribution licenses; retain the credits alongside any reused screenshots. Existing donation links are explicitly for the original author, StippieDot.
