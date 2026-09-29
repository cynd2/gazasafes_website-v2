import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // long-lived consumer, let ioredis keep retrying rather than throwing
});
