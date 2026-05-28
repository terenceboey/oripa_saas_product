import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import { vendorResolver } from "./middleware/vendor";
import { healthRouter } from "./modules/health/router";
import { vendorRouter } from "./modules/vendors/router";
import { packRouter } from "./modules/packs/router";
import { drawRouter } from "./modules/draws/router";
import { walletRouter } from "./modules/wallet/router";
import { bannerRouter } from "./modules/banners/router";
import { authRouter } from "./modules/auth/router";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  const webUrl = String(process.env.WEB_URL ?? "").trim();
  const vendorBaseDomain = String(process.env.VENDOR_BASE_DOMAIN ?? "").trim().toLowerCase();

  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (webUrl && origin === webUrl) return callback(null, true);
      try {
        const parsed = new URL(origin);
        const host = parsed.host.toLowerCase();
        if (host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) {
          return callback(null, true);
        }
        if (vendorBaseDomain && (host === vendorBaseDomain || host.endsWith(`.${vendorBaseDomain}`))) {
          return callback(null, true);
        }
      } catch {
        // ignore parse error
      }
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "64kb" }));
  app.use(morgan("dev"));
  app.use(passport.initialize() as any);
  app.use(vendorResolver as any);

  app.use(healthRouter);
  app.use(vendorRouter);
  app.use(packRouter);
  app.use(drawRouter);
  app.use(walletRouter);
  app.use(bannerRouter);
  app.use(authRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}





