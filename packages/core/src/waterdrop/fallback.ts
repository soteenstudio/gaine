/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { optimizeHtml } from "../speed/html.js";
import {
  WATERDROP_VERSION,
  type WaterdropChange,
  type WaterdropDiagnostic,
  type WaterdropDuplicate,
  type WaterdropFile,
  type WaterdropMissing,
  type WaterdropOptions,
  type WaterdropPage,
  type WaterdropReport,
  type WaterdropResult,
  type WaterdropSummary,
} from "./types.js";

const JS = /\.(?:mjs|cjs|js)$/i;
const CSS = /\.css$/i;
const HTML = /\.html?$/i;
const IMAGE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
const FONT = /\.(?:woff2?|ttf|otf|eot)$/i;
const LICENSE_COMMENT = /\/\*![\s\S]*?\*\//g;
const HTML_COMMENT = /<!--(?!\[if|<!\[endif|!|#)[\s\S]*?-->/gi;
const INLINE_SCRIPT = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const INLINE_STYLE = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
const ATTR = /\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const SRCSET = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;
const JS_IMPORT = /(?:^|[^.\w$])(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gm;
const JS_DYNAMIC = /(?:^|[^.\w$])import\s*\(\s*["']([^"']+)["']\s*\)/gm;
const JS_REQUIRE = /(?:^|[^.\w$])require\s*\(\s*["']([^"']+)["']\s*\)/gm;
const JS_URL = /new\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/gm;

const kindOf = (path: string) =>
  HTML.test(path)
    ? "html"
    : JS.test(path)
      ? "javascript"
      : CSS.test(path)
        ? "css"
        : IMAGE.test(path)
          ? "image"
          : FONT.test(path)
            ? "font"
            : "other";

const asPosix = (path: string) => path.split(sep).join("/");
const hashOf = (buffer: Buffer) => createHash("sha1").update(buffer).digest("hex");
const gz = (buffer: Buffer | string) => gzipSync(buffer, { level: 9 }).length;

export function renderWaterdropReport(report: WaterdropReport): string {
  const lines = [
    `Waterdrop ${report.version} - ${report.mode === "analyze" ? "analyze (no files written)" : "build"}`,
    `root: ${report.root}`,
    `out:  ${report.outDir}`,
    `assets: ${report.summary.assets} (${report.summary.bytes} B raw, ~${report.summary.compressed} B compressed)`,
    `js: ${report.summary.js} B   css: ${report.summary.css} B   html: ${report.summary.html} B`,
  ];
  if (report.orphans.length) {
    lines.push(`orphans: ${report.orphans.length} (${report.summary.orphanBytes} B reclaimable)`);
  }
  if (report.duplicates.length) {
    lines.push(`duplicates: ${report.duplicates.length} group(s)`);
  }
  for (const page of report.pages.slice(0, 8)) {
    lines.push(`  ${page.page}  html ${page.html}  js ${page.js}  css ${page.css}`);
  }
  lines.push(report.budgetOk ? "budget: OK" : "budget: FAILED");
  for (const failure of report.budgetFailures) lines.push(`  - ${failure}`);
  return lines.join("\n") + "\n";
}

export function fallbackMinifyJs(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const ch = source[index]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        out += current;
        index += 1;
        if (current === "\\") {
          if (index < source.length) out += source[index++]!;
          continue;
        }
        if (current === quote) break;
      }
      continue;
    }
    if (ch === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      const comment = source.slice(index, end < 0 ? source.length : end + 2);
      if (comment.startsWith("/*!")) out += comment;
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    out += ch;
    index += 1;
  }
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function fallbackMinifyCss(source: string): string {
  const preserved: string[] = [];
  let css = source.replace(
    LICENSE_COMMENT,
    (comment) => `\u0000L${preserved.push(comment) - 1}\u0000`,
  );
  css = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  let out = "";
  let pending = false;
  let index = 0;
  let quote: string | null = null;
  while (index < css.length) {
    const ch = css[index]!;
    if (quote) {
      out += ch;
      if (ch === "\\") {
        if (index + 1 < css.length) out += css[index + 1];
        index += 2;
        continue;
      }
      if (ch === quote) quote = null;
      index += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (pending && out && !/[{},;:>()]$/.test(out)) out += " ";
      pending = false;
      quote = ch;
      out += ch;
      index += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      pending = true;
      index += 1;
      continue;
    }
    if ("{};,>:!()".includes(ch)) {
      const keep = ch === "(" && pending && /(?:and|or|not|only|media|supports)$/i.test(out);
      out = out.replace(/ +$/, "");
      if (keep) out += " ";
      out += ch;
      pending = false;
      index += 1;
      continue;
    }
    if (pending && out && !/[{},;:>()]$/.test(out)) out += " ";
    pending = false;
    out += ch;
    index += 1;
  }
  out = out.replace(/;}/g, "}").trim();
  return out.replace(/\u0000L(\d+)\u0000/g, (_, id: string) => preserved[Number(id)] ?? "");
}

function looksMinifiedJs(source: string): boolean {
  const lines = source.split(/\r?\n/);
  return source.length > 400 && source.length / Math.max(1, lines.length) > 120;
}

function looksMinifiedCss(source: string): boolean {
  const lines = source.split(/\r?\n/);
  return source.length > 300 && source.length / Math.max(1, lines.length) > 120;
}

function minifyInlineHtml(html: string, options: WaterdropOptions): string {
  const js =
    options.js !== false && (options.js as { minify?: string } | undefined)?.minify !== "never";
  const css =
    options.css !== false && (options.css as { minify?: string } | undefined)?.minify !== "never";
  let out = html;
  if (js) {
    out = out.replace(INLINE_SCRIPT, (match, attrs: string, code: string) => {
      if (
        /\ssrc\s*=/i.test(attrs) ||
        /type\s*=\s*["']?(?:application\/(?:ld\+)?json|speculationrules)/i.test(attrs)
      ) {
        return match;
      }
      const next = fallbackMinifyJs(code);
      return next.length < code.length ? `<script${attrs}>${next}</script>` : match;
    });
  }
  if (css) {
    out = out.replace(INLINE_STYLE, (match, attrs: string, code: string) => {
      const next = fallbackMinifyCss(code);
      return next.length < code.length ? `<style${attrs}>${next}</style>` : match;
    });
  }
  return out;
}

function htmlRefs(html: string): string[] {
  const refs: string[] = [];
  for (const match of html.matchAll(ATTR)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value) refs.push(value);
  }
  for (const match of html.matchAll(SRCSET)) {
    for (const part of (match[1] ?? match[2] ?? "").split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }
  return refs;
}

function cssRefs(css: string): string[] {
  const refs: string[] = [];
  for (const match of css.matchAll(CSS_URL)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value) refs.push(value);
  }
  for (const match of css.matchAll(CSS_IMPORT)) {
    const value = match[1] ?? match[2];
    if (value) refs.push(value);
  }
  return refs;
}

function jsRefs(code: string): string[] {
  const refs: string[] = [];
  for (const pattern of [JS_IMPORT, JS_DYNAMIC, JS_REQUIRE, JS_URL]) {
    pattern.lastIndex = 0;
    for (const match of code.matchAll(pattern)) {
      if (match[1]) refs.push(match[1]);
    }
  }
  return refs;
}

function isLocal(ref: string): boolean {
  return (
    Boolean(ref) &&
    !ref.startsWith("#") &&
    !/^(?:[a-z]+:|\/\/)/i.test(ref) &&
    !/^(?:data|mailto|tel|javascript|blob):/i.test(ref)
  );
}

function resolveRef(
  from: string,
  reference: string,
  base: string,
  paths: Set<string>,
): string | undefined {
  const clean = reference.split(/[?#]/)[0] ?? "";
  if (!isLocal(clean)) return undefined;
  const normalizedBase = base === "/" ? "" : base.replace(/\/+$/, "");
  let candidate = clean;
  if (normalizedBase && candidate.startsWith(normalizedBase + "/")) {
    candidate = candidate.slice(normalizedBase.length);
  }
  const tries: string[] = [];
  if (candidate.startsWith("/")) {
    const absolute = posix.normalize(candidate.slice(1));
    tries.push(absolute);
    if (absolute.startsWith("_next/")) tries.push(absolute.slice("_next/".length));
  } else {
    tries.push(posix.normalize(posix.join(posix.dirname(from), candidate)));
  }
  const extensions = [".js", ".mjs", ".css", ".html", "/index.js", "/index.html"];
  for (const tryPath of [...tries]) {
    if (paths.has(tryPath)) return tryPath;
    for (const extension of extensions) {
      if (paths.has(tryPath + extension)) return tryPath + extension;
    }
  }
  return undefined;
}

function bloatOf(code: string): string[] {
  const warnings: string[] = [];
  if (/\bconsole\.(?:log|info|warn|error|debug|trace)\b/.test(code)) warnings.push("console");
  if (/\bdebugger\b/.test(code)) warnings.push("debugger");
  if (/\beval\s*\(/.test(code)) warnings.push("eval");
  if (/\bdocument\.write(?:ln)?\s*\(/.test(code)) warnings.push("document-write");
  if (/process\.env\.NODE_ENV/.test(code)) warnings.push("dev-check");
  return warnings;
}

interface Graph {
  edges: Map<string, Set<string>>;
  missing: WaterdropMissing[];
  entries: Set<string>;
  incoming: Map<string, number>;
}

function buildGraph(contents: Map<string, Buffer>, base: string): Graph {
  const paths = new Set(contents.keys());
  const graph: Graph = {
    edges: new Map(),
    missing: [],
    entries: new Set(),
    incoming: new Map(),
  };
  const seenMissing = new Set<string>();
  for (const [path, buffer] of contents) {
    const kind = kindOf(path);
    const text = buffer.toString("utf8");
    const refs =
      kind === "html"
        ? htmlRefs(text)
        : kind === "css"
          ? cssRefs(text)
          : kind === "javascript"
            ? jsRefs(text)
            : [];
    const targets = new Set<string>();
    for (const ref of refs) {
      if (!isLocal(ref)) continue;
      const target = resolveRef(path, ref, base, paths);
      if (target) targets.add(target);
      else {
        const key = `${path}\u0000${ref}`;
        if (!seenMissing.has(key)) {
          seenMissing.add(key);
          graph.missing.push({ from: path, reference: ref });
        }
      }
    }
    graph.edges.set(path, targets);
    if (kind === "html") graph.entries.add(path);
  }
  for (const [from, targets] of graph.edges) {
    for (const target of targets) {
      graph.incoming.set(target, (graph.incoming.get(target) ?? 0) + 1);
      if (kindOf(from) === "html" && kindOf(target) === "javascript") graph.entries.add(target);
    }
  }
  for (const [path] of contents) {
    if (kindOf(path) === "javascript" && (graph.incoming.get(path) ?? 0) === 0) {
      graph.entries.add(path);
    }
  }
  return graph;
}

function reachableFrom(graph: Graph, start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of graph.edges.get(current) ?? []) queue.push(next);
  }
  return seen;
}

function reachable(graph: Graph): Set<string> {
  const seen = new Set<string>();
  for (const entry of graph.entries) {
    for (const path of reachableFrom(graph, entry)) seen.add(path);
  }
  return seen;
}

function inlineCompressed(html: string): number {
  let inline = "";
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    if (!/\ssrc\s*=/i.test(match[1] ?? "")) inline += match[2] ?? "";
  }
  for (const match of html.matchAll(INLINE_STYLE)) inline += match[2] ?? "";
  return inline ? gz(inline) : 0;
}

function pruneMissingHints(html: string, paths: Set<string>, base: string): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = /\brel\s*=\s*["']?([^\s'">]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (!rel || !/^(?:preload|prefetch|modulepreload|stylesheet)$/.test(rel)) return tag;
    const href =
      /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(Boolean) ?? "";
    if (!href || !isLocal(href)) return tag;
    return resolveRef("", href, base, paths) ? tag : "";
  });
}

function injectModulePreloads(
  html: string,
  graph: Graph,
  paths: Set<string>,
  base: string,
  limit: number,
): string {
  const present = new Set<string>();
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']?([^\s'">]+)/i.exec(match[0])?.[1]?.toLowerCase();
    if (rel !== "modulepreload") continue;
    const href =
      /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[0])?.slice(1).find(Boolean) ??
      "";
    if (href) present.add(href);
  }
  const urls: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\btype\s*=\s*["']?module/i.test(tag)) continue;
    const src =
      /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(Boolean) ?? "";
    if (!src) continue;
    const seen = new Set<string>();
    let queue = [src];
    let depth = 0;
    while (queue.length && urls.length < limit && depth < 3) {
      const next: string[] = [];
      for (const url of queue) {
        const target = resolveRef("", url, base, paths);
        if (!target || seen.has(target)) continue;
        seen.add(target);
        for (const edge of graph.edges.get(target) ?? []) {
          if (urls.length >= limit) break;
          if (!present.has(edge) && !urls.includes(edge)) urls.push(`/${edge}`);
          next.push(edge);
        }
      }
      queue = next;
      depth += 1;
    }
  }
  if (!urls.length) return html;
  const injected = urls.map((url) => `<link rel="modulepreload" href="${url}">`).join("");
  return html.includes("</head>")
    ? html.replace(/<\/head>/i, `${injected}</head>`)
    : injected + html;
}

function duplicateGroups(contents: Map<string, Buffer>): WaterdropDuplicate[] {
  const byHash = new Map<string, string[]>();
  for (const [path, buffer] of contents) {
    const hash = hashOf(buffer);
    byHash.set(hash, [...(byHash.get(hash) ?? []), path]);
  }
  const groups: WaterdropDuplicate[] = [];
  for (const [hash, paths] of byHash) {
    if (paths.length < 2) continue;
    const bytes = contents.get(paths[0]!)?.length ?? 0;
    groups.push({ hash, bytes, wasted: bytes * (paths.length - 1), paths: paths.sort() });
  }
  return groups.sort((a, b) => b.wasted - a.wasted);
}

function budgetFailures(pages: WaterdropPage[], options: WaterdropOptions): string[] {
  const budget = options.budget ?? {};
  const failures: string[] = [];
  for (const page of pages) {
    if (budget.js !== undefined && page.js > budget.js) {
      failures.push(`${page.page}: JS ${page.js} > ${budget.js} bytes`);
    }
    if (budget.css !== undefined && page.css > budget.css) {
      failures.push(`${page.page}: CSS ${page.css} > ${budget.css} bytes`);
    }
    if (budget.total !== undefined && page.total > budget.total) {
      failures.push(`${page.page}: total ${page.total} > ${budget.total} bytes`);
    }
  }
  return failures;
}

function reportPath(options: WaterdropOptions): string | undefined {
  if (typeof options.report === "string") return options.report;
  return options.report?.path;
}

export async function runFallback(options: WaterdropOptions): Promise<WaterdropResult> {
  const started = Date.now();
  const root = options.root ?? process.cwd();
  const outDir = options.outDir ?? root;
  const base = options.base ?? "/";
  const mode = options.mode ?? "build";
  const dryRun = options.dryRun ?? false;
  const exclude = new Set(
    options.exclude ?? ["node_modules", ".git", ".turbo", ".cache", "coverage"],
  );
  const files = await walk(outDir, exclude);
  const contents = new Map<string, Buffer>();
  for (const file of files) {
    const path = asPosix(relative(outDir, file));
    if (!path) continue;
    contents.set(path, await readFile(file));
  }
  const changes: WaterdropChange[] = [];
  const preGraph = buildGraph(contents, base);

  if (mode === "build") {
    const jsOptions = typeof options.js === "object" ? options.js : {};
    const cssOptions = typeof options.css === "object" ? options.css : {};
    const htmlEnabled = options.html !== false;
    const jsEnabled = options.js !== false;
    const cssEnabled = options.css !== false;
    if (jsEnabled) {
      for (const [path, buffer] of [...contents]) {
        if (kindOf(path) !== "javascript") continue;
        const before = buffer.length;
        let code = buffer.toString("utf8");
        if (jsOptions.dropSourceMaps !== false) {
          code = code.replace(/\/\/[#@]\s*sourceMappingURL=.*$/gm, "");
        }
        const modeOption = jsOptions.minify ?? "auto";
        if (
          modeOption === "always" ||
          (modeOption === "auto" && !looksMinifiedJs(code) && !path.endsWith(".min.js"))
        ) {
          const next = fallbackMinifyJs(code);
          if (next.length < code.length) code = next;
        }
        const next = Buffer.from(code, "utf8");
        if (next.length < before) {
          contents.set(path, next);
          changes.push({ path, kind: "js", before, after: next.length });
        }
      }
    }
    if (cssEnabled) {
      for (const [path, buffer] of [...contents]) {
        if (kindOf(path) !== "css") continue;
        const before = buffer.length;
        let code = buffer.toString("utf8");
        const modeOption = cssOptions.minify ?? "auto";
        if (modeOption === "always" || (modeOption === "auto" && !looksMinifiedCss(code))) {
          const next = fallbackMinifyCss(code);
          if (next.length < code.length) code = next;
        }
        const next = Buffer.from(code, "utf8");
        if (next.length < before) {
          contents.set(path, next);
          changes.push({ path, kind: "css", before, after: next.length });
        }
      }
    }
    if (htmlEnabled) {
      const htmlOptions = typeof options.html === "object" ? options.html : {};
      const paths = new Set(contents.keys());
      for (const [path, buffer] of [...contents]) {
        if (kindOf(path) !== "html") continue;
        const before = buffer.length;
        let html = buffer.toString("utf8");
        if (htmlOptions.removeComments !== false) html = html.replace(HTML_COMMENT, "");
        if (htmlOptions.pruneMissingHints !== false) {
          html = pruneMissingHints(html, paths, base);
        }
        html = minifyInlineHtml(html, options);
        html = optimizeHtml(html, {
          eagerImages: htmlOptions.eagerImages,
          lazyImages: htmlOptions.lazyImages,
          lazyIframes: htmlOptions.lazyIframes,
        });
        if (htmlOptions.modulePreload !== false) {
          html = injectModulePreloads(
            html,
            preGraph,
            paths,
            base,
            htmlOptions.maxModulePreloads ?? 8,
          );
        }
        if (html !== buffer.toString("utf8")) {
          const next = Buffer.from(html, "utf8");
          contents.set(path, next);
          changes.push({ path, kind: "html", before, after: next.length });
        }
      }
    }
  }

  let graph = buildGraph(contents, base);
  const pruned: string[] = [];
  if (mode === "build" && options.prune) {
    const prune =
      options.prune === true
        ? { orphans: true, duplicates: false }
        : { orphans: false, duplicates: false, ...options.prune };
    if (options.pruneOrphans) prune.orphans = true;
    const protectedPrefixes = options.protected ?? [];
    const reachablePaths = reachable(graph);
    const candidates = new Set<string>();
    if (prune.orphans) {
      for (const path of contents.keys()) {
        if (graph.entries.has(path) || reachablePaths.has(path)) continue;
        if (protectedPrefixes.some((prefix) => path.startsWith(prefix))) continue;
        candidates.add(path);
      }
    }
    if (prune.duplicates) {
      for (const group of duplicateGroups(contents)) {
        const keep =
          group.paths.find((path) => (graph.incoming.get(path) ?? 0) > 0) ?? group.paths[0];
        for (const path of group.paths) {
          if (path !== keep && (graph.incoming.get(path) ?? 0) === 0) candidates.add(path);
        }
      }
    }
    if (!dryRun) {
      for (const path of candidates) {
        contents.delete(path);
        pruned.push(path);
        await removeFile(join(outDir, ...path.split("/")));
      }
      if (candidates.size) graph = buildGraph(contents, base);
    }
  }

  if (mode === "build" && !dryRun && changes.length) {
    for (const change of changes) {
      const buffer = contents.get(change.path);
      if (!buffer) continue;
      const file = join(outDir, ...change.path.split("/"));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, buffer);
    }
  }

  const reachablePaths = reachable(graph);
  const orphans = [...contents.keys()]
    .filter((path) => !graph.entries.has(path) && !reachablePaths.has(path))
    .filter((path) => !(options.protected ?? []).some((prefix) => path.startsWith(prefix)))
    .sort();
  const duplicates = duplicateGroups(contents);
  const missing = [...graph.missing].sort((a, b) =>
    a.from === b.from ? a.reference.localeCompare(b.reference) : a.from.localeCompare(b.from),
  );

  const summary: WaterdropSummary = {
    assets: contents.size,
    bytes: 0,
    compressed: 0,
    js: 0,
    css: 0,
    html: 0,
    images: 0,
    fonts: 0,
    orphans: orphans.length,
    orphanBytes: orphans.reduce((total, path) => total + (contents.get(path)?.length ?? 0), 0),
    duplicateGroups: duplicates.length,
    duplicateBytes: duplicates.reduce((total, group) => total + group.wasted, 0),
    unusedExports: 0,
    missing: missing.length,
    budgetOk: true,
  };
  const reportFiles: WaterdropFile[] = [];
  for (const [path, buffer] of [...contents].sort(([a], [b]) => a.localeCompare(b))) {
    const kind = kindOf(path);
    summary.bytes += buffer.length;
    summary.compressed += gz(buffer);
    if (kind === "javascript") summary.js += buffer.length;
    else if (kind === "css") summary.css += buffer.length;
    else if (kind === "html") summary.html += buffer.length;
    else if (kind === "image") summary.images += 1;
    else if (kind === "font") summary.fonts += 1;
    reportFiles.push({
      path,
      kind: kind === "javascript" ? "js" : kind,
      bytes: buffer.length,
      compressed: gz(buffer),
      hash: hashOf(buffer),
      entry: graph.entries.has(path),
      unusedExports: [],
      bloat: kind === "javascript" ? bloatOf(buffer.toString("utf8")) : [],
    });
  }

  const pages: WaterdropPage[] = [];
  for (const path of [...contents.keys()].filter((path) => kindOf(path) === "html").sort()) {
    const buffer = contents.get(path)!;
    const assets = [...reachableFrom(graph, path)].filter((asset) => asset !== path).sort();
    let js = 0;
    let css = 0;
    for (const asset of assets) {
      const size = contents.get(asset)?.length ?? 0;
      if (kindOf(asset) === "javascript") js += size;
      else if (kindOf(asset) === "css") css += size;
    }
    const html = buffer.length;
    pages.push({
      page: `/${path}`,
      html,
      js,
      css,
      inline: inlineCompressed(buffer.toString("utf8")),
      total: html + js + css,
      files: assets.map((asset) => `/${asset}`),
    });
  }
  pages.sort((a, b) => b.total - a.total);
  const failures = budgetFailures(pages, options);
  summary.budgetOk = failures.length === 0;

  const diagnostics: WaterdropDiagnostic[] = [
    ...orphans.map((path) => ({
      level: "warning" as const,
      code: "orphan",
      message: "asset is not reachable from any HTML entry",
      file: path,
    })),
    ...duplicates.map((group) => ({
      level: "warning" as const,
      code: "duplicate",
      message: `${group.paths.length} identical files waste ${group.wasted} bytes`,
      file: null,
    })),
    ...missing.map((item) => ({
      level: "warning" as const,
      code: "missing-ref",
      message: `reference ${item.reference} does not exist`,
      file: item.from,
    })),
    ...failures.map((failure) => ({
      level: "error" as const,
      code: "budget",
      message: failure,
      file: null,
    })),
  ];

  const report: WaterdropReport = {
    version: WATERDROP_VERSION,
    mode,
    root,
    outDir,
    base,
    summary,
    pages,
    files: reportFiles,
    orphans,
    duplicates,
    unusedExports: [],
    missing,
    diagnostics,
    pruned: { orphans: pruned, bytes: 0 },
    budgetOk: summary.budgetOk,
    budgetFailures: failures,
    timings: { totalMs: Date.now() - started },
  };
  const target = reportPath(options);
  if (target) {
    const file = target.match(/^[A-Za-z]:[\\/]|^\//) ? target : join(root, target);
    await mkdir(dirname(file), { recursive: true });
    const pretty = typeof options.report === "object" && options.report.pretty;
    await writeFile(
      file,
      target.endsWith(".json")
        ? JSON.stringify(report, null, pretty ? 2 : 0)
        : renderWaterdropReport(report),
    );
  }

  return {
    report,
    code: failures.length ? 2 : 0,
    native: false,
    changes,
    stdout: "",
    stderr: "",
  };
}

// Same rule as the native engine: an exclude entry matches a file/dir name anywhere
// ("node_modules") or a path prefix relative to the walked root ("server/chunks").
async function walk(
  dir: string,
  exclude: Set<string>,
  root = dir,
  rel = "",
): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (exclude.has(entry.name) || exclude.has(path)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, exclude, root, path)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true });
}
