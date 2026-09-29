import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

// Site key is a public identifier tied to the domain, not a secret (planmode.md
// §3) — this hook scopes traffic to known frontends, it is not the abuse
// defense. Rate limiting + payload validation do that job.
//
// Accepts the key from the X-Site-Key header OR a `site_key` body field.
// The body fallback exists because navigator.sendBeacon — the actual
// transport the frontend uses — cannot set custom headers at all, so the
// header path is unreachable for real beacon traffic; this runs in
// preHandler, which is after body parsing, so request.body is populated.
export async function requireSiteKey(request: FastifyRequest, reply: FastifyReply) {
  const headerKey = request.headers["x-site-key"];
  const bodyKey = (request.body as { site_key?: unknown } | undefined)?.site_key;
  const key = typeof headerKey === "string" ? headerKey : typeof bodyKey === "string" ? bodyKey : null;
  if (!key || !config.siteKeys.has(key)) {
    reply.code(401).send({ error: "invalid or missing site key" });
  }
}
