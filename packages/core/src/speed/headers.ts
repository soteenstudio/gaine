import { normalizeBase } from "./speculation.js";
import { hintsToLinkHeader, type ResourceHint } from "./hints.js";

export interface HeaderRule {
  path: string;
  headers: Record<string, string>;
}

export interface SpeedHeaderOptions {
  base?: string;
  immutable?: readonly string[];
  security?: boolean;
  preload?: readonly ResourceHint[];
}

export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export function speedHeaders(options: SpeedHeaderOptions = {}): HeaderRule[] {
  const base = normalizeBase(options.base);
  const rules: HeaderRule[] = [];
  const all: Record<string, string> = {};
  if (options.security !== false) {
    all["X-Content-Type-Options"] = "nosniff";
    all["Referrer-Policy"] = "strict-origin-when-cross-origin";
  }
  if (options.preload?.length) all.Link = hintsToLinkHeader(options.preload);
  if (Object.keys(all).length) rules.push({ path: `${base}/*`, headers: all });
  for (const dir of options.immutable ?? []) {
    const clean = dir.replace(/^\/+|\/+$/g, "");
    rules.push({ path: `${base}/${clean}/*`, headers: { "Cache-Control": IMMUTABLE_CACHE } });
  }
  return rules;
}

export function toHeadersFile(rules: readonly HeaderRule[]): string {
  return (
    rules
      .map((r) => `${r.path}\n${Object.entries(r.headers).map(([k, v]) => `  ${k}: ${v}`).join("\n")}`)
      .join("\n\n") + "\n"
  );
}

export interface NextHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export function toNextHeaders(rules: readonly HeaderRule[]): NextHeaderRule[] {
  return rules.map((r) => ({
    source: r.path.replace(/\/\*$/, "/:path*"),
    headers: Object.entries(r.headers).map(([key, value]) => ({ key, value })),
  }));
}
