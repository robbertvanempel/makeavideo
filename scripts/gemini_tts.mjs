#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Kore";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

function configDirectory() {
  if (process.env.MAKEAVIDEO_CONFIG_DIR) {
    return path.resolve(process.env.MAKEAVIDEO_CONFIG_DIR);
  }
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "makeavideo");
  }
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "makeavideo");
  }
  return path.join(os.homedir(), ".config", "makeavideo");
}

function readStoredKey() {
  const credentialPath = path.join(configDirectory(), "credentials.json");
  if (!existsSync(credentialPath)) return "";
  try {
    const parsed = JSON.parse(readFileSync(credentialPath, "utf8"));
    return typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey.trim() : "";
  } catch {
    return "";
  }
}

function resolveKey() {
  return (
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    readStoredKey()
  );
}

function parseArguments(argv) {
  const options = {
    model: process.env.GEMINI_TTS_MODEL || DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    style: "Natural, clear delivery at a comfortable pace.",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--self-test") options.selfTest = true;
    else if (argument === "--input") options.input = argv[++index];
    else if (argument === "--output") options.output = argv[++index];
    else if (argument === "--voice") options.voice = argv[++index];
    else if (argument === "--style") options.style = argv[++index];
    else if (argument === "--model") options.model = argv[++index];
    else fail(`unknown option: ${argument}`);
  }
  return options;
}

function wavFromPcm(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function findAudioData(payload) {
  const direct =
    payload?.outputAudio?.data ||
    payload?.output_audio?.data ||
    payload?.output?.audio?.data;
  if (typeof direct === "string") return direct;

  const queue = [payload];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object") continue;
    if (
      typeof value.data === "string" &&
      (String(value.type || "").toLowerCase() === "audio" ||
        String(value.mimeType || value.mime_type || "").startsWith("audio/"))
    ) {
      return value.data;
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return "";
}

function sanitizeApiError(status, payload) {
  if ([400, 401, 403].includes(status)) {
    return "Gemini rejected the API key or request. Configure the key again with setup.mjs --set-key.";
  }
  const apiMessage =
    typeof payload?.error?.message === "string"
      ? payload.error.message.replace(/AIza[0-9A-Za-z_-]+/g, "[API-KEY]")
      : "";
  return apiMessage
    ? `Gemini HTTP ${status}: ${apiMessage}`
    : `Gemini returned HTTP ${status}.`;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestAudio({ key, model, voice, style, text }) {
  const body = {
    model,
    input: [
      "Read the SCRIPT exactly as written. Do not add, omit, summarize, translate, or comment on words.",
      "",
      "### DIRECTOR'S NOTES",
      style,
      "",
      "### SCRIPT",
      text,
    ].join("\n"),
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice }],
    },
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = new Error(`network error: ${error.message}`);
      if (attempt < 3) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Keep the generic HTTP error below; never print raw bodies that may echo input.
    }

    if (response.ok) {
      const audioData = findAudioData(payload);
      if (audioData) return Buffer.from(audioData, "base64");
      lastError = new Error("Gemini returned no audio data");
    } else {
      lastError = new Error(sanitizeApiError(response.status, payload));
      if (![429, 500, 502, 503, 504].includes(response.status)) throw lastError;
    }

    if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastError || new Error("unknown Gemini TTS error");
}

function usage() {
  process.stdout.write(`Usage:
  node gemini_tts.mjs --input scene.txt --output voice_001.wav \\
    [--voice Kore] [--style "Warm, clear English"] [--model MODEL]

The key is read from GOOGLE_API_KEY, GEMINI_API_KEY, or the local credential
store created by setup.mjs. Never pass a key as an argument.
`);
}

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  usage();
  process.exit(0);
}

if (options.selfTest) {
  const sample = wavFromPcm(Buffer.alloc(480));
  if (
    sample.toString("ascii", 0, 4) !== "RIFF" ||
    sample.toString("ascii", 8, 12) !== "WAVE" ||
    sample.readUInt32LE(40) !== 480
  ) {
    fail("internal WAV test failed");
  }
  process.stdout.write("WAV self-test passed.\n");
  process.exit(0);
}

if (!options.input || !options.output) {
  usage();
  fail("--input and --output are required");
}
if (!options.voice || !options.style || !options.model) {
  fail("--voice, --style, and --model cannot be empty");
}
if (!existsSync(options.input)) fail(`input file does not exist: ${options.input}`);

const text = readFileSync(options.input, "utf8").trim();
if (!text) fail("input file is empty");

const key = resolveKey();
if (!key) {
  fail(
    "no Gemini API key found; run node setup.mjs --set-key first",
  );
}

let audio;
try {
  audio = await requestAudio({
    key,
    model: options.model,
    voice: options.voice,
    style: options.style,
    text,
  });
} catch (error) {
  fail(error.message);
}

const output = path.resolve(options.output);
mkdirSync(path.dirname(output), { recursive: true });
const wav =
  audio.length >= 12 &&
  audio.toString("ascii", 0, 4) === "RIFF" &&
  audio.toString("ascii", 8, 12) === "WAVE"
    ? audio
    : wavFromPcm(audio);
writeFileSync(output, wav);
process.stdout.write(`WAV written: ${output} (${wav.length} bytes)\n`);
