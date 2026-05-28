import jwt from "jsonwebtoken";
import { VendorMembershipRole } from "@prisma/client";
import { prisma } from "./prisma";

const jwtSecret = process.env.JWT_SECRET ?? "change-me";

export function getBearerUserId(authorizationHeader?: string) {
  const raw = String(authorizationHeader ?? "");
  if (!raw.startsWith("Bearer ")) return null;
  const token = raw.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function getVendorMembershipRole(input: { vendorId: string; userId: string }) {
  const membership = await prisma.vendorMembership.findFirst({
    where: {
      vendorId: input.vendorId,
      userId: input.userId,
      isActive: true,
    },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export function hasRole(role: VendorMembershipRole, allowed: VendorMembershipRole[]) {
  return allowed.includes(role);
}
