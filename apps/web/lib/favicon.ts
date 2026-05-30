export function applyVendorFavicon(url?: string | null) {
  if (typeof document === "undefined") return;
  if (!url) return;
  const href = url.trim();
  if (!href) return;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = href.endsWith(".png") ? "image/png" : "image/webp";
  link.href = href;
}
