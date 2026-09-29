// Lightweight bot/spam filtering (planmode.md §1). This is a coarse
// substring check on User-Agent, not a fingerprinting technique — full bot
// detection is out of scope for this build.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|facebookexternalhit|preview|monitor|pingdom|uptime|curl\/|wget\//i;

export function isBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}
