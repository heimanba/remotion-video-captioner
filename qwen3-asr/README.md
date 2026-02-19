# Qwen3-ASR 视频字幕生成工具

基于 [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) 和 Qwen3-ForcedAligner 的视频自动字幕生成工具。

## 功能特性

- 自动识别视频中的语音并生成字幕
- 支持多种视频格式（mp4, webm, mkv, mov, avi, flv, wmv, wav）
- 使用强制对齐技术精确匹配字幕时间戳
- 智能分句，根据标点符号和时间间隔自动切分句子
- 支持批量处理目录下的所有视频文件
- 自动检测设备（MPS/CUDA/CPU）并选择合适的计算后端

## 环境要求

- Python >= 3.12
- ffmpeg（用于音频提取和转换）
- 足够的磁盘空间用于存储模型文件

## 安装步骤

### 1. 安装依赖

```bash
# 使用 uv 安装依赖
uv sync --dev

# 或者使用 pip
pip install -e ".[dev]"
```

### 2. 下载模型（**重要**）

在使用前必须先下载两个模型：

```bash
# 下载 ASR 模型
modelscope download --model Qwen/Qwen3-ASR-0.6B --local_dir ./models/Qwen3-ASR-0.6B

# 下载 ForcedAligner 模型
modelscope download --model Qwen/Qwen3-ForcedAligner-0.6B --local_dir ./models/Qwen3-ForcedAligner-0.6B
```

模型将下载到 `models/` 目录下，总大小约 2.4GB。

### 3. 安装 ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
下载并安装 ffmpeg，确保添加到系统 PATH。

## 使用方法

### 处理 public 目录下的所有视频

```bash
python main.py
```

### 处理指定文件

```bash
python main.py /path/to/video.mp4
```

### 处理指定目录

```bash
python main.py /path/to/videos/
```

## 输出格式

生成的字幕文件为 JSON 格式，与视频文件同名（扩展名改为 `.json`）：

```json
[
  {
    "text": "这是第一句字幕",
    "start": 0.0,
    "end": 2.5
  },
  {
    "text": "这是第二句字幕",
    "start": 2.8,
    "end": 5.2
  }
]
```

## 项目结构

```
qwen3-asr/
├── main.py           # 主程序入口
├── pyproject.toml    # 项目配置和依赖
├── README.md         # 本文档
└── models/           # 模型文件目录（需自行下载）
    ├── Qwen3-ASR-0.6B/
    └── Qwen3-ForcedAligner-0.6B/
```

## 注意事项

1. **必须先下载模型**才能运行程序，否则会报错
2. 首次加载模型需要一些时间，请耐心等待
3. 处理过的视频会生成对应的 `.json` 文件，再次运行时会自动跳过
4. 程序会自动检测设备类型：
   - Mac (MPS): 使用 float16
   - NVIDIA GPU (CUDA): 使用 bfloat16
   - CPU: 使用 float32

## 许可证

请参考各依赖库的许可证。
