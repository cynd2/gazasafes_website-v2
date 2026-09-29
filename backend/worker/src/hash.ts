import { createHmac } from "node:crypto";
import { config } from "./config.js";

// HMAC (not a bare hash) so IPv4's ~4 billion address space can't just be
// precomputed by anyone without the pepper (planmode.md §6 — IPs are
// personal data, resolve geo then hash/discard, never store raw).
export function hashIp(ip: string): string {
  return createHmac("sha256", config.ipHashPepper).update(ip).digest("hex");
}
