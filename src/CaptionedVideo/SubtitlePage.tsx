import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Page } from "./Page";
import { captionerConfig } from "../captioner-config";

type Subtitle = {
  text: string;
  startMs: number;
  endMs: number;
};

const SubtitlePage: React.FC<{
  readonly subtitle: Subtitle;
  readonly onTextChange?: (newText: string) => void;
  readonly onSaveToFile?: () => void;
}> = ({ subtitle, onTextChange, onSaveToFile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {
      damping: captionerConfig.animation.damping,
    },
    durationInFrames: captionerConfig.animation.enterDuration,
  });

  return (
    <AbsoluteFill>
      <Page enterProgress={enter} subtitle={subtitle} onTextChange={onTextChange} onSaveToFile={onSaveToFile} />;
    </AbsoluteFill>
  );
};

export default SubtitlePage;
