import React, { useState, useCallback } from "react";
import {
  AbsoluteFill,
  interpolate,
  useVideoConfig,
  getRemotionEnvironment,
} from "remotion";
import { TheBoldFont } from "../load-font";
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { captionerConfig } from "../captioner-config";
import { InlineSubtitleEditor } from "./InlineSubtitleEditor";

const fontFamily = TheBoldFont;

const container: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  top: undefined,
  bottom: captionerConfig.position.bottom,
  height: captionerConfig.position.height,
  overflow: "visible",
};

// 从配置文件读取样式
const FONT_SIZE = captionerConfig.font.size;
const TEXT_COLOR = captionerConfig.colors.text;
const STROKE_COLOR = captionerConfig.colors.stroke;
const STROKE_WIDTH = captionerConfig.stroke.width;
const BACKGROUND_COLOR = captionerConfig.colors.background;
const TEXT_SHADOW = captionerConfig.advanced?.textShadow;
const BACKGROUND_BLUR = captionerConfig.advanced?.backgroundBlur;
const BORDER = captionerConfig.advanced?.border;
const BORDER_TOP_LEFT_RADIUS = captionerConfig.advanced?.borderTopLeftRadius;
const BORDER_TOP_RIGHT_RADIUS = captionerConfig.advanced?.borderTopRightRadius;
const BORDER_BOTTOM_LEFT_RADIUS = captionerConfig.advanced?.borderBottomLeftRadius;
const BORDER_BOTTOM_RIGHT_RADIUS = captionerConfig.advanced?.borderBottomRightRadius;

type Subtitle = {
  text: string;
  startMs: number;
  endMs: number;
};

export const Page: React.FC<{
  readonly enterProgress: number;
  readonly subtitle: Subtitle;
  readonly onTextChange?: (newText: string) => void;
  readonly onSaveToFile?: () => void;
}> = ({ enterProgress, subtitle, onTextChange, onSaveToFile }) => {
  const { width } = useVideoConfig();
  const isStudio = getRemotionEnvironment().isStudio;
  const [isEditing, setIsEditing] = useState(false);

  const handleDoubleClick = useCallback(() => {
    if (isStudio && onTextChange) {
      setIsEditing(true);
    }
  }, [isStudio, onTextChange]);

  const handleConfirm = useCallback(async (newText: string) => {
    const hasChanged = newText !== subtitle.text;
    if (onTextChange && hasChanged) {
      onTextChange(newText);
    }
    setIsEditing(false);
    // Save to file after updating state (always save if there was a change)
    if (onSaveToFile && hasChanged) {
      // Wait a bit to ensure parent component has processed the state update
      await new Promise(resolve => setTimeout(resolve, 50));
      await onSaveToFile();
    }
  }, [subtitle.text, onTextChange, onSaveToFile]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <AbsoluteFill style={container}>
      {isEditing ? (
        <InlineSubtitleEditor
          initialText={subtitle.text}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : (
        <div
          style={{
            backgroundColor: BACKGROUND_COLOR,
            padding: `${captionerConfig.container.paddingVertical}px ${captionerConfig.container.paddingHorizontal}px`,
            borderRadius: `${captionerConfig.container.borderRadius}px`,
            maxWidth: width * captionerConfig.position.maxWidthRatio,
            width: '100%',
            transform: makeTransform([
              scale(interpolate(enterProgress, [0, 1], [captionerConfig.animation.initialScale, 1])),
              translateY(interpolate(enterProgress, [0, 1], [captionerConfig.animation.initialTranslateY, 0])),
            ]),
            cursor: isStudio && onTextChange ? "pointer" : "default",
            backdropFilter: `blur(${BACKGROUND_BLUR || '0px'})`,
            WebkitBackdropFilter: `blur(${BACKGROUND_BLUR || '0px'})`,
            border: BORDER || 'none',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
            borderTopLeftRadius: BORDER_TOP_LEFT_RADIUS !== undefined ? `${BORDER_TOP_LEFT_RADIUS}px` : undefined,
            borderTopRightRadius: BORDER_TOP_RIGHT_RADIUS !== undefined ? `${BORDER_TOP_RIGHT_RADIUS}px` : undefined,
            borderBottomLeftRadius: BORDER_BOTTOM_LEFT_RADIUS !== undefined ? `${BORDER_BOTTOM_LEFT_RADIUS}px` : undefined,
            borderBottomRightRadius: BORDER_BOTTOM_RIGHT_RADIUS !== undefined ? `${BORDER_BOTTOM_RIGHT_RADIUS}px` : undefined,
          }}
          onDoubleClick={handleDoubleClick}
          title={isStudio && onTextChange ? "双击编辑字幕" : undefined}
        >
          <div
            style={{
              fontSize: FONT_SIZE,
              color: TEXT_COLOR,
              WebkitTextStroke: `${STROKE_WIDTH}px ${STROKE_COLOR}`,
              paintOrder: "stroke",
              fontFamily,
              textAlign: "center",
              lineHeight: captionerConfig.font.lineHeight,
              textShadow: TEXT_SHADOW || 'none',
              whiteSpace: "pre",
            }}
          >
            {subtitle.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
