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
