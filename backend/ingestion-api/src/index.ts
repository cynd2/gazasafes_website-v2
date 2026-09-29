import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { eventsRoutes } from "./routes/events.js";

const app = Fastify({
  logger: true,
  // The Pi sits behind a reverse proxy in production (planmode.md §6b) —
  // trust its X-Forwarded-For so rate limiting and ip_address see the real
  // client, not the proxy.
  trustProxy: process.env.TRUST_PROXY === "true",
  bodyLimit: 16 * 1024, // beacons are small; reject anything else outright
});

// navigator.sendBeacon sends a Blob with no explicit type as text/plain by
// default, so JSON bodies can arrive under that content-type too.
app.addContentTypeParser("text/plain", { parseAs: "string" }, (_req, body, done) => {
  try {
    done(null, JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

await app.register(rateLimit, {
  max: config.rateLimitMax,
  timeWindow: config.rateLimitWindowMs,
  // Ingestion must accept anonymous traffic by design (§3) — rate limiting
  // per IP is the primary abuse defense, not auth.
  keyGenerator: (request) => request.ip,
});

app.get("/healthz", async () => ({ ok: true }));

await app.register(eventsRoutes);

app
  .listen({ port: config.port, host: config.host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
