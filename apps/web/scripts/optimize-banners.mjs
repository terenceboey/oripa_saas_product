import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const targets = [
  "default-pack-banner.png",
  "carousel/bonus-points-weekend.png",
  "carousel/one-pack-magic.png",
  "carousel/pokemon-mania.png",
];

const variants = [
  { suffix: "desktop", width: 1600, quality: 78 },
  { suffix: "mobile", width: 800, quality: 72 },
];

async function processImage(relativePath) {
  const source = path.join(publicDir, relativePath);
  const baseNoExt = source.replace(/\.[^.]+$/, "");

  for (const variant of variants) {
    const output = `${baseNoExt}-${variant.suffix}.webp`;
    await sharp(source)
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality, effort: 5 })
      .toFile(output);
    console.log(`[optimize-banners] ${relativePath} -> ${path.relative(publicDir, output)}`);
  }
}

async function main() {
  for (const target of targets) {
    await processImage(target);
  }
}

main().catch((error) => {
  console.error("[optimize-banners] failed", error);
  process.exitCode = 1;
});
