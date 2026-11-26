import { createSitemap } from "@gaine/nextjs/metadata";
import { locales } from "@/i18n/config";
import { baseUrl } from "@/site.config";

export default function sitemap() {
  return createSitemap({ baseUrl, locales, pages: [{ path: "", priority: 1 }] });
}
