#!/usr/bin/env node
/**
 * 阿里云百炼 Qwen3-TTS 语音合成脚本（自然语速模式）
 * 
 * 核心特性：
 * - 使用 TTS 自然语速生成语音，不进行变速处理
 * - 根据实际音频时长反向调整字幕时间轴
 * - 输出新的字幕 JSON 文件供视频渲染使用
 * 
 * API 文档: https://help.aliyun.com/zh/model-studio/qwen-tts
 * 
 * 使用方法：
 *   node sub-tts.mjs                         # 使用默认 public/video.json
 *   node sub-tts.mjs input.json              # 指定输入字幕文件
 *   node sub-tts.mjs input.json out.wav      # 指定输出音频文件
 *   node sub-tts.mjs input.json out.wav Luna # 指定音色
 * 
 * 输出文件：
 *   - 音频文件：指定的输出路径（默认 temp/tts_output.wav）
 *   - 字幕文件：{输入文件名}-tts.json（时间轴已调整）
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "path";
import "dotenv/config";

// ==================== Configuration ====================

const API_KEY = process.env.DASHSCOPE_API_KEY;
// 新的 TTS API 端点（qwen3-tts 使用多模态生成接口）
const TTS_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

// Qwen3-TTS 音色选项（新系统音色）
const VOICE_OPTIONS = {
  // 中文音色
  Cherry: "Cherry（甜美女声）",
  Serena: "Serena（温柔女声）",
  Diana: "Diana（知性女声）",
  Luna: "Luna（活力女声）",
  Ethan: "Ethan（沉稳男声）",
  Marcus: "Marcus（磁性男声）",
  Alexander: "Alexander（大气男声）",
  Cedric: "Cedric（亲切男声）",
  // 方言音色
  Changchun: "长春方言",
  Guangzhou: "广州方言",
  // 英文音色
  Stella: "Stella（英文女声）",
  Bella: "Bella（英文女声）",
};

// 默认输出采样率和声道
const OUTPUT_SAMPLE_RATE = 24000;
const OUTPUT_CHANNELS = 1;

// 字幕间隙配置
const MIN_GAP_MS = 100;   // 字幕之间最小间隙（毫秒）
const DEFAULT_GAP_MS = 200; // 默认间隙

// 默认配置
const DEFAULT_CONFIG = {
  model: "qwen3-tts-instruct-flash", // instruct 模型支持 instructions 控制发音
  voice: "Ethan",
  languageType: "Auto", // Auto 自动识别语言，适合中英混合文本
  instructions: "吐字清晰精准，字正腔圆。遇到英文缩写时请逐字母拼读，例如 MCP 读作 M-C-P，API 读作 A-P-I。",
};

// ==================== TTS API ====================

/**
 * 调用阿里云百炼 Qwen3-TTS API 生成语音
 * 文档：https://help.aliyun.com/zh/model-studio/qwen-tts
 */
async function synthesizeSpeech(text, options = {}) {
  const {
    model = DEFAULT_CONFIG.model,
    voice = DEFAULT_CONFIG.voice,
    languageType = DEFAULT_CONFIG.languageType,
    instructions = DEFAULT_CONFIG.instructions,
  } = options;

  if (!API_KEY) {
    throw new Error("未找到 DASHSCOPE_API_KEY，请在 .env 文件中配置");
  }

  // 构建请求体
  const requestBody = {
    model,
    input: {
      text,  // 使用处理后的文本
      voice,
      language_type: languageType,
    },
  };

  // 如果使用 instruct 模型，可以添加指令控制
  if (instructions && model.includes("instruct")) {
    requestBody.input.instructions = instructions;
    requestBody.parameters = { optimize_instructions: true };
  }

  const response = await fetch(TTS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS API 调用失败: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // 检查错误
  if (result.code) {
    throw new Error(`TTS API 错误: ${result.code} - ${result.message}`);
  }

  // 获取音频 URL
  const audioUrl = result.output?.audio?.url;
  if (!audioUrl) {
    throw new Error(`未返回音频 URL: ${JSON.stringify(result)}`);
  }

  // 下载音频数据
  console.log(`  音频 URL: ${audioUrl}`);
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`下载音频失败: ${audioResponse.status}`);
  }

  return Buffer.from(await audioResponse.arrayBuffer());
}

// ==================== Audio Processing ====================

/**
 * 获取音频时长（秒）
 */
function getAudioDuration(audioPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: "utf-8" }
    );
    return parseFloat(output.trim());
  } catch (error) {
    console.error("获取音频时长失败:", error.message);
    return 0;
  }
}

/**
 * 统一音频格式（不变速）
 */
function normalizeAudio(inputPath, outputPath) {
  execSync(
    `ffmpeg -i "${inputPath}" -ar ${OUTPUT_SAMPLE_RATE} -ac ${OUTPUT_CHANNELS} -y "${outputPath}" -v quiet`,
    { stdio: "inherit" }
  );
}

/**
 * 合并多个音频片段（按新时间轴）
 */
function mergeAudioSegmentsSimple(segments, outputPath) {
  const tempDir = path.join(process.cwd(), "temp", "tts_merge");
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });

  // 为每个片段生成静音填充和音频文件
  const fileList = [];
  let currentTime = 0;

  segments.forEach((segment, index) => {
    const startMs = segment.newStartMs;

    // 如果有间隙，添加静音
    if (startMs > currentTime) {
      const silenceDuration = (startMs - currentTime) / 1000;
      const silencePath = path.join(tempDir, `silence_${index}.wav`);
      execSync(
        `ffmpeg -f lavfi -i anullsrc=r=${OUTPUT_SAMPLE_RATE}:cl=mono -t ${silenceDuration} -y "${silencePath}" -v quiet`,
        { stdio: "inherit" }
      );
      fileList.push(`file '${silencePath}'`);
      currentTime = startMs;
    }

    // 添加音频片段
    fileList.push(`file '${segment.audioPath}'`);
    currentTime = segment.newEndMs;
  });

  // 写入文件列表
  const listPath = path.join(tempDir, "files.txt");
  writeFileSync(listPath, fileList.join("\n"));

  // 合并所有音频
  execSync(
    `ffmpeg -f concat -safe 0 -i "${listPath}" -ar ${OUTPUT_SAMPLE_RATE} -ac ${OUTPUT_CHANNELS} -y "${outputPath}" -v quiet`,
    { stdio: "inherit" }
  );

  // 清理临时文件
  rmSync(tempDir, { recursive: true });
}

// ==================== Main Logic ====================

/**
 * 处理单个字幕条目（自然语速，不变速）
 */
async function processSubtitle(subtitle, index, tempDir, voice) {
  const { text, startMs, endMs } = subtitle;
  const originalDuration = (endMs - startMs) / 1000;

  console.log(`\n[${index + 1}] "${text}"`);
  console.log(`  原始时间轴: ${(startMs/1000).toFixed(2)}s - ${(endMs/1000).toFixed(2)}s (${originalDuration.toFixed(2)}s)`);

  // 构建请求选项（使用自然语速）
  const options = {
    voice,
    model: DEFAULT_CONFIG.model,
    languageType: DEFAULT_CONFIG.languageType,
    instructions: DEFAULT_CONFIG.instructions,
  };

  // 生成原始音频
  const rawPath = path.join(tempDir, `raw_${index}.wav`);
  console.log(`  正在合成语音...`);
  
  try {
    const audioBuffer = await synthesizeSpeech(text, options);
    writeFileSync(rawPath, audioBuffer);
  } catch (error) {
    console.error(`  TTS 失败: ${error.message}`);
    return null;
  }

  // 获取实际时长
  const actualDuration = getAudioDuration(rawPath);
  console.log(`  实际时长: ${actualDuration.toFixed(2)}s`);

  // 统一音频格式（不变速）
  const normalizedPath = path.join(tempDir, `normalized_${index}.wav`);
  normalizeAudio(rawPath, normalizedPath);

  return {
    audioPath: normalizedPath,
    text,
    originalStartMs: startMs,
    originalEndMs: endMs,
    actualDurationMs: Math.round(actualDuration * 1000),
  };
}

/**
 * 根据实际音频时长重建时间轴
 * 策略：保持字幕顺序，按实际时长排列，保留合理间隙
 */
function rebuildTimeline(segments, originalSubtitles) {
  const newSubtitles = [];
  let currentTime = 0;

  // 计算原始间隙
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const original = originalSubtitles[i];
    
    // 计算原始间隙（与前一条字幕的间隔）
    let gap = DEFAULT_GAP_MS;
    if (i > 0) {
      const prevOriginal = originalSubtitles[i - 1];
      const originalGap = original.startMs - prevOriginal.endMs;
      // 保留原始间隙，但设置最小值
      gap = Math.max(MIN_GAP_MS, Math.min(originalGap, 1000));
    } else {
      // 第一条字幕：保持原始开始时间或设置最小间隙
      gap = Math.max(0, original.startMs);
    }

    const startMs = currentTime + (i === 0 ? gap : gap);
    const endMs = startMs + segment.actualDurationMs;

    newSubtitles.push({
      text: segment.text,
      startMs,
      endMs,
    });

    // 更新音频路径信息
    segment.newStartMs = startMs;
    segment.newEndMs = endMs;

    currentTime = endMs;
  }

  return newSubtitles;
}

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("阿里云百炼 Qwen3-TTS 语音合成（自然语速模式）");
  console.log("=".repeat(60));

  // 解析命令行参数
  const args = process.argv.slice(2);
  const inputFile = args[0] || "public/video.json";
  const outputFile = args[1] || "temp/tts_output.wav";
  const voice = args[2] || DEFAULT_CONFIG.voice;

  // 输出字幕文件路径（根据输入文件名生成）
  const inputBaseName = path.basename(inputFile, ".json");
  const subtitleOutputFile = path.join(path.dirname(inputFile), `${inputBaseName}-tts.json`);

  console.log(`\n输入文件: ${inputFile}`);
  console.log(`输出音频: ${outputFile}`);
  console.log(`输出字幕: ${subtitleOutputFile}`);
  console.log(`音色: ${voice} (${VOICE_OPTIONS[voice] || "未知"})`);
  console.log(`模式: 自然语速（反向调整时间轴）`);

  // 读取字幕文件
  if (!existsSync(inputFile)) {
    console.error(`错误: 找不到输入文件 ${inputFile}`);
    process.exit(1);
  }

  const subtitles = JSON.parse(readFileSync(inputFile, "utf-8"));
  console.log(`\n共有 ${subtitles.length} 条字幕`);

  // 创建临时目录
  const tempDir = path.join(process.cwd(), "temp", "tts_cache");
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });

  // 处理每条字幕（自然语速）
  console.log("\n--- 阶段1: 生成自然语速音频 ---");
  const segments = [];
  for (let i = 0; i < subtitles.length; i++) {
    const segment = await processSubtitle(subtitles[i], i, tempDir, voice);
    if (segment) {
      segments.push(segment);
    }
  }

  // 根据实际时长重建时间轴
  console.log("\n--- 阶段2: 重建时间轴 ---");
  const newSubtitles = rebuildTimeline(segments, subtitles);

  // 输出时间轴对比
  console.log("\n时间轴调整对比:");
  const originalTotal = Math.max(...subtitles.map((s) => s.endMs));
  const newTotal = Math.max(...newSubtitles.map((s) => s.endMs));
  console.log(`  原始总时长: ${(originalTotal / 1000).toFixed(2)}s`);
  console.log(`  新总时长: ${(newTotal / 1000).toFixed(2)}s`);
  console.log(`  时长变化: ${((newTotal - originalTotal) / 1000).toFixed(2)}s`);

  // 保存新的字幕文件
  writeFileSync(subtitleOutputFile, JSON.stringify(newSubtitles, null, 2));
  console.log(`\n字幕文件已保存: ${subtitleOutputFile}`);

  // 合并所有音频片段
  console.log("\n--- 阶段3: 合并音频 ---");
  mergeAudioSegmentsSimple(segments, outputFile);

  // 清理临时文件
//   rmSync(tempDir, { recursive: true });

  console.log("\n" + "=".repeat(60));
  console.log(`完成！`);
  console.log(`  音频: ${outputFile}`);
  console.log(`  字幕: ${subtitleOutputFile}`);
  console.log("=".repeat(60));

  // 输出使用提示
  console.log("\n后续使用提示:");
  console.log(`1. 使用新字幕文件 ${subtitleOutputFile} 更新视频字幕`);
  console.log("2. 如需替换视频原音轨:");
  console.log(`   ffmpeg -i public/video.mp4 -i ${outputFile} -c:v copy -map 0:v:0 -map 1:a:0 public/output.mp4`);
}

// ==================== Entry ====================

main().catch((error) => {
  console.error("\n错误:", error.message);
  process.exit(1);
});
