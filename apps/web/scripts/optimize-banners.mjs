import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const targetRoots = [
  "default-pack-banner.png",
  "carousel",
  "pack-presets",
];

const variants = [
  { suffix: "desktop", width: 1600, height: 900, quality: 78 },
  { suffix: "mobile", width: 800, height: 450, quality: 72 },
];

async function processImage(relativePath) {
  const source = path.join(publicDir, relativePath);
  const baseNoExt = source.replace(/\.[^.]+$/, "");

  for (const variant of variants) {
    const output = `${baseNoExt}-${variant.suffix}.webp`;
    await sharp(source)
      .resize({ width: variant.width, height: variant.height, fit: "cover", position: "center" })
      .webp({ quality: variant.quality, effort: 5 })
      .toFile(output);
    console.log(`[optimize-banners] ${relativePath} -> ${path.relative(publicDir, output)}`);
  }
}

function collectTargets() {
  const targets = [];
  for (const entry of targetRoots) {
    const fullPath = path.join(publicDir, entry);
    if (!fs.existsSync(fullPath)) continue;

    const stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      if (entry.toLowerCase().endsWith(".png")) targets.push(entry);
      continue;
    }

    for (const child of fs.readdirSync(fullPath, { withFileTypes: true })) {
      if (!child.isFile() || !child.name.toLowerCase().endsWith(".png")) continue;
      targets.push(path.posix.join(entry.replace(/\\/g, "/"), child.name));
    }
  }
  return targets;
}

async function main() {
  const targets = collectTargets();
  for (const target of targets) {
    await processImage(target);
  }
}

main().catch((error) => {
  console.error("[optimize-banners] failed", error);
  process.exitCode = 1;
});
