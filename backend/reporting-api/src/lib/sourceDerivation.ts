// planmode.md §4 traffic-sources derivation: utm_source if present, else the
// referrer's domain, else "direct". The utm_source half is written at
// ingest time by the worker (see planmode.md §5 implementation note); this
// fills in the previously-open referrer-domain fallback, at read time.
export function deriveSource(utmSource: string | null, referrer: string | null): string {
  if (utmSource) return utmSource;
  if (referrer) {
    try {
      return new URL(referrer).hostname.replace(/^www\./, "");
    } catch {
      // malformed referrer, fall through to "direct"
    }
  }
  return "direct";
}
