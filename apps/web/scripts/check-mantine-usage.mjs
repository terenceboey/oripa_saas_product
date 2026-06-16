import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, "..");

const allowList = new Set([
  "app/page.tsx",
  "app/layout.tsx",
  "app/login/page.tsx",
  "app/register/page.tsx",
  "app/profile/page.tsx",
  "app/fairness-proofs/page.tsx",
  "app/pack/[packId]/page.tsx",
  "app/setlists/page.tsx",
  "app/setlists/[sourceSetId]/page.tsx",
  "app/vendor/page.tsx",
  "app/vendor/login/page.tsx",
  "app/vendor/register/page.tsx",
  "app/vendor/profile/page.tsx",
  "app/vendor/working/sorting/page.tsx",
  "app/super-admin/page.tsx",
  "app/super-admin/login/page.tsx",
  "app/super-admin/vendors/[vendorId]/page.tsx",
  "app/auth/complete/page.tsx",
  "components/airwallex-dropin-checkout.tsx",
]);

const targetDirs = ["app", "components"];
const offenders = [];

for (const dir of targetDirs) {
  await walk(path.join(workspaceRoot, dir));
}

if (offenders.length > 0) {
  console.error("Mantine guard: legacy raw HTML layout detected in new or unallowlisted files.");
  for (const item of offenders) {
    console.error(`- ${item.file}`);
    for (const line of item.lines) {
      console.error(`  ${line}`);
    }
  }
  process.exit(1);
}

async function walk(dir) {
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(dir, { withFileTypes: true }));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !fullPath.endsWith(".tsx")) continue;

    const relative = path.relative(workspaceRoot, fullPath).replaceAll(path.sep, "/");
    if (allowList.has(relative)) continue;

    const content = await readFile(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    const matchedLines = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.includes("className=") && !line.includes("style=")) continue;
      if (/<\s*[a-z][\w-]*[\s\S]*?(className=|style=)/.test(line)) {
        matchedLines.push(`${index + 1}: ${line.trim()}`);
      }
    }

    if (matchedLines.length > 0) {
      offenders.push({ file: relative, lines: matchedLines.slice(0, 5) });
    }
  }
}
