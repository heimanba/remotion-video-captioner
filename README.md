# Remotion Video Captioner

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

一个基于 Remotion 的视频字幕生成和编辑工具，支持多种 ASR 引擎，提供可视化字幕编辑器和 TikTok 风格的字幕渲染效果。

## ✨ 特性

- 🎬 **多种 ASR 引擎支持**：Whisper.cpp（本地）、B站必剪、剪映
- 🎨 **可视化字幕编辑器**：在开发模式下实时编辑字幕内容和时间轴
- 💅 **高度可定制的字幕样式**：通过配置文件轻松调整字体、颜色、位置等
- 🌏 **多语言支持**：支持中文、英文等多种语言的语音识别
- 🎯 **TikTok 风格字幕**：现代化的字幕渲染效果，带动画和描边
- 📦 **批量处理**：支持批量处理整个文件夹的视频

## 🚀 快速开始

### 安装依赖

```bash
bun install
```

### 启动预览

```bash
bun run dev
```

在浏览器中打开 Remotion Studio，你可以：
- 预览带字幕的视频效果
- 使用可视化编辑器调整字幕内容和时间轴
- 实时查看样式修改效果

### 渲染视频

```bash
bunx remotion render
```

## 📝 字幕生成

### 方式一：使用 B站必剪 ASR（推荐）

B站必剪提供免费的在线 ASR 服务，无需本地模型，速度快且准确度高。

**处理所有视频：**
```bash
node sub-bcut.mjs
```

**处理单个视频：**
```bash
node sub-bcut.mjs public/video.mp4
```

**处理指定文件夹：**
```bash
node sub-bcut.mjs public/my-videos
```

### 方式二：使用剪映 ASR

剪映 ASR 同样提供在线服务，适合中文视频。

```bash
node jianying.mjs [视频路径]
```

### 方式三：使用 Whisper.cpp（本地）

Whisper.cpp 在本地运行，首次使用会自动下载模型（约 1.5GB）。

```bash
node sub-whisper.mjs [视频路径]
```

**配置 Whisper 模型：**

编辑 `whisper-config.mjs` 文件：

```javascript
// 选择模型（影响准确度和速度）
export const WHISPER_MODEL = "large-v2";  // 可选：tiny, base, small, medium, large-v2, large-v3

// 设置语言
export const WHISPER_LANG = "zh";  // 中文
// export const WHISPER_LANG = "en";  // 英文
```

**模型对比：**

| 模型 | 磁盘占用 | 内存占用 | 速度 | 准确度 |
|------|---------|---------|------|--------|
| tiny | 75 MB | ~390 MB | 最快 | 较低 |
| base | 142 MB | ~500 MB | 快 | 中等 |
| small | 466 MB | ~1.0 GB | 中等 | 良好 |
| medium | 1.5 GB | ~2.6 GB | 较慢 | 很好 |
| large-v2 | 2.9 GB | ~4.7 GB | 慢 | 最佳 |

> 💡 **提示**：对于非英语语言，请使用不带 `.en` 后缀的模型（如 `medium` 而非 `medium.en`）

## 🎨 字幕样式定制

编辑 `src/captioner-config.ts` 文件来自定义字幕样式：

```typescript
export const captionerConfig = {
  // 字体设置
  font: {
    family: "Inter",           // 字体名称
    size: 52,                  // 字体大小 (px)
    lineHeight: 1.5,           // 行高
  },

  // 颜色设置
  colors: {
    text: "#6EE7B7",           // 文字颜色（薄荷绿）
    stroke: "rgba(0, 0, 0, 0.9)",  // 描边颜色
    background: "rgba(0, 0, 0, 0.98)",  // 背景颜色
  },

  // 描边设置
  stroke: {
    width: 2,                  // 描边宽度 (px)
  },

  // 位置设置
  position: {
    bottom: 20,                // 距离底部距离 (px)
    height: 100,               // 容器高度 (px)
    maxWidthRatio: 1.0,        // 最大宽度占视频宽度的比例
  },

  // 容器样式
  container: {
    paddingVertical: 20,       // 垂直内边距 (px)
    paddingHorizontal: 40,     // 水平内边距 (px)
    borderRadius: 16,          // 圆角 (px)
  },

  // 动画设置
  animation: {
    enterDuration: 10,         // 入场动画时长 (帧)
    damping: 150,              // 弹簧阻尼
    initialScale: 0.95,        // 初始缩放
    initialTranslateY: 20,     // 初始 Y 偏移 (px)
  },

  // 字幕处理设置
  processing: {
    maxCharsPerLine: 42,       // 每行最大字符数
  },
};
```

修改配置后，在 Remotion Studio 中可以实时预览效果。

## 🛠️ 字幕编辑

### 在开发模式下编辑

1. 启动开发服务器：`bun run dev`
2. 在 Remotion Studio 中打开视频
3. 使用内置的字幕编辑器：
   - 点击字幕文本进行编辑
   - 拖动时间轴调整字幕时间
   - 添加、删除或合并字幕片段
4. 点击"导出"按钮保存修改

### 字幕文件格式

字幕以 JSON 格式存储在 `public` 目录中，与视频文件同名：

```json
[
  {
    "text": "这是第一句字幕",
    "startMs": 0,
    "endMs": 2000,
    "timestampMs": null,
    "confidence": 1
  },
  {
    "text": "这是第二句字幕",
    "startMs": 2000,
    "endMs": 4500,
    "timestampMs": null,
    "confidence": 1
  }
]
```

也支持 SRT 格式的字幕文件，会自动转换为 JSON 格式。

## 📁 项目结构

```
remotion-video-captioner/
├── public/                    # 视频和字幕文件
│   ├── video.mp4             # 示例视频
│   └── video.json            # 对应的字幕文件
├── src/
│   ├── CaptionedVideo/       # 字幕视频组件
│   │   ├── index.tsx         # 主组件
│   │   ├── SubtitlePage.tsx  # 字幕渲染
│   │   └── SubtitleEditor.tsx # 字幕编辑器
│   ├── captioner-config.ts   # 字幕样式配置
│   ├── Root.tsx              # Remotion 根组件
│   └── index.ts              # 入口文件
├── sub-bcut.mjs              # B站必剪 ASR 脚本
├── jianying.mjs              # 剪映 ASR 脚本
├── sub-whisper.mjs           # Whisper.cpp ASR 脚本
├── whisper-config.mjs        # Whisper 配置
└── remotion.config.ts        # Remotion 配置
```

## 🎯 使用场景

- 📱 **短视频制作**：为 TikTok、抖音等平台的视频添加字幕
- 🎓 **教育内容**：为教学视频自动生成字幕
- 🎤 **访谈节目**：快速为访谈、播客添加字幕
- 🌐 **多语言内容**：为视频生成多语言字幕

## 🔧 高级配置

### 视频输出设置

编辑 `src/Root.tsx` 修改视频尺寸：

```typescript
<Composition
  id="CaptionedVideo"
  component={CaptionedVideo}
  width={1920}      // 视频宽度
  height={1080}     // 视频高度
  defaultProps={{
    src: staticFile("video.mp4"),
  }}
/>
```

### Remotion 配置

编辑 `remotion.config.ts` 进行全局配置：

```typescript
Config.setVideoImageFormat("jpeg");  // 视频帧格式
Config.setOverwriteOutput(true);     // 覆盖已存在的输出文件
```

## 📚 相关资源

- [Remotion 官方文档](https://www.remotion.dev/docs)
- [Remotion Discord 社区](https://remotion.dev/discord)
- [Whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)

## 🐛 问题反馈

如果遇到问题，请在 [GitHub Issues](https://github.com/remotion-dev/remotion/issues) 提交反馈。

## 📄 许可证

本项目基于 Remotion 构建。注意：某些使用场景可能需要 Remotion 的商业许可证。详情请查看 [Remotion 许可证条款](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
