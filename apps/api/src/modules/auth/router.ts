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

const authRouter = Router();
const webBaseUrl = process.env.WEB_URL ?? "http://localhost:3000";
const appBaseUrl = process.env.APP_URL ?? "http://localhost:4000";
const jwtSecret = process.env.JWT_SECRET ?? "change-me";

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

async function findOrCreateCustomerUser(email: string, displayName?: string | null) {
  const role = await prisma.role.upsert({
    where: { code: "customer" },
    update: {},
    create: { code: "customer", label: "Customer" },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName: displayName ?? undefined,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: new Date(),
      emailOtpCodeHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttemptCount: 0,
      emailOtpLockedUntil: null,
      lastLoginAt: new Date(),
    },
    create: {
      email,
      displayName: displayName ?? null,
      status: "ACTIVE",
      emailVerificationStatus: "VERIFIED",
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return user;
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
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email) return done(new Error("Google account missing email"));
            const user = await findOrCreateCustomerUser(email, profile.displayName);
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
            const user = await findOrCreateCustomerUser(email, displayName);
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }
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

configurePassportIfNeeded();

authRouter.post("/v1/auth/register", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  const displayName = String(req.body?.displayName ?? "").trim() || null;
  const referralCode = String(req.body?.referralCode ?? "").trim().toLowerCase() || null;
  const vendorId = req.vendorId;

  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  if (!isEmailFormatValid(email)) return res.status(400).json({ error: "invalid email format" });
  if (isBlockedEmailDomain(email)) return res.status(400).json({ error: "please use a real email address" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email already registered. please login instead." });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
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
    user: { id: user.id, email: user.email, displayName: user.displayName, emailVerificationStatus: user.emailVerificationStatus },
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

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), status: "ACTIVE" },
  });

  const token = issueAccessToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

authRouter.post("/v1/auth/verify-email-otp", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const otp = String(req.body?.otp ?? "").trim();
  if (!email || !otp) return res.status(400).json({ error: "email and otp are required" });
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: "otp must be 6 digits" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.passwordHash) return res.status(409).json({ error: "social login account does not require OTP verification here." });
  if (user.emailVerificationStatus === "VERIFIED" && user.emailVerifiedAt) {
    const token = issueAccessToken(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName, emailVerificationStatus: user.emailVerificationStatus },
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
  return res.json({
    token,
    user: { id: verifiedUser.id, email: verifiedUser.email, displayName: verifiedUser.displayName, emailVerificationStatus: verifiedUser.emailVerificationStatus },
  });
});

authRouter.post("/v1/auth/resend-email-otp", async (req: VendorRequest, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "email is required" });
  if (!isEmailFormatValid(email)) return res.status(400).json({ error: "invalid email format" });
  if (isBlockedEmailDomain(email)) return res.status(400).json({ error: "please use a real email address" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.passwordHash) return res.status(409).json({ error: "social login account does not require OTP verification here." });
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

authRouter.get("/v1/auth/me", async (req: VendorRequest, res) => {
  const userId = getBearerUserId(req.header("authorization") ?? undefined);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      emailVerificationStatus: user.emailVerificationStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

authRouter.get("/v1/auth/google/start", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }
  const vendorHost = String(req.query.vendorHost ?? req.header("x-vendor-host") ?? "demo.localhost");
  const referralCode = String(req.query.referralCode ?? "").trim().toLowerCase() || null;
  const state = Buffer.from(JSON.stringify({ vendorHost, referralCode })).toString("base64url");
  return passport.authenticate("google", { scope: ["profile", "email"], session: false, state })(req, res, next);
});

authRouter.get("/v1/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err: unknown, user: any) => {
    if (err || !user) {
      return res.redirect(`${webBaseUrl}/login?error=google_auth_failed`);
    }
    const rawState = String(req.query.state ?? "");
    let vendorHost = "demo.localhost";
    let referralCode: string | null = null;
    try {
      const decoded = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as { vendorHost?: string; referralCode?: string };
      vendorHost = String(decoded.vendorHost ?? vendorHost);
      referralCode = decoded.referralCode ? String(decoded.referralCode).toLowerCase() : null;
    } catch {
      vendorHost = "demo.localhost";
      referralCode = null;
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
    return res.redirect(`${webBaseUrl}/login?token=${encodeURIComponent(token)}&vendorHost=${encodeURIComponent(vendorHost)}`);
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
    return res.redirect(`${webBaseUrl}/login?token=${encodeURIComponent(token)}`);
  })(req, res, next);
});

export { authRouter };









