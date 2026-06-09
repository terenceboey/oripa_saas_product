import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "../..");

const packId = "smoke-pack-1";
const custodyItemId = "smoke-item-1";
const drawOrderId = "smoke-draw-order-1";
const quoteId = "smoke-quote-1";
const nowIso = "2026-06-09T09:00:00.000Z";
const localCardImage = "/default-pack-banner-mobile.webp";

const requestsSeen: string[] = [];
let quoteCreated = false;
let quoteAccepted = false;
let drawn = false;
let walletBalance = 1250;

type JsonValue = Record<string, unknown> | Array<unknown>;

function parseHostFromDatabaseUrl(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return databaseUrl.toLowerCase();
  }
}

function isUnsafeHostedDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  const lowered = databaseUrl.toLowerCase();
  const host = parseHostFromDatabaseUrl(databaseUrl);

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  if (lowered.startsWith("file:") || lowered.startsWith("sqlite:")) return false;

  return (
    host.includes("render.com") ||
    lowered.includes("render.com") ||
    lowered.includes("oripa_sg") ||
    (lowered.includes("sslmode=require") && !host.endsWith(".local") && host !== "")
  );
}

function readDotenvValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || match[1] !== key) continue;
    return match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return undefined;
}

function assertLocalOnlyEnvironment(): void {
  const databaseUrls = [
    process.env.DATABASE_URL,
    readDotenvValue(path.resolve(REPO_ROOT, ".env"), "DATABASE_URL"),
    readDotenvValue(path.resolve(REPO_ROOT, "apps/api/.env"), "DATABASE_URL"),
    readDotenvValue(path.resolve(WEB_ROOT, ".env"), "DATABASE_URL"),
  ].filter(Boolean) as string[];

  const unsafe = databaseUrls.find(isUnsafeHostedDatabaseUrl);
  if (unsafe) {
    const host = parseHostFromDatabaseUrl(unsafe);
    throw new Error(`Refusing customer loop smoke with hosted/live DATABASE_URL detected at host ${host}`);
  }
}

function json(req: IncomingMessage, res: ServerResponse, status: number, payload: JsonValue): void {
  const origin = req.headers.origin ?? "*";
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-client-page,x-idempotency-key,x-vendor-host,authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const vendor = {
  id: "smoke-vendor",
  name: "Smoke Storefront",
  slug: "smoke",
  host: "demo.localhost",
  isActive: true,
  logoImageUrl: null,
  faviconImageUrl: null,
  vendorSettings: {
    storefrontPrimary: "#1f5b4f",
    storefrontSecondary: "#dfe8e3",
    storefrontAccent: "#f5b942",
    storefrontSurface: "#ffffff",
    storefrontText: "#17201d",
    storefrontMuted: "#66756f",
    storefrontRadius: 18,
  },
};

function packPayload() {
  return {
    id: packId,
    title: "Smoke Test Pack",
    packBannerImageUrl: "/default-pack-banner-desktop.webp",
    pricePoints: 100,
    remainingStock: 9,
    totalStock: 10,
    isNew: true,
    limitedLabel: "Local smoke",
    createdAt: nowIso,
    status: "OPEN",
    availability: { visible: true, openable: true, status: "OPEN" },
    machineProjection: {
      pricePoints: 100,
      estimatedEv: 140,
      minValue: 80,
      maxValue: 260,
      buybackPercent: 70,
      valueAsOf: nowIso,
      valueFresh: true,
      stock: { total: 10, remaining: 9 },
      availability: { visible: true, openable: true, status: "OPEN" },
      odds: { totalWeight: 1, prizes: [{ prizeId: "smoke-prize-1", label: "Smoke Moon Card", weight: 1, probability: 1, dropRatePercent: 100 }] },
      tierRanges: [{ name: "Smoke Tier", percentage: 100, minValue: 80, maxValue: 260, itemCount: 1 }],
    },
    tierSnapshotJson: { tiers: [{ name: "Smoke Tier", percentage: 100, items: [{ label: "Smoke Moon Card", stock: 9, imageUrl: localCardImage }] }] },
    prizes: [{ id: "smoke-prize-1", label: "Smoke Moon Card", imageUrl: localCardImage, estimatedValue: 200, weight: 1, remainingStock: 9, dropRatePercent: 100 }],
    activity: { lastPullAt: drawn ? nowIso : null, pullsLast7Days: drawn ? 1 : 0 },
  };
}

function quotePayload(status = quoteAccepted ? "PENDING" : "QUOTED") {
  return {
    id: quoteId,
    type: "BUYBACK",
    status,
    quoteAmount: 140,
    quoteCurrency: "POINTS",
    buybackPercent: 70,
    valueSource: "vendor_comp",
    valueAsOf: nowIso,
    expiresAt: "2099-06-09T09:15:00.000Z",
    requestedAt: nowIso,
    acceptedAt: quoteAccepted ? nowIso : null,
    creditedAt: null,
  };
}

function itemPayload() {
  const requests = quoteCreated ? [quotePayload()] : [];
  return {
    id: custodyItemId,
    status: quoteAccepted ? "BUYBACK_REQUESTED" : "HELD",
    provider: "ORIPA_INTERNAL",
    prizeLabel: "Smoke Moon Card",
    imageUrl: localCardImage,
    imageLargeUrl: null,
    setName: "Smoke Set",
    cardName: "Smoke Moon Card",
    rarity: "Smoke Rare",
    estimatedValue: 200,
    estimatedValueSource: "vendor_comp",
    estimatedValueAsOf: nowIso,
    createdAt: nowIso,
    pendingRequest: quoteAccepted ? quotePayload("PENDING") : null,
    requests,
  };
}

function createMockApiServer() {
  return createServer(async (req, res) => {
    if (req.method === "OPTIONS") return json(req, res, 200, {});
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const route = `${req.method ?? "GET"} ${url.pathname}`;
    requestsSeen.push(route);

    if (req.method === "POST") await readBody(req);

    if (route === "GET /v1/vendor/current") return json(req, res, 200, { vendor });
    if (route === "GET /v1/wallet") return json(req, res, 200, { wallet: { id: "smoke-wallet", balancePoints: walletBalance } });
    if (route === "GET /v1/auth/me") return json(req, res, 200, { user: { id: "smoke-user", email: "smoke@example.test", displayName: "Smoke Customer", status: "ACTIVE", profileComplete: true } });
    if (route === "GET /v1/auth/csrf") return json(req, res, 200, { csrfToken: "local-smoke-csrf" });
    if (route === "GET /v1/banners") return json(req, res, 200, { banners: [] });
    if (route === "GET /v1/packs") return json(req, res, 200, { packs: [packPayload()] });
    if (route === `GET /v1/packs/${packId}`) return json(req, res, 200, { pack: packPayload() });
    if (route === "GET /v1/customer/summary") return json(req, res, 200, { summary: { heldCount: quoteAccepted ? 0 : 1, pendingRequestCount: quoteAccepted ? 1 : 0 } });
    if (route === "GET /v1/customer/items") return json(req, res, 200, { items: drawn ? [itemPayload()] : [] });
    if (route === "GET /v1/activity/public") return json(req, res, 200, { activities: [] });
    if (route === "GET /v1/fairness-proofs") return json(req, res, 200, { proofs: [{ drawOrderId, algorithmVersion: "v1", serverSeedHash: "sha256-smoke-seed", revealedServerSeed: "smoke-server-seed", clientSeed: "smoke-client", nonceBase: "1", quantity: 1, poolSnapshotHash: "pool-snapshot-smoke", createdAt: nowIso }] });
    if (route === `GET /v1/draws/${drawOrderId}/proof`) return json(req, res, 200, { proof: { id: "proof-smoke-1", drawOrderId, algorithmVersion: "v1", serverSeedHash: "sha256-smoke-seed", revealedServerSeed: "smoke-server-seed", clientSeed: "smoke-client", nonceBase: "1", quantity: 1, poolSnapshotHash: "pool-snapshot-smoke", createdAt: nowIso, selections: [{ id: "selection-smoke-1", drawSequence: 1, hmacHex: "abcdef", randomFloat: "0.42", randomWeightValue: 0.42, totalWeightAtDraw: 1, tierLabel: "Smoke Tier", tierLowerBound: 0, tierUpperBound: 1, rowSeedHex: "row-seed-smoke", chosenPackPrizeId: "smoke-prize-1", eligiblePrizeIds: ["smoke-prize-1"] }] }, howToVerify: ["Hash the revealed server seed.", "Recompute the draw HMAC."] });

    if (route === "POST /v1/draws") {
      drawn = true;
      walletBalance = 1150;
      return json(req, res, 201, { packId, drawOrderId, quantity: 1, totalCost: 100, draws: [{ drawId: "smoke-draw-1", prizeId: "smoke-prize-1", prizeLabel: "Smoke Moon Card", prizeImageUrl: localCardImage, custodyItemId, custodyStatus: "HELD" }] });
    }
    if (route === `POST /v1/customer/items/${custodyItemId}/buyback-quotes`) {
      quoteCreated = true;
      return json(req, res, 201, { quote: quotePayload("QUOTED") });
    }
    if (route === `POST /v1/customer/buyback-quotes/${quoteId}/accept`) {
      quoteAccepted = true;
      return json(req, res, 200, { request: quotePayload("PENDING"), item: { id: custodyItemId, status: "BUYBACK_REQUESTED" } });
    }
    if (route === `POST /v1/customer/items/${custodyItemId}/redemption-requests`) {
      return json(req, res, 201, { request: { id: "smoke-redemption-1", type: "REDEMPTION", status: "PENDING", requestedAt: nowIso } });
    }

    return json(req, res, 404, { error: `Unhandled local smoke route: ${route}` });
  });
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function listen(server: ReturnType<typeof createMockApiServer>, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.on("error", reject);
  });
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function startNextDev(webPort: number, apiPort: number): ChildProcessWithoutNullStreams {
  const nextBin = path.resolve(REPO_ROOT, "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(webPort)], {
    cwd: WEB_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
      NEXT_PUBLIC_TENANT_HOST: `demo.localhost:${webPort}`,
      DATABASE_URL: "file:local-customer-loop-smoke-does-not-touch-db",
    },
    stdio: "pipe",
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[web] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[web] ${chunk}`));
  return child;
}

function findAgentChromeExecutable(): string | undefined {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const browserRoot = path.resolve(process.env.HOME ?? "", ".agent-browser/browsers");
  if (!existsSync(browserRoot)) return undefined;
  const candidates = readdirSync(browserRoot)
    .filter((name) => name.startsWith("chrome-"))
    .sort()
    .reverse()
    .map((name) => path.join(browserRoot, name, "chrome"));
  return candidates.find((candidate) => existsSync(candidate));
}

async function runBrowserSmoke(webPort: number): Promise<void> {
  let playwright: { chromium: any };
  try {
    playwright = require("playwright") as { chromium: any };
  } catch (error) {
    throw new Error(`Playwright is required for customer loop browser smoke but is not resolvable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: findAgentChromeExecutable(),
  });
  const page = await browser.newPage({ baseURL: `http://demo.localhost:${webPort}` });
  const consoleErrors: string[] = [];
  const failedResourceUrls: string[] = [];
  page.on("console", (message: any) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response: any) => {
    if (response.status() >= 400) failedResourceUrls.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error: Error) => consoleErrors.push(error.message));

  try {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByText("Smoke Test Pack").waitFor({ timeout: 15000 });
    await page.getByRole("link", { name: /Open Draw Page/i }).click();

    await page.getByRole("heading", { name: "Smoke Test Pack" }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /^Draw$/ }).click();
    await page.getByRole("heading", { name: "Draw Result" }).waitFor({ timeout: 15000 });
    await page.getByText("Smoke Moon Card").first().waitFor({ timeout: 15000 });

    await page.getByRole("button", { name: /Request Buyback Quote/i }).click();
    await page.getByText("Buyback quote ready.").waitFor({ timeout: 15000 });
    await page.getByText("Buyback quote card").waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /Accept Buyback Quote/i }).click();
    await page.getByText(/Buyback request submitted/i).waitFor({ timeout: 15000 });

    await page.getByRole("link", { name: /My Backpack/i }).first().click();
    await page.getByRole("heading", { name: /Items you have pulled/i }).waitFor({ timeout: 15000 });
    await page.getByText("Smoke Moon Card").first().waitFor({ timeout: 15000 });
    await page.getByText(/Pending request/i).first().waitFor({ timeout: 15000 });

    await page.goto(`/fairness-proofs?drawOrderId=${drawOrderId}`, { waitUntil: "networkidle" });
    await page.getByText("Your Fairness Proofs").waitFor({ timeout: 15000 });
    await page.getByText(/Linked proof/i).waitFor({ timeout: 15000 });
    await page.getByText("smoke-server-seed").waitFor({ timeout: 15000 });

    const visibleErrors = await page.locator(".error, .inline-error-banner").allTextContents();
    assert.deepEqual(visibleErrors.filter((text: string) => text.trim().length > 0), [], "customer loop smoke must not leave visible error banners");
    assert.deepEqual(failedResourceUrls, [], "customer loop smoke must not receive failed browser resources");
    assert.deepEqual(consoleErrors, [], "customer loop smoke must not emit browser console errors");
  } finally {
    await browser.close();
  }
}

async function main() {
  assertLocalOnlyEnvironment();
  const apiPort = await getFreePort();
  const webPort = await getFreePort();
  const apiServer = createMockApiServer();
  let webProcess: ChildProcessWithoutNullStreams | null = null;

  try {
    await listen(apiServer, apiPort);
    webProcess = startNextDev(webPort, apiPort);
    await waitForHttp(`http://127.0.0.1:${webPort}`, 60_000);
    await runBrowserSmoke(webPort);

    const requiredRoutes = [
      "GET /v1/vendor/current",
      "GET /v1/packs",
      `GET /v1/packs/${packId}`,
      "POST /v1/draws",
      `POST /v1/customer/items/${custodyItemId}/buyback-quotes`,
      `POST /v1/customer/buyback-quotes/${quoteId}/accept`,
      "GET /v1/customer/items",
      "GET /v1/fairness-proofs",
      `GET /v1/draws/${drawOrderId}/proof`,
    ];
    for (const route of requiredRoutes) {
      assert.ok(requestsSeen.includes(route), `customer loop smoke must hit ${route}`);
    }
    assert.equal(drawn, true, "customer loop smoke must draw a pack");
    assert.equal(quoteCreated, true, "customer loop smoke must request a buyback quote");
    assert.equal(quoteAccepted, true, "customer loop smoke must accept the buyback quote");
    console.log("customer loop local browser smoke ok");
  } finally {
    if (webProcess && !webProcess.killed) webProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
