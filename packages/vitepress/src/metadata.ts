import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SiteConfig } from "vitepress";

/** Node only (config / `buildEnd`); do not import from client code. */

export function createRobotsTxt(options: { baseUrl: string; disallow?: string[] }): string {
  const lines = ["User-agent: *", "Allow: /"];
  for (const path of options.disallow ?? []) lines.push(`Disallow: ${path}`);
  lines.push("", `Sitemap: ${options.baseUrl}/sitemap.xml`, "");
  return lines.join("\n");
}

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapPage {
  path: string;
  priority: number;
  changeFrequency?: ChangeFrequency;
}

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** Same entry shape as `createSitemap` in @gaine/nextjs. */
export function createSitemap<L extends string>(options: {
  baseUrl: string;
  locales: readonly L[];
  pages: readonly SitemapPage[];
  now?: Date;
}): SitemapEntry[] {
  const now = options.now ?? new Date();
  const entries: SitemapEntry[] = [];
  for (const locale of options.locales) {
    for (const page of options.pages) {
      entries.push({
        url: `${options.baseUrl}/${locale}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency ?? "weekly",
        priority: page.priority,
      });
    }
  }
  return entries;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function sitemapToXml(entries: readonly SitemapEntry[]): string {
  const items = entries.map(
    (e) =>
      `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${e.lastModified.toISOString()}</lastmod>\n    <changefreq>${e.changeFrequency}</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>\n`;
}

/**
 * `buildEnd` hook that writes `robots.txt` and `sitemap.xml` to the output folder.
 * Do not combine with VitePress's built-in `sitemap` option (same file name).
 */
export function createSeoBuildEnd<L extends string>(options: {
  baseUrl: string;
  locales: readonly L[];
  pages: readonly SitemapPage[];
  disallow?: string[];
}) {
  return async function buildEnd(siteConfig: SiteConfig) {
    await mkdir(siteConfig.outDir, { recursive: true });
    await writeFile(join(siteConfig.outDir, "robots.txt"), createRobotsTxt(options));
    await writeFile(join(siteConfig.outDir, "sitemap.xml"), sitemapToXml(createSitemap(options)));
  };
}
