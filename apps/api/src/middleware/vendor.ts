import { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma";

export type VendorRequest = Request & {
  vendorId?: string;
  vendorHost?: string;
};

export const vendorResolver: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  void (async () => {
    const vendorReq = req as VendorRequest;
    const explicitHost = String(vendorReq.header("x-vendor-host") || "").trim().toLowerCase();
    const requestHost = explicitHost || String(vendorReq.hostname || "").toLowerCase();
    const host = requestHost.split(":")[0];
    if (!host) {
      next();
      return;
    }

    let vendor = await prisma.vendor.findUnique({ where: { host } });

    // Fallback: subdomain routing for multi-tenant hosts, e.g. vendorA.example.com
    if (!vendor) {
      const baseDomain = String(process.env.VENDOR_BASE_DOMAIN ?? "").trim().toLowerCase();
      if (baseDomain && host.endsWith(`.${baseDomain}`)) {
        const candidateSlug = host.slice(0, host.length - (`.${baseDomain}`).length).trim();
        if (candidateSlug && !candidateSlug.includes(".")) {
          vendor = await prisma.vendor.findUnique({ where: { slug: candidateSlug } });
        }
      }
    }

    if (vendor) {
      vendorReq.vendorId = vendor.id;
      vendorReq.vendorHost = host;
    }

    next();
  })().catch(next);
};






