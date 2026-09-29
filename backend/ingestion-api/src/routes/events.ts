import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { publishEvent, publishEvents } from "../queue.js";
import { requireSiteKey } from "../plugins/siteKey.js";
import { batchSchema, eventSchema, type EnrichedEvent } from "../schema.js";

function enrich(
  event: ReturnType<typeof eventSchema.parse>,
  request: { ip: string; headers: Record<string, unknown> },
): EnrichedEvent {
  return {
    ...event,
    server_timestamp: new Date().toISOString(),
    ip_address: request.ip,
    user_agent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : "",
  };
}

export async function eventsRoutes(app: FastifyInstance) {
  app.post(
    "/v1/events",
    { preHandler: requireSiteKey },
    async (request, reply) => {
      const parsed = eventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid payload", details: parsed.error.flatten() });
      }

      try {
        await publishEvent(enrich(parsed.data, request));
      } catch (err) {
        request.log.error(err, "failed to publish event to queue");
        return reply.code(503).send({ error: "queue unavailable" });
      }

      return reply.code(202).send({ accepted: true });
    },
  );

  app.post(
    "/v1/events/batch",
    { preHandler: requireSiteKey },
    async (request, reply) => {
      const parsed = batchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid payload", details: parsed.error.flatten() });
      }
      if (parsed.data.events.length > config.maxBatchSize) {
        return reply.code(413).send({ error: `batch exceeds max size of ${config.maxBatchSize}` });
      }

      const enriched = parsed.data.events.map((event) => enrich(event, request));
      try {
        await publishEvents(enriched);
      } catch (err) {
        request.log.error(err, "failed to publish event batch to queue");
        return reply.code(503).send({ error: "queue unavailable" });
      }

      return reply.code(202).send({ accepted: enriched.length });
    },
  );
}
