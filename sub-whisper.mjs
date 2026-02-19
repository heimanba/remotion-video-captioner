import { execSync } from "node:child_process";
import {
  existsSync,
  rmSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import path from "path";
import {
  WHISPER_LANG,
  WHISPER_MODEL,
  WHISPER_PATH,
  WHISPER_VERSION,
} from "./whisper-config.mjs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const extractToTempAudioFile = (fileToTranscribe, tempOutFile) => {
  // Extracting audio from mp4 and save it as 16khz wav file
  execSync(
    `npx remotion ffmpeg -i "${fileToTranscribe}" -ar 16000 "${tempOutFile}" -y`,
    { stdio: ["ignore", "inherit"] },
  );
};

const subFile = async (filePath, fileName, folder) => {
  const outPath = path.join(
    process.cwd(),
    "public",
    folder,
    fileName.replace(".wav", ".json"),
  );

  const whisperCppOutput = await transcribe({
    inputPath: filePath,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    printOutput: false,
    translateToEnglish: false,
    language: WHISPER_LANG,
    splitOnWord: true,
  });

  const { captions } = toCaptions({
    whisperCppOutput,
  });
  writeFileSync(outPath, JSON.stringify(captions, null, 2));
};

const getFileNameWithoutExt = (fileName) => {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
};

const processVideo = async (fullPath, entry, directory) => {
  const videoExts = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".flv", ".wmv"];
  const isVideo = videoExts.some((ext) => fullPath.toLowerCase().endsWith(ext));
  if (!isVideo) {
    return;
  }

  const jsonPath = videoExts.reduce(
    (path, ext) => path.replace(new RegExp(`${ext}$`, "i"), ".json"),
    fullPath,
  );

  if (existsSync(jsonPath)) {
    console.log(`Already transcribed: ${entry}, skipping.`);
    return;
  }

  let tempDir = path.join(process.cwd(), "temp");
  let shouldRemoveTempDirectory = false;
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir);
    shouldRemoveTempDirectory = true;
  }
  console.log("Extracting audio from file", entry);

  const tempWavFileName = getFileNameWithoutExt(entry) + ".wav";
  const tempOutFilePath = path.join(tempDir, tempWavFileName);

  try {
    extractToTempAudioFile(fullPath, tempOutFilePath);
    await subFile(
      tempOutFilePath,
      tempWavFileName,
      path.relative("public", directory),
    );
  } finally {
    // 清理临时音频文件
    if (existsSync(tempOutFilePath)) {
      rmSync(tempOutFilePath);
    }
    if (shouldRemoveTempDirectory && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  }
};

const processDirectory = async (directory) => {
  const entries = readdirSync(directory).filter((f) => f !== ".DS_Store");

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = lstatSync(fullPath);

    if (stat.isDirectory()) {
      await processDirectory(fullPath); // Recurse into subdirectories
    } else {
      await processVideo(fullPath, entry, directory);
    }
  }
};

const main = async () => {
  try {
    await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
    // await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

    // Read arguments for filename if given else process all files in the directory
    const hasArgs = process.argv.length > 2;

    if (!hasArgs) {
      await processDirectory(path.join(process.cwd(), "public"));
      process.exit(0);
    }

    for (const arg of process.argv.slice(2)) {
      const fullPath = path.join(process.cwd(), arg);
      if (!existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        continue;
      }
      const stat = lstatSync(fullPath);

      if (stat.isDirectory()) {
        await processDirectory(fullPath);
        continue;
      }

      console.log(`Processing file ${fullPath}`);
      const directory = path.dirname(fullPath);
      const fileName = path.basename(fullPath);
      await processVideo(fullPath, fileName, directory);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

main();
