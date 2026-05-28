import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (error) => {
  // Redis can be optional in local MVP mode; keep API alive when unavailable.
  console.warn("[redis] connection error", error?.message ?? error);
});





