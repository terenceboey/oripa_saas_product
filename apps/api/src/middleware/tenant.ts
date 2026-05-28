import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export type TenantRequest = Request & {
  tenantId?: string;
  tenantHost?: string;
};

export async function tenantResolver(req: TenantRequest, _res: Response, next: NextFunction) {
  const explicitHost = String(req.header("x-tenant-host") || "").trim().toLowerCase();
  const host = explicitHost || String(req.hostname || "").toLowerCase();
  if (!host) return next();

  const tenant = await prisma.tenant.findUnique({ where: { host } });
  if (tenant) {
    req.tenantId = tenant.id;
    req.tenantHost = tenant.host;
  }

  return next();
}
