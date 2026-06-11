import fs from "node:fs/promises";
import { creativeStorageAbsolutePathFromUrl } from "./creative-storage";

type GptImage2Input = {
  model: string;
  prompt: string;
  images: Array<{ id: string; label: string; imageUrl: string }>;
  imageCount: number;
  appUrl?: string;
  apiKey?: string;
};

function extensionForImagePath(imagePath: string) {
  const lower = imagePath.toLowerCase().split(/[?#]/)[0];
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".webp")) return "webp";
  return "png";
}

function contentTypeForExtension(extension: string) {
  if (extension === "jpg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

async function loadPrivateImageBlob(imageUrl: string) {
  const imagePath = creativeStorageAbsolutePathFromUrl({ imageUrl });
  const fileBuffer = await fs.readFile(imagePath);
  const extension = extensionForImagePath(imagePath);
  const contentType = contentTypeForExtension(extension);
  return { blob: new Blob([fileBuffer], { type: contentType }), extension };
}

export async function generateGptImage2(input: GptImage2Input) {
  const apiKey = String(input.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for direct GPT Image 2 generation");
  }
  if (input.images.length === 0) {
    throw new Error("at least one uploaded source image is required for GPT Image 2 generation");
  }

  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.prompt);
  form.set("n", String(input.imageCount));
  form.set("size", "1536x1024");

  for (const [index, image] of input.images.entries()) {
    const loaded = await loadPrivateImageBlob(image.imageUrl);
    const fileName = `${image.id || `source-${index + 1}`}.${loaded.extension}`;
    form.append("image[]", loaded.blob, fileName);
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const requestId = response.headers.get("x-request-id") || response.headers.get("openai-request-id") || null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : `GPT Image 2 generation failed: ${response.status}`;
    throw new Error(requestId ? `${message} (request ${requestId})` : message);
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  const images = data.map((item: any, index: number) => {
    const b64 = String(item?.b64_json ?? "");
    if (!b64) throw new Error("GPT Image 2 response did not include b64_json image data");
    return {
      index: index + 1,
      fileBuffer: Buffer.from(b64, "base64"),
      revisedPrompt: typeof item?.revised_prompt === "string" ? item.revised_prompt : null,
    };
  });
  if (images.length === 0) throw new Error("GPT Image 2 returned no images");

  return { providerRequestId: requestId, images };
}
