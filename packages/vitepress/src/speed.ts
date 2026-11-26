import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HeadConfig, SiteConfig, UserConfig } from "vitepress";
import {
  gaineRuntimeScript,
  hintAttrs,
  optimizeHtml,
  speculationRulesJson,
  speedHeaders,
  toHeadersFile,
  type OptimizeHtmlOptions,
  type ResourceHint,
  type RuntimeOptions,
  type SpeculationOptions,
} from "@gaine/core/speed";

export interface GaineVitepressSpeedOptions {
  mode?: "spa" | "mpa";
  locales?: readonly string[];
  runtime?: RuntimeOptions;
  speculation?: boolean | SpeculationOptions;
  hints?: readonly ResourceHint[];
  optimizeHtml?: boolean | OptimizeHtmlOptions;
  metaChunk?: boolean;
  modernTarget?: boolean;
  headersFile?: boolean;
  immutable?: readonly string[];
  security?: boolean;
}

const MODERN_TARGET = ["es2022", "chrome100", "firefox100", "safari15.4"];

export function withGaineSpeed<C extends UserConfig<any>>(config: C, options: GaineVitepressSpeedOptions = {}): C {
  const mpa = options.mode === "mpa";
  const base = config.base ?? "/";
  const locales =
    options.locales ?? Object.keys(config.locales ?? {}).filter((key) => key !== "root");

  const runtime = gaineRuntimeScript({
    menu: true,
    locales,
    base,
    prefetch: mpa ? { fallbackOnly: true } : false,
    ...options.runtime,
  });
  const head: HeadConfig[] = [...(config.head ?? [])];
  for (const hint of options.hints ?? []) head.push(["link", hintAttrs(hint)]);
  const speculation = options.speculation ?? mpa;
  if (speculation) {
    const json = speculationRulesJson({ base, ...(speculation === true ? {} : speculation) });
    head.push(["script", { type: "speculationrules" }, json]);
  }
  if (runtime) head.push(["script", {}, runtime]);

  const html = options.optimizeHtml ?? true;
  const htmlOptions: OptimizeHtmlOptions = typeof html === "object" ? html : {};
  const immutable = options.immutable ?? [config.vite?.build?.assetsDir ?? "assets"];

  const transformHtml: NonNullable<UserConfig["transformHtml"]> = async (code, id, ctx) => {
    const user = await config.transformHtml?.(code, id, ctx);
    const current = typeof user === "string" ? user : code;
    return html === false ? current : optimizeHtml(current, htmlOptions);
  };

  const buildEnd = async (siteConfig: SiteConfig) => {
    await config.buildEnd?.(siteConfig);
    if (options.headersFile === false) return;
    const rules = speedHeaders({ base, immutable, security: options.security ?? false });
    if (!rules.length) return;
    const file = join(siteConfig.outDir, "_headers");
    await mkdir(siteConfig.outDir, { recursive: true });
    const existing = await readFile(file, "utf8").catch(() => "");
    await writeFile(file, (existing ? existing.trimEnd() + "\n\n" : "") + toHeadersFile(rules));
  };

  const next = { ...config, head, transformHtml, buildEnd } as unknown as Record<string, unknown>;
  if (mpa && config.mpa === undefined) next.mpa = true;
  if (!mpa && options.metaChunk !== false && config.metaChunk === undefined) next.metaChunk = true;
  if (options.modernTarget !== false && !config.vite?.build?.target) {
    next.vite = { ...config.vite, build: { ...config.vite?.build, target: MODERN_TARGET } };
  }
  return next as C;
}
