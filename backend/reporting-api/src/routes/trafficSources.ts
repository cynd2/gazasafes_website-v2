import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/apiKey.js";
import { parseDateRange } from "../lib/dateRange.js";
import { pool } from "../db/postgres.js";
import { deriveSource } from "../lib/sourceDerivation.js";

export async function trafficSourcesRoute(app: FastifyInstance) {
  app.get("/v1/reports/traffic-sources", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = parseDateRange(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const { range } = parsed;

    // Grouping by derived source (utm_source, else referrer domain, else
    // "direct") isn't expressible as a plain GROUP BY since the fallback
    // logic lives in JS (see lib/sourceDerivation.ts) — fine at this
    // traffic volume, revisit if sessions per range grows large enough for
    // this to matter.
    const { rows } = await pool.query<{ utm_source: string | null; referrer: string | null }>(
      `SELECT utm_source, referrer FROM sessions WHERE first_seen >= $1 AND first_seen < $2`,
      [range.startDateTime, range.endExclusiveDateTime],
    );

    const counts = new Map<string, number>();
    for (const row of rows) {
      const source = deriveSource(row.utm_source, row.referrer);
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }

    const data = [...counts.entries()]
      .map(([source, sessions]) => ({ source, sessions }))
      .sort((a, b) => b.sessions - a.sessions);

    return { start_date: range.startDate, end_date: range.endDate, data };
  });
}
