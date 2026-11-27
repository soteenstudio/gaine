import { mannWhitneyP, summarize } from "./stats.mjs";

/**
 * kind: "lab"   -> per-run samples, noisy: needs Mann-Whitney p<0.05
 *       "exact" -> deterministic (bytes, counts): any change over thresholds counts
 * better: "lower" | "higher"
 * minAbs: smallest absolute change worth reporting
 * key: true -> counts for the CI gate / headline
 */
export const METRICS = [
  { id: "ttfb", group: "Load (browser)", label: "TTFB", unit: "ms", better: "lower", kind: "lab", minAbs: 5 },
  { id: "fcp", group: "Load (browser)", label: "First Contentful Paint", unit: "ms", better: "lower", kind: "lab", minAbs: 20, key: true },
  { id: "lcp", group: "Load (browser)", label: "Largest Contentful Paint", unit: "ms", better: "lower", kind: "lab", minAbs: 20, key: true },
  { id: "tbt", group: "Load (browser)", label: "Total Blocking Time", unit: "ms", better: "lower", kind: "lab", minAbs: 20, key: true },
  { id: "cls", group: "Load (browser)", label: "Cumulative Layout Shift", unit: "", better: "lower", kind: "lab", minAbs: 0.01 },
  { id: "dcl", group: "Load (browser)", label: "DOMContentLoaded", unit: "ms", better: "lower", kind: "lab", minAbs: 20 },
  { id: "load", group: "Load (browser)", label: "Load event", unit: "ms", better: "lower", kind: "lab", minAbs: 20 },
  { id: "requests", group: "Payload (per page)", label: "Requests", unit: "", better: "lower", kind: "exact", minAbs: 1 },
  { id: "htmlBytes", group: "Payload (per page)", label: "HTML (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 256 },
  { id: "jsBytes", group: "Payload (per page)", label: "JavaScript (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 512, key: true },
  { id: "cssBytes", group: "Payload (per page)", label: "CSS (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 256 },
  { id: "fontBytes", group: "Payload (per page)", label: "Fonts (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 256 },
  { id: "imgBytes", group: "Payload (per page)", label: "Images (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 256 },
  { id: "totalBytes", group: "Payload (per page)", label: "Total (transfer)", unit: "B", better: "lower", kind: "exact", minAbs: 512, key: true },
  { id: "rps", group: "Server (next start)", label: "Throughput", unit: "req/s", better: "higher", kind: "lab", minAbs: 5 },
  { id: "p50", group: "Server (next start)", label: "Latency p50", unit: "ms", better: "lower", kind: "lab", minAbs: 0.5 },
  { id: "p95", group: "Server (next start)", label: "Latency p95", unit: "ms", better: "lower", kind: "lab", minAbs: 1 },
  { id: "rssMb", group: "Server (next start)", label: "Memory (RSS after load)", unit: "MB", better: "lower", kind: "exact", minAbs: 5 },
  { id: "buildSec", group: "Build", label: "next build time", unit: "s", better: "lower", kind: "lab", minAbs: 1 },
  { id: "nextDirMb", group: "Build", label: ".next size (no cache)", unit: "MB", better: "lower", kind: "exact", minAbs: 0.1 },
  { id: "staticJsGz", group: "Build", label: "Static JS (gzip, all chunks)", unit: "B", better: "lower", kind: "exact", minAbs: 512 },
  { id: "staticCssGz", group: "Build", label: "Static CSS (gzip)", unit: "B", better: "lower", kind: "exact", minAbs: 256 },
  { id: "chunks", group: "Build", label: "JS chunks", unit: "", better: "lower", kind: "exact", minAbs: 1 },
];

const MIN_REL = 3; // percent

export function compareMetric(def, baseSamples, gaineSamples) {
  const b = (baseSamples ?? []).filter(Number.isFinite);
  const g = (gaineSamples ?? []).filter(Number.isFinite);
  if (!b.length || !g.length) return null;
  const bs = summarize(b);
  const gs = summarize(g);
  const delta = gs.median - bs.median;
  const pct = bs.median === 0 ? (delta === 0 ? 0 : Infinity) : (delta / bs.median) * 100;
  const p = def.kind === "lab" ? mannWhitneyP(b, g) : null;
  const material = Math.abs(delta) >= def.minAbs && (bs.median === 0 || Math.abs(pct) >= MIN_REL);
  const significant = material && (def.kind === "exact" || (p !== null && p < 0.05));
  let winner = "tie";
  if (significant) {
    const gaineLower = delta < 0;
    winner = (def.better === "lower") === gaineLower ? "gaine" : "baseline";
  }
  return { ...def, baseline: bs, gaine: gs, delta, pct, p, winner };
}

export function compareAll(baseline, gaine) {
  return METRICS.map((m) => compareMetric(m, baseline[m.id], gaine[m.id])).filter(Boolean);
}

export function verdict(rows) {
  const key = rows.filter((r) => r.key);
  const count = (w, list = rows) => list.filter((r) => r.winner === w).length;
  const gaineKey = count("gaine", key);
  const baseKey = count("baseline", key);
  let headline;
  if (gaineKey > baseKey) headline = "Gaine is faster on the key metrics";
  else if (baseKey > gaineKey) headline = "Plain Next.js is faster on the key metrics";
  else headline = "No clear winner on the key metrics";
  return {
    headline,
    gaineWins: count("gaine"),
    baselineWins: count("baseline"),
    ties: count("tie"),
    keyGaineWins: gaineKey,
    keyBaselineWins: baseKey,
    regressions: key.filter((r) => r.winner === "baseline").map((r) => r.id),
  };
}
