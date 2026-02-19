import { execSync } from "node:child_process";
import {
  existsSync,
  rmSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "path";

// ==================== Config ====================

const VERSION = "1.0.0";

// ==================== Bcut ASR ====================

const API_BASE_URL =
  "https://member.bilibili.com/x/bcut/rubick-interface";
const API_REQ_UPLOAD = API_BASE_URL + "/resource/create";
const API_COMMIT_UPLOAD = API_BASE_URL + "/resource/create/complete";
const API_CREATE_TASK = API_BASE_URL + "/task";
const API_QUERY_RESULT = API_BASE_URL + "/task/result";

const HEADERS = {
  "User-Agent": "Bilibili/1.0.0 (https://www.bilibili.com)",
  "Content-Type": "application/json",
};

class BcutASR {
  /**
   * @param {string | Buffer} audioInput - file path or Buffer
   */
  constructor(audioInput) {
    if (typeof audioInput === "string") {
      this.fileBinary = readFileSync(audioInput);
    } else {
      this.fileBinary = audioInput;
    }
    this.taskId = null;
    this._etags = [];
    this._inBossKey = null;
    this._resourceId = null;
    this._uploadId = null;
    this._uploadUrls = [];
    this._perSize = null;
    this._downloadUrl = null;
  }

  async upload() {
    const payload = JSON.stringify({
      type: 2,
      name: "audio.mp3",
      size: this.fileBinary.length,
      ResourceFileType: "mp3",
      model_id: "8",
    });

    const resp = await fetch(API_REQ_UPLOAD, {
      method: "POST",
      body: payload,
      headers: HEADERS,
    });
    if (!resp.ok) throw new Error(`Upload request failed: ${resp.status}`);
    const json = await resp.json();
    const data = json.data;

    this._inBossKey = data.in_boss_key;
    this._resourceId = data.resource_id;
    this._uploadId = data.upload_id;
    this._uploadUrls = data.upload_urls;
    this._perSize = data.per_size;

    await this._uploadParts();
    await this._commitUpload();
  }

  async _uploadParts() {
    const clips = this._uploadUrls.length;
    for (let i = 0; i < clips; i++) {
      const start = i * this._perSize;
      const end = (i + 1) * this._perSize;
      const chunk = this.fileBinary.slice(start, end);

      const resp = await fetch(this._uploadUrls[i], {
        method: "PUT",
        body: chunk,
        headers: {
          "User-Agent": HEADERS["User-Agent"],
        },
      });
      if (!resp.ok) throw new Error(`Upload part ${i} failed: ${resp.status}`);
      const etag = resp.headers.get("Etag");
      if (etag) {
        this._etags.push(etag);
      }
    }
  }

  async _commitUpload() {
    const payload = JSON.stringify({
      InBossKey: this._inBossKey,
      ResourceId: this._resourceId,
      Etags: this._etags.join(","),
      UploadId: this._uploadId,
      model_id: "8",
    });

    const resp = await fetch(API_COMMIT_UPLOAD, {
      method: "POST",
      body: payload,
      headers: HEADERS,
    });
    if (!resp.ok) throw new Error(`Commit upload failed: ${resp.status}`);
    const json = await resp.json();
    this._downloadUrl = json.data.download_url;
  }

  async createTask() {
    const resp = await fetch(API_CREATE_TASK, {
      method: "POST",
      body: JSON.stringify({ resource: this._downloadUrl, model_id: "8" }),
      headers: HEADERS,
    });
    if (!resp.ok) throw new Error(`Create task failed: ${resp.status}`);
    const json = await resp.json();
    this.taskId = json.data.task_id;
    return this.taskId;
  }

  async queryResult(taskId) {
    const id = taskId || this.taskId;
    const url = `${API_QUERY_RESULT}?model_id=8&task_id=${id}`;
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) throw new Error(`Query result failed: ${resp.status}`);
    const json = await resp.json();
    return json.data;
  }

  /**
   * Run the full ASR workflow: upload -> create task -> poll result.
   * Returns captions in the format expected by the project:
   * [{text, startMs, endMs, timestampMs, confidence}]
   */
  async run() {
    console.log("  [1/3] Uploading audio...");
    await this.upload();

    console.log("  [2/3] Creating task...");
    await this.createTask();

    console.log("  [3/3] Waiting for transcription...");
    let taskResp = null;
    for (let i = 0; i < 500; i++) {
      taskResp = await this.queryResult();
      if (taskResp.state === 4) break;
      console.log(`  Waiting for result... (${i + 1}/500)`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!taskResp || taskResp.state !== 4) {
      throw new Error("ASR task failed or timed out");
    }

    const result = JSON.parse(taskResp.result);
    return this._toCaptions(result);
  }

  /**
   * Convert Bcut ASR response to project caption format.
   */
  _toCaptions(result) {
    const utterances = result.utterances || [];
    return utterances.map((u) => ({
      text: u.transcript,
      startMs: u.start_time,
      endMs: u.end_time,
      timestampMs: null,
      confidence: 1,
    }));
  }
}

// ==================== CLI ====================

const extractToTempAudioFile = (fileToTranscribe, tempOutFile) => {
  execSync(
    `npx remotion ffmpeg -i "${fileToTranscribe}" -vn -ar 16000 -ac 1 -b:a 128k "${tempOutFile}" -y`,
    { stdio: ["ignore", "inherit"] },
  );
};

const subFile = async (filePath, fileName, folder) => {
  const outPath = path.join(
    process.cwd(),
    "public",
    folder,
    fileName.replace(".mp3", ".json"),
  );

  const asr = new BcutASR(filePath);
  const captions = await asr.run();

  writeFileSync(outPath, JSON.stringify(captions, null, 2));
  console.log(`Subtitles written to ${outPath}`);
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

  // Bcut ASR accepts mp3, so we convert to mp3 instead of wav
  const tempMp3FileName = getFileNameWithoutExt(entry) + ".mp3";
  const tempOutFilePath = path.join(tempDir, tempMp3FileName);

  try {
    extractToTempAudioFile(fullPath, tempOutFilePath);
    await subFile(
      tempOutFilePath,
      tempMp3FileName,
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
      await processDirectory(fullPath);
    } else {
      await processVideo(fullPath, entry, directory);
    }
  }
};

const main = async () => {
  try {
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
