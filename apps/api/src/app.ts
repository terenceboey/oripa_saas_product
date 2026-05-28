import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { tenantResolver } from "./middleware/tenant";
import { healthRouter } from "./modules/health/router";
import { tenantRouter } from "./modules/tenants/router";
import { packRouter } from "./modules/packs/router";
import { drawRouter } from "./modules/draws/router";
import { walletRouter } from "./modules/wallet/router";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));
  app.use(morgan("dev"));
  app.use(tenantResolver);

  app.use(healthRouter);
  app.use(tenantRouter);
  app.use(packRouter);
  app.use(drawRouter);
  app.use(walletRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
