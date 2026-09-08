# 练了么 Vela 手环端

这是「练了么」的 Xiaomi Vela 手环客户端，当前目标设备为 Xiaomi Smart Band 9 Pro（M2401B1）。

## 当前基线

当前公开仓库从已经完成真机验证的 0.2.5 基线迁移而来：

```text
versionName 0.2.5
versionCode 8
package com.rogerlang.lianleme.vela
```

公开仓库中的训练内容使用演示数据。个人训练计划、训练记录、GitHub Token 和手机端私有数据不进入本仓库。

## 当前功能

- 当前动作、组进度、重量和次数展示
- 双列主操作按钮
- 完成本组
- 重量 / 次数临时调整
- 组间休息倒计时
- `−15 秒 / +15 秒`
- 撤销上一组
- 跳过休息
- 实际重量 / 次数记录
- 本地状态恢复
- 绝对时间休息校时
- 完成组、休息结束与训练完成震动反馈
- 训练完成页

手机 Planned Workout 同步、断连事件队列和正式训练记录回传将在后续手机 ↔ 手环联动阶段接入。

## 本地开发

要求 Node.js 20。

```bash
npm install
npm run check
npm run build
```

`npm run build` 会先确定性生成 `src/common/icon.png`，然后调用 Xiaomi `aiot-toolkit` 构建 RPK。生成产物位于 `dist/`。

## CI

GitHub Actions 使用 macOS runner：

- Pull Request：执行 metadata 检查并真实构建 RPK。
- `main`：执行检查、构建并上传 RPK artifact。
- `workflow_dispatch`：可手动构建并上传 artifact。

Public 仓库使用 GitHub 标准 hosted runner，不占用私有主仓库的 Actions 额度。

## 数据边界

手机端负责 Template、Candidate Workout、Planned Workout、WorkoutSession、Session、GitHub 同步和长期数据。

手环端负责训练期间显示、完成组、临时调整、休息提醒、本地恢复，以及后续离线 action 缓存。

正式手机 ↔ 手环协议接入后，优先交换紧凑 workout snapshot 与语义 action，不复制手机端完整 IndexedDB 数据模型。

## 图标

当前 manifest 使用：

```json
"icon": "/common/icon.png"
```

图标由 `scripts/generate-icon.mjs` 生成。Band 9 Pro Launcher 当前仍以方形外轮廓显示该 RPK 图标，因此暂不继续处理圆形 Launcher 图标。
