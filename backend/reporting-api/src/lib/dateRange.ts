import { z } from "zod";
import { config } from "../config.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export interface DateRange {
  startDate: string; // as given, YYYY-MM-DD
  endDate: string;
  startDateTime: Date; // start of startDate, UTC
  endExclusiveDateTime: Date; // start of the day AFTER endDate, UTC — use as an exclusive upper bound
}

export type DateRangeResult = { ok: true; range: DateRange } | { ok: false; error: string };

// Shared validation for every reporting endpoint (planmode.md §4): required
// start_date/end_date, end_date >= start_date, and a bounded max range so a
// report can never scan `events` unbounded.
export function parseDateRange(query: Record<string, unknown>): DateRangeResult {
  const startResult = dateSchema.safeParse(query.start_date);
  if (!startResult.success) return { ok: false, error: "start_date is required, format YYYY-MM-DD" };
  const endResult = dateSchema.safeParse(query.end_date);
  if (!endResult.success) return { ok: false, error: "end_date is required, format YYYY-MM-DD" };

  const startDateTime = new Date(`${startResult.data}T00:00:00Z`);
  const endDateTime = new Date(`${endResult.data}T00:00:00Z`);
  if (Number.isNaN(startDateTime.getTime())) return { ok: false, error: "start_date is not a valid date" };
  if (Number.isNaN(endDateTime.getTime())) return { ok: false, error: "end_date is not a valid date" };

  if (endDateTime < startDateTime) return { ok: false, error: "end_date must be >= start_date" };

  const rangeDays = (endDateTime.getTime() - startDateTime.getTime()) / 86_400_000 + 1;
  if (rangeDays > config.maxDateRangeDays) {
    return { ok: false, error: `date range exceeds the maximum of ${config.maxDateRangeDays} days` };
  }

  const endExclusiveDateTime = new Date(endDateTime.getTime() + 86_400_000);

  return {
    ok: true,
    range: { startDate: startResult.data, endDate: endResult.data, startDateTime, endExclusiveDateTime },
  };
}
