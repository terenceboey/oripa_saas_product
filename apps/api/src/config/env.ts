import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appPort: Number(process.env.APP_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  defaultTenantHost: process.env.DEFAULT_TENANT_HOST ?? "demo.localhost",
};
