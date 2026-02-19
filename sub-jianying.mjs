import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  lstatSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ==================== Config ====================

const VERSION = "1.0.0";

// ==================== CRC32 ====================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

// ==================== AWS Signature V4 ====================

function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg, "utf-8").digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf-8").digest("hex");
}

function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kDate = hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, regionName);
  const kService = hmacSha256(kRegion, serviceName);
  const kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
}

function awsSignature(
  secretKey,
  requestParameters,
  headers,
  { method = "GET", payload = "", region = "cn", service = "vod" } = {},
) {
  const canonicalUri = "/";
  const canonicalQuerystring = requestParameters;
  const canonicalHeaders =
    Object.entries(headers)
      .map(([k, v]) => `${k}:${v}`)
      .join("\n") + "\n";
  const signedHeaders = Object.keys(headers).join(";");
  const payloadHash = sha256Hex(payload);
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const amzDate = headers["x-amz-date"];
  const dateStamp = amzDate.split("T")[0];

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf-8")
    .digest("hex");
  return signature;
}

// ==================== Fetch with Retry ====================

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      return resp;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`  Fetch failed (attempt ${attempt}/${maxRetries}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ==================== JianYing ASR ====================

class JianYingASR {
  constructor(audioInput, { startTime = 0, endTime = 6000, needWordTimeStamp = false } = {}) {
    this.audioInput = audioInput;
    this.startTime = startTime;
    this.endTime = endTime;
    this.needWordTimeStamp = needWordTimeStamp;

    // Load file
    if (Buffer.isBuffer(audioInput)) {
      this.fileBinary = audioInput;
    } else {
      this.fileBinary = readFileSync(audioInput);
    }
    this.crc32Hex = crc32(this.fileBinary);

    // AWS credentials
    this.sessionToken = null;
    this.secretKey = null;
    this.accessKey = null;

    // Upload details
    this.storeUri = null;
    this.auth = null;
    this.uploadId = null;
    this.sessionKey = null;
    this.uploadHosts = null;

    this.tdid = this._getTid();
  }

  _getTid() {
    const yearStr = String(new Date().getFullYear());
    const i = parseInt(yearStr[3], 10);
    const fr = 390 + i;
    const ed =
      i % 2 !== 0
        ? "3278516897751"
        : String(Date.now() * 1000 + Math.floor(Math.random() * 1e6)).padStart(13, "0");
    return `${fr}${ed}`;
  }

  async _generateSignParameters(urlPath) {
    const currentTime = String(Math.floor(Date.now() / 1000));
    const data = {
      url: urlPath,
      current_time: currentTime,
      pf: "4",
      appvr: "6.6.0",
      tdid: this.tdid,
    };
    const headers = {
      "User-Agent": `VideoCaptioner/${VERSION}`,
      "Content-Type": "application/json",
      tdid: this.tdid,
      t: currentTime,
    };

    const getSignUrl = "https://asrtools-update.bkfeng.top/sign";
    const resp = await fetch(getSignUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      throw new Error(`Sign request failed: ${resp.status} ${resp.statusText}`);
    }
    const respData = await resp.json();
    const sign = respData.sign;
    if (!sign) {
      throw new Error("No 'sign' in sign response");
    }
    return { sign: sign.toLowerCase(), deviceTime: currentTime };
  }

  _buildHeaders(deviceTime, sign) {
    return {
      "User-Agent":
        "Cronet/TTNetVersion:d4572e53 2024-06-12 QuicVersion:4bf243e0 2023-04-17",
      appvr: "6.6.0",
      "device-time": String(deviceTime),
      pf: "4",
      sign,
      "sign-ver": "1",
      tdid: this.tdid,
      "Content-Type": "application/json",
    };
  }

  _uploadHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 Thea/1.0.1",
      Authorization: this.auth,
      "Content-CRC32": this.crc32Hex,
    };
  }

  // Step 1: Get upload credentials
  async _uploadSign() {
    const url = "https://lv-pc-api-sinfonlinec.ulikecam.com/lv/v1/upload_sign";
    const { sign, deviceTime } = await this._generateSignParameters("/lv/v1/upload_sign");
    const headers = this._buildHeaders(deviceTime, sign);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ biz: "pc-recognition" }),
    });
    if (!resp.ok) {
      throw new Error(`Upload sign failed: ${resp.status}`);
    }
    const loginData = await resp.json();
    this.accessKey = loginData.data.access_key_id;
    this.secretKey = loginData.data.secret_access_key;
    this.sessionToken = loginData.data.session_token;
  }

  // Step 2: Get upload authorization (AWS Signature V4)
  async _uploadAuth() {
    const fileSize = this.fileBinary.length;
    const requestParameters = `Action=ApplyUploadInner&FileSize=${fileSize}&FileType=object&IsInner=1&SpaceName=lv-mac-recognition&Version=2020-11-19&s=5y0udbjapi`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const dateStamp = amzDate.split("T")[0];

    const headers = {
      "x-amz-date": amzDate,
      "x-amz-security-token": this.sessionToken,
    };

    const signature = awsSignature(this.secretKey, requestParameters, headers, {
      region: "cn",
      service: "vod",
    });
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${dateStamp}/cn/vod/aws4_request, SignedHeaders=x-amz-date;x-amz-security-token, Signature=${signature}`;
    headers["authorization"] = authorization;

    const resp = await fetch(
      `https://vod.bytedanceapi.com/?${requestParameters}`,
      { headers },
    );
    const storeInfos = await resp.json();

    const uploadAddress = storeInfos.Result.UploadAddress;
    const storeInfo = uploadAddress.StoreInfos[0];
    this.storeUri = storeInfo.StoreUri;
    this.auth = storeInfo.Auth;
    this.uploadId = storeInfo.UploadID;
    this.sessionKey = uploadAddress.SessionKey;
    this.uploadHosts = uploadAddress.UploadHosts[0];
  }

  // Step 3: Upload file
  async _uploadFile() {
    const url = `https://${this.uploadHosts}/${this.storeUri}?partNumber=1&uploadID=${this.uploadId}`;
    const headers = this._uploadHeaders();
    const blob = new Blob([this.fileBinary]);
    const resp = await fetchWithRetry(url, {
      method: "PUT",
      headers,
      body: blob,
      duplex: "half",
    });
    const respData = await resp.json();
    if (respData.success !== 0) {
      throw new Error(`File upload failed: ${JSON.stringify(respData)}`);
    }
  }

  // Step 4: Check upload
  async _uploadCheck() {
    const url = `https://${this.uploadHosts}/${this.storeUri}?uploadID=${this.uploadId}`;
    const headers = this._uploadHeaders();
    const resp = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: `1:${this.crc32Hex}`,
    });
    await resp.json();
  }

  // Step 5: Commit upload
  async _uploadCommit() {
    const url = `https://${this.uploadHosts}/${this.storeUri}?uploadID=${this.uploadId}&partNumber=1&x-amz-security-token=${this.sessionToken}`;
    const headers = this._uploadHeaders();
    const blob = new Blob([this.fileBinary]);
    await fetchWithRetry(url, {
      method: "PUT",
      headers,
      body: blob,
      duplex: "half",
    });
    return this.storeUri;
  }

  async upload() {
    console.log("  [1/5] Getting upload credentials...");
    await this._uploadSign();
    console.log("  [2/5] Getting upload authorization...");
    await this._uploadAuth();
    console.log("  [3/5] Uploading file...");
    await this._uploadFile();
    console.log("  [4/5] Checking upload...");
    await this._uploadCheck();
    console.log("  [5/5] Committing upload...");
    await this._uploadCommit();
    return this.storeUri;
  }

  async submit() {
    const url =
      "https://lv-pc-api-sinfonlinec.ulikecam.com/lv/v1/audio_subtitle/submit";
    const payload = {
      adjust_endtime: 200,
      audio: this.storeUri,
      caption_type: 2,
      client_request_id: crypto.randomUUID(),
      max_lines: 1,
      songs_info: [
        { end_time: this.endTime, id: "", start_time: this.startTime },
      ],
      words_per_line: 16,
    };

    const { sign, deviceTime } = await this._generateSignParameters(
      "/lv/v1/audio_subtitle/submit",
    );
    const headers = this._buildHeaders(deviceTime, sign);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const respData = await resp.json();

    if (respData.ret !== "0") {
      throw new Error(
        `Submit API Error: ${respData.errmsg || "Unknown error"} (ret: ${respData.ret})`,
      );
    }
    return respData.data.id;
  }

  async query(queryId) {
    const url =
      "https://lv-pc-api-sinfonlinec.ulikecam.com/lv/v1/audio_subtitle/query";
    const payload = { id: queryId, pack_options: { need_attribute: true } };

    const { sign, deviceTime } = await this._generateSignParameters(
      "/lv/v1/audio_subtitle/query",
    );
    const headers = this._buildHeaders(deviceTime, sign);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const respData = await resp.json();

    if (respData.ret !== "0") {
      throw new Error(
        `Query API Error: ${respData.errmsg || "Unknown error"} (ret: ${respData.ret})`,
      );
    }
    return respData;
  }

  async run() {
    console.log("Uploading audio...");
    await this.upload();

    console.log("Submitting ASR task...");
    const queryId = await this.submit();

    console.log(`Querying result (id: ${queryId})...`);
    // Poll for result
    let respData;
    for (let i = 0; i < 60; i++) {
      respData = await this.query(queryId);
      if (
        respData.data &&
        respData.data.utterances &&
        respData.data.utterances.length > 0
      ) {
        break;
      }
      console.log(`  Waiting for result... (${i + 1}/60)`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!respData?.data?.utterances?.length) {
      throw new Error("ASR task timed out or returned no results");
    }

    return this._makeSegments(respData);
  }

  _makeSegments(respData) {
    const utterances = respData.data.utterances;
    if (this.needWordTimeStamp) {
      return utterances.flatMap((u) =>
        u.words.map((w) => ({
          text: w.text.trim(),
          startMs: w.start_time,
          endMs: w.end_time,
          timestampMs: null,
          confidence: 1,
        })),
      );
    }
    return utterances.map((u) => ({
      text: u.text,
      startMs: u.start_time,
      endMs: u.end_time,
      timestampMs: null,
      confidence: 1,
    }));
  }
}

// ==================== CLI ====================

function extractToTempAudioFile(fileToTranscribe, tempOutFile) {
  execSync(
    `npx remotion ffmpeg -i "${fileToTranscribe}" -ar 16000 "${tempOutFile}" -y`,
    { stdio: ["ignore", "inherit"] },
  );
}

function getAudioDurationMs(filePath) {
  try {
    const output = execSync(
      `npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: "utf-8" },
    ).trim();
    return Math.ceil(parseFloat(output) * 1000);
  } catch {
    return 6000 * 1000; // fallback to a large value
  }
}

async function processVideo(fullPath, entry, directory) {
  if (
    !fullPath.endsWith(".mp4") &&
    !fullPath.endsWith(".webm") &&
    !fullPath.endsWith(".mkv") &&
    !fullPath.endsWith(".mov")
  ) {
    return;
  }

  const outJson = fullPath
    .replace(/.mp4$/, ".json")
    .replace(/.mkv$/, ".json")
    .replace(/.mov$/, ".json")
    .replace(/.webm$/, ".json");

  if (existsSync(outJson)) {
    console.log(`Skipping ${entry} (already transcribed)`);
    return;
  }

  let shouldRemoveTempDirectory = false;
  const tempDir = path.join(process.cwd(), "temp");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir);
    shouldRemoveTempDirectory = true;
  }

  console.log(`\nProcessing: ${entry}`);

  // Extract audio
  const tempWavFileName = entry.split(".")[0] + ".wav";
  const tempOutFilePath = path.join(tempDir, tempWavFileName);

  console.log("Extracting audio...");
  extractToTempAudioFile(fullPath, tempOutFilePath);

  // Get audio duration
  const durationMs = getAudioDurationMs(fullPath);
  console.log(`Audio duration: ${(durationMs / 1000).toFixed(1)}s`);

  // Run JianYing ASR
  const asr = new JianYingASR(tempOutFilePath, {
    startTime: 0,
    endTime: durationMs,
  });
  const captions = await asr.run();

  // Write output
  writeFileSync(outJson, JSON.stringify(captions, null, 2));
  console.log(`Saved: ${outJson}`);
  console.log(`  ${captions.length} caption segments`);

  if (shouldRemoveTempDirectory) {
    rmSync(tempDir, { recursive: true });
  }
}

async function processDirectory(directory) {
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
}

// ==================== Main ====================

const hasArgs = process.argv.length > 2;

if (!hasArgs) {
  console.log("Usage: node jianying.mjs <video-or-directory> [...]");
  console.log("Processing all files in public/ ...");
  await processDirectory(path.join(process.cwd(), "public"));
  process.exit(0);
}

for (const arg of process.argv.slice(2)) {
  const fullPath = path.resolve(arg);
  const stat = lstatSync(fullPath);

  if (stat.isDirectory()) {
    await processDirectory(fullPath);
    continue;
  }

  console.log(`Processing file: ${fullPath}`);
  const directory = path.dirname(fullPath);
  const fileName = path.basename(fullPath);
  await processVideo(fullPath, fileName, directory);
}
