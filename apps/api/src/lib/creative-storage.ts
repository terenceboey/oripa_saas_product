import crypto from "node:crypto";
import dns from "node:dns/promises";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_HDD_CREATIVE_STORAGE_ROOT = "/mnt/archive/oripa-creative-storage";
const FALLBACK_CREATIVE_STORAGE_ROOT = path.resolve(process.cwd(), "apps/api/creative-storage");
const MAX_CREATIVE_IMAGE_BYTES = 15 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);

export function resolveCreativeStorageRoot() {
  const configured = String(process.env.ORIPA_CREATIVE_STORAGE_ROOT ?? "").trim();
  if (configured) return path.resolve(configured);
  if (existsSync(DEFAULT_HDD_CREATIVE_STORAGE_ROOT)) return path.resolve(DEFAULT_HDD_CREATIVE_STORAGE_ROOT);
  return FALLBACK_CREATIVE_STORAGE_ROOT;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "unknown";
}

function extensionForFormat(format: string) {
  if (format === "jpeg") return "jpg";
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return "bin";
}

function publicUrlFor(relativeUrl: string, publicBaseUrl?: string) {
  const base = String(publicBaseUrl ?? "").trim().replace(/\/$/, "");
  return base ? `${base}${relativeUrl}` : relativeUrl;
}

export function creativeStorageAbsolutePathFromUrl(input: { imageUrl: string; storageRoot?: string }) {
  const raw = String(input.imageUrl ?? "").trim();
  const pathname = raw.startsWith("http://") || raw.startsWith("https://")
    ? new URL(raw).pathname
    : raw.split(/[?#]/)[0];
  if (!pathname.startsWith("/creative-storage/private/")) {
    throw new Error("image URL must be a private creative-storage path");
  }
  const relative = decodeURIComponent(pathname.slice("/creative-storage/".length));
  if (!relative || relative.includes("\0")) throw new Error("invalid creative-storage path");
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const absolutePath = path.resolve(root, relative);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(rootPrefix)) {
    throw new Error("creative-storage path escapes storage root");
  }
  return absolutePath;
}

function isBlockedIpAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) {
    return isBlockedIpv4(address);
  }
  if (family === 6) {
    const mapped = mappedIpv4FromIpv6(address);
    if (mapped) return isBlockedIpv4(mapped);
    const segments = expandIpv6(address);
    if (!segments) return true;
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      (segments[0] & 0xfe00) === 0xfc00 ||
      (segments[0] & 0xffc0) === 0xfe80 ||
      (segments[0] & 0xff00) === 0xff00
    );
  }
  return true;
}

export function isUnsafeCreativeRemoteAddress(address: string) {
  return isBlockedIpAddress(address);
}

function isBlockedIpv4(address: string) {
  const [a, b] = address.split(".").map((part) => Number(part));
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function expandIpv6(address: string) {
  const lower = address.toLowerCase();
  const convertPart = (part: string) => {
    if (part.includes(".")) {
      if (net.isIP(part) !== 4) return null;
      const octets = part.split(".").map((octet) => Number(octet));
      return [((octets[0] << 8) | octets[1]), ((octets[2] << 8) | octets[3])];
    }
    if (!/^[0-9a-f]{0,4}$/.test(part)) return null;
    return [part ? parseInt(part, 16) : 0];
  };
  const [leftRaw, rightRaw] = lower.split("::");
  if (lower.split("::").length > 2) return null;
  const left = leftRaw ? leftRaw.split(":").flatMap((part) => convertPart(part) ?? [Number.NaN]) : [];
  const right = rightRaw ? rightRaw.split(":").flatMap((part) => convertPart(part) ?? [Number.NaN]) : [];
  if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;
  const missing = 8 - left.length - right.length;
  if (lower.includes("::")) {
    if (missing < 0) return null;
    return [...left, ...Array.from({ length: missing }, () => 0), ...right];
  }
  return left.length === 8 ? left : null;
}

function mappedIpv4FromIpv6(address: string) {
  const segments = expandIpv6(address);
  if (!segments) return null;
  if (!segments.slice(0, 5).every((segment) => segment === 0) || segments[5] !== 0xffff) return null;
  const high = segments[6];
  const low = segments[7];
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

async function resolveSafeRemoteImageUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("card image URL must be http(s)");
  if (parsed.username || parsed.password) throw new Error("card image URL credentials are not allowed");
  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname)) throw new Error("localhost card image URL is not allowed");
  if (net.isIP(hostname) && isBlockedIpAddress(hostname)) throw new Error("private-network card image URL is not allowed");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  const safeRecords = records.filter((record) => !isBlockedIpAddress(record.address));
  if (safeRecords.length === 0 || safeRecords.length !== records.length) {
    throw new Error("card image URL resolves to a private or unsafe address");
  }
  return { parsed, record: safeRecords[0] };
}

async function fetchRemoteImageBuffer(rawUrl: string) {
  const { parsed, record } = await resolveSafeRemoteImageUrl(rawUrl);
  const client = parsed.protocol === "https:" ? https : http;
  return new Promise<Buffer>((resolve, reject) => {
    const request = client.request(parsed, {
      method: "GET",
      timeout: 10_000,
      lookup: ((_hostname: string, options: any, callback: any) => {
        if (typeof options === "function") {
          options(null, record.address, record.family);
          return;
        }
        if (options?.all) {
          callback(null, [{ address: record.address, family: record.family }]);
          return;
        }
        callback(null, record.address, record.family);
      }) as any,
      headers: { accept: "image/png,image/jpeg,image/webp" },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.resume();
        reject(new Error("card image redirects are not allowed"));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`failed to fetch card image: ${status}`));
        return;
      }
      const contentType = String(response.headers["content-type"] ?? "");
      if (!contentType.toLowerCase().startsWith("image/")) {
        response.resume();
        reject(new Error("card image response must be an image"));
        return;
      }
      const contentLength = Number(response.headers["content-length"] ?? 0);
      if (contentLength > MAX_CREATIVE_IMAGE_BYTES) {
        response.resume();
        reject(new Error("card image too large (max 15MB)"));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_CREATIVE_IMAGE_BYTES) {
          request.destroy(new Error("card image too large (max 15MB)"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.on("timeout", () => request.destroy(new Error("card image fetch timed out")));
    request.on("error", reject);
    request.end();
  });
}

export async function persistCreativeCandidateImage(input: {
  fileBuffer: Buffer;
  originalName?: string | null;
  mimeType?: string | null;
  creativeJobId: string;
  vendorId: string;
  storageRoot?: string;
  publicBaseUrl?: string;
}) {
  if (!input.fileBuffer?.length) throw new Error("empty file");
  if (input.fileBuffer.length > MAX_CREATIVE_IMAGE_BYTES) throw new Error("file too large (max 15MB)");

  const metadata = await sharp(input.fileBuffer).metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new Error("unsupported image format (jpg/png/webp only)");
  }

  const contentHash = crypto.createHash("sha256").update(input.fileBuffer).digest("hex");
  const ext = extensionForFormat(metadata.format);
  const day = new Date().toISOString().slice(0, 10);
  const jobSegment = safeSegment(input.creativeJobId);
  const vendorSegment = safeSegment(input.vendorId);
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const relativePath = path.join("private", "creative-jobs", jobSegment, day);
  const directory = path.join(root, relativePath);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${vendorSegment}-${contentHash.slice(0, 20)}.${ext}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, input.fileBuffer, { flag: "wx" }).catch(async (error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    throw error;
  });

  const relativeUrl = `/creative-storage/${relativePath.split(path.sep).join("/")}/${fileName}`;
  return {
    storageRoot: root,
    absolutePath,
    relativeUrl,
    publicUrl: publicUrlFor(relativeUrl, input.publicBaseUrl),
    contentHash,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format,
    mimeType: input.mimeType ?? null,
    originalName: input.originalName ?? null,
    bytesUploaded: input.fileBuffer.length,
  };
}

export async function persistVendorSourceImage(input: {
  fileBuffer: Buffer;
  originalName?: string | null;
  mimeType?: string | null;
  vendorId: string;
  storageRoot?: string;
  publicBaseUrl?: string;
}) {
  if (!input.fileBuffer?.length) throw new Error("empty source image");
  if (input.fileBuffer.length > MAX_CREATIVE_IMAGE_BYTES) throw new Error("source image too large (max 15MB)");

  const metadata = await sharp(input.fileBuffer).metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new Error("unsupported source image format (jpg/png/webp only)");
  }

  const contentHash = crypto.createHash("sha256").update(input.fileBuffer).digest("hex");
  const fileNameHash = crypto.createHash("sha256").update(`${input.originalName ?? "source"}:${contentHash}`).digest("hex");
  const ext = extensionForFormat(metadata.format);
  const day = new Date().toISOString().slice(0, 10);
  const vendorSegment = safeSegment(input.vendorId);
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const relativePath = path.join("private", "source-assets", vendorSegment, day);
  const directory = path.join(root, relativePath);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${fileNameHash.slice(0, 20)}.${ext}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, input.fileBuffer, { flag: "wx" }).catch(async (error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    throw error;
  });

  const relativeUrl = `/creative-storage/${relativePath.split(path.sep).join("/")}/${fileName}`;
  const snapshotHash = crypto.createHash("sha256").update(JSON.stringify({
    source: "upload",
    vendorId: input.vendorId,
    originalName: input.originalName ?? null,
    contentHash,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format,
  })).digest("hex");
  return {
    id: `source_upload:${contentHash.slice(0, 24)}`,
    source: "upload" as const,
    displayName: input.originalName?.replace(/\.[^.]+$/, "").slice(0, 120) || "Vendor uploaded image",
    storageRoot: root,
    absolutePath,
    relativeUrl,
    publicUrl: publicUrlFor(relativeUrl, input.publicBaseUrl),
    contentHash,
    snapshotHash,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format,
    mimeType: input.mimeType ?? null,
    originalName: input.originalName ?? null,
    bytesUploaded: input.fileBuffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function persistGeneratedCreativeImage(input: {
  fileBuffer: Buffer;
  creativeJobId: string;
  vendorId: string;
  storageRoot?: string;
  publicBaseUrl?: string;
}) {
  return persistCreativeCandidateImage({
    fileBuffer: input.fileBuffer,
    originalName: "gpt-image-2-generated.png",
    mimeType: "image/png",
    creativeJobId: input.creativeJobId,
    vendorId: input.vendorId,
    storageRoot: input.storageRoot,
    publicBaseUrl: input.publicBaseUrl,
  });
}


export async function persistCardImageCache(input: {
  fileBuffer: Buffer;
  sourceImageUrl: string;
  packId: string;
  packPrizeId: string;
  vendorId: string;
  label?: string | null;
  storageRoot?: string;
  publicBaseUrl?: string;
}) {
  if (!input.fileBuffer?.length) throw new Error("empty card image");
  if (input.fileBuffer.length > MAX_CREATIVE_IMAGE_BYTES) throw new Error("card image too large (max 15MB)");

  const metadata = await sharp(input.fileBuffer).metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new Error("unsupported card image format (jpg/png/webp only)");
  }

  const sourceHash = crypto.createHash("sha256").update(input.sourceImageUrl).digest("hex");
  const contentHash = crypto.createHash("sha256").update(input.fileBuffer).digest("hex");
  const ext = extensionForFormat(metadata.format);
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const packSegment = safeSegment(input.packId);
  const prizeSegment = safeSegment(input.packPrizeId);
  const relativePath = path.join("private", "card-assets", "pack-prizes", packSegment, prizeSegment);
  const directory = path.join(root, relativePath);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${sourceHash.slice(0, 20)}-${contentHash.slice(0, 20)}.${ext}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, input.fileBuffer, { flag: "wx" }).catch(async (error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    throw error;
  });

  const relativeUrl = `/creative-storage/${relativePath.split(path.sep).join("/")}/${fileName}`;
  const cached = {
    storageRoot: root,
    absolutePath,
    relativeUrl,
    publicUrl: publicUrlFor(relativeUrl, input.publicBaseUrl),
    contentHash,
    sourceHash,
    sourceImageUrl: input.sourceImageUrl,
    packId: input.packId,
    packPrizeId: input.packPrizeId,
    vendorId: input.vendorId,
    label: input.label ?? null,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format,
    bytesUploaded: input.fileBuffer.length,
    cachedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(cached, null, 2));
  return cached;
}

export async function readCachedCardImage(input: { packId: string; packPrizeId: string; storageRoot?: string; publicBaseUrl?: string }) {
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const manifestPath = path.join(root, "private", "card-assets", "pack-prizes", safeSegment(input.packId), safeSegment(input.packPrizeId), "manifest.json");
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const relativeUrl = String(parsed.relativeUrl ?? "");
    return {
      ...parsed,
      storageRoot: root,
      manifestPath,
      publicUrl: publicUrlFor(relativeUrl, input.publicBaseUrl),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function fetchAndPersistCardImage(input: {
  sourceImageUrl: string;
  packId: string;
  packPrizeId: string;
  vendorId: string;
  label?: string | null;
  storageRoot?: string;
  publicBaseUrl?: string;
}) {
  const fileBuffer = await fetchRemoteImageBuffer(input.sourceImageUrl);
  return persistCardImageCache({
    ...input,
    fileBuffer,
  });
}

export async function findHermesHandoffOutputImages(input: {
  creativeJobId: string;
  handoffId: string;
  storageRoot?: string;
}) {
  const root = path.resolve(input.storageRoot || resolveCreativeStorageRoot());
  const handoffDirectory = path.join(
    root,
    "private",
    "hermes-handoffs",
    safeSegment(input.creativeJobId),
    safeSegment(input.handoffId),
  );
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(handoffDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const candidates = [] as Array<{
    handoffDirectory: string;
    fileName: string;
    absolutePath: string;
    bytesUploaded: number;
    contentHash: string;
    width: number | null;
    height: number | null;
    format: string;
    mtimeMs: number;
  }>;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/^source-\d+\./i.test(entry.name)) continue;
    if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
    const absolutePath = path.join(handoffDirectory, entry.name);
    const [fileBuffer, stat] = await Promise.all([fs.readFile(absolutePath), fs.stat(absolutePath)]);
    if (!fileBuffer.length || fileBuffer.length > MAX_CREATIVE_IMAGE_BYTES) continue;
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(fileBuffer).metadata();
    } catch {
      continue;
    }
    if (!metadata.format || !allowedFormats.has(metadata.format)) continue;
    candidates.push({
      handoffDirectory,
      fileName: entry.name,
      absolutePath,
      bytesUploaded: fileBuffer.length,
      contentHash: crypto.createHash("sha256").update(fileBuffer).digest("hex"),
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      format: metadata.format,
      mtimeMs: stat.mtimeMs,
    });
  }
  return candidates.sort((a, b) => a.mtimeMs - b.mtimeMs || a.fileName.localeCompare(b.fileName));
}
