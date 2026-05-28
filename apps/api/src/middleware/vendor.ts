import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export type VendorRequest = Request & {
  vendorId?: string;
  vendorHost?: string;
};

export async function vendorResolver(req: VendorRequest, _res: Response, next: NextFunction) {
  const explicitHost = String(req.header("x-vendor-host") || "").trim().toLowerCase();
  const host = explicitHost || String(req.hostname || "").toLowerCase();
  if (!host) return next();

  const vendor = await prisma.vendor.findUnique({ where: { host } });
  if (vendor) {
    req.vendorId = vendor.id;
    req.vendorHost = vendor.host;
  }

  return next();
}






