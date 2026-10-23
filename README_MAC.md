# VideoCull — Apple Silicon 非官方社区版

基于 StippieDot/VideoCull 的 `c7eacd5`，保留上游视频网格、多帧预览、内嵌播放、保留／删除／跳过、撤销、标签评分与进度保存。适配日期：2026-10-22。

## 使用

打开 `VideoCull.app`，点击 **Open Directory** 选择视频目录。扫描后自动生成预览；第一次生成需要等待，之后复用缓存。

- 点击视频进入逐个查看：`K` 保留，`D` 标记待删除，`S` 跳过，`Z` 撤销。
- 空格播放／暂停，方向键切换或在播放时跳转；也可以点击 Play。
- `⌘F` 搜索，`⌘O` 打开目录，`⌘K` 打开命令面板，`⌘Z` 撤销。
- **标记删除不会删除原文件。** 最后点击批量删除按钮并确认，才会移到废纸篓。如果移入失败，会单独询问是否永久删除；取消则保留失败的文件。
- 关闭红色窗口按钮会隐藏窗口并保留当前会话；点击 Dock 图标继续。`⌘Q` 保存后退出。重新打开应用，在最近目录中选择原目录即可恢复已保存的决定。
- 内嵌播放器不支持的编码可用外部播放器打开。

此版本使用集中缓存，默认位于 `~/Library/Application Support/VideoCull/video-cache`；原视频保持原位置。界面沿用上游英文版本。

## 支持范围

只针对 Apple Silicon 构建和验证。已关闭上游自动更新及处理完成后关机／休眠；“防止处理期间自动休眠”仍可使用。应用采用本机临时签名，未进行 Apple 公证，不是上游官方发行版。

视频工具与其动态库已经包含在应用中，运行应用无需 Node、Homebrew 或网络。源码构建需要这些开发工具。

## 构建

在 Apple Silicon Mac 上安装 Node 24.21+、npm 11.19+、Xcode 命令行工具及 Homebrew FFmpeg，然后：

```sh
npm ci
npm run test:mac
npm run test:mac:e2e
npm run package:mac
```

`npm ci` 的安装脚本安装 Electron，并将本机 Homebrew FFmpeg/FFprobe 及其非系统动态库复制到 `vendor/ffmpeg`，重写相对加载路径、临时签名并保留许可文本和来源摘要。Homebrew 默认目录为 `/opt/homebrew`，可通过 `VIDEOCULL_HOMEBREW_PREFIX` 指定。更新本机视频工具后可执行 `npm run bundle:mac-media`。

输出：`artifacts/packages/mac-arm64/VideoCull.app` 和 `artifacts/packages/VideoCull-Mac-arm64-2.4.0-mac.2.dmg`。打包过程会在真正的应用包内验证 SQLite 主进程及后台线程读写。上述为自用构建；公开发布使用 [MAC_RELEASE.md](MAC_RELEASE.md) 中的固定源码流程。

验证打包后的完整程序：

```sh
VC_TEST_EXECUTABLE="$PWD/artifacts/packages/mac-arm64/VideoCull.app/Contents/MacOS/VideoCull" \
  npx playwright test tests/e2e/mac-personal.spec.ts tests/e2e/delete-safety.spec.ts \
  tests/e2e/relaunch-persistence.spec.ts tests/e2e/review-shortcuts.spec.ts tests/e2e/smoke.spec.ts tests/e2e/large-library.spec.ts
```

界面测试使用临时生成的视频和独立配置目录。删除测试只处理这些测试文件，可能在废纸篓留下测试视频。

## 已知验证边界

Mac 专用测试覆盖六帧预览、中文及特殊字符路径、内嵌播放与跳转、留删跳过及撤销、关窗和 Dock 恢复、重新启动后的决定与缓存、废纸篓删除。未验证 Intel Mac、每一种媒体编码、网络盘及所有外置盘文件系统。

上游全套测试有部分硬编码 Windows 盘符的用例，不能原样作为 Mac 验收标准；`test:mac` 是此版本的定向检查，并保留原上游测试。

## 许可

保留上游 AGPL-3.0-only 许可，见 `LICENSE` 和 `NOTICE_MAC.md`。应用内附带第三方许可；此版本为非官方社区适配；保留原项目的附加扩展许可，见 `EXTENSION-PERMISSION.md`。

## 大目录性能优化（2026-10-22）

- 递归扫描跳过 `.git`、`node_modules`、`.app` 应用包，以及含 `.videocull-ignore` 文件的目录。本源码目录已经添加该标记。
- `.ts`／`.mts` 读取少量文件头区分文本源码和二进制视频；真实 TS/MTS 视频仍可导入。
- 零字节文件保留在列表，不启动探测程序；本轮探测失败的文件跳过预览生成，保留失败记录。修复文件并重新扫描，或主动重新生成，可以再次尝试。
- Mac 自动并发在 16 GB 及以上内存的机器最多 4 路，较小内存最多 2 路，每路最多使用 4 个解码线程。设置中仍可手动降低并发。
- 首次处理大目录时，先读取首批最多 16 个文件并生成完整多帧预览，再继续余下队列；不是滚动视口动态调度。
- 沿用已有缓存、整理状态和原文件位置，不清除旧进度。

只读扫描一组本地测试目录：任务数由 3,886 降到 363，其中 3 个为空文件。混合目录回归测试验证源码排除、坏文件不抽帧、首批预览提前出现，以及重启后无需重新探测或抽帧。

抽样性能对比：本机 12 个真实视频共约 15.06 GB，生成 72 张预览，旧单路方式约 8.22 秒，4 路任务／每路 4 解码线程约 4.39 秒。只代表这组本地、已预热文件的抽帧速度，不代表整库首次处理时间。

公开仓库：https://github.com/yosoro114514/VideoCull-Mac 。`mac.1` 首发为源码版，`mac.2` 增加未公证安装包预览版及配套源码材料。Homebrew 自用构建与公开发行构建分开；后者使用固定源码和哈希，但不保证跨 Xcode/SDK 逐字节一致。已验证 macOS 15 / Apple Silicon；其他系统版本不作兼容承诺。下载和安装说明见 [MAC_RELEASE.md](MAC_RELEASE.md)。
