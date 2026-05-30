export function normalizeVendorLogoUrl(url?: string | null) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/\.(png|jpg|jpeg|webp|svg)$/i.test(raw)) return raw;
  if (raw.includes("/uploads/vendor-logo/")) return `${raw.replace(/\/$/, "")}-desktop.webp`;
  return raw;
}

export function normalizeVendorFaviconUrl(url?: string | null, fallbackLogoUrl?: string | null) {
  const raw = String(url ?? "").trim();
  if (raw && /\.(png|ico|jpg|jpeg|webp|svg)$/i.test(raw)) return raw;
  if (raw && raw.includes("/uploads/vendor-logo/")) return `${raw.replace(/\/$/, "")}-favicon.png`;

  const fallback = normalizeVendorLogoUrl(fallbackLogoUrl);
  if (!fallback) return "";
  return fallback.replace(/-desktop\.webp$/i, "-favicon.png");
}
