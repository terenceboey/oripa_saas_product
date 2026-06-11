import countryToCurrency from "country-to-currency";
import currencyCodes from "currency-codes";
import crypto from "node:crypto";

const airwallexEnv = String(process.env.AIRWALLEX_ENV ?? "demo").toLowerCase() === "prod" ? "prod" : "demo";
const airwallexBaseUrl = process.env.AIRWALLEX_API_BASE_URL ?? (airwallexEnv === "prod" ? "https://api.airwallex.com" : "https://api-demo.airwallex.com");
const airwallexClientId = String(process.env.AIRWALLEX_CLIENT_ID ?? "").trim();
const airwallexApiKey = String(process.env.AIRWALLEX_API_KEY ?? "").trim();
const airwallexWebhookSecret = String(process.env.AIRWALLEX_WEBHOOK_SECRET ?? "").trim();
const defaultCurrencyCode = String(process.env.AIRWALLEX_DEFAULT_CURRENCY_CODE ?? "USD").trim().toUpperCase();

type CachedAccessToken = {
  token: string;
  expiresAtMs: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

function normalizeCountryCode(countryCode?: string | null) {
  const raw = String(countryCode ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "";
}

export function resolveCurrencyCodeForCountry(countryCode?: string | null, fallbackCurrencyCode = defaultCurrencyCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const mapped = normalizedCountryCode ? (countryToCurrency as Record<string, string | undefined>)[normalizedCountryCode] : undefined;
  return String(mapped ?? fallbackCurrencyCode ?? defaultCurrencyCode).trim().toUpperCase() || defaultCurrencyCode;
}

export function getCurrencyMinorUnitDigits(currencyCode: string) {
  const normalized = String(currencyCode ?? "").trim().toUpperCase();
  const entry = normalized ? currencyCodes.code(normalized) : null;
  const digits = entry?.digits;
  if (typeof digits !== "number" || !Number.isFinite(digits) || digits < 0) return 2;
  return digits;
}

export function convertPointsToCurrencyMajor(pointsToCredit: number, pointsPerCurrencyUnit = 100) {
  const normalizedPointsPerCurrencyUnit = Number(pointsPerCurrencyUnit);
  const divisor = Number.isFinite(normalizedPointsPerCurrencyUnit) && normalizedPointsPerCurrencyUnit > 0
    ? normalizedPointsPerCurrencyUnit
    : 100;
  return Number((pointsToCredit / divisor).toFixed(2));
}

export function convertCurrencyMajorToMinor(currencyAmountMajor: number, currencyCode: string) {
  const digits = getCurrencyMinorUnitDigits(currencyCode);
  const factor = 10 ** digits;
  return Math.round(currencyAmountMajor * factor);
}

export function formatCurrencyAmount(currencyAmountMajor: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currencyCode ?? defaultCurrencyCode).toUpperCase(),
    }).format(currencyAmountMajor);
  } catch {
    return `${currencyAmountMajor.toFixed(2)} ${String(currencyCode ?? defaultCurrencyCode).toUpperCase()}`;
  }
}

async function getAirwallexAccessToken() {
  if (!airwallexClientId || !airwallexApiKey) {
    throw new Error("Airwallex credentials are not configured");
  }

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - 60_000 > now) {
    return cachedAccessToken.token;
  }

  const response = await fetch(`${airwallexBaseUrl}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": airwallexApiKey,
      "x-client-id": airwallexClientId,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to authenticate with Airwallex (${response.status}): ${text || response.statusText}`);
  }

  const payload = await response.json() as { token?: string; expires_at?: string };
  const token = String(payload.token ?? "").trim();
  const expiresAtMs = payload.expires_at ? new Date(payload.expires_at).getTime() : now + 15 * 60 * 1000;

  if (!token) {
    throw new Error("Airwallex authentication response missing access token");
  }

  cachedAccessToken = { token, expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : now + 15 * 60 * 1000 };
  return token;
}

export type AirwallexPaymentIntentCreateInput = {
  amountMinor: number;
  currencyCode: string;
  merchantOrderId: string;
  returnUrl: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AirwallexPaymentIntentCreateResult = {
  id: string;
  clientSecret: string;
  amountMinor: number;
  currencyCode: string;
  merchantOrderId: string;
  raw: Record<string, unknown>;
};

export async function createAirwallexPaymentIntent(input: AirwallexPaymentIntentCreateInput) {
  const token = await getAirwallexAccessToken();
  const response = await fetch(`${airwallexBaseUrl}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      request_id: input.requestId ?? crypto.randomUUID(),
      amount: input.amountMinor,
      currency: input.currencyCode,
      merchant_order_id: input.merchantOrderId,
      return_url: input.returnUrl,
      metadata: input.metadata ?? {},
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to create Airwallex payment intent (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const id = String(payload.id ?? "").trim();
  const clientSecret = String(payload.client_secret ?? payload.clientSecret ?? "").trim();
  const amountMinor = Number(payload.amount ?? input.amountMinor);
  const currencyCode = String(payload.currency ?? input.currencyCode).trim().toUpperCase();
  const merchantOrderId = String(payload.merchant_order_id ?? input.merchantOrderId).trim();

  if (!id || !clientSecret) {
    throw new Error("Airwallex payment intent response missing id or client_secret");
  }

  return {
    id,
    clientSecret,
    amountMinor,
    currencyCode,
    merchantOrderId,
    raw: payload,
  } satisfies AirwallexPaymentIntentCreateResult;
}

export function getAirwallexWebhookSecret() {
  return airwallexWebhookSecret;
}

export function verifyAirwallexWebhookSignature(rawBody: string, timestamp: string | undefined, signature: string | undefined) {
  if (!airwallexWebhookSecret) {
    throw new Error("Airwallex webhook secret is not configured");
  }
  const rawTimestamp = String(timestamp ?? "").trim();
  const rawSignature = String(signature ?? "").trim();
  if (!rawTimestamp || !rawSignature) return false;

  const digest = crypto
    .createHmac("sha256", airwallexWebhookSecret)
    .update(`${rawTimestamp}${rawBody}`)
    .digest("hex");

  const provided = Buffer.from(rawSignature);
  const expected = Buffer.from(digest);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractAirwallexWebhookDetails(payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : isRecord(root.object) ? root.object : isRecord(root.resource) ? root.resource : root;

  const eventType =
    String(root.name ?? root.event_type ?? root.eventType ?? root.type ?? "").trim() ||
    String(data.name ?? data.event_type ?? data.eventType ?? data.type ?? "").trim();
  const eventId = String(root.id ?? root.event_id ?? root.eventId ?? data.id ?? data.event_id ?? data.eventId ?? "").trim();
  const paymentIntentId = String(data.id ?? data.payment_intent_id ?? data.paymentIntentId ?? data.intent_id ?? root.payment_intent_id ?? root.paymentIntentId ?? "").trim();
  const merchantOrderId = String(data.merchant_order_id ?? data.merchantOrderId ?? root.merchant_order_id ?? root.merchantOrderId ?? "").trim();
  const status = String(data.status ?? root.status ?? "").trim();

  return {
    eventType,
    eventId,
    paymentIntentId,
    merchantOrderId,
    status,
    raw: root,
  };
}
