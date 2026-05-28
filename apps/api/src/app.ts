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

  app.use(helmet());
  app.use(cors());
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





