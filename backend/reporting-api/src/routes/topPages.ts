import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/apiKey.js";
import { parseDateRange } from "../lib/dateRange.js";
import { chQuery, toClickHouseDateTime } from "../db/clickhouse.js";
import { pool } from "../db/postgres.js";
import { config } from "../config.js";

export async function topPagesRoute(app: FastifyInstance) {
  app.get("/v1/reports/top-pages", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = parseDateRange(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const { range } = parsed;

    const rawLimit = Number((request.query as Record<string, unknown>).limit ?? config.defaultTopPagesLimit);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), config.maxTopPagesLimit) : config.defaultTopPagesLimit;

    // `events` (ClickHouse) and `pages` (Postgres) live in different
    // databases — no native cross-store join, so the aggregate comes from
    // ClickHouse and the url/title dimensions are merged in from Postgres
    // here, application-side. Fine at this scale (a handful of pages);
    // replicating pages into ClickHouse would be over-engineering for a
    // 7-branch marketing site.
    const chRows = await chQuery<{ page_id: string; pageviews: string }>(
      `SELECT page_id, count() AS pageviews
       FROM events
       WHERE event_type = 'pageview' AND server_ts >= {start:DateTime} AND server_ts < {end:DateTime}
       GROUP BY page_id
       ORDER BY pageviews DESC
       LIMIT {limit:UInt32}`,
      { start: toClickHouseDateTime(range.startDateTime), end: toClickHouseDateTime(range.endExclusiveDateTime), limit },
    );

    if (chRows.length === 0) {
      return { start_date: range.startDate, end_date: range.endDate, data: [] };
    }

    const pageIds = chRows.map((r) => r.page_id);
    const { rows: pageRows } = await pool.query<{ page_id: string; url: string; title: string | null }>(
      `SELECT page_id, url, title FROM pages WHERE page_id = ANY($1)`,
      [pageIds],
    );
    const pageById = new Map(pageRows.map((p) => [p.page_id, p]));

    return {
      start_date: range.startDate,
      end_date: range.endDate,
      data: chRows.map((r) => ({
        page_id: r.page_id,
        url: pageById.get(r.page_id)?.url ?? null,
        title: pageById.get(r.page_id)?.title ?? null,
        pageviews: Number(r.pageviews),
      })),
    };
  });
}
