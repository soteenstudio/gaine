import type { MetadataRoute } from "next";
import { createSitemap } from "@gaine/nextjs/metadata";
import { locales } from "@/i18n/config";
import { baseUrl } from "@/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap({ baseUrl, locales, pages: [{ path: "", priority: 1 }] });
}
