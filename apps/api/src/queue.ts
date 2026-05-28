import { Queue } from "bullmq";
import { env } from "./config/env";

const queueDisabled = String(process.env.DISABLE_DRAW_QUEUE || "false").toLowerCase() === "true";

export const drawQueue = queueDisabled
  ? null
  : new Queue("draw-jobs", {
    connection: { url: env.redisUrl },
  });





