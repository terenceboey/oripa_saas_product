import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AppleStrategy from "passport-apple";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { sendEmail } from "../../lib/email";
import { getRequestUserId } from "../../lib/rbac";

const authRouter = Router();
const webBaseUrl = process.env.WEB_URL ?? "http://localhost:3000";
const appBaseUrl = process.env.APP_URL ?? "http://localhost:4000";
const jwtSecret = process.env.JWT_SECRET ?? "change-me";
const appNodeEnv = String(process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = appNodeEnv === "production";
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const authCookieSameSite = isProduction ? "None" : "Lax";

let passportConfigured = false;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;
const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "invalid",
  "localhost",
]);

function resolveRequestHost(req: VendorRequest) {
  const explicitHost = String(req.header("x-vendor-host") ?? "").trim().toLowerCase();
  if (explicitHost) return explicitHost;
  const hostname = String(req.hostname ?? "").trim().toLowerCase();
  if (hostname) return hostname;
  return String(process.env.DEFAULT_TENANT_HOST ?? "localhost").trim().toLowerCase();
}

function isSafeRedirectVendorHost(host: string) {
  const normalized = String(host ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return false;
  const base = String(process.env.VENDOR_BASE_DOMAIN ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^\.+/, "");
  if (!base) return false;
  return normalized === base || normalized.endsWith(`.${base}`);
}

function buildAuthCompleteRedirectUrl(vendorHost: string, provider: "google" | "apple") {
  const normalizedVendorHost = String(vendorHost ?? "").trim().toLowerCase();
  const applyParams = (url: URL) => {
    if (normalizedVendorHost) url.searchParams.set("vendorHost", normalizedVendorHost);
    url.searchParams.set("provider", provider);
    return url.toString();
  };

  try {
    if (isSafeRedirectVendorHost(normalizedVendorHost)) {
      const parsedWeb = new URL(webBaseUrl);
      return applyParams(new URL(`${parsedWeb.protocol}//${normalizedVendorHost}/auth/complete`));
    }
  } catch {
    // Fall back to the configured web URL below.
  }

  return applyParams(new URL("/auth/complete", webBaseUrl));
}

function buildVendorPathRedirectUrl(vendorHost: string, path: string, params?: Record<string, string | null | undefined>) {
  const normalizedVendorHost = String(vendorHost ?? "").trim().toLowerCase();
  const applyParams = (url: URL) => {
    for (const [key, value] of Object.entries(params ?? {})) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return url.toString();
  };

  try {
    if (isSafeRedirectVendorHost(normalizedVendorHost)) {
      const parsedWeb = new URL(webBaseUrl);
      return applyParams(new URL(`${parsedWeb.protocol}//${normalizedVendorHost}${path}`));
    }
  } catch {
    // Fall back to the configured web URL below.
  }

  return applyParams(new URL(path, webBaseUrl));
}

function issueAccessToken(user: { id: string; email: string; displayName: string | null; status: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      status: user.status,
    },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function setAccessCookie(res: any, token: string) {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const parts = [
    `oripa_access_token=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${authCookieSameSite}`,
  ];
  if (isProduction) parts.push("Secure");
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAccessCookie(res: any) {
  const parts = [
    "oripa_access_token=",
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    `SameSite=${authCookieSameSite}`,
  ];
  if (isProduction) parts.push("Secure");
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  fullName: string | null;
  dateOfBirth: Date | null;
  age: number | null;
  country: string | null;
  status: string;
  emailVerificationStatus: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
};

function formatDateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function countryToCode(value?: string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  const knownCountries: Record<string, string> = {
    singapore: "SG",
    australia: "AU",
    malaysia: "MY",
    "united states": "US",
    "united kingdom": "GB",
    canada: "CA",
    japan: "JP",
    "south korea": "KR",
    indonesia: "ID",
    philippines: "PH",
    thailand: "TH",
    vietnam: "VN",
  };
  return knownCountries[normalized.toLowerCase()] ?? null;
}

function isCustomerProfileComplete(user: Pick<AuthUserRecord, "fullName" | "dateOfBirth" | "country">) {
  return Boolean(user.fullName?.trim() && user.dateOfBirth && countryToCode(user.country));
}

function serializeAuthUser(user: AuthUserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    fullName: user.fullName,
    dateOfBirth: formatDateOnly(user.dateOfBirth),
    country: user.country,
    countryCode: countryToCode(user.country),
    age: user.age,
    status: user.status,
    emailVerificationStatus: user.emailVerificationStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    profileComplete: isCustomerProfileComplete(user),
  };
}

function normalizeFullName(input: unknown) {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

function normalizeCountryCode(input: unknown) {
  return String(input ?? "").trim().toUpperCase();
}

function parseDateOfBirth(input: unknown) {
  const raw = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== raw) return null;
  return parsed;
}

function calculateAge(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function validateCustomerProfileInput(body: unknown, options: { required?: boolean } = {}) {
  const required = options.required ?? true;
  const input = (body ?? {}) as Record<string, unknown>;
  const rawFullName = input.fullName ?? input.displayName;
  const rawDateOfBirth = input.dateOfBirth;
  const rawCountry = input.countryCode ?? input.country;
  const hasFullName = normalizeFullName(rawFullName).length > 0;
  const hasDateOfBirth = String(rawDateOfBirth ?? "").trim().length > 0;
  const hasCountry = String(rawCountry ?? "").trim().length > 0;
  const fullName = normalizeFullName(rawFullName);
  const dateOfBirth = hasDateOfBirth ? parseDateOfBirth(rawDateOfBirth) : null;
  const countryCode = countryToCode(String(rawCountry ?? "")) ?? normalizeCountryCode(rawCountry);
  const errors: string[] = [];
  const today = new Date();
  const oldestAllowed = new Date("1900-01-01T00:00:00.000Z");

  if (required || hasFullName) {
    if (!fullName) errors.push("fullName is required");
    else if (fullName.length > 120) errors.push("fullName must be 120 characters or fewer");
  }

  if (required || hasDateOfBirth) {
    if (!dateOfBirth) errors.push("dateOfBirth must be a valid YYYY-MM-DD date");
    else if (dateOfBirth > today) errors.push("dateOfBirth cannot be in the future");
    else if (dateOfBirth < oldestAllowed) errors.push("dateOfBirth is too far in the past");
  }

  if (required || hasCountry) {
    if (!/^[A-Z]{2}$/.test(countryCode)) errors.push("countryCode must be a valid 2-letter country code");
  }

  return {
    errors,
    data: {
      fullName: fullName || null,
      dateOfBirth,
      countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
      age: calculateAge(dateOfBirth),
    },
  };
}

type VendorMembershipSummary = {
  role: string;
  Vendor: {
    id: string;
    name: string;
    slug: string;
    host: string;
    isActive: boolean;
  };
};

async function findOrCreateVerifiedSocialUser(email: string, displayName?: string | null) {
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName: displayName ?? undefined,
      fullName: displayName ?? undefined,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: now,
      emailOtpCodeHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttemptCount: 0,
      emailOtpLockedUntil: null,
      lastLoginAt: now,
    },
    create: {
      email,
      displayName: displayName ?? null,
      fullName: displayName ?? null,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: now,
      lastLoginAt: now,
    },
  });

  return user;
}

async function findOrCreatePendingSocialUser(email: string, displayName?: string | null) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { user: existing, created: false };
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName: displayName ?? null,
      fullName: displayName ?? null,
      status: "ACTIVE",
      emailVerificationStatus: "PENDING",
      emailVerifiedAt: null,
      lastLoginAt: null,
    },
  });

  return { user, created: true };
}

async function getActiveVendorMemberships(userId: string) {
  return prisma.vendorMembership.findMany({
    where: {
      userId,
      isActive: true,
      Vendor: {
        isActive: true,
      },
    },
    select: {
      role: true,
      Vendor: {
        select: {
          id: true,
          name: true,
          slug: true,
          host: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  }) as Promise<VendorMembershipSummary[]>;
}

async function getActiveVendorMembershipForHost(userId: string, vendorHost: string) {
  const host = String(vendorHost ?? "").trim().toLowerCase();
  if (!host) return null;
  return prisma.vendorMembership.findFirst({
    where: {
      userId,
      isActive: true,
      Vendor: {
        host,
        isActive: true,
      },
    },
    select: {
      role: true,
      Vendor: {
        select: {
          id: true,
          name: true,
          slug: true,
          host: true,
          isActive: true,
        },
      },
    },
  });
}

async function ensureVendorMembershipForHost(userId: string, vendorHost: string) {
  const host = String(vendorHost ?? "").trim().toLowerCase();
  if (!host) return null;
  const vendor = await prisma.vendor.findUnique({
    where: { host },
    select: { id: true, name: true, slug: true, host: true, isActive: true },
  });
  if (!vendor || !vendor.isActive) return null;

  const membership = await prisma.vendorMembership.upsert({
    where: { vendorId_userId: { vendorId: vendor.id, userId } },
    update: { isActive: true },
    create: {
      vendorId: vendor.id,
      userId,
      role: "OWNER",
      isActive: true,
    },
    select: {
      role: true,
      isActive: true,
      Vendor: {
        select: { id: true, name: true, slug: true, host: true, isActive: true },
      },
    },
  });
  return membership;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmailFormatValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isBlockedEmailDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

function hashOtp(email: string, code: string) {
  const secret = process.env.JWT_SECRET ?? "change-me";
  return crypto.createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");
}

async function issueAndSendEmailOtp(user: { id: string; email: string; displayName: string | null }) {
  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
  const otpHash = hashOtp(user.email, code);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailOtpCodeHash: otpHash,
      emailOtpExpiresAt: expiresAt,
      emailOtpAttemptCount: 0,
      emailOtpLastSentAt: now,
      emailOtpLockedUntil: null,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Verify your account OTP",
    text: `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });
}

async function ensureCustomerEntitlements(input: { userId: string; email: string; displayName: string | null; vendorHost?: string | null }) {
  const role = await prisma.role.upsert({
    where: { code: "customer" },
    update: {},
    create: { code: "customer", label: "Customer" },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: input.userId, roleId: role.id } },
    update: {},
    create: { userId: input.userId, roleId: role.id },
  });

  const host = String(input.vendorHost ?? "").trim().toLowerCase();
  if (!host) return;

  const tenant = await prisma.vendor.findUnique({ where: { host } });
  if (!tenant) return;

  await prisma.walletAccount.upsert({
    where: { vendorId_userId: { vendorId: tenant.id, userId: input.userId } },
    update: { ownerLabel: input.displayName ?? input.email },
    create: {
      vendorId: tenant.id,
      userId: input.userId,
      ownerLabel: input.displayName ?? input.email,
      balancePoints: 0,
    },
  });
}

async function recordReferralSignup(input: { vendorHost?: string | null; referralCode?: string | null; customerUserId: string }) {
  const host = String(input.vendorHost ?? "").trim().toLowerCase();
  const referralCode = String(input.referralCode ?? "").trim().toLowerCase();
  if (!host || !referralCode) return;

  const vendor = await prisma.vendor.findUnique({ where: { host } });
  if (!vendor || !vendor.referralCode) return;
  if (vendor.referralCode.toLowerCase() !== referralCode) return;

  await prisma.vendorReferralSignup.upsert({
    where: { vendorId_customerUserId: { vendorId: vendor.id, customerUserId: input.customerUserId } },
    update: { referralCode },
    create: {
      vendorId: vendor.id,
      referralCode,
      customerUserId: input.customerUserId,
    },
  });
}

function configurePassportIfNeeded() {
  if (passportConfigured) return;
  passportConfigured = true;

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: process.env.GOOGLE_CALLBACK_URL ?? `${appBaseUrl}/v1/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email) return done(new Error("Google account missing email"));
            let intent = "customer_login";
            try {
              const rawState = String(req?.query?.state ?? "");
              const decoded = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as { intent?: string } | null;
              intent = String(decoded?.intent ?? intent).trim().toLowerCase();
            } catch {
              intent = "customer_login";
            }

            const pendingSocialUser = intent.startsWith("vendor_")
              ? await findOrCreatePendingSocialUser(email, profile.displayName)
              : null;
            const user = pendingSocialUser?.user ?? await findOrCreateVerifiedSocialUser(email, profile.displayName);
            if (pendingSocialUser) {
              (user as any).__created = pendingSocialUser.created;
            }
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKeyLocation = process.env.APPLE_PRIVATE_KEY_PATH;
  if (appleClientId && appleTeamId && appleKeyId && applePrivateKeyLocation) {
    passport.use(
      new AppleStrategy(
        {
          clientID: appleClientId,
          teamID: appleTeamId,
          keyID: appleKeyId,
          privateKeyLocation: applePrivateKeyLocation,
          callbackURL: process.env.APPLE_CALLBACK_URL ?? `${appBaseUrl}/v1/auth/apple/callback`,
          passReqToCallback: true,
        },
        async (_req, _accessToken, _refreshToken, idToken, profile, done) => {
          try {
            const decoded = jwt.decode(idToken) as { email?: string } | null;
            const email = String(decoded?.email ?? "").toLowerCase().trim();
            if (!email) return done(new Error("Apple account missing email"));
            const displayName = profile?.displayName ?? null;
            const user = await findOrCreateVerifiedSocialUser(email, displayName);
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }
}

configurePassportIfNeeded();

authRouter.post("/v1/auth/register", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  const profileInput = validateCustomerProfileInput(req.body, { required: false });
  const displayName = String(req.body?.displayName ?? profileInput.data.fullName ?? "").trim() || null;
  const referralCode = String(req.body?.referralCode ?? "").trim().toLowerCase() || null;
  const vendorId = req.vendorId;

  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  if (!isEmailFormatValid(email)) return res.status(400).json({ error: "invalid email format" });
  if (isBlockedEmailDomain(email)) return res.status(400).json({ error: "please use a real email address" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (profileInput.errors.length) return res.status(400).json({ error: "invalid customer profile", issues: profileInput.errors });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const vendorMemberships = await getActiveVendorMemberships(existing.id);
    if (vendorMemberships.length > 0) {
      return res.status(403).json({
        error: "this email is registered as a vendor account. please use vendor login.",
      });
    }
    return res.status(409).json({ error: "email already registered. please login instead." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      fullName: profileInput.data.fullName,
      dateOfBirth: profileInput.data.dateOfBirth,
      age: profileInput.data.age,
      country: profileInput.data.countryCode,
      status: "ACTIVE",
      emailVerificationStatus: "PENDING",
      emailVerifiedAt: null,
      lastLoginAt: null,
    },
  });

  await ensureCustomerEntitlements({
    userId: user.id,
    email,
    displayName,
    vendorHost: req.vendorHost,
  });
  await recordReferralSignup({
    vendorHost: req.vendorHost,
    referralCode,
    customerUserId: user.id,
  });

  try {
    await issueAndSendEmailOtp(user);
  } catch (error) {
    console.error("[auth] failed to send OTP email", { email: user.email, error });
    return res.status(502).json({ error: "failed to send verification email. please try resend OTP shortly." });
  }

  return res.status(201).json({
    requiresEmailVerification: true,
    user: serializeAuthUser(user),
  });
});

authRouter.post("/v1/auth/vendor/register", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "vendor context is required" });

  const vendorHost = String(req.vendorHost ?? "").trim().toLowerCase();
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");

  if (!vendorHost) return res.status(400).json({ error: "vendor host is required" });
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  if (!isEmailFormatValid(email)) return res.status(400).json({ error: "invalid email format" });
  if (isBlockedEmailDomain(email)) return res.status(400).json({ error: "please use a real email address" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "email already registered. please use vendor login." });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { host: vendorHost },
    select: { id: true, host: true, isActive: true },
  });
  if (!vendor || !vendor.isActive) {
    return res.status(404).json({ error: "vendor not found" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        status: "ACTIVE",
        emailVerificationStatus: "PENDING",
        emailVerifiedAt: null,
        lastLoginAt: null,
      },
    });

    await tx.vendorMembership.create({
      data: {
        vendorId: vendor.id,
        userId: createdUser.id,
        role: "OWNER",
        isActive: true,
      },
    });

    return createdUser;
  });

  try {
    await issueAndSendEmailOtp(user);
  } catch (error) {
    console.error("[auth] failed to send vendor registration OTP", { email: user.email, error });
    try {
      await prisma.vendorMembership.deleteMany({ where: { vendorId: vendor.id, userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    } catch (cleanupError) {
      console.error("[auth] failed to roll back vendor registration after OTP failure", {
        email: user.email,
        cleanupError,
      });
    }
    return res.status(502).json({ error: "failed to send verification email. please try again shortly." });
  }

  return res.status(201).json({
    requiresEmailVerification: true,
    user: serializeAuthUser(user),
    nextUrl: buildVendorPathRedirectUrl(vendorHost, "/verify-email", {
      email: user.email,
      vendorHost,
      returnTo: "/vendor/profile",
    }),
  });
});

authRouter.post("/v1/auth/login", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  if (!user.passwordHash) return res.status(409).json({ error: "this email uses social login. please continue with google." });
  if (user.emailVerificationStatus !== "VERIFIED" || !user.emailVerifiedAt) {
    return res.status(403).json({ error: "email not verified. please verify with OTP first." });
  }
  const vendorMemberships = await getActiveVendorMemberships(user.id);
  if (vendorMemberships.length > 0) {
    const vendorHost = vendorMemberships[0]?.Vendor?.host ?? "";
    return res.status(403).json({
      error: "this is a vendor account. please use vendor login.",
      vendorHost,
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const loggedInUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), status: "ACTIVE" },
  });

  const token = issueAccessToken(loggedInUser);
  setAccessCookie(res, token);
  return res.json({
    token,
    user: serializeAuthUser(loggedInUser),
  });
});

authRouter.post("/v1/auth/vendor/login", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "vendor context is required" });

  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid vendor credentials" });
  if (!user.passwordHash) return res.status(409).json({ error: "this vendor account uses social login. contact support for vendor access." });
  if (user.emailVerificationStatus !== "VERIFIED" || !user.emailVerifiedAt) {
    return res.status(403).json({ error: "email not verified. please verify with OTP first." });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid vendor credentials" });

  const membership = await prisma.vendorMembership.findFirst({
    where: { vendorId: req.vendorId, userId: user.id, isActive: true },
    select: {
      role: true,
      Vendor: {
        select: { id: true, name: true, slug: true, host: true, isActive: true },
      },
    },
  });

  if (!membership || !membership.Vendor?.isActive) {
    return res.status(403).json({ error: "this account is not approved for this vendor" });
  }

  const loggedInUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), status: "ACTIVE" },
  });

  const token = issueAccessToken(loggedInUser);
  setAccessCookie(res, token);
  return res.json({
    token,
    user: serializeAuthUser(loggedInUser),
    membership: {
      role: membership.role,
      vendor: membership.Vendor,
    },
  });
});

authRouter.post("/v1/auth/verify-email-otp", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const otp = String(req.body?.otp ?? "").trim();
  if (!email || !otp) return res.status(400).json({ error: "email and otp are required" });
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: "otp must be 6 digits" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (user.emailVerificationStatus === "VERIFIED" && user.emailVerifiedAt) {
    const token = issueAccessToken(user);
    setAccessCookie(res, token);
    return res.json({
      token,
      user: serializeAuthUser(user),
    });
  }

  const now = new Date();
  if (user.emailOtpLockedUntil && now < user.emailOtpLockedUntil) {
    return res.status(429).json({ error: "too many failed attempts. try again later." });
  }
  if (!user.emailOtpCodeHash || !user.emailOtpExpiresAt || now > user.emailOtpExpiresAt) {
    return res.status(400).json({ error: "otp expired. please request a new OTP." });
  }

  const expected = hashOtp(email, otp);
  if (expected !== user.emailOtpCodeHash) {
    const nextAttempts = user.emailOtpAttemptCount + 1;
    const lockedUntil = nextAttempts >= OTP_MAX_ATTEMPTS ? new Date(now.getTime() + OTP_LOCK_MINUTES * 60 * 1000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtpAttemptCount: nextAttempts,
        emailOtpLockedUntil: lockedUntil,
      },
    });
    return res.status(400).json({ error: "invalid otp" });
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: now,
      emailOtpCodeHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttemptCount: 0,
      emailOtpLockedUntil: null,
      lastLoginAt: now,
    },
  });

  const token = issueAccessToken(verifiedUser);
  setAccessCookie(res, token);
  return res.json({
    token,
    user: serializeAuthUser(verifiedUser),
  });
});

authRouter.post("/v1/auth/resend-email-otp", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "email is required" });
  if (!isEmailFormatValid(email)) return res.status(400).json({ error: "invalid email format" });
  if (isBlockedEmailDomain(email)) return res.status(400).json({ error: "please use a real email address" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (user.emailVerificationStatus === "VERIFIED") return res.status(200).json({ message: "email already verified" });

  const now = new Date();
  if (user.emailOtpLastSentAt) {
    const secondsSinceLast = Math.floor((now.getTime() - user.emailOtpLastSentAt.getTime()) / 1000);
    if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({ error: "please wait before requesting another OTP" });
    }
  }

  try {
    await issueAndSendEmailOtp(user);
  } catch (error) {
    console.error("[auth] failed to resend OTP email", { email: user.email, error });
    return res.status(502).json({ error: "failed to send verification email. please try again later." });
  }
  return res.json({ message: "otp sent" });
});

authRouter.post("/v1/auth/logout", async (_req: VendorRequest, res) => {
  clearAccessCookie(res);
  return res.json({ ok: true });
});

authRouter.get("/v1/auth/me", async (req: VendorRequest, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  return res.json({ user: serializeAuthUser(user) });
});

authRouter.get("/v1/auth/profile", async (req: VendorRequest, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  return res.json({ user: serializeAuthUser(user) });
});

authRouter.patch("/v1/auth/profile", async (req: VendorRequest, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const profileInput = validateCustomerProfileInput(req.body);
  if (profileInput.errors.length) return res.status(400).json({ error: "invalid customer profile", issues: profileInput.errors });
  const displayName = String(req.body?.displayName ?? profileInput.data.fullName).trim() || profileInput.data.fullName;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: profileInput.data.fullName,
      displayName,
      dateOfBirth: profileInput.data.dateOfBirth,
      age: profileInput.data.age,
      country: profileInput.data.countryCode,
    },
  });

  return res.json({ user: serializeAuthUser(user) });
});

authRouter.get("/v1/auth/vendor-home", async (req: VendorRequest, res) => {
  const userId = getRequestUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const memberships = await prisma.vendorMembership.findMany({
    where: { userId, isActive: true },
    select: {
      role: true,
      createdAt: true,
      Vendor: {
        select: { id: true, host: true, slug: true, isActive: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeMemberships = memberships.filter((m) => m.Vendor?.isActive);
  if (!activeMemberships.length) {
    return res.json({ vendorHost: null });
  }

  const rolePriority: Record<string, number> = {
    OWNER: 0,
    MANAGER: 1,
    STAFF: 2,
  };

  activeMemberships.sort((a, b) => {
    const aRank = rolePriority[a.role] ?? 99;
    const bRank = rolePriority[b.role] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const picked = activeMemberships[0];
  return res.json({
    vendorHost: picked.Vendor.host,
    vendorSlug: picked.Vendor.slug,
    role: picked.role,
  });
});

authRouter.get("/v1/auth/google/start", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }
  const vendorHost = String(req.query.vendorHost ?? resolveRequestHost(req)).trim().toLowerCase();
  const referralCode = String(req.query.referralCode ?? "").trim().toLowerCase() || null;
  const intent = String(req.query.intent ?? "customer_login").trim().toLowerCase();
  const safeIntent = new Set(["customer_login", "customer_register", "vendor_login", "vendor_register"]).has(intent) ? intent : "customer_login";
  const state = Buffer.from(JSON.stringify({ vendorHost, referralCode, intent: safeIntent })).toString("base64url");
  return passport.authenticate("google", { scope: ["profile", "email"], session: false, state })(req, res, next);
});

authRouter.get("/v1/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err: unknown, user: any) => {
    if (err || !user) {
      return res.redirect(`${webBaseUrl}/login?error=google_auth_failed`);
    }
    const rawState = String(req.query.state ?? "");
    let vendorHost = resolveRequestHost(req);
    let referralCode: string | null = null;
    let intent = "customer_login";
    try {
      const decoded = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as { vendorHost?: string; referralCode?: string; intent?: string };
      vendorHost = String(decoded.vendorHost ?? vendorHost);
      referralCode = decoded.referralCode ? String(decoded.referralCode).toLowerCase() : null;
      intent = String(decoded.intent ?? intent).trim().toLowerCase();
    } catch {
      vendorHost = resolveRequestHost(req);
      referralCode = null;
      intent = "customer_login";
    }

    if (intent.startsWith("vendor_")) {
      const vendorMembership = await getActiveVendorMembershipForHost(String(user.id), vendorHost);
      if (intent === "vendor_register") {
        const createdMembership = await ensureVendorMembershipForHost(String(user.id), vendorHost);
        if (!createdMembership) {
          return res.redirect(buildVendorPathRedirectUrl(vendorHost, "/vendor/register", { error: "vendor_approval_required" }));
        }

        if (user.emailVerificationStatus !== "VERIFIED" || !user.emailVerifiedAt) {
          try {
            await issueAndSendEmailOtp(user);
          } catch (error) {
            console.error("[auth] failed to send vendor onboarding OTP", { email: user.email, error });
            if (user.__created) {
              try {
                await prisma.vendorMembership.deleteMany({ where: { vendorId: createdMembership.Vendor.id, userId: user.id } });
                await prisma.user.delete({ where: { id: user.id } });
              } catch (cleanupError) {
                console.error("[auth] failed to roll back vendor onboarding after OTP failure", {
                  email: user.email,
                  cleanupError,
                });
              }
            }
            return res.redirect(buildVendorPathRedirectUrl(vendorHost, "/vendor/register", { error: "otp_send_failed" }));
          }
          return res.redirect(
            buildVendorPathRedirectUrl(vendorHost, "/verify-email", {
              email: user.email,
              vendorHost,
              returnTo: "/vendor/profile",
            })
          );
        }

        const loggedInUser = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), status: "ACTIVE" },
        });
        const token = issueAccessToken(loggedInUser);
        setAccessCookie(res, token);
        return res.redirect(buildVendorPathRedirectUrl(vendorHost, "/vendor/profile", { from: "register" }));
      }

      if (!vendorMembership) {
        const errorUrl = buildVendorPathRedirectUrl(vendorHost, "/vendor/login", { error: "vendor_approval_required" });
        return res.redirect(errorUrl);
      }

      if (user.emailVerificationStatus !== "VERIFIED" || !user.emailVerifiedAt) {
        try {
          await issueAndSendEmailOtp(user);
        } catch (error) {
          console.error("[auth] failed to send vendor login OTP", { email: user.email, error });
          return res.redirect(buildVendorPathRedirectUrl(vendorHost, "/vendor/login", { error: "otp_send_failed" }));
        }
        return res.redirect(
          buildVendorPathRedirectUrl(vendorHost, "/verify-email", {
            email: user.email,
            vendorHost,
            returnTo: "/vendor",
          })
        );
      }

      const loggedInUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), status: "ACTIVE" },
      });
      const token = issueAccessToken(loggedInUser);
      setAccessCookie(res, token);
      return res.redirect(buildVendorPathRedirectUrl(vendorHost, "/vendor"));
    }

    const activeVendorMemberships = await getActiveVendorMemberships(String(user.id));
    if (activeVendorMemberships.length > 0) {
      const vendorLoginUrl = buildVendorPathRedirectUrl(activeVendorMemberships[0].Vendor.host, "/vendor/login", {
        error: "vendor_account",
      });
      return res.redirect(vendorLoginUrl);
    }

    await ensureCustomerEntitlements({
      userId: String(user.id),
      email: String(user.email),
      displayName: user.displayName ? String(user.displayName) : null,
      vendorHost,
    });
    await recordReferralSignup({
      vendorHost,
      referralCode,
      customerUserId: String(user.id),
    });
    const token = issueAccessToken(user);
    setAccessCookie(res, token);
    try {
      return res.redirect(buildAuthCompleteRedirectUrl(vendorHost, "google"));
    } catch {
      return res.redirect(`${webBaseUrl}/login?error=google_auth_failed`);
    }
  })(req, res, next);
});

authRouter.get("/v1/auth/apple/start", (req, res, next) => {
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY_PATH) {
    return res.status(503).json({ error: "Apple OAuth not configured" });
  }
  return passport.authenticate("apple", { session: false, scope: ["name", "email"] })(req, res, next);
});

authRouter.post("/v1/auth/apple/callback", (req, res, next) => {
  passport.authenticate("apple", { session: false }, (err: unknown, user: any) => {
    if (err || !user) {
      return res.redirect(`${webBaseUrl}/login?error=apple_auth_failed`);
    }
    const token = issueAccessToken(user);
    setAccessCookie(res, token);
    return res.redirect(buildAuthCompleteRedirectUrl(resolveRequestHost(req), "apple"));
  })(req, res, next);
});

export { authRouter };









