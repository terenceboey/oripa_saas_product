import countryToCurrency from "country-to-currency";
import { init } from "@airwallex/components-sdk";

const airwallexEnv = String(process.env.NEXT_PUBLIC_AIRWALLEX_ENV ?? "demo").toLowerCase() === "prod" ? "prod" : "demo";

let airwallexPaymentsPromise: Promise<Awaited<ReturnType<typeof init>>["payments"]> | null = null;

function normalizeCountryCode(countryCode?: string | null) {
  const raw = String(countryCode ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "";
}

export function resolveCurrencyCodeForCountry(countryCode?: string | null, fallbackCurrencyCode = "USD") {
  const normalized = normalizeCountryCode(countryCode);
  const mapped = normalized ? (countryToCurrency as Record<string, string | undefined>)[normalized] : undefined;
  return String(mapped ?? fallbackCurrencyCode ?? "USD").trim().toUpperCase() || "USD";
}

export function formatCurrencyAmount(amountMajor: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currencyCode ?? "USD").toUpperCase(),
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${String(currencyCode ?? "USD").toUpperCase()}`;
  }
}

async function loadAirwallexPayments() {
  if (!airwallexPaymentsPromise) {
    airwallexPaymentsPromise = init({
      env: airwallexEnv,
      enabledElements: ["payments"],
    }).then((result) => result.payments);
  }

  const payments = await airwallexPaymentsPromise;
  if (!payments) {
    throw new Error("Airwallex payments SDK is not available");
  }
  return payments;
}

export async function redirectCustomerTopupCheckout(input: {
  intentId: string;
  clientSecret: string;
  currencyCode: string;
  countryCode?: string | null;
  successUrl: string;
}) {
  const payments = await loadAirwallexPayments();
  await payments.redirectToCheckout({
    intent_id: input.intentId,
    client_secret: input.clientSecret,
    currency: input.currencyCode,
    country_code: input.countryCode ?? undefined,
    successUrl: input.successUrl,
    mode: "payment",
  });
}
