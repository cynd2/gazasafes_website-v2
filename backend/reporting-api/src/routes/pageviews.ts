import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/apiKey.js";
import { parseDateRange } from "../lib/dateRange.js";
import { chQuery, toClickHouseDateTime } from "../db/clickhouse.js";

export async function pageviewsRoute(app: FastifyInstance) {
  app.get("/v1/reports/pageviews", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = parseDateRange(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const { range } = parsed;

    const rows = await chQuery<{ date: string; pageviews: string }>(
      `SELECT toDate(server_ts) AS date, count() AS pageviews
       FROM events
       WHERE event_type = 'pageview' AND server_ts >= {start:DateTime} AND server_ts < {end:DateTime}
       GROUP BY date
       ORDER BY date`,
      { start: toClickHouseDateTime(range.startDateTime), end: toClickHouseDateTime(range.endExclusiveDateTime) },
    );

    return {
      start_date: range.startDate,
      end_date: range.endDate,
      data: rows.map((r) => ({ date: r.date, pageviews: Number(r.pageviews) })),
    };
  });
}
