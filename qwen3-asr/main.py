import os
import sys
import json
import torch
import tempfile
import subprocess
from pathlib import Path
from qwen_asr import Qwen3ASRModel, Qwen3ForcedAligner
from typing import List, Dict, Any


def group_into_sentences(items: List) -> List[List]:
    """
    将字符级别的对齐项分组为句子级别。
    
    分组策略：
    1. 根据中文标点符号（。！？；：,.!?;:）切分
    2. 如果相邻字符之间的时间间隔超过阈值（如 0.5 秒），也进行切分
    
    Args:
        items: ForcedAlignItem 列表
    
    Returns:
        List[List]: 分组后的句子列表
    """
    if not items:
        return []
    
    # 中文和英文的句末标点
    sentence_end_puncts = set('。！？；：,.!?;:')
    
    # 时间间隔阈值（秒）- 超过这个值认为是新的句子
    time_gap_threshold = 0.5
    
    sentences = []
    current_sentence = []
    
    for i, item in enumerate(items):
        current_sentence.append(item)
        
        # 检查是否应该在此处断句
        should_split = False
        
        # 规则 1: 当前字符是标点符号
        if item.text in sentence_end_puncts:
            should_split = True
        
        # 规则 2: 与下一个字符的时间间隔过大
        if not should_split and i < len(items) - 1:
            next_item = items[i + 1]
            time_gap = next_item.start_time - item.end_time
            if time_gap > time_gap_threshold:
                should_split = True
        
        # 如果需要断句，保存当前句子并开始新句子
        if should_split:
            sentences.append(current_sentence)
            current_sentence = []
    
    # 添加最后一个句子（如果有剩余）
    if current_sentence:
        sentences.append(current_sentence)
    
    return sentences


def convert_audio_to_16k(input_path: str, output_path: str) -> None:
    """
    使用 ffmpeg 将音频转换为 16khz wav 格式
    
    Args:
        input_path: 输入音频/视频文件路径
        output_path: 输出 wav 文件路径
    """
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-ar", "16000",
                output_path,
                "-y"
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        raise Exception(f"ffmpeg 转换失败：{e}")
    except FileNotFoundError:
        raise Exception("未找到 ffmpeg，请确保已安装 ffmpeg")


def process_video_file(
    video_path: str,
    output_json_path: str,
    asr_model: Qwen3ASRModel,
    aligner_model: Qwen3ForcedAligner,
    device_map: str,
    dtype: torch.dtype
) -> None:
    """
    处理单个视频文件，生成字幕 JSON
    
    Args:
        video_path: 视频文件路径
        output_json_path: 输出 JSON 文件路径
        asr_model: ASR 模型
        aligner_model: 对齐模型
        device_map: 设备映射
        dtype: 数据类型
    """
    print(f"正在处理：{video_path}")
    
    # 创建临时目录和临时音频文件
    temp_dir = tempfile.mkdtemp()
    temp_wav_path = os.path.join(temp_dir, f"{Path(video_path).stem}.wav")
    
    try:
        # 提取并转换音频
        print(f"  正在提取音频...")
        convert_audio_to_16k(video_path, temp_wav_path)
        
        # ASR 识别
        print(f"  正在进行语音识别...")
        asr_results = asr_model.transcribe(
            audio=temp_wav_path,
            language="Chinese",
        )
        recognized_text = asr_results[0].text
        
        # ForcedAligner 对齐
        print(f"  正在进行强制对齐...")
        align_results = aligner_model.align(
            audio=temp_wav_path,
            text=recognized_text,
            language="Chinese",
        )
        
        # 构建字幕数据
        captions = []
        for result_idx, result in enumerate(align_results):
            if len(result) == 0:
                continue
            
            # 将字符级别的项分组为句子级别
            sentences = group_into_sentences(result.items)
            
            # 输出每个句子
            for sent_idx, sentence in enumerate(sentences):
                full_text = "".join(item.text for item in sentence)
                start_time = sentence[0].start_time
                end_time = sentence[-1].end_time
                
                captions.append({
                    "text": full_text,
                    "start": start_time,
                    "end": end_time,
                })
        
        # 写入 JSON 文件
        output_dir = os.path.dirname(output_json_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(captions, f, ensure_ascii=False, indent=2)
        
        print(f"  ✓ 已完成，字幕保存到：{output_json_path}")
        
    finally:
        # 清理临时文件
        if os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)


def get_file_name_without_ext(file_name: str) -> str:
    """获取不带扩展名的文件名"""
    last_dot_index = file_name.rfind('.')
    return file_name[:last_dot_index] if last_dot_index > 0 else file_name


def process_directory(
    directory: str,
    asr_model: Qwen3ASRModel,
    aligner_model: Qwen3ForcedAligner,
    device_map: str,
    dtype: torch.dtype
) -> None:
    """
    递归处理目录下的所有视频文件
    
    Args:
        directory: 目录路径
        asr_model: ASR 模型
        aligner_model: 对齐模型
        device_map: 设备映射
        dtype: 数据类型
    """
    video_exts = ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.flv', '.wmv', '.wav']
    
    try:
        entries = os.listdir(directory)
    except PermissionError:
        print(f"  跳过（无权限）：{directory}")
        return
    
    # 过滤掉 .DS_Store 等系统文件
    entries = [f for f in entries if f != '.DS_Store']
    
    for entry in entries:
        full_path = os.path.join(directory, entry)
        
        if os.path.isdir(full_path):
            # 递归处理子目录
            process_directory(full_path, asr_model, aligner_model, device_map, dtype)
        else:
            # 检查是否是视频/音频文件
            is_video = any(entry.lower().endswith(ext) for ext in video_exts)
            if not is_video:
                continue
            
            # 生成输出 JSON 路径
            json_path = full_path
            for ext in video_exts:
                if json_path.lower().endswith(ext):
                    json_path = json_path[:-len(ext)] + '.json'
                    break
            
            # 检查是否已处理
            if os.path.exists(json_path):
                print(f"已处理，跳过：{entry}")
                continue
            
            # 处理视频文件
            process_video_file(
                full_path,
                json_path,
                asr_model,
                aligner_model,
                device_map,
                dtype
            )


def main():
    # 配置路径
    asr_model_path = "models/Qwen3-ASR-0.6B"
    aligner_model_path = "models/Qwen3-ForcedAligner-0.6B"

    # 检查模型路径是否存在
    if not os.path.exists(asr_model_path):
        print(f"错误: ASR 模型不存在: {asr_model_path}")
        return
    if not os.path.exists(aligner_model_path):
        print(f"错误: 对齐模型不存在: {aligner_model_path}")
        return

    # 根据设备自动选择 (MPS 用于 Mac, CUDA 用于 NVIDIA GPU, CPU 作为回退)
    if torch.backends.mps.is_available():
        device_map = "mps"
        dtype = torch.float16
    elif torch.cuda.is_available():
        device_map = "cuda:0"
        dtype = torch.bfloat16
    else:
        device_map = "cpu"
        dtype = torch.float32

    print(f"使用设备：{device_map}, 数据类型：{dtype}")
    print("=" * 50)
        
    # 读取命令行参数
    args = sys.argv[1:]
        
    # 如果没有参数，处理 public 目录下的所有文件
    # public 目录在 qwen3-asr 的上一级目录中
    if not args:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        target_dir = os.path.join(os.path.dirname(script_dir), "public")
        if not os.path.exists(target_dir):
            print(f"错误：目录不存在：{target_dir}")
            return
        print(f"将处理目录：{target_dir}")
    else:
        print(f"将处理指定的文件/目录")

    # ========== 第一步：加载 ASR 模型 ==========
    print("\n【第一步】正在加载 ASR 模型...")
    print("=" * 50)
    
    asr_model = Qwen3ASRModel.from_pretrained(
        asr_model_path,
        dtype=dtype,
        device_map=device_map,
        max_inference_batch_size=1,
        max_new_tokens=256,
    )
    
    print("ASR 模型加载完成!")
    print("=" * 50)
    
    # ========== 第二步：加载 ForcedAligner 模型 ==========
    print("\n【第二步】正在加载 ForcedAligner 模型...")
    print("=" * 50)
    
    aligner_model = Qwen3ForcedAligner.from_pretrained(
        aligner_model_path,
        dtype=dtype,
        device_map=device_map,
    )
    
    print("ForcedAligner 模型加载完成!")
    print("=" * 50)
        
    # ========== 第三步：处理视频文件 ==========
    print("\n【第三步】开始处理视频文件...")
    print("=" * 50)
        
    if not args:
        # 处理 public 目录（向上一级到项目根目录）
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        target_dir = os.path.join(project_root, "public")
        process_directory(
            target_dir,
            asr_model,
            aligner_model,
            device_map,
            dtype
        )
    else:
        # 处理命令行参数中指定的文件或目录
        for arg in args:
            full_path = os.path.join(os.getcwd(), arg)
                
            if not os.path.exists(full_path):
                print(f"错误：文件/目录不存在：{full_path}")
                continue
                
            if os.path.isdir(full_path):
                # 处理整个目录
                process_directory(
                    full_path,
                    asr_model,
                    aligner_model,
                    device_map,
                    dtype
                )
            else:
                # 处理单个文件
                video_exts = ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.flv', '.wmv', '.wav']
                is_video = any(arg.lower().endswith(ext) for ext in video_exts)
                    
                if not is_video:
                    print(f"跳过非视频文件：{arg}")
                    continue
                    
                # 生成输出 JSON 路径
                json_path = full_path
                for ext in video_exts:
                    if full_path.lower().endswith(ext):
                        json_path = full_path[:-len(ext)] + '.json'
                        break
                    
                if os.path.exists(json_path):
                    print(f"已处理，跳过：{arg}")
                    continue
                    
                process_video_file(
                    full_path,
                    json_path,
                    asr_model,
                    aligner_model,
                    device_map,
                    dtype
                )

    print("\n处理完成!")
    print("=" * 50)


if __name__ == "__main__":
    main()
