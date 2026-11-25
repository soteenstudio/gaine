import type { MetadataRoute } from "next";

export function createRobots(options: {
  baseUrl: string;
  disallow?: string[];
}): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: options.disallow ?? ["/_next/", "/api/"],
    },
    sitemap: `${options.baseUrl}/sitemap.xml`,
  };
}

export interface SitemapPage {
  path: string;
  priority: number;
  changeFrequency?: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}

export function createSitemap<L extends string>(options: {
  baseUrl: string;
  locales: readonly L[];
  pages: readonly SitemapPage[];
  now?: Date;
}): MetadataRoute.Sitemap {
  const now = options.now ?? new Date();
  const entries: MetadataRoute.Sitemap = [];
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
