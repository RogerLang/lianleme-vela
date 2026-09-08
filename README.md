# 练了么 Vela 手环端

这是「练了么」的 Xiaomi Vela 手环客户端，当前目标设备为 Xiaomi Smart Band 9 Pro（M2401B1）。

## 当前基线

当前真机验收基线为 0.4.0：

```text
versionName 0.4.0
versionCode 14
package io.github.rogerlang.lianleme
minPlatformVersion 1200
```

0.4.0 已完成 Xiaomi Smart Band 9 Pro 真机验证，覆盖训练页、调整页、休息页、训练结束页、震动反馈、退出流程、手机 ↔ 手环 Workout Protocol V1 双向进度同步，以及圆形 Launcher 图标。包名与 Android `io.github.rogerlang.lianleme` 对齐，用于 Xiaomi `system.interconnect` 身份匹配。0.2.5 及更早版本使用 `com.rogerlang.lianleme.vela`，首次迁移到当前包名时需要先卸载旧包。

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
- 手环完成组、撤销、完成训练后回传 progress snapshot
- 手机端进度变化同步回手环，并回传 `progress-ack`
- 断连期间继续训练，连接恢复后补发当前 progress snapshot

如果手机端暂时没有可用计划，手环保留公开演示计划作为开发 fallback。

## Workout Protocol V1

协议定义见 [`docs/WORKOUT_PROTOCOL_V1.md`](docs/WORKOUT_PROTOCOL_V1.md)。

V1 采用 workout / progress 快照：

- 手环启动或重连发送 `hello`。
- 手机回复当前 `plan`。
- 手环本地保存 plan 与训练进度。
- 手环关键训练变化后发送 `progress`。
- 手机训练进度变化后也可发送 `progress`，手环更新到对应组状态。
- 接收端应用有效 progress 后发送 `progress-ack`。
- 重新连接时再次交换当前 progress，补齐断连期间的数据。
- 双方只处理与当前 `workoutId + revision` 一致的进度。

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

模拟器用于高频布局和基础交互迭代；震动、Launcher 图标、真实性能以及 `system.interconnect` 最终以 M2401B1 真机结果为准。

## CI

`.github/workflows/ci.yml`：

- Pull Request：metadata 检查 + macOS 真构建 RPK。
- `main`：检查、构建并上传 debug RPK artifact。
- `workflow_dispatch`：可手动构建 debug artifact。
- 依赖安装使用 `npm ci`，严格按 `package-lock.json` 构建。

`.github/workflows/signed-rpk.yml`：

- `main` 的 `Vela CI` 成功完成后自动触发签名 RPK 构建，不需要手动点 Run workflow。
- 自动签名只响应 `main` 的 push CI；Pull Request 不会接触签名 secrets。
- 自动签名 checkout 的是刚刚通过 CI 的准确 commit SHA，避免主分支后续变化导致构建内容错位。
- 保留 `workflow_dispatch` 作为手动兜底入口。
- 使用与 Android 正式 APK 相同的 keystore 派生 `private.pem` / `certificate.pem`。
- 签名文件只存在于 Actions 临时环境，构建后立即删除。
- 需要在本仓库 Actions secrets 中配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`。
- 输出 `lianleme-vela-signed-rpk` artifact，用于手机 ↔ 手环互联与真机测试。

Xiaomi 互联要求 Vela 与 Android 同包名、同签名。普通 debug RPK 可以验证构建和 UI；实际手机 ↔ 手环互联测试应使用同签名 RPK。

## 维护与发布流程

0.4.0 已作为当前真机基线。后续功能修改继续通过分支、PR、CI、自动签名包的流程进入 `main`，避免直接在已验收基线上做未检查修改。

```text
PR / main 变更
→ Vela CI
→ main CI 成功
→ Signed Vela RPK 自动构建
→ 下载 lianleme-vela-signed-rpk
→ 真机安装并完成全流程测试
```

版本记录见 [`CHANGELOG.md`](CHANGELOG.md)。

## 数据边界

手机端负责 Template、Candidate Workout、Planned Workout、WorkoutSession、Session、GitHub 同步和长期数据。

手环端负责训练期间显示、完成组、临时调整、休息提醒、本地恢复和离线 progress snapshot。

手环不直接访问 GitHub，不复制手机端完整 IndexedDB 数据模型。

## 图标

当前 manifest 使用：

```json
"icon": "/common/icon.png"
```

图标由 `scripts/generate-icon.mjs` 生成，192×192 RGBA，透明四角，圆形主体视觉直径约 186px。Xiaomi Smart Band 9 Pro 真机已识别为接近系统尺寸的圆形应用图标。
