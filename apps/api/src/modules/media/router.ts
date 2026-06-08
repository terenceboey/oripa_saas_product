import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireVendorAccess } from "../../lib/rbac";
import { optimizeAndPersistImage } from "../../lib/image-pipeline";
import { VendorRequest } from "../../middleware/vendor";

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const uploadSingleImage = upload.single("file") as any;
const uploadSingleDocument = upload.single("file") as any;

async function requireVendorMediaWrite(req: VendorRequest, res: any) {
  return requireVendorAccess(req, res, ["OWNER", "MANAGER"]);
}

mediaRouter.post("/v1/vendor/media/images", uploadSingleImage, async (req: VendorRequest, res) => {
  const auth = await requireVendorMediaWrite(req, res);
  if (!auth) return;

  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ error: "file is required" });
  }

  try {
    const appUrl = String(process.env.APP_URL ?? "").trim();
    const kind = String(req.body?.kind ?? "pack-banner");
    const payload = await optimizeAndPersistImage({
      fileBuffer: file.buffer,
      kindRaw: kind,
      appUrl: appUrl || undefined,
    });
    return res.status(201).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process image";
    return res.status(400).json({ error: message });
  }
});

mediaRouter.post("/v1/vendor/media/documents", uploadSingleDocument, async (req: VendorRequest, res) => {
  const auth = await requireVendorMediaWrite(req, res);
  if (!auth) return;

  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ error: "file is required" });
  }

  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);
  if (!allowedMimeTypes.has(String(file.mimetype ?? "").toLowerCase())) {
    return res.status(400).json({ error: "unsupported document format (jpg/png/webp/pdf only)" });
  }

  try {
    const appUrl = String(process.env.APP_URL ?? "").trim();
    const day = new Date().toISOString().slice(0, 10);
    const uploadRoot = path.resolve(process.cwd(), "apps/api/uploads");
    const dir = path.join(uploadRoot, "vendor-documents", day);
    await fs.mkdir(dir, { recursive: true });

    const safeOriginal = String(file.originalname ?? "document").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80) || "document";
    const extensionFromMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    const ext = extensionFromMime[String(file.mimetype ?? "").toLowerCase()] ?? (path.extname(safeOriginal).replace(/^\./, "") || "bin");
    const fileName = `${randomUUID().replace(/-/g, "")}.${ext}`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, file.buffer);

    const relativeUrl = `/uploads/vendor-documents/${day}/${fileName}`;
    const documentUrl = appUrl ? `${appUrl.replace(/\/$/, "")}${relativeUrl}` : relativeUrl;
    return res.status(201).json({
      documentUrl,
      mimeType: file.mimetype,
      bytesUploaded: file.buffer.length,
      originalName: file.originalname ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process document";
    return res.status(400).json({ error: message });
  }
});
