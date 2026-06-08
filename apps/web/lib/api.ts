const csrfCookieName = "oripa_csrf_token";
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchVendorByHost(host: string) {
  const url = new URL("/v1/vendors/by-host", apiBaseUrl);
  url.searchParams.set("host", host);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

function isUnsafeMethod(method?: string) {
  const normalized = String(method ?? "GET").trim().toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD" && normalized !== "OPTIONS";
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

export function getCsrfToken() {
  return readCookie(csrfCookieName);
}

export function csrfHeaders() {
  const token = getCsrfToken();
  return token ? { "x-csrf-token": token } : {};
}

export async function ensureCsrfCookie() {
  try {
    const response = await fetch(`${apiBaseUrl}/v1/auth/csrf`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        "x-client-page": "csrf-bootstrap",
      },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return String(payload?.csrfToken ?? readCookie(csrfCookieName) ?? "");
  } catch {
    return null;
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = String(init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers ?? {});
  headers.delete("x-vendor-host");
  if (isUnsafeMethod(method) && !headers.has("x-csrf-token")) {
    const token = getCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }
  return fetch(new Request(input, { ...init, headers }));
}
