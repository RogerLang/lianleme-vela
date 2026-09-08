# Xiaomi Smart Band 9 Pro 模拟器配置

目标真机：**Xiaomi Smart Band 9 Pro（M2401B1）**。

本项目的 UI 以该设备为主目标。官方 Vela 设备资料给出的关键屏幕参数如下：

| 参数 | 值 |
| --- | --- |
| 屏幕类型 | 矩形 AMOLED |
| 分辨率 | 336 × 480 px |
| PPI / screen DPI | 336 |
| DPR | 2.1 |
| device width | 168 dp |
| Vela `designWidth` | 336 |

`src/manifest.json` 已使用 `config.designWidth = 336`，不要为了模拟器改成其他基准宽度。

## 推荐模拟器方案

使用 Xiaomi 官方 **AIoT-IDE**，模拟器镜像选择：

```text
vela-watch-4.0
```

该镜像支持手环设备以及 Custom 自定义设备。`vela-miwear-watch-4.0` / `vela-miwear-watch-5.0` 当前只支持 xiaomiWatch 466×466 规格，不适合作为 Band 9 Pro 的主布局模拟环境。

### 创建 Custom 模拟器

在 AIoT-IDE 的「设备」→「新建模拟器」中创建：

```text
Name: Xiaomi Smart Band 9 Pro
Image: vela-watch-4.0
Device type / flavor: band
Width: 336
Height: 480
Shape: rect / rectangular
Screen DPI: 336
```

如果当前 IDE 版本还要求填写离散的 emulator density，优先选最接近真机的 `340`；布局缩放仍由 336×480 和项目 `designWidth: 336` 决定。

矩形圆角可以先使用 IDE 默认值。布局验收重点放在 336×480 可视区域；Launcher 外框、玻璃边缘和真机屏幕物理圆角留到真机终验。

> 不要用 `xiaomi10Band` 作为 Band 9 Pro 的布局基线。Smart Band 10 是 212×520 的胶囊屏，与 9 Pro 的 336×480 矩形屏差异明显。

如果 AIoT-IDE 中的内置 `xiaomiBandpro` profile 显示为 336×480，也可以直接使用；若尺寸无法确认，使用上面的 Custom 配置最明确。

## 第一次运行

1. 用 AIoT-IDE 打开仓库根目录。
2. 按 IDE 引导安装项目依赖并初始化模拟器环境。
3. 在「设备」中创建上面的 Band 9 Pro Custom 模拟器。
4. 顶部点击「选择设备」，选中 `Xiaomi Smart Band 9 Pro`。
5. 点击「调试」。
6. 模拟器启动后，当前项目会自动编译并推送到模拟器。
7. 使用底部调试面板查看 Console、DOM 和运行日志。

本项目本地依赖仍可提前安装：

```bash
npm install
npm run check
```

## 日常 UI 迭代流程

推荐把日常布局调整压缩为：

```text
改 UX / CSS
→ AIoT-IDE 调试
→ 336×480 模拟器立即验收
→ 累积一批改动后再打 RPK 上真机
```

模拟器主要用于检查：

- 双列按钮宽度、间距和点击区域
- 卡片高度、内外边距
- 字体大小和换行
- 页面滚动与内容溢出
- 休息倒计时页面排版
- 训练完成页面排版
- 不同动作名称长度下的布局
- 页面切换和基础交互

当前应用在手机计划不可用时会保留公开演示计划作为开发 fallback，因此只做 UI 时不需要先连 Android 手机。

## 仍需真机验收的项目

以下行为不要只依赖模拟器判断：

- 真实帧率、滚动手感和启动速度
- 震动强度与节奏
- Launcher 应用图标裁切
- `system.interconnect` 手机 ↔ 手环互联
- 休眠 / 唤醒后的状态恢复
- 真机系统字体、触摸边缘和固件差异

手机 ↔ 手环互联测试仍需使用与 Android APK 同包名、同签名的 RPK。

## manifest 中为什么还是 `watch`

当前 Xiaomi Vela JS manifest 的 `deviceTypeList` 文档只支持 `watch`。AIoT-IDE 的模拟器自身可以选择 `band` 类型，这两处配置用途不同，因此项目继续保留：

```json
"deviceTypeList": [
  "watch"
]
```

不要把 manifest 改成 `band`。
