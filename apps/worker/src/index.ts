import dotenv from "dotenv";
import { Worker } from "bullmq";

dotenv.config({ path: "../../.env" });

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = { url: redisUrl };

const worker = new Worker(
  "draw-jobs",
  async (job) => {
    if (job.name === "post-draw") {
      // Placeholder for async side effects: analytics, email, webhooks, fraud checks.
      console.log("[worker] processed post-draw", job.id);
      return { ok: true };
    }
    return { ok: true };
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error("[worker] job failed", job?.id, err);
});

worker.on("completed", (job) => {
  console.log("[worker] job completed", job.id);
});

console.log("[worker] listening for jobs");
