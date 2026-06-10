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

type ResponsiveMediaUrl = {
  mobile: string;
  desktop: string;
  fallback: string;
  mobileType?: string | null;
  desktopType?: string | null;
  allowSources: boolean;
};

function inferContentType(url: string) {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function canDerivePackBannerWebp(url: string) {
  return (
    url.startsWith("/default-pack-banner") ||
    url.startsWith("/carousel/") ||
    url.startsWith("/pack-presets/")
  );
}

export function resolvePackBannerMediaUrl(url?: string | null, fallback = "/default-pack-banner-desktop.webp"): ResponsiveMediaUrl {
  const raw = String(url ?? "").trim();
  const resolved = raw
    ? raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : raw.startsWith("/")
        ? raw
        : `/${raw}`
    : fallback;

  const contentType = inferContentType(resolved);
  if (!resolved.startsWith("/")) {
    return {
      mobile: resolved,
      desktop: resolved,
      fallback: resolved,
      mobileType: contentType,
      desktopType: contentType,
      allowSources: contentType === "image/webp",
    };
  }

  if (resolved.endsWith("-desktop.webp")) {
    return {
      mobile: resolved.replace("-desktop.webp", "-mobile.webp"),
      desktop: resolved,
      fallback: resolved,
      mobileType: "image/webp",
      desktopType: "image/webp",
      allowSources: true,
    };
  }

  if (resolved.endsWith(".png") && canDerivePackBannerWebp(resolved)) {
    const base = resolved.slice(0, -4);
    return {
      mobile: `${base}-mobile.webp`,
      desktop: `${base}-desktop.webp`,
      fallback: resolved,
      mobileType: "image/webp",
      desktopType: "image/webp",
      allowSources: true,
    };
  }

  return {
    mobile: resolved,
    desktop: resolved,
    fallback: resolved,
    mobileType: contentType,
    desktopType: contentType,
    allowSources: contentType === "image/webp",
  };
}
