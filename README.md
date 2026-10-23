# VideoCull Mac — 非官方 Apple Silicon 分支

[English](README.en.md) · [原项目](https://github.com/StippieDot/VideoCull) · [使用与构建详情](README_MAC.md) · [反馈问题](https://github.com/yosoro114514/VideoCull-Mac/issues)

> 基于 **StippieDot 和原项目贡献者开发的 VideoCull**，由 [yosoro114514](https://github.com/yosoro114514) 维护的非官方 macOS 分支。本分支不代表原作者，也不是原项目的官方 Mac 发行版。

用多帧预览快速了解本地视频，再决定保留、删除或跳过。适合整理积累的视频、录屏、相机素材和备份，不需要把视频上传到服务器。

**当前状态：实验性预览版 `2.4.0-mac.2`。** 已在 Apple Silicon / macOS 15 上验证。界面目前沿用英文。个人维护，欢迎反馈，但不承诺固定更新周期。

## 下载与安装

**[下载 Apple Silicon DMG 与配套源码](https://github.com/yosoro114514/VideoCull-Mac/releases/tag/v2.4.0-mac.2)**。打开 DMG 后，把 VideoCull 拖进 Applications；无需安装 Node.js、Homebrew 或 FFmpeg。

此预览版为**临时签名、未公证**，首次启动可能被 macOS 拦截。核对来源和发布页的 SHA-256 后，可在“系统设置 → 隐私与安全性”中查看“仍要打开”；如果系统仍拒绝运行，请反馈错误信息。详见[安装、许可证与重建说明](MAC_RELEASE.md)。

发布页同时提供应用源码、FFmpeg/x264/dav1d 对应源码、Electron/Chromium 相关源码及完整许可材料。媒体处理 FFmpeg 使用 GPL-3.0-or-later；Electron 内的另一份 FFmpeg 使用 LGPL-2.1-or-later。

## 能做什么

- **视频网格与多帧预览**：默认从不同位置抽取六帧，显示时长、大小、编码和分辨率。
- **内嵌播放**：播放、暂停、跳转；不兼容的媒体可以交给外部播放器。
- **快速整理**：保留／标记删除／跳过，支持键盘操作和撤销整理决定。
- **保存进度**：缓存预览和整理状态，重新打开原目录可继续处理。
- **Mac 适配**：Command 快捷键、Finder、废纸篓、关窗隐藏和 Dock 恢复。

评分、收藏、过滤和重复视频比较等功能继承自上游；本分支的重点验证范围是上述核心整理流程。

## 删除如何工作

按 `D` **只标记待删除，不立即删除视频**。检查待删列表并确认批量删除后，应用才尝试移入废纸篓。如果移动失败，应用会单独询问是否永久删除；取消可以保留失败的文件。

`Z` / `⌘Z` 撤销的是整理决定。已经移入废纸篓的文件请在 Finder 中恢复；永久删除无法通过应用撤销。

## 相比上游的变化

本分支从上游提交 [`c7eacd5`](https://github.com/StippieDot/VideoCull/commit/c7eacd5f0e87eff4874b55fc70cb914839353343)（2.4.0 开发线）开始，保留原 Git 历史。主要修改发生于 2026-10-22 至 2026-10-23，见 [修改与归属声明](NOTICE_MAC.md)。

| 方向 | 修改 |
| --- | --- |
| Apple Silicon | 原生 ARM64 FFmpeg/FFprobe、动态库路径处理、SQLite 与应用打包验证 |
| 系统体验 | Mac 快捷键、窗口按钮、Dock 恢复、Finder 和废纸篓文案 |
| 扫描性能 | 排除源码依赖目录；区分 `.ts` / `.mts` 文本源码与二进制视频 |
| 无效文件 | 零字节文件不启动媒体探测，失败文件跳过常规预览生成 |
| 大目录体验 | Mac 保守并发预算；大批任务优先生成首批最多 16 个文件的完整预览 |
| 自用边界 | 集中缓存，关闭上游自动更新及处理后关机／休眠操作 |

没有滚动视口动态优先队列；也不保证所有编码、媒体和存储设备都兼容。

## 从源码运行

需要 **Apple Silicon Mac、macOS 15 或更新版本**，以及 Xcode 命令行工具、Homebrew、Node.js **24.21.0**。推荐 npm **11.19.0 或更新版本**。目前验证环境为 macOS 15；更新系统版本仍需测试。

```sh
# 首次配置开发环境；已安装的工具无需重复安装。
xcode-select --install
brew install ffmpeg

# 克隆默认的 Mac 分支。
git clone --branch mac https://github.com/yosoro114514/VideoCull-Mac.git
cd VideoCull-Mac

# 如果使用 nvm，可通过 nvm install 和 nvm use 读取 .nvmrc。
npm ci
npm run dev
```

安装脚本会下载 Electron，并将本机 Homebrew 的 FFmpeg/FFprobe 与非系统动态库复制到被 Git 忽略的 `vendor/ffmpeg` 中，重写加载路径并临时签名。**Homebrew 依赖尚未固定到可复现的源码构建，构建结果会随本机工具版本变化。**

打开应用后选择 **Open Directory**。初次预览在后台生成，已有预览会复用。

| 操作 | 快捷键 |
| --- | --- |
| 保留／标记删除／跳过 | `K` / `D` / `S` |
| 撤销决定 | `Z` 或 `⌘Z` |
| 播放／暂停 | 空格 |
| 打开目录／搜索／命令面板 | `⌘O` / `⌘F` / `⌘K` |
| 保存并退出 | `⌘Q` |

红色关闭按钮隐藏窗口并保留当前会话；点击 Dock 图标恢复。退出再启动后，从最近目录中打开原目录恢复进度。

## 验证与本地打包

```sh
npm run test:mac
npm run test:mac:e2e
npm run package:mac
```

输出位于 `artifacts/packages/`：`mac-arm64/VideoCull.app` 与 `VideoCull-Mac-arm64-2.4.0-mac.2.dmg`。上述命令是 Homebrew 自用构建；公开发行请按 [MAC_RELEASE.md](MAC_RELEASE.md) 使用固定源码构建及 `package:mac:release`，并附上全部源码资产。

回归测试使用临时生成的视频和独立配置，覆盖扫描排除、坏文件跳过、首批预览、缓存复用、六帧预览、播放、保留／删除／跳过、撤销、关窗恢复、退出保存和废纸篓删除。界面测试可能在废纸篓留下合成测试视频。

GitHub Actions 配置了 Mac 检查，不上传安装包、媒体或缓存。上游 Windows 发布流程保留，但不会在此 Fork 中执行。

## 数据与支持范围

- 配置、进度与默认缓存位于 `~/Library/Application Support/VideoCull`；开发模式使用独立的 `VideoCull-dev` 配置。
- 当前仍沿用上游的数据目录名称，不要同时运行多个使用同一配置目录的 VideoCull 版本。
- 视频留在所选目录；应用不提供云端视频分析。开发依赖下载及主动打开外部链接需要网络。
- 扫描跳过 `.git`、`node_modules`、`.app` 以及含 `.videocull-ignore` 文件的目录。本源码仓库已添加该标记。
- Intel Mac、网络盘、所有外置盘文件系统与所有媒体编码尚未验证。
- Mac 使用集中缓存；自动更新及处理后关机／休眠已关闭。
- 性能与文件编码、关键帧间隔、存储介质及系统负载有关，抽样结果不代表整库处理时间。

## 贡献与反馈

请在[本分支的 Issues](https://github.com/yosoro114514/VideoCull-Mac/issues)反馈 Mac 问题，附系统版本、芯片、复现步骤以及去除个人路径后的日志。请勿公开私人视频或包含敏感信息的文件名。

参见[贡献指南](.github/CONTRIBUTING.md)、[安全问题报告方式](.github/SECURITY.md)和[行为准则](.github/CODE_OF_CONDUCT.md)。适合所有平台的修复可以独立整理后提交上游；上游是否接受不影响本分支维护。

## 归属与许可证

原项目：[StippieDot/VideoCull](https://github.com/StippieDot/VideoCull)，原作者与贡献者保留其版权；Mac 适配由 yosoro114514 维护。上游 README 原文保存在 [README_UPSTREAM.md](README_UPSTREAM.md)，其中的下载与支持说明针对原项目，不代表本分支。

继续使用 [AGPL-3.0-only](LICENSE)，并保留上游的[扩展附加许可](EXTENSION-PERMISSION.md)。第三方组件各自适用其许可证。赞助链接仍指向**原作者 StippieDot**。

`mac.1` 首发仅公开源码；`mac.2` 增加未公证的 DMG 预览版，公开包使用固定源码构建的媒体工具。对应源码、许可、构建脚本和校验值与安装包一起分发。更多说明见 [NOTICE_MAC.md](NOTICE_MAC.md) 和 [MAC_RELEASE.md](MAC_RELEASE.md)。
