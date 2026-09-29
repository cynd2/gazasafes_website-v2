import { existsSync } from "node:fs";
import { open, type Reader, type CityResponse } from "maxmind";
import { config } from "./config.js";

let reader: Reader<CityResponse> | null = null;
let attempted = false;

// Local .mmdb lookup only (planmode.md §5) — never a network call from the
// hot path. Missing/unreadable file degrades to no geo data rather than
// crashing the worker, so dev environments work without a MaxMind account.
export async function loadGeoIp(): Promise<void> {
  attempted = true;
  if (!config.geoipDbPath) {
    console.warn("[geoip] GEOIP_DB_PATH not set, geo enrichment disabled");
    return;
  }
  if (!existsSync(config.geoipDbPath)) {
    console.warn(`[geoip] ${config.geoipDbPath} not found, geo enrichment disabled`);
    return;
  }
  reader = await open<CityResponse>(config.geoipDbPath);
  console.log(`[geoip] loaded ${config.geoipDbPath}`);
}

export function lookupGeo(ip: string): { country: string | null; city: string | null } {
  if (!attempted) throw new Error("loadGeoIp() must be called before lookupGeo()");
  if (!reader) return { country: null, city: null };
  try {
    const result = reader.get(ip);
    return {
      country: result?.country?.iso_code ?? null,
      city: result?.city?.names?.en ?? null,
    };
  } catch {
    return { country: null, city: null };
  }
}
