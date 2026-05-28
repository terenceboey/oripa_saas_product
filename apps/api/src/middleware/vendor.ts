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
    const host = explicitHost || String(vendorReq.hostname || "").toLowerCase();
    if (!host) {
      next();
      return;
    }

    const vendor = await prisma.vendor.findUnique({ where: { host } });
    if (vendor) {
      vendorReq.vendorId = vendor.id;
      vendorReq.vendorHost = vendor.host;
    }

    next();
  })().catch(next);
};






