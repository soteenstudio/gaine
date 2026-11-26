import { readdir, readFile } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { normalizeBase } from "./speculation.js";

export interface PageWeight {
  page: string;
  html: number;
  js: number;
  css: number;
  inline: number;
  total: number;
  files: string[];
}

export interface BudgetLimits {
  js?: number;
  css?: number;
  total?: number;
}

export interface BuildReport {
  pages: PageWeight[];
  worst: PageWeight | undefined;
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const gz = (buf: Buffer | string) => gzipSync(buf, { level: 9 }).length;
const ATTR = (tag: string, name: string) => new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i").exec(tag)?.slice(1).find(Boolean);

export async function measureBuild(outDir: string, options: { base?: string } = {}): Promise<BuildReport> {
  const base = normalizeBase(options.base);
  const files = await walk(outDir);
  const cache = new Map<string, number>();
  const sizeOf = async (abs: string) => {
    let size = cache.get(abs);
    if (size === undefined) {
      size = gz(await readFile(abs));
      cache.set(abs, size);
    }
    return size;
  };
  const resolveAsset = (url: string): string | undefined => {
    const path = url.split(/[?#]/)[0] ?? "";
    if (/^(?:[a-z]+:)?\/\//i.test(path)) return undefined;
    const clean = path.startsWith(base + "/") ? path.slice(base.length) : path;
    return join(outDir, ...posix.normalize(clean).split("/").filter(Boolean));
  };

  const pages: PageWeight[] = [];
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const html = await readFile(file, "utf8");
    const used = new Set<string>();
    let js = 0;
    let css = 0;
    let inline = 0;
    for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
      const url = /^<script/i.test(tag)
        ? ATTR(tag, "src")
        : /rel=["']?(?:stylesheet|modulepreload)/i.test(tag)
          ? ATTR(tag, "href")
          : undefined;
      const abs = url && resolveAsset(url);
      if (!abs || used.has(abs) || !files.includes(abs)) continue;
      used.add(abs);
      if (abs.endsWith(".css")) css += await sizeOf(abs);
      else js += await sizeOf(abs);
    }
    for (const m of html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      if (m[2] && !/\ssrc=/i.test(m[0]) && !/type=["']?(?:application\/(?:ld\+)?json|speculationrules)/i.test(m[0])) {
        inline += gz(m[2]);
      }
    }
    const htmlSize = gz(html);
    pages.push({
      page: "/" + relative(outDir, file).split(sep).join("/"),
      html: htmlSize,
      js,
      css,
      inline,
      total: htmlSize + js + css,
      files: [...used].map((u) => "/" + relative(outDir, u).split(sep).join("/")),
    });
  }
  pages.sort((a, b) => b.total - a.total);
  return { pages, worst: pages[0] };
}

export function checkBudget(report: BuildReport, limits: BudgetLimits): string[] {
  const problems: string[] = [];
  for (const p of report.pages) {
    if (limits.js !== undefined && p.js > limits.js) problems.push(`${p.page}: JS ${p.js} B > ${limits.js} B (gzip)`);
    if (limits.css !== undefined && p.css > limits.css) problems.push(`${p.page}: CSS ${p.css} B > ${limits.css} B (gzip)`);
    if (limits.total !== undefined && p.total > limits.total) problems.push(`${p.page}: total ${p.total} B > ${limits.total} B (gzip)`);
  }
  return problems;
}
