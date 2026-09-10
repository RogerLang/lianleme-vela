# 练了么 Vela 手环端

这是「练了么」的 Xiaomi Vela 手环客户端，当前目标设备为 Xiaomi Smart Band 9 Pro（M2401B1）。

## 当前基线

当前源码、正式签名发布与完整真机回归基线均为 0.4.5：

```text
versionName 0.4.5
versionCode 18
package io.github.rogerlang.lianleme
minPlatformVersion 1200
```

0.4.5 已完成 Xiaomi Smart Band 9 Pro 真机验收。当前验证覆盖训练、调整、休息、完成、震动、退出、Launcher 图标、RIR 0–5、手机 ↔ 手环双向进度同步、断连恢复、手机 App 进程被强制结束后的进度恢复、最新训练计划下发、新旧计划交接，以及息屏再亮屏后的训练页布局恢复。完成本轮联合回归后未发现新的已知功能问题。

0.4.5 保留 Workout Protocol V1 与 `lianleme.workout.state.v3` 本地状态结构，并完成页面控制器职责拆分：纯训练计算、storage 与 interconnect transport 各自由独立模块负责。此前基于 0.4.3 发现并修复的息屏 / 亮屏训练卡片上移问题已包含在 0.4.5 中，并再次通过正式版本真机验证。0.4.4 未发布，版本直接从 0.4.3 跳到 0.4.5。

当前版本继续使用与 Android `io.github.rogerlang.lianleme` 对齐的包名与签名身份，用于 Xiaomi `system.interconnect` 身份匹配。0.2.5 及更早版本使用 `com.rogerlang.lianleme.vela`，首次迁移到当前包名时需要先卸载旧包。

公开仓库不保存个人训练计划、训练记录、GitHub Token、Android keystore 或 PEM 私钥。

## 长期下载

每个首次出现且完成 `Vela CI → Signed Vela RPK` 的版本会自动归档到 GitHub Releases。Release Assets 中的签名 `.rpk` 用于长期保存与重新安装，不受 Actions artifact 保留时间影响；同时附带 `signing-certificate.txt` 供签名指纹核对。

自动 Release 表示该 commit 已通过 CI 并生成正式签名 RPK。真机验收状态以 README 中的当前基线说明和实际设备测试结果为准。已有版本不会被后续同版本构建覆盖。

## 当前功能

- 当前动作、组进度、重量和次数展示
- 双列主操作按钮
- 完成本组
- 普通工作组完成后记录 RIR 0–5
- 热身组跳过 RIR 记录
- 独立重量 / 次数调整页
- 组间休息倒计时
- `−15 秒 / +15 秒`
- 休息页撤销上一组
- 跳过休息
- 训练结束页撤销最后一组
- 训练完成后保存最终状态并退出应用
- 未同步完成记录保存在手环，连接后继续补发
- 本地状态恢复，包括 RIR 选择页恢复
- 演示训练完成确认后，下次启动自动回到第 1 组
- 绝对时间休息校时
- 完成组、休息结束与训练完成震动反馈
- Xiaomi `system.interconnect` 双向通道
- 从 Android 接收并持久化 Planned Workout
- 新计划与旧训练冲突时暂存最新 plan，并在旧进度确认后自动交接
- plan 接收返回 `accepted / deferred` ACK，手机端可识别实际应用状态
- 手环完成组、撤销、完成训练后回传 progress snapshot
- 手机端进度变化同步回手环，并回传 `progress-ack`
- `actualRir` 作为可选进度字段双向同步
- 断连期间继续训练，连接恢复后补发当前 progress snapshot
- 息屏 / 亮屏恢复后保持训练页固定纵向几何

如果手机端暂时没有可用计划，手环保留公开演示计划作为开发 fallback。

## Workout Protocol V1

协议定义见 [`docs/WORKOUT_PROTOCOL_V1.md`](docs/WORKOUT_PROTOCOL_V1.md)。

V1 采用 workout / progress 快照：

- 手环启动或重连发送 `hello`。
- 手机回复当前 `plan`。
- 手环本地保存 plan 与训练进度。
- 新 plan 无法立即交接时返回 `deferred` ACK 并暂存，满足交接条件后自动应用。
- 手环关键训练变化后发送 `progress`。
- 手机训练进度变化后也可发送 `progress`，手环更新到对应组状态。
- 普通工作组可在 `completedRecords` 中附带可选 `actualRir`。
- 手机主 wearable bridge 统一处理实时消息与启动队列中的 `progress-ack`。
- 其他 workout identity 的 progress 不覆盖手机当前训练，会先进入持久化延后收件箱，再返回确认。
- 重新连接时再次交换当前 progress，补齐断连期间的数据。
- `workoutId + revision + planId` 完整 identity 匹配的 progress 才会修改当前训练会话。

## 代码结构

架构说明见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

当前运行时职责：

```text
src/pages/index/index.ux
  ├─ workout-runtime.js     纯训练计算与 state snapshot
  ├─ workout-store.js       system.storage owner
  ├─ workout-transport.js   system.interconnect transport owner
  └─ workout-protocol.js    Workout Protocol V1 owner
```

`index.ux` 保留页面生命周期、响应式 UI 状态、休息计时、震动与训练流程编排。CI 会阻止 `storage.get / storage.set / interconnect.instance` 重新进入页面控制器，并执行 runtime/store/transport 的可执行模块测试。

## 本地开发

要求 Node.js 20。

```bash
npm ci
npm run check
npm run build
```

`npm run check` 会生成图标、执行静态 ownership 检查，并运行 `scripts/check-modules.mjs` 的 runtime/store/transport contract tests。

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

- Pull Request：metadata / ownership / module contract 检查 + macOS 真构建 RPK。
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

`.github/workflows/release.yml`：

- Signed Vela RPK 成功后读取当前版本号。
- 若对应 `v<version>` Release 尚未存在，下载刚生成的签名 RPK 并创建永久 GitHub Release。
- 自动 Release 只声明 CI 与正式签名包归档状态，不自动声明真机验收完成。
- 已经发布过的版本保持原有归档，不会被后续同版本构建替换。

Xiaomi 互联要求 Vela 与 Android 同包名、同签名。普通 debug RPK 可以验证构建和 UI；实际手机 ↔ 手环互联测试应使用同签名 RPK。

## 维护与发布流程

后续功能修改继续通过分支、PR、CI、自动签名包的流程进入 `main`，避免直接在已验证基线上做未检查修改。

```text
PR / main 变更
→ Vela CI
→ main CI 成功
→ Signed Vela RPK 自动构建
→ 首次版本自动归档到 GitHub Release
→ 真机安装并完成全流程测试
→ 更新真机验收状态
```

## 数据边界

手机端负责 Template、Candidate Workout、Planned Workout、WorkoutSession、Session、GitHub 同步和长期数据。

手环端负责训练期间显示、完成组、RIR、临时调整、休息提醒、本地恢复和离线 progress snapshot。

手环不直接访问 GitHub，不复制手机端完整 IndexedDB 数据模型。

## 图标

当前 manifest 使用：

```json
"icon": "/common/icon.png"
```

图标由 `scripts/generate-icon.mjs` 生成，192×192 RGBA，透明四角，圆形主体视觉直径约 186px。Xiaomi Smart Band 9 Pro 真机已识别为接近系统尺寸的圆形应用图标。
