import { Request, Response } from "express";
import { VendorMembershipRole } from "@prisma/client";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

const jwtSecret = process.env.JWT_SECRET ?? "change-me";
export const SUPER_ADMIN_ROLE_CODE = "super_admin";
const appNodeEnv = String(process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = appNodeEnv === "production";
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const authCookieSameSite = isProduction ? "None" : "Lax";
const accessCookieName = "oripa_access_token";
const refreshCookieName = "oripa_refresh_token";
const csrfCookieName = "oripa_csrf_token";
const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlDays = 30;
const refreshTokenPepper = process.env.AUTH_REFRESH_PEPPER ?? jwtSecret;

type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
};

type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
};

type AuthSessionRecord = {
  id: string;
  familyId: string;
  userId: string;
  refreshTokenHash: string;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedBySessionId: string | null;
  expiresAt: Date;
  user: AuthSessionUser;
};

type VendorAccessRequest = Request & {
  vendorId?: string;
  vendorHost?: string;
  vendorResolutionError?: string;
};

type AccessTokenPayload = {
  sub?: string;
  sid?: string;
  email?: string;
  name?: string | null;
  status?: string;
  typ?: "access";
};

function parseCookieHeader(cookieHeader?: string) {
  const map = new Map<string, string>();
  const raw = String(cookieHeader ?? "");
  if (!raw) return map;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      map.set(key, decodeURIComponent(val));
    } catch {
      map.set(key, val);
    }
  }
  return map;
}

function setCookie(res: Response, name: string, value: string, maxAgeSeconds: number, options: { httpOnly?: boolean } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${authCookieSameSite}`,
  ];
  if (options.httpOnly !== false) {
    parts.splice(2, 0, "HttpOnly");
  }
  if (isProduction) parts.push("Secure");
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  res.append("Set-Cookie", parts.join("; "));
}

function clearCookie(res: Response, name: string, options: { httpOnly?: boolean } = {}) {
  const parts = [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${authCookieSameSite}`,
  ];
  if (options.httpOnly !== false) {
    parts.splice(2, 0, "HttpOnly");
  }
  if (isProduction) parts.push("Secure");
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  res.append("Set-Cookie", parts.join("; "));
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies.get(name) ?? null;
}

function getBearerUserId(authorizationHeader?: string) {
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

function verifyAccessToken(token?: string | null) {
  const rawToken = String(token ?? "").trim();
  if (!rawToken) return null;
  try {
    const payload = jwt.verify(rawToken, jwtSecret) as AccessTokenPayload;
    if (payload.typ !== "access") return null;
    if (!payload.sub || !payload.sid) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(`${token}:${refreshTokenPepper}`).digest("hex");
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function createFamilyId() {
  return crypto.randomUUID();
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getAccessCookie(req: Request) {
  return getCookieValue(req.header("cookie") ?? undefined, accessCookieName);
}

function getRefreshCookie(req: Request) {
  return getCookieValue(req.header("cookie") ?? undefined, refreshCookieName);
}

function getCsrfCookie(req: Request) {
  return getCookieValue(req.header("cookie") ?? undefined, csrfCookieName);
}

export function getCsrfTokenFromRequest(req: Request) {
  return getCsrfCookie(req);
}

function getCsrfHeader(req: Request) {
  return String(req.header("x-csrf-token") ?? "").trim();
}

export function ensureCsrfCookie(res: Response, existingToken?: string | null) {
  const token = String(existingToken ?? "").trim();
  if (token) return token;
  const nextToken = createCsrfToken();
  setCookie(res, csrfCookieName, nextToken, refreshTokenTtlDays * 24 * 60 * 60, { httpOnly: false });
  return nextToken;
}

export function validateCsrfRequest(req: Request) {
  const method = String(req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  const authorization = String(req.header("authorization") ?? "").trim();
  if (authorization.startsWith("Bearer ")) return null;
  const cookieToken = getCsrfCookie(req);
  const headerToken = getCsrfHeader(req);
  if (!cookieToken || !headerToken) return "csrf token missing";
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);
  if (cookieBuf.length !== headerBuf.length) return "csrf token invalid";
  if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) return "csrf token invalid";
  return null;
}

async function revokeSessionFamily(familyId: string, reason: string) {
  const now = new Date();
  await prisma.authSession.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      revokedReason: reason,
    },
  });
}

async function loadActiveAccessSession(req: Request) {
  const accessToken = getAccessCookie(req);
  const payload = verifyAccessToken(accessToken);
  if (!payload) return null;

  const session = await prisma.authSession.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      familyId: true,
      userId: true,
      refreshTokenHash: true,
      revokedAt: true,
      revokedReason: true,
      replacedBySessionId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
  }) as AuthSessionRecord | null;

  if (!session) return null;
  if (session.user.status !== "ACTIVE") return null;
  return session;
}

async function loadRefreshSession(req: Request) {
  const refreshToken = getRefreshCookie(req);
  if (!refreshToken) return null;
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash },
    select: {
      id: true,
      familyId: true,
      userId: true,
      refreshTokenHash: true,
      revokedAt: true,
      revokedReason: true,
      replacedBySessionId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
  }) as AuthSessionRecord | null;

  if (!session) return null;
  if (session.user.status !== "ACTIVE") return null;
  return { refreshToken, session };
}

function issueAccessToken(user: AuthUserRecord, sessionId: string) {
  return jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      email: user.email,
      name: user.displayName,
      status: user.status,
      typ: "access",
    },
    jwtSecret,
    { expiresIn: accessTokenTtlSeconds }
  );
}

async function createAuthSession(user: AuthUserRecord, input: { familyId?: string; userAgent?: string | null; ipAddress?: string | null } = {}) {
  const now = new Date();
  const familyId = input.familyId ?? createFamilyId();
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(now.getTime() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  const session = await prisma.authSession.create({
    data: {
      familyId,
      userId: user.id,
      refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      lastUsedAt: now,
      expiresAt,
    },
    select: {
      id: true,
      familyId: true,
      userId: true,
      refreshTokenHash: true,
      revokedAt: true,
      revokedReason: true,
      replacedBySessionId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
  }) as AuthSessionRecord;

  return {
    accessToken: issueAccessToken(user, session.id),
    refreshToken,
    session,
  };
}

function setAuthCookies(res: Response, user: AuthUserRecord, session: AuthSessionRecord, refreshToken: string) {
  const accessToken = issueAccessToken(user, session.id);
  setCookie(res, accessCookieName, accessToken, accessTokenTtlSeconds);
  setCookie(res, refreshCookieName, refreshToken, refreshTokenTtlDays * 24 * 60 * 60);
  return accessToken;
}

async function rotateRefreshSession(req: Request, res?: Response) {
  const loaded = await loadRefreshSession(req);
  if (!loaded) return null;

  const { session } = loaded;
  const now = new Date();
  if (session.revokedAt) {
    if (session.replacedBySessionId) {
      await revokeSessionFamily(session.familyId, "refresh_reuse_detected");
    }
    if (res) {
      clearCookie(res, accessCookieName);
      clearCookie(res, refreshCookieName);
    }
    return null;
  }
  if (session.expiresAt <= now) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        revokedReason: "expired",
      },
    });
    if (res) {
      clearCookie(res, accessCookieName);
      clearCookie(res, refreshCookieName);
    }
    return null;
  }

  const newRefreshToken = createRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const nextSession = await prisma.$transaction(async (tx) => {
    const created = await tx.authSession.create({
      data: {
        familyId: session.familyId,
        userId: session.userId,
        refreshTokenHash: newRefreshTokenHash,
        userAgent: req.header("user-agent") ?? null,
        ipAddress: req.ip ?? null,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + refreshTokenTtlDays * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        familyId: true,
        userId: true,
        refreshTokenHash: true,
        revokedAt: true,
        revokedReason: true,
        replacedBySessionId: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
          },
        },
      },
    });

    await tx.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        revokedReason: "rotated",
        replacedBySessionId: created.id,
        lastUsedAt: now,
      },
    });

    return created as AuthSessionRecord;
  });

  if (res) {
    await setAuthCookies(res, nextSession.user, nextSession, newRefreshToken);
  }
  return {
    userId: nextSession.user.id,
    session: nextSession,
  };
}

async function resolveActiveUserFromRequest(req: Request, res?: Response) {
  const accessSession = await loadActiveAccessSession(req);
  if (accessSession) {
    return {
      userId: accessSession.user.id,
      session: accessSession,
    };
  }

  const rotated = await rotateRefreshSession(req, res);
  if (rotated) return rotated;

  const bearerUserId = getBearerUserId(req.header("authorization") ?? undefined);
  if (bearerUserId) {
    return {
      userId: bearerUserId,
      session: null,
    };
  }

  if (res) {
    clearCookie(res, accessCookieName);
    clearCookie(res, refreshCookieName);
  }
  return null;
}

export async function issueAuthSession(res: Response, user: AuthUserRecord, input: { familyId?: string; userAgent?: string | null; ipAddress?: string | null } = {}) {
  const session = await createAuthSession(user, input);
  setAuthCookies(res, user, session.session, session.refreshToken);
  ensureCsrfCookie(res);
  return session;
}

export async function revokeCurrentSessionFromRequest(req: Request, res?: Response) {
  const accessSession = await loadActiveAccessSession(req);
  const now = new Date();
  if (accessSession) {
    await prisma.authSession.update({
      where: { id: accessSession.id },
      data: {
        revokedAt: now,
        revokedReason: "logout",
      },
    });
    if (res) {
      clearCookie(res, accessCookieName);
      clearCookie(res, refreshCookieName);
      clearCookie(res, csrfCookieName, { httpOnly: false });
    }
    return true;
  }

  const loadedRefresh = await loadRefreshSession(req);
  if (!loadedRefresh) {
    if (res) {
      clearCookie(res, accessCookieName);
      clearCookie(res, refreshCookieName);
      clearCookie(res, csrfCookieName, { httpOnly: false });
    }
    return false;
  }

  const { session } = loadedRefresh;
  if (session.revokedAt) {
    if (session.replacedBySessionId) {
      await revokeSessionFamily(session.familyId, "refresh_reuse_detected");
    }
  } else {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        revokedReason: "logout",
      },
    });
  }

  if (res) {
    clearCookie(res, accessCookieName);
    clearCookie(res, refreshCookieName);
    clearCookie(res, csrfCookieName, { httpOnly: false });
  }
  return true;
}

export async function getRequestUserId(req: Request, res?: Response) {
  const resolved = await resolveActiveUserFromRequest(req, res);
  return resolved?.userId ?? null;
}

export function hasRole(role: VendorMembershipRole, allowed: VendorMembershipRole[]) {
  return allowed.includes(role);
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

export async function getUserRoleCodes(userId: string) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: { code: true },
      },
    },
  });
  return roles.map((row) => row.role.code);
}

export async function isSuperAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      emailVerificationStatus: true,
      emailVerifiedAt: true,
      userRoles: {
        select: {
          role: {
            select: { code: true },
          },
        },
      },
    },
  });
  if (!user) return false;
  if (user.status !== "ACTIVE") return false;
  if (user.emailVerificationStatus !== "VERIFIED" || !user.emailVerifiedAt) return false;
  return user.userRoles.some((row) => row.role.code === SUPER_ADMIN_ROLE_CODE);
}

export async function requireSuperAdmin(req: Request, res: Response) {
  const actorUserId = await getRequestUserId(req, res);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: {
      id: true,
      email: true,
      status: true,
      emailVerificationStatus: true,
      emailVerifiedAt: true,
      userRoles: {
        select: {
          role: {
            select: { code: true, label: true },
          },
        },
      },
    },
  });
  if (!user) {
    res.status(403).json({ error: "forbidden: super admin access required" });
    return null;
  }
  if (user.status !== "ACTIVE") {
    res.status(403).json({ error: "forbidden: super admin access required" });
    return null;
  }
  const isRoleAssigned = user.userRoles.some((row) => row.role.code === SUPER_ADMIN_ROLE_CODE);
  if (!isRoleAssigned) {
    res.status(403).json({ error: "forbidden: super admin access required" });
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    roles: user.userRoles.map((row) => row.role.code),
  };
}

export async function requireVendorAccess(
  req: VendorAccessRequest,
  res: Response,
  allowedRoles?: VendorMembershipRole[]
) {
  if (req.vendorResolutionError) {
    res.status(403).json({ error: req.vendorResolutionError });
    return null;
  }

  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }

  const actorUserId = await getRequestUserId(req, res);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
  if (!role) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(role, allowedRoles)) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }

  return { vendorId: req.vendorId, actorUserId, role };
}
