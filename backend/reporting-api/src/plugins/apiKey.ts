import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Unlike the ingestion API's site key, this gates real analytics data, so it
// gets a timing-safe comparison rather than a plain === / Set.has (planmode.md §4).
export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token || !config.apiKeys.some((key) => safeEqual(token, key))) {
    reply.code(401).send({ error: "invalid or missing bearer token" });
  }
}
