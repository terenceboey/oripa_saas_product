import { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma";

export type VendorRequest = Request & {
  vendorId?: string;
  vendorHost?: string;
  vendorResolutionError?: string;
};

function normalizeHost(raw: string) {
  const input = String(raw ?? "").trim().toLowerCase();
  if (!input) return "";
  try {
    return new URL(input).host.toLowerCase().replace(/^\.+/, "");
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^\.+/, "").split("/")[0].split(":")[0];
  }
}

function hostFromHeader(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).host.toLowerCase().replace(/^\.+/, "");
    } catch {
      return normalizeHost(raw);
    }
  }
  return normalizeHost(raw);
}

function resolveBrowserVendorHost(req: Request) {
  const explicitHost = hostFromHeader(req.header("x-vendor-host"));
  const originHost = hostFromHeader(req.header("origin"));
  const refererHost = hostFromHeader(req.header("referer"));
  const browserHost = originHost || refererHost;
  const isProduction = String(process.env.NODE_ENV ?? "development").toLowerCase() === "production";

  if (browserHost) {
    return {
      host: browserHost,
      source: originHost ? "origin" : "referer",
      explicitHost,
      mismatch: Boolean(isProduction && explicitHost && explicitHost !== browserHost),
      trusted: true,
    } as const;
  }

  if (!isProduction && explicitHost) {
    return {
      host: explicitHost,
      source: "header",
      explicitHost,
      mismatch: false,
      trusted: true,
    } as const;
  }

  if (explicitHost) {
    return {
      host: explicitHost,
      source: "header",
      explicitHost,
      mismatch: true,
      trusted: false,
    } as const;
  }

  return {
    host: "",
    source: "none",
    explicitHost: "",
    mismatch: false,
    trusted: false,
  } as const;
}

export function resolveVendorHostHint(req: Request) {
  return resolveBrowserVendorHost(req);
}

export const vendorResolver: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  void (async () => {
    const vendorReq = req as VendorRequest;
    const resolved = resolveBrowserVendorHost(vendorReq);
    const host = resolved.host;
    const baseDomain = String(process.env.VENDOR_BASE_DOMAIN ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^\.+/, "");

    if (resolved.mismatch) {
      vendorReq.vendorResolutionError = "forbidden: vendor host mismatch";
    } else if (resolved.explicitHost && !resolved.trusted) {
      vendorReq.vendorResolutionError = "forbidden: vendor host could not be verified";
    }

    if (host && resolved.trusted) {
      vendorReq.vendorHost = host;
    }

    if (!host || (vendorReq.vendorResolutionError && !resolved.trusted)) {
      next();
      return;
    }

    let vendor = await prisma.vendor.findUnique({ where: { host } });

    // Fallback: subdomain routing for multi-tenant hosts, e.g. vendorA.example.com
    if (!vendor && baseDomain && host.endsWith(`.${baseDomain}`)) {
      const candidateSlug = host.slice(0, host.length - (`.${baseDomain}`).length).trim();
      if (candidateSlug && !candidateSlug.includes(".")) {
        vendor = await prisma.vendor.findUnique({ where: { slug: candidateSlug } });
      }
    }

    if (vendor) {
      vendorReq.vendorId = vendor.id;
    }

    next();
  })().catch(next);
};






