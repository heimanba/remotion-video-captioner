# Remotion Video Captioner

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

一个基于 Remotion 的视频字幕生成和编辑工具，采用**本地优先**策略，支持多种 ASR 引擎，提供可视化字幕编辑器和 TikTok 风格的字幕渲染效果。

> **系统要求**：本项目针对 **macOS M1/M2 (Apple Silicon)** 优化，充分利用 MPS/CoreML 加速实现高速语音识别和视频渲染。

## ✨ 特性

- 🎬 **多种 ASR 引擎支持**：
  - **Qwen3-ASR**（本地优先，中文推荐）：阿里云开源，M1 MPS 加速，中文效果最佳
  - **Whisper.cpp**（本地备选）：OpenAI 开源，CoreML 加速，轻量级
  - **B站必剪/剪映**（在线测试）：快速测试用
- 🎙️ **TTS 语音合成**：支持阿里云百炼 Qwen3-TTS，可将字幕合成为自然语音
- 🎨 **可视化字幕编辑器**：所见即所得，双击即可编辑，实时预览效果
- 💅 **高度可定制的字幕样式**：字体、颜色、位置、动画完全可控
- 🌏 **多语言支持**：针对中文深度优化，支持简繁体识别
- 📦 **批量处理**：支持批量处理整个文件夹的视频
- ⚡ **M1/M2 原生加速**：ASR 识别速度提升 3-5 倍

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备视频

```bash
cp your-video.mp4 public/
```

### 3. 生成字幕（推荐 Qwen3-ASR）

```bash
# 进入 qwen3-asr 目录
cd qwen3-asr

# 安装 Python 依赖
uv sync --dev

# 下载模型（首次需要，约 2.4GB）
modelscope download --model Qwen/Qwen3-ASR-0.6B --local_dir ./models/Qwen3-ASR-0.6B
modelscope download --model Qwen/Qwen3-ForcedAligner-0.6B --local_dir ./models/Qwen3-ForcedAligner-0.6B

# 生成字幕
uv run python main.py ../public/your-video.mp4

# 返回项目根目录
cd ..
```

### 4. 启动编辑器

```bash
npx remotion studio
```

在浏览器中打开 Remotion Studio，你可以：
- **实时预览**：字幕与视频同步播放
- **所见即所得编辑**：双击字幕直接修改文本
- **时间轴调整**：拖拽面板精确调整字幕时间
- **样式实时预览**：修改配置即时查看效果

### 5. 导出视频

```bash
npx remotion render CaptionedVideo out/output.mp4
```

---

### 为什么选择 Remotion？

传统字幕烧录方案（如 ffmpeg）每次修改都要重新渲染整个视频（3-5分钟），而 Remotion 提供**所见即所得**的编辑体验：

| 对比维度 | ffmpeg 烧录 | Remotion Studio |
|---------|------------|-----------------|
| 编辑体验 | 盲改，改完渲染才知道效果 | 所见即所得，实时预览 |
| 修改成本 | 改一个字也要重新渲染 | 编辑完成一次性导出 |
| 字幕样式 | ASS/SSA 格式，样式受限 | React 组件，动画任意定制 |
| 时间调整 | 手改时间戳，反复试错 | 可视化时间轴，精确到帧 |

## 📝 字幕生成

### 方案对比

| 方案 | 运行环境 | 依赖复杂度 | macOS 优化 | 中文效果 | 推荐度 |
|------|---------|-----------|-----------|---------|--------|
| **Qwen3-ASR** | Python + PyTorch | 中，需 Python 环境 | ✅ MPS 加速 (M1 原生) | ⭐⭐⭐ 中文专用优化 | **主力推荐** |
| **Whisper.cpp** | 纯 C/C++ 二进制 | 低，无运行时依赖 | ✅ CoreML 加速 (M1 原生) | ⭐⭐ 需 prompt 优化 | 备选方案 |
| 必剪 ASR | 在线服务 | 低，需网络 | 无需优化 | ⭐⭐⭐ 中文优化 | 快速测试 |

### 方式一：Qwen3-ASR（本地优先，中文推荐）

[Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) 是阿里云通义千问团队推出的开源语音识别模型，针对中文场景深度优化。

**核心优势：**
- 原生支持简体中文，无需 prompt 调整
- 内置 ForcedAligner，精确到字符级时间戳
- M1 Mac 自动启用 MPS 加速，1 分钟视频识别仅需 5-8 秒

**安装配置：**

```bash
# 1. 进入 qwen3-asr 目录
cd qwen3-asr

# 2. 安装依赖（使用 uv）
uv sync --dev

# 3. 下载模型（约 2.4GB）
modelscope download --model Qwen/Qwen3-ASR-0.6B --local_dir ./models/Qwen3-ASR-0.6B
modelscope download --model Qwen/Qwen3-ForcedAligner-0.6B --local_dir ./models/Qwen3-ForcedAligner-0.6B
```

**使用方法：**

```bash
# 处理单个视频
cd qwen3-asr && uv run python main.py ../public/video.mp4

# 批量处理 public 目录
cd qwen3-asr && uv run python main.py
```

### 方式二：Whisper.cpp（本地备选）

[Whisper.cpp](https://github.com/ggerganov/whisper.cpp) 是 OpenAI Whisper 的 C/C++ 移植版本，轻量级无 Python 依赖。

```bash
node sub-whisper.mjs public/video.mp4
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

> 💡 **中文识别提示**：Whisper 默认输出繁体中文，建议添加 `--prompt "我们需要使用简体中文"` 参数优化

### 方式三：必剪 ASR（在线测试）

B站必剪提供免费的在线 ASR 服务，适合快速测试。

```bash
# 处理单个视频
node sub-bcut.mjs public/video.mp4

# 批量处理
node sub-bcut.mjs
```

> ⚠️ **注意**：在线服务需要网络连接，数据会上传到服务器。

### 方式四：剪映 ASR

```bash
node sub-jianying.mjs [视频路径]
```

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

## 🎙️ TTS 语音合成（可选）

TTS（Text-to-Speech）可将字幕文本合成为自然流畅的语音，用于视频配音替换。

### 阿里云百炼 Qwen3-TTS（云端方案）

[Qwen3-TTS](https://help.aliyun.com/zh/model-studio/qwen-tts) 支持多种音色和情感表达。

**配置与使用：**

```bash
# 1. 获取 API Key
# 访问 https://dashscope.console.aliyun.com/ 开通服务并获取 API Key

# 2. 配置环境变量
echo "DASHSCOPE_API_KEY=your-api-key" >> .env

# 3. 运行 TTS 合成
node sub-tts.mjs                         # 使用默认配置
node sub-tts.mjs input.json out.wav Luna # 指定输入、输出和音色
```

**可用音色：** Cherry（甜美）、Serena（温柔）、Diana（知性）、Luna（活力）、Ethan（沉稳）、Marcus（磁性）、Alexander（大气）、Cedric（亲切）、Changchun（长春方言）、Guangzhou（广州方言）、Stella/Bella（英文）

### Qwen3-TTS 本地部署

Apple Silicon 设备可本地部署，完全离线运行：

```bash
git clone https://github.com/kapi2800/qwen3-tts-apple-silicon
cd qwen3-tts-apple-silicon
# 按项目 README 完成安装
```

## 📁 项目结构

```
remotion-video-captioner/
├── public/                    # 视频和字幕文件
│   ├── video.mp4             # 示例视频
│   └── video.json            # 对应的字幕文件
├── qwen3-asr/                # Qwen3-ASR 本地语音识别
│   ├── main.py               # ASR 处理脚本
│   └── models/               # 模型文件
├── src/
│   ├── CaptionedVideo/       # 字幕视频组件
│   │   ├── index.tsx         # 主组件
│   │   ├── SubtitlePage.tsx  # 字幕渲染
│   │   └── SubtitleEditor.tsx # 字幕编辑器
│   ├── captioner-config.ts   # 字幕样式配置
│   ├── Root.tsx              # Remotion 根组件
│   └── index.ts              # 入口文件
├── sub-bcut.mjs              # B站必剪 ASR 脚本
├── sub-jianying.mjs          # 剪映 ASR 脚本
├── sub-whisper.mjs           # Whisper.cpp ASR 脚本
├── sub-tts.mjs               # TTS 语音合成脚本
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

### 核心技术与框架

- [Remotion](https://www.remotion.dev/docs) - 使用 React 创建视频的程序化视频制作框架
- [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) - 阿里云通义千问开源语音识别模型，中文效果优秀
- [Whisper](https://github.com/openai/whisper) - OpenAI 开源的自动语音识别（ASR）模型
- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Whisper 模型的 C/C++ 高性能实现
- [Qwen3-TTS](https://help.aliyun.com/zh/model-studio/qwen-tts) - 阿里云百炼语音合成 API 文档

### 项目模板

- [remotion-tiktok](https://github.com/remotion-dev/remotion/tree/main/packages/template-tiktok) - Remotion 官方 TikTok 风格视频模板

## 🐛 问题反馈

如果遇到问题，请在 [GitHub Issues](https://github.com/remotion-dev/remotion/issues) 提交反馈。

## 📄 许可证

本项目基于 Remotion 构建。注意：某些使用场景可能需要 Remotion 的商业许可证。详情请查看 [Remotion 许可证条款](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
