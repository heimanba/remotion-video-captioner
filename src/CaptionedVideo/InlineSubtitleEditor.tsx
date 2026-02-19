import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVideoConfig, getRemotionEnvironment } from "remotion";
import { pause } from "@remotion/studio";
import { TheBoldFont } from "../load-font";
import { captionerConfig } from "../captioner-config";

const fontFamily = TheBoldFont;

// 从配置文件读取样式
const FONT_SIZE = captionerConfig.font.size;
const TEXT_COLOR = captionerConfig.colors.text;
const STROKE_COLOR = captionerConfig.colors.stroke;
const STROKE_WIDTH = captionerConfig.stroke.width;
const BACKGROUND_COLOR = captionerConfig.colors.background;
const TEXT_SHADOW = captionerConfig.advanced?.textShadow;

export type InlineSubtitleEditorProps = {
  /** 初始文本内容 */
  initialText: string;
  /** 确认时的回调 */
  onConfirm: (text: string) => void;
  /** 取消时的回调 */
  onCancel: () => void;
  /** 是否显示确认/取消按钮 */
  showButtons?: boolean;
  /** placeholder 文本 */
  placeholder?: string;
};

export const InlineSubtitleEditor: React.FC<InlineSubtitleEditorProps> = ({
  initialText,
  onConfirm,
  onCancel,
  showButtons = false,
  placeholder,
}) => {
  const { width } = useVideoConfig();
  const [editText, setEditText] = useState(initialText);
  const inputRef = useRef<HTMLDivElement>(null);
  const isStudio = getRemotionEnvironment().isStudio;

  // 进入编辑模式时暂停播放
  useEffect(() => {
    if (isStudio) {
      pause();
    }
  }, [isStudio]);

  // 进入编辑模式时聚焦并选中文本
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = editText.trim();
    if (showButtons) {
      // 添加模式：需要有内容才能确认
      if (trimmed) {
        onConfirm(trimmed);
      }
    } else {
      // 编辑模式：直接保存（允许空文本）
      onConfirm(editText);
    }
  }, [editText, onConfirm, showButtons]);

  // 阻止所有键盘事件冒泡，防止触发 Remotion Studio 的全局快捷键
  const stopKeyboardPropagation = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleConfirm, onCancel],
  );

  const handleBlur = useCallback(() => {
    // 如果显示按钮，不在失焦时自动保存（用户可能要点按钮）
    if (!showButtons) {
      handleConfirm();
    }
  }, [handleConfirm, showButtons]);

  const isEmpty = !editText.trim();

  return (
    <div
      style={{
        backgroundColor: BACKGROUND_COLOR,
        padding: `${captionerConfig.container.paddingVertical}px ${captionerConfig.container.paddingHorizontal}px`,
        borderRadius: `${captionerConfig.container.borderRadius}px`,
        maxWidth: width * 0.9,
        width: width * 0.9,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minWidth: "300px",
          minHeight: "80px",
          maxHeight: "200px",
          backgroundColor: "rgba(59, 130, 246, 0.3)",
          border: "2px solid #3b82f6",
          borderRadius: "4px",
          boxSizing: "border-box",
          overflow: "auto",
        }}
      >
        <div
          ref={inputRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setEditText(e.currentTarget.textContent || "")}
          onKeyDown={handleKeyDown}
          onKeyUp={stopKeyboardPropagation}
          onKeyPress={stopKeyboardPropagation}
          onBlur={handleBlur}
          data-placeholder={placeholder}
          style={{
            fontSize: FONT_SIZE,
            color: isEmpty && placeholder ? "rgba(255, 255, 255, 0.5)" : TEXT_COLOR,
            WebkitTextStroke: `${STROKE_WIDTH}px ${STROKE_COLOR}`,
            paintOrder: "stroke",
            fontFamily,
            textAlign: "center",
            lineHeight: captionerConfig.font.lineHeight,
            outline: "none",
            width: "100%",
            padding: "16px 8px",
            boxSizing: "border-box",
            textShadow: TEXT_SHADOW || "none",
          }}
        >
          {initialText || placeholder}
        </div>
      </div>
    </div>
  );
};
