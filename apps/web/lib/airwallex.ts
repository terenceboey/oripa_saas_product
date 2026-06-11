import countryToCurrency from "country-to-currency";

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
