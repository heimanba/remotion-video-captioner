import { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  getRemotionEnvironment,
  getStaticFiles,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
  watchStaticFile,
} from "remotion";
import { z } from "zod";
import SubtitlePage from "./SubtitlePage";
import { parseMedia } from "@remotion/media-parser";
import { loadFont } from "../load-font";
import { SubtitleInputOverlay } from "./SubtitleInputOverlay";
import {
  CaptionsInternals,
  Caption,
  parseSrt,
} from "@remotion/captions";
import { SubtitleEditor, type SubtitleLine } from "./SubtitleEditor";
import { captionerConfig } from "../captioner-config";

export type SubtitleProp = {
  startInSeconds: number;
  text: string;
};

export const captionedVideoSchema = z.object({
  src: z.string(),
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 30;
  const { durationInSeconds } = await parseMedia({
    src: props.src,
    fields: {
      durationInSeconds: true,
    },
  });

  return {
    fps,
    durationInFrames: Math.floor(durationInSeconds! * fps),
  };
};

const getFileExists = (file: string) => {
  const files = getStaticFiles();
  const fileExists = files.find((f) => {
    return f.src === file;
  });
  return Boolean(fileExists);
};

// How many captions should be displayed at a time?
// Try out:
// - 1500 to display a lot of words at a time
// - 200 to only display 1 word at a time
const SWITCH_CAPTIONS_EVERY_MS = 1200;

export const CaptionedVideo: React.FC<{
  src: string;
}> = ({ src }) => {
  const [subtitles, setSubtitles] = useState<Caption[]>([]);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const subtitlesFileRef = useRef<string>("");

  // Subtitle editing state (dev mode only)
  const [subtitleLines, setSubtitleLines] = useState<SubtitleLine[]>([]);
  const subtitleLinesRef = useRef<SubtitleLine[]>([]);
  const originalLinesRef = useRef<SubtitleLine[]>([]);
  const isFirstLoadRef = useRef(true);
  const currentTimeMs = (frame / fps) * 1000;
  const isStudio = getRemotionEnvironment().isStudio;

  // Track whether no caption file was found
  const [noCaptionFile, setNoCaptionFile] = useState(false);

  // 尝试不同的字幕文件格式
  const jsonFile = src
    .replace(/.mp4$/, ".json")
    .replace(/.mkv$/, ".json")
    .replace(/.mov$/, ".json")
    .replace(/.webm$/, ".json");
  const srtFile = src
    .replace(/.mp4$/, ".srt")
    .replace(/.mkv$/, ".srt")
    .replace(/.mov$/, ".srt")
    .replace(/.webm$/, ".srt");

  const fetchSubtitles = useCallback(async () => {
    try {
      await loadFont();

      // 先尝试 JSON 格式
      let captions: Caption[];
      let isJsonFile = false;
      try {
        const res = await fetch(jsonFile);
        if (res.ok) {
          captions = await res.json();
          subtitlesFileRef.current = jsonFile;
          isJsonFile = true;
        } else {
          throw new Error("JSON file not found");
        }
      } catch {
        // JSON 失败，尝试 SRT 格式
        const res = await fetch(srtFile);
        if (!res.ok) {
          // 没有字幕文件，标记状态，继续渲染
          setNoCaptionFile(true);
          continueRender(handle);
          return;
        }
        const srtContent = await res.text();
        const result = parseSrt({ input: srtContent });
        captions = result.captions;
        subtitlesFileRef.current = srtFile;
      }

      let processedCaptions: Caption[];
      
      // JSON 文件（用户编辑保存的格式）直接使用，不再合并处理
      // 只对 SRT 文件进行 ensureMaxCharactersPerLine 处理
      if (isJsonFile) {
        // JSON 文件已经是最终格式，直接使用
        processedCaptions = captions.map((c) => ({
          text: c.text,
          startMs: c.startMs,
          endMs: c.endMs,
          timestampMs: null,
          confidence: 0,
        }));
      } else {
        // SRT 文件需要处理
        const { segments } = CaptionsInternals.ensureMaxCharactersPerLine({
          captions,
          maxCharsPerLine: captionerConfig.processing.maxCharsPerLine,
        });
        // 将 segments 扁平化为单个字幕数组，过滤掉空数组
        processedCaptions = segments
          .filter((segment) => segment.length > 0)
          .map((segment) => ({
            text: segment.map((c) => c.text).join(" "),
            startMs: segment[0].startMs,
            endMs: segment[segment.length - 1].endMs,
            timestampMs: null,
            confidence: 0,
          }));
      }
      
      // 确保字幕时间不重叠，避免两层叠加
      for (let i = 0; i < processedCaptions.length - 1; i++) {
        if (processedCaptions[i].endMs > processedCaptions[i + 1].startMs) {
          processedCaptions[i].endMs = processedCaptions[i + 1].startMs;
        }
      }
      setSubtitles(processedCaptions);

      const lines = processedCaptions.map((c) => ({
        text: c.text,
        startMs: c.startMs,
        endMs: c.endMs,
      }));
      originalLinesRef.current = lines;

      // On first load, check localStorage for saved edits
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        try {
          const saved = localStorage.getItem(
            `subtitle-editor-${src.replace(/^.*\//, "")}`,
          );
          if (saved) {
            const parsedLines = JSON.parse(saved);
            setSubtitleLines(parsedLines);
            subtitleLinesRef.current = parsedLines;
            continueRender(handle);
            return;
          }
        } catch {
          // Ignore localStorage errors
        }
      }

      setSubtitleLines(lines);
      subtitleLinesRef.current = lines;
      continueRender(handle);
    } catch (e) {
      // 没有字幕文件时，不报错，继续渲染
      console.warn("No subtitle file found, continuing without subtitles");
      setNoCaptionFile(true);
      continueRender(handle);
    }
  }, [continueRender, handle, jsonFile, srtFile]);

  useEffect(() => {
    fetchSubtitles();

    const c = watchStaticFile(jsonFile, () => {
      fetchSubtitles();
    });

    return () => {
      c.cancel();
    };
  }, [fetchSubtitles, src, jsonFile]);

  // Editor handlers
  const handleSubtitlesChange = useCallback(
    (updated: SubtitleLine[]) => {
      setSubtitleLines(updated);
      subtitleLinesRef.current = updated;
      try {
        localStorage.setItem(
          `subtitle-editor-${src.replace(/^.*\//, "")}`,
          JSON.stringify(updated),
        );
      } catch {
        // localStorage might be full or unavailable
      }
    },
    [src],
  );

  const handleExport = useCallback(() => {
    const data = subtitleLines.map((s) => ({
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
      timestampMs: null,
      confidence: 0,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = src.replace(/^.*\//, "").replace(/\.\w+$/, "") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [subtitleLines, src]);

  // Save subtitles directly to the source file using Remotion Studio API
  const handleSave = useCallback(async () => {
    let filename = subtitlesFileRef.current.replace(/^.*\//, "");
    
    // If no JSON file exists, create one based on the video filename
    if (!filename.endsWith(".json")) {
      filename = src.replace(/^.*\//, "").replace(/\.\w+$/, ".json");
      // Update the ref so subsequent saves work correctly
      subtitlesFileRef.current = src.replace(/\.\w+$/, ".json");
    }
    
    // Use ref to get the latest subtitles
    const currentSubtitles = subtitleLinesRef.current;
    const data = currentSubtitles.map((s) => ({
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
      timestampMs: null,
      confidence: 0,
    }));
    
    try {
      // Dynamic import to avoid bundling issues in non-studio environments
      const { writeStaticFile } = await import("@remotion/studio");
      await writeStaticFile({
        filePath: filename,
        contents: JSON.stringify(data, null, 2),
      });
      
      // Clear localStorage after successful save
      localStorage.removeItem(`subtitle-editor-${src.replace(/^.*\//, "")}`);
      originalLinesRef.current = currentSubtitles;
    } catch (e) {
      console.error("保存失败:", e);
    }
  }, [src]);

  const handleReset = useCallback(() => {
    setSubtitleLines(originalLinesRef.current);
    try {
      localStorage.removeItem(
        `subtitle-editor-${src.replace(/^.*\//, "")}`,
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [src]);

  // Add a new subtitle via double-click inline editing
  const handleAddSubtitle = useCallback(
    (text: string, startMs: number) => {
      // Ensure subtitlesFileRef is set for saving
      if (!subtitlesFileRef.current) {
        subtitlesFileRef.current = src
          .replace(/.mp4$/, ".json")
          .replace(/.mkv$/, ".json")
          .replace(/.mov$/, ".json")
          .replace(/.webm$/, ".json");
      }
      const newEntry: SubtitleLine = {
        text,
        startMs,
        endMs: startMs + 2000,
      };
      const updated = [...subtitleLinesRef.current];
      const insertIndex = updated.findIndex((s) => s.startMs > startMs);
      if (insertIndex === -1) {
        updated.push(newEntry);
      } else {
        updated.splice(insertIndex, 0, newEntry);
      }
      handleSubtitlesChange(updated);
      setNoCaptionFile(false);
      // Save the file so the JSON is created on disk
      handleSave();
    },
    [src, handleSubtitlesChange, handleSave],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <AbsoluteFill>
        <OffthreadVideo
          style={{
            objectFit: "cover",
            width: "100%",
            height: "100%",
          }}
          src={src}
        />
      </AbsoluteFill>
      {(() => {
        // 找到当前帧应该显示的字幕（只显示一个，避免重叠）
        const currentSubtitle = subtitleLines.find((subtitle) => {
          const subtitleStartFrame = Math.round((subtitle.startMs / 1000) * fps);
          const subtitleEndFrame = Math.round((subtitle.endMs / 1000) * fps);
          return frame >= subtitleStartFrame && frame < subtitleEndFrame;
        });

        if (!currentSubtitle) {
          return null;
        }

        const index = subtitleLines.indexOf(currentSubtitle);
        const subtitleStartFrame = Math.round((currentSubtitle.startMs / 1000) * fps);
        const subtitleEndFrame = Math.round((currentSubtitle.endMs / 1000) * fps);
        const durationInFrames = subtitleEndFrame - subtitleStartFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        const handleTextChange = (newText: string) => {
          // Use ref to get the latest subtitles state
          const currentLines = subtitleLinesRef.current;
          const updated = [...currentLines];
          updated[index] = { ...updated[index], text: newText };
          handleSubtitlesChange(updated);
        };

        return (
          <Sequence
            key={`${currentSubtitle.startMs}-${currentSubtitle.text}`}
            from={subtitleStartFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitlePage
              subtitle={currentSubtitle}
              onTextChange={isStudio ? handleTextChange : undefined}
              onSaveToFile={isStudio ? handleSave : undefined}
            />
          </Sequence>
        );
      })()}
      {/* Double-click overlay to add subtitle when no subtitle at current time */}
      {isStudio && (() => {
        // 检查当前时间点是否有字幕
        const hasSubtitleAtCurrentTime = subtitleLines.some((subtitle) => {
          const subtitleStartFrame = Math.round((subtitle.startMs / 1000) * fps);
          const subtitleEndFrame = Math.round((subtitle.endMs / 1000) * fps);
          return frame >= subtitleStartFrame && frame < subtitleEndFrame;
        });
        // 当前时间点没有字幕时显示添加覆盖层
        if (!hasSubtitleAtCurrentTime) {
          return (
            <SubtitleInputOverlay
              currentTimeMs={currentTimeMs}
              onAddSubtitle={handleAddSubtitle}
            />
          );
        }
        return null;
      })()}
      {/* Show SubtitleEditor in Studio mode (always show for editing) */}
      {isStudio && (
        <SubtitleEditor
          subtitles={subtitleLines}
          currentTimeMs={currentTimeMs}
          onSubtitlesChange={handleSubtitlesChange}
          onSave={handleSave}
          onExport={handleExport}
          onReset={handleReset}
        />
      )}
    </AbsoluteFill>
  );
};
