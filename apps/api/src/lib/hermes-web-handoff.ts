import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { creativeStorageAbsolutePathFromUrl, resolveCreativeStorageRoot } from "./creative-storage";

type HandoffImage = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

type PreparedHandoffImage = HandoffImage & {
  localPath?: string;
};

export type HermesGptWebHandoffInput = {
  creativeJobId: string;
  vendorId: string;
  prompt: string;
  negativePrompt?: string;
  images: HandoffImage[];
  appUrl?: string;
  imageCount?: number;
};

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "unknown";
}

function isLocalRuntimeEnabled() {
  if (process.env.ORIPA_ENABLE_HERMES_WEB_HANDOFF === "1") return true;
  if (process.env.ORIPA_DISABLE_HERMES_WEB_HANDOFF === "1") return false;
  return false;
}

function normalizeUrl(url: string, appUrl?: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) return trimmed;
  const base = String(appUrl ?? process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  return base ? `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}` : trimmed;
}

async function materializeDataUrl(dataUrl: string, directory: string, index: number) {
  const match = dataUrl.match(/^data:([^;,]+)(;charset=[^;,]+)?(;base64)?,(.*)$/);
  if (!match) return undefined;
  const mimeType = match[1] ?? "application/octet-stream";
  const encoded = match[4] ?? "";
  const isBase64 = Boolean(match[3]);
  const buffer = isBase64 ? Buffer.from(encoded, "base64") : Buffer.from(decodeURIComponent(encoded), "utf8");
  const extension = mimeType.includes("svg") ? "svg" : mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : mimeType.includes("png") ? "png" : "bin";
  const filePath = path.join(directory, `source-${index + 1}.${extension}`);
  await fsp.writeFile(filePath, buffer);
  return filePath;
}

function localPathForCreativeStorageUrl(imageUrl: string) {
  try {
    return creativeStorageAbsolutePathFromUrl({ imageUrl });
  } catch {
    return undefined;
  }
}

async function prepareImages(images: HandoffImage[], directory: string, appUrl?: string): Promise<PreparedHandoffImage[]> {
  const prepared: PreparedHandoffImage[] = [];
  for (const [index, image] of images.entries()) {
    const normalizedUrl = normalizeUrl(String(image.imageUrl ?? ""), appUrl);
    let localPath: string | undefined;
    if (normalizedUrl.startsWith("data:")) {
      localPath = await materializeDataUrl(normalizedUrl, directory, index);
    } else {
      const storagePath = localPathForCreativeStorageUrl(normalizedUrl);
      if (storagePath && fs.existsSync(storagePath)) localPath = storagePath;
    }
    prepared.push({ ...image, imageUrl: normalizedUrl, localPath });
  }
  return prepared;
}

function buildTaskPrompt(input: HermesGptWebHandoffInput, preparedImages: PreparedHandoffImage[], handoffDirectory: string) {
  const imageLines = preparedImages.map((image, index) => {
    const handle = image.localPath || image.imageUrl || "missing image";
    return `${index + 1}. ${image.label} (${image.id}): ${handle}`;
  }).join("\n");
  return [
    "You are running a local Oripa banner demo handoff.",
    "Goal: use the ChatGPT/GPT Image web app in the browser to create ONE storefront banner from the supplied source images and prompt.",
    "Do not publish anything. Do not claim production readiness. If ChatGPT login, CAPTCHA, or image generation blocks you, stop and report the blocker clearly.",
    "",
    "Steps:",
    "1. Open https://chatgpt.com/ in the browser.",
    "2. Start a new chat if needed.",
    "3. Attach every source image listed below. If a local path is provided, upload that file. If only a URL is provided, open/download it first if the UI needs a file.",
    "4. Paste the ORIPA PROMPT below exactly.",
    "5. Ask GPT Image to generate one banner.",
    `6. If an image is produced, download it to: ${handoffDirectory}`,
    "7. Final response must include: generated file path if downloaded, or the exact blocker if not.",
    "",
    `Creative job: ${input.creativeJobId}`,
    `Vendor: ${input.vendorId}`,
    `Requested images: ${input.imageCount ?? 1}`,
    "",
    "SOURCE IMAGES:",
    imageLines || "No source images supplied.",
    "",
    "ORIPA PROMPT:",
    input.prompt,
    input.negativePrompt ? `\nNEGATIVE / SAFETY PROMPT:\n${input.negativePrompt}` : "",
  ].join("\n");
}

export async function startHermesGptWebHandoff(input: HermesGptWebHandoffInput) {
  if (!isLocalRuntimeEnabled()) {
    throw new Error("Hermes GPT web handoff is disabled. Set ORIPA_ENABLE_HERMES_WEB_HANDOFF=1 for this local demo runtime.");
  }
  if (!input.prompt.trim()) throw new Error("handoff prompt is required");
  if (!input.images.length) throw new Error("at least one source image is required for Hermes handoff");

  const handoffId = crypto.createHash("sha256").update(JSON.stringify({
    creativeJobId: input.creativeJobId,
    vendorId: input.vendorId,
    prompt: input.prompt,
    images: input.images.map((image) => image.id),
    createdAt: Date.now(),
  })).digest("hex").slice(0, 16);
  const root = resolveCreativeStorageRoot();
  const handoffDirectory = path.join(root, "private", "hermes-handoffs", safeSegment(input.creativeJobId), handoffId);
  await fsp.mkdir(handoffDirectory, { recursive: true });

  const preparedImages = await prepareImages(input.images.slice(0, 5), handoffDirectory, input.appUrl);
  const taskPrompt = buildTaskPrompt(input, preparedImages, handoffDirectory);
  const packetPath = path.join(handoffDirectory, "handoff.json");
  const promptPath = path.join(handoffDirectory, "prompt.txt");
  const logPath = path.join(handoffDirectory, "hermes.log");
  await fsp.writeFile(promptPath, taskPrompt);
  await fsp.writeFile(packetPath, JSON.stringify({
    handoffId,
    creativeJobId: input.creativeJobId,
    vendorId: input.vendorId,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt ?? null,
    images: preparedImages,
    promptPath,
    logPath,
    handoffDirectory,
    createdAt: new Date().toISOString(),
  }, null, 2));

  const command = process.env.ORIPA_HERMES_COMMAND || "hermes";
  const args = ["--oneshot", taskPrompt, "--toolsets", process.env.ORIPA_HERMES_TOOLSETS || "browser,terminal"];
  const logFd = fs.openSync(logPath, "a");
  fs.writeSync(logFd, `[oripa] starting Hermes GPT web handoff ${handoffId} at ${new Date().toISOString()}\n`);
  fs.writeSync(logFd, `[oripa] command: ${command} ${args.map((arg) => JSON.stringify(arg)).join(" ")}\n\n`);
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    HERMES_HOME: process.env.HERMES_HOME,
    HERMES_PROFILE: process.env.ORIPA_HERMES_PROFILE ?? process.env.HERMES_PROFILE,
    ORIPA_HERMES_HANDOFF_ID: handoffId,
  };
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: childEnv,
  });
  child.unref();
  return {
    handoffId,
    status: "started" as const,
    pid: child.pid ?? null,
    packetPath,
    promptPath,
    logPath,
    handoffDirectory,
    images: preparedImages.map((image) => ({ id: image.id, label: image.label, imageUrl: image.imageUrl, localPath: image.localPath })),
  };
}
