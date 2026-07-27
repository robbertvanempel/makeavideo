#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const LINKS = {
  aiStudio: "https://aistudio.google.com/apikey",
  hyperframes: "https://hyperframes.heygen.com/quickstart",
};

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

const configDir = configDirectory();
const credentialsPath = path.join(configDir, "credentials.json");

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  return !result.error && result.status === 0;
}

function readStoredKey() {
  if (!existsSync(credentialsPath)) return "";
  try {
    const parsed = JSON.parse(readFileSync(credentialsPath, "utf8"));
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

function status() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  const envKey = Boolean(
    process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim(),
  );
  const storedKey = Boolean(readStoredKey());
  return {
    ready:
      major >= 22 &&
      commandExists("npx") &&
      commandExists("ffmpeg") &&
      commandExists("ffprobe") &&
      (envKey || storedKey),
    node: {
      ok: major >= 22,
      version: process.versions.node,
      requiredMajor: 22,
    },
    npx: { ok: commandExists("npx") },
    ffmpeg: { ok: commandExists("ffmpeg") },
    ffprobe: { ok: commandExists("ffprobe") },
    keyConfigured: envKey || storedKey,
    keySource: envKey ? "environment" : storedKey ? "credential-store" : null,
    credentialStore: credentialsPath,
    links: LINKS,
  };
}

function printStatus(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const mark = (ok) => (ok ? "OK" : "MISSING");
  process.stdout.write(
    [
      `Node.js 22+: ${mark(result.node.ok)} (${result.node.version})`,
      `npx: ${mark(result.npx.ok)}`,
      `FFmpeg: ${mark(result.ffmpeg.ok)}`,
      `ffprobe: ${mark(result.ffprobe.ok)}`,
      `Gemini API key: ${mark(result.keyConfigured)}`,
      `Ready for video production: ${result.ready ? "YES" : "NO"}`,
      "",
      `Google AI Studio: ${LINKS.aiStudio}`,
      `HyperFrames: ${LINKS.hyperframes}`,
    ].join("\n"),
  );
  process.stdout.write("\n");
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY) {
    fail("run --set-key in an interactive terminal; never paste the key into chat");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return await new Promise((resolve, reject) => {
    let value = "";
    let settled = false;
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (settled) return;
        if (character === "\u0003") {
          settled = true;
          cleanup();
          process.stdout.write("\n");
          reject(new Error("cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          settled = true;
          cleanup();
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

function saveKey(key) {
  if (key.length < 20 || /\s/.test(key)) {
    fail("the pasted value does not look like a valid API key");
  }
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  const temporaryPath = `${credentialsPath}.${process.pid}.tmp`;
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({ geminiApiKey: key }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, credentialsPath);
    chmodSync(credentialsPath, 0o600);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

async function verifyKey() {
  const key = resolveKey();
  if (!key) fail(`no API key is configured; create one at ${LINKS.aiStudio}`);
  let response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      { headers: { "x-goog-api-key": key } },
    );
  } catch (error) {
    fail(`network error while verifying the key: ${error.message}`);
  }
  if (!response.ok) {
    const message =
      response.status === 400 || response.status === 401 || response.status === 403
        ? "the Gemini API key was rejected"
        : `Gemini returned HTTP ${response.status}`;
    fail(`${message}; manage the key at ${LINKS.aiStudio}`);
  }
  process.stdout.write("The Gemini API key works.\n");
}

function usage() {
  process.stdout.write(`Usage:
  node setup.mjs --status [--json]
  node setup.mjs --set-key
  node setup.mjs --verify-key

--set-key stores the key outside projects with read/write access limited to
the current user. Existing GEMINI_API_KEY or GOOGLE_API_KEY environment
variables remain supported.
`);
}

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  usage();
} else if (args.has("--set-key")) {
  try {
    const key = await readSecret("Paste your Gemini API key (input remains hidden): ");
    saveKey(key);
    process.stdout.write(
      `Key stored securely in ${credentialsPath}. The key itself was not displayed.\n`,
    );
  } catch (error) {
    fail(error.message);
  }
} else if (args.has("--verify-key")) {
  await verifyKey();
} else if (args.has("--status") || args.size === 0 || args.has("--json")) {
  printStatus(status(), args.has("--json"));
} else {
  usage();
  fail("unknown option");
}
