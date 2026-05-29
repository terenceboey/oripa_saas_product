import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type UploadKind = "carousel-banner" | "pack-banner" | "card-art";

const uploadRoot = path.resolve(process.cwd(), "apps/api/uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);

type VariantSpec = {
  desktopWidth: number;
  mobileWidth: number;
  desktopQuality: number;
  mobileQuality: number;
};

const kindVariantSpecs: Record<UploadKind, VariantSpec> = {
  "carousel-banner": { desktopWidth: 1600, mobileWidth: 800, desktopQuality: 78, mobileQuality: 72 },
  "pack-banner": { desktopWidth: 1600, mobileWidth: 800, desktopQuality: 78, mobileQuality: 72 },
  "card-art": { desktopWidth: 900, mobileWidth: 450, desktopQuality: 80, mobileQuality: 76 },
};

function sanitizeKind(kind: string): UploadKind {
  if (kind === "carousel-banner" || kind === "pack-banner" || kind === "card-art") return kind;
  return "pack-banner";
}

export async function ensureUploadRoot() {
  await fs.mkdir(uploadRoot, { recursive: true });
}

export async function optimizeAndPersistImage(input: { fileBuffer: Buffer; kindRaw: string; appUrl?: string }) {
  if (!input.fileBuffer?.length) {
    throw new Error("empty file");
  }
  if (input.fileBuffer.length > MAX_BYTES) {
    throw new Error("file too large (max 5MB)");
  }

  const metadata = await sharp(input.fileBuffer).metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new Error("unsupported image format (jpg/png/webp only)");
  }

  const kind = sanitizeKind(input.kindRaw);
  const spec = kindVariantSpecs[kind];
  const day = new Date().toISOString().slice(0, 10);
  const id = randomUUID().replace(/-/g, "");
  const dir = path.join(uploadRoot, kind, day);
  await fs.mkdir(dir, { recursive: true });

  const desktopFile = `${id}-desktop.webp`;
  const mobileFile = `${id}-mobile.webp`;
  const desktopPath = path.join(dir, desktopFile);
  const mobilePath = path.join(dir, mobileFile);

  const source = sharp(input.fileBuffer).rotate();
  await source.clone().resize({ width: spec.desktopWidth, withoutEnlargement: true }).webp({ quality: spec.desktopQuality, effort: 5 }).toFile(desktopPath);
  await source.clone().resize({ width: spec.mobileWidth, withoutEnlargement: true }).webp({ quality: spec.mobileQuality, effort: 5 }).toFile(mobilePath);

  const relativeDesktop = `/uploads/${kind}/${day}/${desktopFile}`;
  const relativeMobile = `/uploads/${kind}/${day}/${mobileFile}`;
  const absoluteDesktop = input.appUrl ? `${input.appUrl.replace(/\/$/, "")}${relativeDesktop}` : relativeDesktop;
  const absoluteMobile = input.appUrl ? `${input.appUrl.replace(/\/$/, "")}${relativeMobile}` : relativeMobile;

  return {
    kind,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format,
    desktopUrl: absoluteDesktop,
    mobileUrl: absoluteMobile,
    bytesUploaded: input.fileBuffer.length,
  };
}

