"use client";

import { useEffect } from "react";
import { apiBaseUrl, ensureCsrfCookie, getCsrfToken } from "../lib/api";

function isApiRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!url) return false;
  if (url.startsWith(apiBaseUrl)) return true;
  if (url.startsWith("/v1/")) return true;
  return false;
}

function buildSanitizedRequest(input: RequestInfo | URL, init: RequestInit) {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.delete("x-vendor-host");
  return new Request(input, { ...init, headers });
}

export function CsrfBootstrap() {
  useEffect(() => {
    let mounted = true;
    let patched = false;

    const patchFetch = async () => {
      const bootstrapPromise = ensureCsrfCookie();
      if (!mounted || patched || typeof window === "undefined") return;
      const originalFetch = window.fetch.bind(window);

      window.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
        try {
          const method = String(init.method ?? (input instanceof Request ? input.method : "GET")).trim().toUpperCase();
          const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
          if (unsafe && isApiRequest(input)) {
            const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
            headers.delete("x-vendor-host");
            let csrfToken = getCsrfToken();
            if (!csrfToken) {
              await bootstrapPromise.catch(() => null);
              csrfToken = getCsrfToken();
            }
            if (!headers.has("x-csrf-token") && csrfToken) {
              headers.set("x-csrf-token", csrfToken);
            }
            return originalFetch(buildSanitizedRequest(input, { ...init, headers }));
          }
          if (isApiRequest(input)) {
            return originalFetch(buildSanitizedRequest(input, init));
          }
        } catch {
          // fall back to original fetch below
        }
        return originalFetch(input, init);
      }) as typeof window.fetch;

      patched = true;
    };

    void patchFetch();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
