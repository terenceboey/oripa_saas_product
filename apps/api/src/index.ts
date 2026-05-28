import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.appPort, () => {
  console.log(`[api] listening on :${env.appPort}`);
});





