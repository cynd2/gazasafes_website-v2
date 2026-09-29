import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { pageviewsRoute } from "./routes/pageviews.js";
import { topPagesRoute } from "./routes/topPages.js";
import { sessionsRoute } from "./routes/sessions.js";
import { clickEventsRoute } from "./routes/clickEvents.js";
import { trafficSourcesRoute } from "./routes/trafficSources.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin,
  methods: ["GET"],
  allowedHeaders: ["Authorization"],
});

app.get("/healthz", async () => ({ ok: true }));

await app.register(pageviewsRoute);
await app.register(topPagesRoute);
await app.register(sessionsRoute);
await app.register(clickEventsRoute);
await app.register(trafficSourcesRoute);

app
  .listen({ port: config.port, host: config.host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
