import React, { useCallback, useState } from "react";
import { AbsoluteFill } from "remotion";
import { InlineSubtitleEditor } from "./InlineSubtitleEditor";
import { captionerConfig } from "../captioner-config";

export const SubtitleInputOverlay: React.FC<{
  currentTimeMs: number;
  onAddSubtitle: (text: string, startMs: number) => void;
}> = ({ currentTimeMs, onAddSubtitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startMs, setStartMs] = useState(0);

  const handleDoubleClick = useCallback(() => {
    // 如果已经在编辑模式，忽略双击事件（防止意外重置）
    if (isEditing) {
      return;
    }
    setStartMs(currentTimeMs);
    setIsEditing(true);
  }, [currentTimeMs, isEditing]);

  const handleConfirm = useCallback(
    (text: string) => {
      onAddSubtitle(text, startMs);
      setIsEditing(false);
    },
    [onAddSubtitle, startMs],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        top: undefined,
        bottom: captionerConfig.position.bottom,
        height: captionerConfig.position.height,
        overflow: "visible",
        cursor: "pointer",
      }}
      onDoubleClick={handleDoubleClick}
      title="双击添加字幕"
    >
      {isEditing ? (
        <InlineSubtitleEditor
          initialText=""
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          showButtons
          placeholder="输入字幕文本..."
        />
      ) : (
        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            padding: "10px 28px",
            borderRadius: "8px",
            border: "1px dashed rgba(255, 255, 255, 0.3)",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "rgba(255, 255, 255, 0.9)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              textAlign: "center",
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              padding: "12px 24px",
              borderRadius: 8,
            }}
          >
            双击添加字幕
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
