import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/apiKey.js";
import { parseDateRange } from "../lib/dateRange.js";
import { chQuery, toClickHouseDateTime } from "../db/clickhouse.js";

export async function clickEventsRoute(app: FastifyInstance) {
  app.get("/v1/reports/click-events", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = parseDateRange(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const { range } = parsed;

    const clickTarget = (request.query as Record<string, unknown>).click_target;
    const hasFilter = typeof clickTarget === "string" && clickTarget.length > 0;

    const rows = await chQuery<{ click_target: string; count: string }>(
      `SELECT click_target, count() AS count
       FROM events
       WHERE event_type = 'click' AND server_ts >= {start:DateTime} AND server_ts < {end:DateTime}
       ${hasFilter ? "AND click_target = {click_target:String}" : ""}
       GROUP BY click_target
       ORDER BY count DESC`,
      {
        start: toClickHouseDateTime(range.startDateTime),
        end: toClickHouseDateTime(range.endExclusiveDateTime),
        ...(hasFilter ? { click_target: clickTarget } : {}),
      },
    );

    return {
      start_date: range.startDate,
      end_date: range.endDate,
      data: rows.map((r) => ({ click_target: r.click_target, count: Number(r.count) })),
    };
  });
}
