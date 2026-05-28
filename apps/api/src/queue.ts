import { Queue } from "bullmq";
import { env } from "./config/env";

export const drawQueue = new Queue("draw-jobs", {
  connection: { url: env.redisUrl },
});
