import { Router } from "express";
import multer from "multer";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";
import { optimizeAndPersistImage } from "../../lib/image-pipeline";
import { VendorRequest } from "../../middleware/vendor";

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const uploadSingleImage = upload.single("file") as any;

async function requireVendorMediaWrite(req: VendorRequest, res: any) {
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }
  const actorUserId = getRequestUserId(req);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
  if (!role || !hasRole(role, ["OWNER", "MANAGER"])) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId };
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
