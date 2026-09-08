# 练了么 Vela 手环端

这是「练了么」的 Xiaomi Vela 手环客户端，当前目标设备为 Xiaomi Smart Band 9 Pro（M2401B1）。

## 当前基线

当前实机测试基线为 0.3.0：

```text
versionName 0.3.0
versionCode 9
package io.github.rogerlang.lianleme
minPlatformVersion 1200
```

0.3.0 接入手机 ↔ 手环 Workout Protocol V1，并完成训练、调整、休息与训练结束四个主要界面。包名与 Android `io.github.rogerlang.lianleme` 对齐，这是 Xiaomi `system.interconnect` 的要求。0.2.5 及更早版本使用 `com.rogerlang.lianleme.vela`，第一次安装 0.3.0 真机包前需要先卸载旧包。

公开仓库不保存个人训练计划、训练记录、GitHub Token、Android keystore 或 PEM 私钥。

## 当前功能

- 当前动作、组进度、重量和次数展示
- 双列主操作按钮
- 完成本组
- 独立重量 / 次数调整页
- 组间休息倒计时
- `−15 秒 / +15 秒`
- 休息页撤销上一组
- 跳过休息
- 训练结束页撤销最后一组
- 训练完成后保存最终状态并退出应用
- 未同步完成记录保存在手环，连接后继续补发
- 本地状态恢复
- 演示训练完成确认后，下次启动自动回到第 1 组
- 绝对时间休息校时
- 完成组、休息结束与训练完成震动反馈
- Xiaomi `system.interconnect` 双向通道
- 从 Android 接收并持久化 Planned Workout
- 完成组、撤销、完成训练后回传 progress snapshot
- 断连期间继续训练，连接恢复后补发当前 progress snapshot

如果手机端暂时没有可用计划，手环保留公开演示计划作为开发 fallback。

## Workout Protocol V1

协议定义见 [`docs/WORKOUT_PROTOCOL_V1.md`](docs/WORKOUT_PROTOCOL_V1.md)。

V1 采用 workout / progress 快照：

- 手环启动或重连发送 `hello`。
- 手机回复当前 `plan`。
- 手环本地保存 plan 与训练进度。
- 每次完成组、撤销、训练完成等关键变化后发送 `progress`。
- 重新连接时再次发送完整 progress，补齐离线期间的数据。
- 手机只接收与当前 `workoutId + revision` 一致的进度。

## 本地开发

要求 Node.js 20。

```bash
npm ci
npm run check
npm run build
```

`npm run build` 会先生成 `src/common/icon.png`，再调用 Xiaomi `aiot-toolkit` 构建 RPK。产物位于 `dist/`。

### Smart Band 9 Pro 模拟器

日常 UI 调整推荐直接使用 Xiaomi AIoT-IDE 的 Vela 模拟器。目标真机参数：

```text
Xiaomi Smart Band 9 Pro (M2401B1)
336 × 480 px
rectangular
screen DPI 336
DPR 2.1
designWidth 336
```

推荐使用 `vela-watch-4.0` 镜像创建 `band` 类型的 336×480 Custom 模拟器。详细配置和调试流程见 [`docs/SMART_BAND_9_PRO_EMULATOR.md`](docs/SMART_BAND_9_PRO_EMULATOR.md)。

模拟器用于高频布局和基础交互迭代；震动、Launcher 图标、真实性能以及 `system.interconnect` 最后仍在 M2401B1 真机验收。

## CI

`.github/workflows/ci.yml`：

- Pull Request：metadata 检查 + macOS 真构建 RPK。
- `main`：检查、构建并上传 debug RPK artifact。
- `workflow_dispatch`：可手动构建 debug artifact。
- 依赖安装使用 `npm ci`，严格按 `package-lock.json` 构建。

`.github/workflows/signed-rpk.yml`：

- 仅手动运行，并且只允许 `main`。
- 使用与 Android 正式 APK 相同的 keystore 派生 `private.pem` / `certificate.pem`。
- 签名文件只存在于 Actions 临时环境，构建后立即删除。
- 需要在本仓库 Actions secrets 中配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`。
- 输出 `lianleme-vela-signed-rpk` artifact，用于手机 ↔ 手环互联与真机测试。

Xiaomi 互联要求 Vela 与 Android 同包名、同签名。普通 debug RPK 可以验证构建和 UI；实际手机 ↔ 手环互联测试应使用同签名 RPK。

## 发布前检查

当前 0.3.0 已作为首轮真机测试基线冻结。发布前只做构建、签名与真机验收，不再进行大范围代码重构。

建议顺序：

```text
npm ci
npm run check
npm run build
GitHub Actions → Signed Vela RPK → Run workflow → confirm
真机安装并完成全流程测试
```

## 数据边界

手机端负责 Template、Candidate Workout、Planned Workout、WorkoutSession、Session、GitHub 同步和长期数据。

手环端负责训练期间显示、完成组、临时调整、休息提醒、本地恢复和离线 progress snapshot。

手环不直接访问 GitHub，不复制手机端完整 IndexedDB 数据模型。

## 图标

当前 manifest 使用：

```json
"icon": "/common/icon.png"
```

图标由 `scripts/generate-icon.mjs` 生成。Band 9 Pro Launcher 当前仍以方形外轮廓显示该 RPK 图标，因此暂不继续处理圆形 Launcher 图标。
