// Vendors Chart.js as a static file rather than pulling it from a CDN at
// runtime — this dashboard is meant to run on a Pi that may not have
// reliable internet (planmode.md §6b), and everything else in this stack is
// self-hosted.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "chart.js", "dist", "chart.umd.js");
const destDir = join(root, "public", "vendor");
const dest = join(destDir, "chart.umd.js");

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log(`copied ${src} -> ${dest}`);
