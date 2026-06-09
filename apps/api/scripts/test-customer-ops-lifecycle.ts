import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { AddressInfo } from "node:net";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import {
  isValidCustodyRequestTransition,
  nextCustodyItemStatusForRequest,
  normalizeOpsRequestStatusUpdate,
  terminalCustodyRequestStatuses,
} from "../src/lib/customer-custody";
import { prisma } from "../src/lib/prisma";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_ROOT = path.resolve(__dirname, "..");
const WEB_ROOT = path.resolve(API_ROOT, "../web");
const REPO_ROOT = path.resolve(API_ROOT, "../..");

const smokeVendorHost = "demo.localhost";
const now = new Date("2026-06-09T09:00:00.000Z");
const smokeRequestIds = {
  redemptionPending: "smoke-redemption-pending",
  buybackPending: "smoke-buyback-pending",
  redemptionTerminal: "smoke-redemption-terminal",
} as const;
const smokeItemIds = {
  redemptionPending: "smoke-item-redemption-pending",
  buybackPending: "smoke-item-buyback-pending",
  redemptionTerminal: "smoke-item-redemption-terminal",
} as const;

type RestoreFn = () => void;
type JsonValue = Record<string, unknown> | Array<unknown>;
type CustodyRequestType = "REDEMPTION" | "BUYBACK";
type CustodyRequestStatus =
  | "QUOTED"
  | "PENDING"
  | "OPS_REVIEW"
  | "APPROVED"
  | "PACKED"
  | "FULFILLED_MANUAL"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "CREDITED"
  | "EXPIRED";
type CustodyItemStatus = "HELD" | "REDEMPTION_REQUESTED" | "BUYBACK_REQUESTED" | "REDEEMED" | "BOUGHT_BACK" | "VOIDED";
type WalletEntry = {
  id: string;
  requestId: string;
  amountPoints: number;
  idempotencyScopeKey: string;
  createdAt: Date;
};
type MockItem = {
  id: string;
  status: CustodyItemStatus;
  provider: string;
  prizeLabel: string;
  setName: string | null;
  cardName: string | null;
  rarity: string | null;
  estimatedValue: number | null;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  createdAt: Date;
};
type MockRequest = {
  id: string;
  type: CustodyRequestType;
  status: CustodyRequestStatus;
  customerNote: string | null;
  opsNote: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  completedAt: Date | null;
  creditedAt: Date | null;
  quoteAmount: number | null;
  quoteCurrency: string | null;
  buybackPercent: number | null;
  policyVersion: string | null;
  valueSource: string | null;
  valueAsOf: Date | null;
  expiresAt: Date | null;
  walletEntryId: string | null;
  user: { id: string; email: string; displayName: string };
  custodyItemId: string;
};
type MockOpsState = {
  requests: Map<string, MockRequest>;
  items: Map<string, MockItem>;
  walletEntries: WalletEntry[];
  routesSeen: string[];
};

function patchMethod<T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]): RestoreFn {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
}

function tokenFor(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.test` }, process.env.JWT_SECRET ?? "change-me");
}

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
    readDotenvValue(path.resolve(API_ROOT, ".env"), "DATABASE_URL"),
    readDotenvValue(path.resolve(WEB_ROOT, ".env"), "DATABASE_URL"),
  ].filter(Boolean) as string[];

  const unsafe = databaseUrls.find(isUnsafeHostedDatabaseUrl);
  if (unsafe) {
    const host = parseHostFromDatabaseUrl(unsafe);
    throw new Error(`Refusing customer ops lifecycle smoke with hosted/live DATABASE_URL detected at host ${host}`);
  }
}

function json(req: IncomingMessage, res: ServerResponse, status: number, payload: JsonValue): void {
  const origin = req.headers.origin ?? "*";
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-client-page,x-csrf-token,x-idempotency-key,x-vendor-host,authorization",
    "access-control-allow-methods": "GET,PATCH,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
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

async function listen(server: Server, port: number): Promise<void> {
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
      NEXT_PUBLIC_TENANT_HOST: `${smokeVendorHost}:${webPort}`,
      DATABASE_URL: "file:local-customer-ops-lifecycle-smoke-does-not-touch-db",
    },
    stdio: "pipe",
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[web] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[web] ${chunk}`));
  return child;
}

function findChromiumExecutable(): string | undefined {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const agentBrowserRoot = path.resolve(process.env.HOME ?? "", ".agent-browser/browsers");
  if (existsSync(agentBrowserRoot)) {
    const agentCandidates = readdirSync(agentBrowserRoot)
      .filter((name) => name.startsWith("chrome-"))
      .sort()
      .reverse()
      .map((name) => path.join(agentBrowserRoot, name, "chrome"));
    const match = agentCandidates.find((candidate) => existsSync(candidate));
    if (match) return match;
  }

  const playwrightRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (playwrightRoot && existsSync(playwrightRoot)) {
    const candidates = readdirSync(playwrightRoot)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()
      .flatMap((name) => [
        path.join(playwrightRoot, name, "chrome-linux", "chrome"),
        path.join(playwrightRoot, name, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
        path.join(playwrightRoot, name, "chrome-win", "chrome.exe"),
      ]);
    return candidates.find((candidate) => existsSync(candidate));
  }

  return undefined;
}

function createMockOpsState(): MockOpsState {
  const requestedAt = now;
  const reviewedAt = new Date("2026-06-09T08:20:00.000Z");
  const completedAt = new Date("2026-06-09T08:45:00.000Z");
  const items = new Map<string, MockItem>([
    [
      smokeItemIds.redemptionPending,
      {
        id: smokeItemIds.redemptionPending,
        status: "REDEMPTION_REQUESTED",
        provider: "ORIPA_INTERNAL",
        prizeLabel: "Moonbreon",
        setName: "Eevee Heroes",
        cardName: "Umbreon VMAX",
        rarity: "Alt Art",
        estimatedValue: 1000,
        imageUrl: null,
        imageLargeUrl: null,
        createdAt: requestedAt,
      },
    ],
    [
      smokeItemIds.buybackPending,
      {
        id: smokeItemIds.buybackPending,
        status: "BUYBACK_REQUESTED",
        provider: "ORIPA_INTERNAL",
        prizeLabel: "Charizard",
        setName: "Base Set",
        cardName: "Charizard",
        rarity: "Holo",
        estimatedValue: 800,
        imageUrl: null,
        imageLargeUrl: null,
        createdAt: requestedAt,
      },
    ],
    [
      smokeItemIds.redemptionTerminal,
      {
        id: smokeItemIds.redemptionTerminal,
        status: "REDEEMED",
        provider: "ORIPA_INTERNAL",
        prizeLabel: "Pikachu Trophy",
        setName: "Promo",
        cardName: "Pikachu",
        rarity: "Trophy",
        estimatedValue: 5000,
        imageUrl: null,
        imageLargeUrl: null,
        createdAt: requestedAt,
      },
    ],
  ]);
  const requests = new Map<string, MockRequest>([
    [
      smokeRequestIds.redemptionPending,
      {
        id: smokeRequestIds.redemptionPending,
        type: "REDEMPTION",
        status: "PENDING",
        customerNote: "ship it",
        opsNote: null,
        requestedAt,
        reviewedAt: null,
        completedAt: null,
        creditedAt: null,
        quoteAmount: null,
        quoteCurrency: null,
        buybackPercent: null,
        policyVersion: null,
        valueSource: null,
        valueAsOf: null,
        expiresAt: null,
        walletEntryId: null,
        user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
        custodyItemId: smokeItemIds.redemptionPending,
      },
    ],
    [
      smokeRequestIds.buybackPending,
      {
        id: smokeRequestIds.buybackPending,
        type: "BUYBACK",
        status: "PENDING",
        customerNote: "buy it",
        opsNote: null,
        requestedAt,
        reviewedAt: null,
        completedAt: null,
        creditedAt: null,
        quoteAmount: 560,
        quoteCurrency: "POINTS",
        buybackPercent: 70,
        policyVersion: "policy-1",
        valueSource: "vendor_comp",
        valueAsOf: requestedAt,
        expiresAt: new Date(requestedAt.getTime() + 900_000),
        walletEntryId: null,
        user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
        custodyItemId: smokeItemIds.buybackPending,
      },
    ],
    [
      smokeRequestIds.redemptionTerminal,
      {
        id: smokeRequestIds.redemptionTerminal,
        type: "REDEMPTION",
        status: "FULFILLED_MANUAL",
        customerNote: "already shipped",
        opsNote: "packed and handed to carrier",
        requestedAt,
        reviewedAt,
        completedAt,
        creditedAt: null,
        quoteAmount: null,
        quoteCurrency: null,
        buybackPercent: null,
        policyVersion: null,
        valueSource: null,
        valueAsOf: null,
        expiresAt: null,
        walletEntryId: null,
        user: { id: "customer-two", email: "customer-two@example.test", displayName: "Customer Two" },
        custodyItemId: smokeItemIds.redemptionTerminal,
      },
    ],
  ]);

  return {
    requests,
    items,
    walletEntries: [],
    routesSeen: [],
  };
}

function serializeRequestForOps(request: MockRequest, item: MockItem) {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    customerNote: request.customerNote,
    opsNote: request.opsNote,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    completedAt: request.completedAt ? request.completedAt.toISOString() : null,
    customer: {
      id: request.user.id,
      email: request.user.email,
      name: request.user.displayName,
    },
    quote: request.type === "BUYBACK" ? {
      amount: request.quoteAmount,
      currency: request.quoteCurrency,
      buybackPercent: request.buybackPercent,
      policyVersion: request.policyVersion,
      valueSource: request.valueSource,
      valueAsOf: request.valueAsOf ? request.valueAsOf.toISOString() : null,
      expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
      creditedAt: request.creditedAt ? request.creditedAt.toISOString() : null,
      walletEntryId: request.walletEntryId,
    } : null,
    item: {
      id: item.id,
      status: item.status,
      provider: item.provider,
      prizeLabel: item.prizeLabel,
      setName: item.setName,
      cardName: item.cardName,
      rarity: item.rarity,
      estimatedValue: item.estimatedValue,
      imageUrl: item.imageUrl,
      imageLargeUrl: item.imageLargeUrl,
      createdAt: item.createdAt.toISOString(),
    },
  };
}

function applyMockTransition(state: MockOpsState, requestId: string, body: unknown) {
  const request = state.requests.get(requestId);
  if (!request) return { status: 404, payload: { error: "Custody request not found" } };

  const parsed = normalizeOpsRequestStatusUpdate(body);
  if ("error" in parsed) return { status: 400, payload: { error: parsed.error } };
  if (request.type === "BUYBACK" && request.status === "CREDITED" && parsed.status === "APPROVED") {
    const item = state.items.get(request.custodyItemId);
    assert.ok(item, `missing custody item for ${request.id}`);
    return { status: 200, payload: { request: serializeRequestForOps(request, item) } };
  }
  if (terminalCustodyRequestStatuses().has(request.status)) {
    return { status: 409, payload: { error: "Custody request is already terminal" } };
  }
  if (!isValidCustodyRequestTransition(request.type, request.status, parsed.status)) {
    return { status: 409, payload: { error: "Invalid custody request transition", fromStatus: request.status, toStatus: parsed.status } };
  }

  const item = state.items.get(request.custodyItemId);
  assert.ok(item, `missing custody item for ${request.id}`);

  const creditsBuyback = request.type === "BUYBACK" && parsed.status === "APPROVED";
  const finalStatus = creditsBuyback ? "CREDITED" : parsed.status;
  const itemStatus = nextCustodyItemStatusForRequest(request.type, finalStatus);
  const transitionTime = new Date(now.getTime() + state.walletEntries.length * 1000 + state.routesSeen.length);

  if (creditsBuyback) {
    const idempotencyScopeKey = `buyback-credit:${request.id}`;
    const existingEntry = state.walletEntries.find((entry) => entry.idempotencyScopeKey === idempotencyScopeKey);
    if (existingEntry) {
      request.walletEntryId = existingEntry.id;
      request.creditedAt = request.creditedAt ?? existingEntry.createdAt;
    } else {
      const entry: WalletEntry = {
        id: `wallet-entry-${state.walletEntries.length + 1}`,
        requestId: request.id,
        amountPoints: request.quoteAmount ?? 0,
        idempotencyScopeKey,
        createdAt: transitionTime,
      };
      state.walletEntries.push(entry);
      request.walletEntryId = entry.id;
      request.creditedAt = transitionTime;
    }
  }

  request.status = finalStatus;
  request.opsNote = parsed.opsNote;
  request.reviewedAt = parsed.status === "OPS_REVIEW" || parsed.status === "APPROVED" || parsed.status === "REJECTED" ? transitionTime : request.reviewedAt;
  request.completedAt = parsed.status === "COMPLETED" || parsed.status === "FULFILLED_MANUAL" ? transitionTime : null;
  item.status = itemStatus;

  return { status: 200, payload: { request: serializeRequestForOps(request, item) } };
}

function createMockOpsApiServer(state: MockOpsState) {
  return createServer(async (req, res) => {
    if (req.method === "OPTIONS") return json(req, res, 200, {});

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const routeKey = `${req.method ?? "GET"} ${url.pathname}`;
    state.routesSeen.push(routeKey);

    if (routeKey === "GET /v1/auth/csrf") {
      return json(req, res, 200, { csrfToken: "local-ops-smoke-csrf" });
    }

    if (routeKey === "GET /v1/ops/custody-requests") {
      const requestedStatus = String(url.searchParams.get("status") ?? "PENDING").trim().toUpperCase();
      const requests = [...state.requests.values()]
        .filter((request) => requestedStatus === "ALL" || request.status === requestedStatus)
        .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime())
        .map((request) => {
          const item = state.items.get(request.custodyItemId);
          assert.ok(item, `missing custody item for ${request.id}`);
          return serializeRequestForOps(request, item);
        });
      return json(req, res, 200, { requests });
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/v1/ops/custody-requests/")) {
      const requestId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const bodyText = await readBody(req);
      const body = bodyText ? JSON.parse(bodyText) : {};
      const result = applyMockTransition(state, requestId, body);
      return json(req, res, result.status, result.payload);
    }

    return json(req, res, 404, { error: `Unhandled local smoke route: ${routeKey}` });
  });
}

async function patchRequest(baseUrl: string, pathName: string, userId: string, status: string, host = "alpha.localhost") {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-vendor-host": host,
      authorization: `Bearer ${tokenFor(userId)}`,
    },
    body: JSON.stringify({ status, opsNote: `move to ${status}` }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function runBackendContractAssertions() {
  assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PENDING", "OPS_REVIEW"), true);
  assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PENDING", "PACKED"), false);
  assert.equal(isValidCustodyRequestTransition("REDEMPTION", "APPROVED", "PACKED"), true);
  assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PACKED", "FULFILLED_MANUAL"), true);
  assert.equal(isValidCustodyRequestTransition("BUYBACK", "PENDING", "PACKED"), false);
  assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "OPS_REVIEW"), "REDEMPTION_REQUESTED");
  assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "PACKED"), "REDEMPTION_REQUESTED");
  assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "FULFILLED_MANUAL"), "REDEEMED");
  assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "packed", opsNote: "  packed in safe  " }), { status: "PACKED", opsNote: "packed in safe" });
  assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "fulfilled_manual" }), { status: "FULFILLED_MANUAL", opsNote: null });

  const restores: RestoreFn[] = [];
  const allocations = new Map([
    ["alloc_redemption", { id: "alloc_redemption", status: "COMMITTED", quantityAllocated: 1, quantityCommitted: 1, quantityReleased: 0 }],
    ["alloc_buyback", { id: "alloc_buyback", status: "COMMITTED", quantityAllocated: 1, quantityCommitted: 1, quantityReleased: 0 }],
  ]);
  const items = new Map<string, any>([
    ["item_redemption", {
      id: "item_redemption",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      status: "REDEMPTION_REQUESTED",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Moonbreon",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 1000,
      createdAt: now,
      packPrizeInventoryAllocationId: "alloc_redemption",
    }],
    ["item_buyback", {
      id: "item_buyback",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      status: "BUYBACK_REQUESTED",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Charizard",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 800,
      createdAt: now,
      packPrizeInventoryAllocationId: "alloc_buyback",
    }],
  ]);
  const requests = new Map<string, any>([
    ["req_redemption", {
      id: "req_redemption",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      custodyItemId: "item_redemption",
      type: "REDEMPTION",
      status: "PENDING",
      customerNote: "ship it",
      opsNote: null,
      requestedAt: now,
      reviewedAt: null,
      completedAt: null,
      creditedAt: null,
      quoteAmount: null,
      quoteCurrency: null,
      buybackPercent: null,
      policyVersion: null,
      valueSource: null,
      valueAsOf: null,
      expiresAt: null,
      walletEntryId: null,
      user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
    }],
    ["req_buyback", {
      id: "req_buyback",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      custodyItemId: "item_buyback",
      type: "BUYBACK",
      status: "PENDING",
      customerNote: "buy it",
      opsNote: null,
      requestedAt: now,
      reviewedAt: null,
      completedAt: null,
      creditedAt: null,
      quoteAmount: 560,
      quoteCurrency: "POINTS",
      buybackPercent: 70,
      policyVersion: "policy-1",
      valueSource: "vendor_comp",
      valueAsOf: now,
      expiresAt: new Date(now.getTime() + 900_000),
      walletEntryId: null,
      user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
    }],
  ]);
  const audits: any[] = [];
  const walletEntries: any[] = [];

  function requestWithIncludes(request: any) {
    return { ...request, user: request.user, custodyItem: items.get(request.custodyItemId) };
  }

  restores.push(patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
    if (where?.host === "alpha.localhost") return { id: "vendor-alpha", host: "alpha.localhost", slug: "alpha", name: "Alpha" };
    if (where?.host === "beta.localhost") return { id: "vendor-beta", host: "beta.localhost", slug: "beta", name: "Beta" };
    return null;
  }));
  restores.push(patchMethod((prisma as any).vendorMembership, "findFirst", async ({ where }: any) => {
    if (where?.vendorId === "vendor-alpha" && where?.userId === "ops-staff") return { role: "STAFF" };
    if (where?.vendorId === "vendor-alpha" && where?.userId === "ops-viewer") return { role: "CUSTOMER" };
    return null;
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "findFirst", async ({ where }: any) => {
    const request = requests.get(where?.id);
    if (!request || request.vendorId !== where?.vendorId) return null;
    return requestWithIncludes(request);
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "update", async ({ where, data }: any) => {
    const request = requests.get(where.id);
    if (!request) throw new Error("request not found");
    Object.assign(request, data);
    return requestWithIncludes(request);
  }));
  restores.push(patchMethod((prisma as any).custodyItem, "update", async ({ where, data }: any) => {
    const item = items.get(where.id);
    if (!item) throw new Error("item not found");
    Object.assign(item, data);
    return item;
  }));
  restores.push(patchMethod((prisma as any).packPrizeInventoryAllocation, "update", async ({ where, data }: any) => {
    const allocation = allocations.get(where.id);
    if (!allocation) throw new Error("allocation not found");
    if (data.status) allocation.status = data.status;
    if (data.quantityCommitted?.decrement) allocation.quantityCommitted -= data.quantityCommitted.decrement;
    if (data.quantityReleased?.increment) allocation.quantityReleased += data.quantityReleased.increment;
    return allocation;
  }));
  restores.push(patchMethod((prisma as any).auditLog, "create", async ({ data }: any) => {
    audits.push({ id: `audit_${audits.length + 1}`, ...data });
    return audits[audits.length - 1];
  }));
  restores.push(patchMethod((prisma as any).walletEntry, "findUnique", async () => null));
  restores.push(patchMethod((prisma as any).walletEntry, "create", async ({ data }: any) => {
    const entry = { id: `wallet_entry_${walletEntries.length + 1}`, createdAt: now, ...data };
    walletEntries.push(entry);
    return entry;
  }));
  restores.push(patchMethod((prisma as any).walletAccount, "upsert", async () => ({ id: "wallet_1", balancePoints: 100 })));
  restores.push(patchMethod((prisma as any).walletAccount, "update", async ({ data }: any) => ({ id: "wallet_1", balancePoints: data.balancePoints, version: 1 })));
  restores.push(patchMethod((prisma as any), "$transaction", async (callback: any) => callback(prisma)));

  const app = createApp();
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const noRole = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-viewer", "OPS_REVIEW");
    assert.equal(noRole.response.status, 403, "non-staff vendor member cannot change custody ops lifecycle");

    const crossVendor = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "OPS_REVIEW", "beta.localhost");
    assert.equal(crossVendor.response.status, 403, "cross-vendor ops actor must be denied before request lookup");

    const invalid = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "PACKED");
    assert.equal(invalid.response.status, 409, "invalid transition PENDING -> PACKED must be rejected");
    assert.equal(requests.get("req_redemption")?.status, "PENDING");
    assert.equal(audits.length, 0, "invalid transition must not write audit log");

    const review = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "OPS_REVIEW");
    assert.equal(review.response.status, 200);
    assert.equal(review.payload.request.status, "OPS_REVIEW");
    assert.equal(items.get("item_redemption")?.status, "REDEMPTION_REQUESTED");
    assert.equal(allocations.get("alloc_redemption")?.status, "COMMITTED", "redemption review must keep physical inventory locked");
    assert.equal(audits.at(-1)?.action, "CUSTODY_REQUEST_TRANSITION");

    const approved = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "APPROVED");
    assert.equal(approved.response.status, 200);
    const packed = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "PACKED");
    assert.equal(packed.response.status, 200);
    const fulfilled = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "FULFILLED_MANUAL");
    assert.equal(fulfilled.response.status, 200);
    assert.equal(fulfilled.payload.request.status, "FULFILLED_MANUAL");
    assert.equal(items.get("item_redemption")?.status, "REDEEMED");
    assert.equal(allocations.get("alloc_redemption")?.status, "COMMITTED", "manual fulfillment must preserve committed allocation proof, not release or label-ship automatically");

    const credited = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_buyback", "ops-staff", "APPROVED");
    assert.equal(credited.response.status, 200);
    assert.equal(credited.payload.request.status, "CREDITED");
    assert.equal(items.get("item_buyback")?.status, "BOUGHT_BACK");
    assert.equal(allocations.get("alloc_buyback")?.status, "RELEASED", "credited buyback returns custody item to vendor inventory pool");
    assert.equal(allocations.get("alloc_buyback")?.quantityReleased, 1);
    assert.equal(walletEntries.length, 1, "buyback approval credits wallet once");
    assert.ok(audits.some((entry) => entry.entityId === "req_buyback" && entry.afterState?.status === "CREDITED"), "credited buyback transition must be audited");

    const duplicateCredit = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_buyback", "ops-staff", "APPROVED");
    assert.equal(duplicateCredit.response.status, 200, "duplicate buyback approval should be idempotent");
    assert.equal(duplicateCredit.payload.request.status, "CREDITED");
    assert.equal(walletEntries.length, 1, "duplicate buyback approval must not create another wallet credit");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }
}

async function runBrowserSmoke(webPort: number, apiPort: number, state: MockOpsState): Promise<void> {
  let playwright: { chromium: any };
  try {
    playwright = require("playwright") as { chromium: any };
  } catch (error) {
    throw new Error(`Playwright is required for customer ops browser smoke but is not resolvable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const launchOptions: Record<string, unknown> = { headless: true };
  const executablePath = findChromiumExecutable();
  if (executablePath) launchOptions.executablePath = executablePath;

  const browser = await playwright.chromium.launch(launchOptions);
  const page = await browser.newPage({ baseURL: `http://${smokeVendorHost}:${webPort}` });
  const consoleErrors: string[] = [];
  const failedResourceUrls: string[] = [];

  page.on("console", (message: any) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error: Error) => consoleErrors.push(error.message));
  page.on("response", (response: any) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.endsWith("/favicon.ico")) failedResourceUrls.push(`${status} ${url}`);
  });

  try {
    await page.goto("/ops/custody", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Custody fulfillment" }).waitFor({ timeout: 30_000 });
    await page.getByText(smokeRequestIds.redemptionPending).waitFor({ timeout: 15_000 });
    await page.getByText(smokeRequestIds.buybackPending).waitFor({ timeout: 15_000 });

    const buybackCard = page.locator("article").filter({ hasText: smokeRequestIds.buybackPending });
    await buybackCard.locator("textarea").fill("approve buyback in smoke");
    await buybackCard.getByRole("button", { name: "Apply transition" }).click();
    await buybackCard.getByText(/Buyback approved and credited/i).waitFor({ timeout: 15_000 });
    await buybackCard.getByText(/^credited$/i).first().waitFor({ timeout: 15_000 });

    assert.equal(state.requests.get(smokeRequestIds.buybackPending)?.status, "CREDITED");
    assert.equal(state.items.get(smokeItemIds.buybackPending)?.status, "BOUGHT_BACK");
    assert.equal(state.walletEntries.length, 1, "UI buyback approval must credit wallet exactly once");

    const redemptionCard = page.locator("article").filter({ hasText: smokeRequestIds.redemptionPending });
    await redemptionCard.locator("textarea").fill("review redemption in smoke");
    await redemptionCard.getByRole("button", { name: "Apply transition" }).click();
    await redemptionCard.getByText(/Request updated to ops review\./i).waitFor({ timeout: 15_000 });
    await redemptionCard.getByText(/^ops review$/i).first().waitFor({ timeout: 15_000 });

    assert.equal(state.requests.get(smokeRequestIds.redemptionPending)?.status, "OPS_REVIEW");
    assert.equal(state.items.get(smokeItemIds.redemptionPending)?.status, "REDEMPTION_REQUESTED");

    await page.getByLabel("Status filter").selectOption("ALL");
    await page.getByText(smokeRequestIds.redemptionTerminal).waitFor({ timeout: 15_000 });
    const terminalCard = page.locator("article").filter({ hasText: smokeRequestIds.redemptionTerminal });
    assert.equal(await terminalCard.locator("select").isDisabled(), true, "terminal request status select must be disabled");
    assert.equal(await terminalCard.locator("textarea").isDisabled(), true, "terminal request note input must be disabled");
    assert.equal(await terminalCard.getByRole("button", { name: "Apply transition" }).isDisabled(), true, "terminal request action button must be disabled");
    await terminalCard.getByText(/Terminal requests are locked and cannot be changed from the UI\./i).waitFor({ timeout: 15_000 });

    const visibleErrors = await page.locator(".error, .inline-error-banner").allTextContents();
    assert.deepEqual(visibleErrors.filter((text: string) => text.trim().length > 0), [], "ops custody smoke must not leave visible error banners");
    assert.deepEqual(failedResourceUrls, [], "ops custody smoke must not receive failed browser resources");
    assert.deepEqual(consoleErrors, [], "ops custody smoke must not emit browser console errors");

    const invalidTransition = await fetch(`http://127.0.0.1:${apiPort}/v1/ops/custody-requests/${smokeRequestIds.redemptionPending}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-vendor-host": `${smokeVendorHost}:${webPort}`,
      },
      body: JSON.stringify({ status: "PACKED", opsNote: "skip approval" }),
    });
    assert.equal(invalidTransition.status, 409, "mock backend must block invalid OPS_REVIEW -> PACKED skip transition");
    assert.equal(state.requests.get(smokeRequestIds.redemptionPending)?.status, "OPS_REVIEW");

    const duplicateCredit = await fetch(`http://127.0.0.1:${apiPort}/v1/ops/custody-requests/${smokeRequestIds.buybackPending}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-vendor-host": `${smokeVendorHost}:${webPort}`,
      },
      body: JSON.stringify({ status: "APPROVED", opsNote: "duplicate approval" }),
    });
    assert.equal(duplicateCredit.status, 200, "duplicate buyback approval should remain idempotent in mock smoke backend");
    assert.equal(state.walletEntries.length, 1, "duplicate buyback approval must not create a second wallet entry");

    const terminalEditAttempt = await fetch(`http://127.0.0.1:${apiPort}/v1/ops/custody-requests/${smokeRequestIds.redemptionTerminal}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-vendor-host": `${smokeVendorHost}:${webPort}`,
      },
      body: JSON.stringify({ status: "CANCELLED", opsNote: "should fail" }),
    });
    assert.equal(terminalEditAttempt.status, 409, "terminal request must reject direct edit attempts");
  } finally {
    await browser.close();
  }
}

async function stopChild(child: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

async function runLocalOpsBrowserSmoke() {
  const state = createMockOpsState();
  const apiPort = await getFreePort();
  const webPort = await getFreePort();
  const apiServer = createMockOpsApiServer(state);
  const nextEnvPath = path.resolve(WEB_ROOT, "next-env.d.ts");
  const originalNextEnv = existsSync(nextEnvPath) ? readFileSync(nextEnvPath, "utf8") : null;
  let webProcess: ChildProcessWithoutNullStreams | null = null;

  try {
    await listen(apiServer, apiPort);
    webProcess = startNextDev(webPort, apiPort);
    await waitForHttp(`http://127.0.0.1:${webPort}/ops/custody`, 90_000);
    await runBrowserSmoke(webPort, apiPort, state);

    const requiredRoutes = [
      "GET /v1/auth/csrf",
      "GET /v1/ops/custody-requests",
      `PATCH /v1/ops/custody-requests/${smokeRequestIds.buybackPending}`,
      `PATCH /v1/ops/custody-requests/${smokeRequestIds.redemptionPending}`,
      `PATCH /v1/ops/custody-requests/${smokeRequestIds.redemptionTerminal}`,
    ];
    for (const route of requiredRoutes) {
      assert.ok(state.routesSeen.includes(route), `ops custody smoke must hit ${route}`);
    }
  } finally {
    await stopChild(webProcess);
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    if (originalNextEnv != null) writeFileSync(nextEnvPath, originalNextEnv);
  }
}

async function main() {
  assertLocalOnlyEnvironment();
  await runBackendContractAssertions();
  console.log("customer ops lifecycle backend contract ok");
  await runLocalOpsBrowserSmoke();
  console.log("customer ops custody local browser smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
