import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import { vendorResolver } from "./middleware/vendor";
import { healthRouter } from "./modules/health/router";
import { vendorRouter } from "./modules/vendors/router";
import { packRouter } from "./modules/packs/router";
import { packTemplateRouter } from "./modules/packs/templates-router";
import { drawRouter } from "./modules/draws/router";
import { walletRouter } from "./modules/wallet/router";
import { bannerRouter } from "./modules/banners/router";
import { authRouter } from "./modules/auth/router";
import { catalogRouter } from "./modules/catalog/router";
import { creativeRouter } from "./modules/creative/router";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  const webUrl = String(process.env.WEB_URL ?? "").trim();

  function normalizeHost(raw: string) {
    const input = String(raw ?? "").trim().toLowerCase();
    if (!input) return "";
    try {
      return new URL(input).host.toLowerCase().replace(/^\.+/, "");
    } catch {
      return input.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^\.+/, "");
    }
  }

  const webHost = normalizeHost(webUrl);
  const vendorBaseDomain = normalizeHost(String(process.env.VENDOR_BASE_DOMAIN ?? ""));
  const hardcodedPrimaryDomain = "gachanow.xyz";
  const corsAllowedHeaders = "Content-Type, Authorization, X-Vendor-Host, X-Idempotency-Key, X-Request-Id, X-Client-Page";
  const corsAllowedMethods = "GET,POST,PATCH,PUT,DELETE,OPTIONS";

  function isAllowedOrigin(origin?: string) {
    const requestHost = normalizeHost(String(origin ?? ""));
    if (!requestHost) return false;
    if (webHost && requestHost === webHost) return true;
    if (requestHost.startsWith("localhost:") || requestHost.startsWith("127.0.0.1:")) return true;
    if (requestHost === hardcodedPrimaryDomain || requestHost.endsWith(`.${hardcodedPrimaryDomain}`)) return true;
    if (vendorBaseDomain && (requestHost === vendorBaseDomain || requestHost.endsWith(`.${vendorBaseDomain}`))) return true;
    return false;
  }

  app.use(helmet());
  // Explicit preflight responder for credentialed cross-subdomain requests on Render.
  app.use((req, res, next) => {
    const origin = String(req.headers.origin ?? "");
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", corsAllowedHeaders);
      res.setHeader("Access-Control-Allow-Methods", corsAllowedMethods);
    }
    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }
    return next();
  });
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: corsAllowedHeaders.split(",").map((x) => x.trim()),
    optionsSuccessStatus: 204,
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "64kb" }));
  morgan.token("clientPage", (req) => String(req.headers["x-client-page"] ?? "-"));
  app.use(morgan(":method :url :status :response-time ms - :res[content-length] page=:clientPage"));
  app.use(passport.initialize() as any);
  app.use(vendorResolver as any);

  app.use(healthRouter);
  app.use(vendorRouter);
  app.use(packRouter);
  app.use(packTemplateRouter);
  app.use(drawRouter);
  app.use(walletRouter);
  app.use(bannerRouter);
  app.use(authRouter);
  app.use(catalogRouter);
  app.use(creativeRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
