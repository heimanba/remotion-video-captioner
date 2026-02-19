import { loadFont as loadRemotionFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { captionerConfig } from "./captioner-config";

export const TheBoldFont = captionerConfig.font.family;

let loaded = false;

export const loadFont = async (): Promise<void> => {
  if (loaded) {
    return Promise.resolve();
  }

  loaded = true;

  await loadRemotionFont({
    family: TheBoldFont,
    url: staticFile("Inter-Regular.ttf"),
  });
};
