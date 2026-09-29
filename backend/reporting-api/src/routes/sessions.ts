import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/apiKey.js";
import { parseDateRange } from "../lib/dateRange.js";
import { pool } from "../db/postgres.js";
import { config } from "../config.js";

export async function sessionsRoute(app: FastifyInstance) {
  app.get("/v1/reports/sessions", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = parseDateRange(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const { range } = parsed;

    const q = request.query as Record<string, unknown>;
    const rawLimit = Number(q.limit ?? config.defaultSessionsLimit);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), config.maxSessionsLimit) : config.defaultSessionsLimit;
    const rawOffset = Number(q.offset ?? 0);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const [summaryResult, dataResult] = await Promise.all([
      pool.query<{ total_sessions: string; avg_duration_seconds: number | null }>(
        `SELECT count(*) AS total_sessions,
                avg(extract(epoch FROM (last_seen - first_seen))) AS avg_duration_seconds
         FROM sessions
         WHERE first_seen >= $1 AND first_seen < $2`,
        [range.startDateTime, range.endExclusiveDateTime],
      ),
      pool.query(
        `SELECT session_id, first_seen, last_seen, device_type, country
         FROM sessions
         WHERE first_seen >= $1 AND first_seen < $2
         ORDER BY first_seen DESC
         LIMIT $3 OFFSET $4`,
        [range.startDateTime, range.endExclusiveDateTime, limit, offset],
      ),
    ]);

    const summaryRow = summaryResult.rows[0];

    return {
      start_date: range.startDate,
      end_date: range.endDate,
      summary: {
        total_sessions: Number(summaryRow.total_sessions),
        avg_duration_seconds: summaryRow.avg_duration_seconds === null ? 0 : Math.round(summaryRow.avg_duration_seconds),
      },
      pagination: { limit, offset },
      data: dataResult.rows,
    };
  });
}
