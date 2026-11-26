import { defineConfig } from "vitepress";
import { gaineHead } from "@gaine/vitepress/head";
import { withGaineSpeed } from "@gaine/vitepress/speed";
import { createSeoBuildEnd } from "@gaine/vitepress/metadata";
import { defaultLocale, locales } from "./i18n";

const baseUrl = process.env.SITE_URL ?? "http://localhost:5173";

const config = defineConfig({
  title: "{{name}}",
  cleanUrls: true,
  appearance: false, // theming is managed by Gaine (themeInitScript + inline runtime)
  head: gaineHead({ locales, defaultLocale }),
  buildEnd: createSeoBuildEnd({
    baseUrl,
    locales,
    pages: [
      { path: "/", priority: 1 },
      { path: "/guide/", priority: 0.8 },
    ],
  }),
  locales: {
    // `root` is only the entry page (index.md); the head script redirects it to /id/ or /en/.
    root: { label: "Bahasa Indonesia", lang: "id" },
    id: {
      label: "Bahasa Indonesia",
      lang: "id",
      link: "/id/",
      description: "Starter Gaine untuk VitePress.",
      themeConfig: { nav: [{ text: "Panduan", link: "/id/guide/" }] },
    },
    en: {
      label: "English",
      lang: "en",
      link: "/en/",
      description: "Gaine starter for VitePress.",
      themeConfig: { nav: [{ text: "Guide", link: "/en/guide/" }] },
    },
  },
});

// Speed layer: inline runtime (theme, reveal, menu), metaChunk, lazy images, `_headers` with immutable caching.
// Zero-JS mode for content / marketing sites with a custom layout: withGaineSpeed(config, { mode: "mpa", locales })
export default withGaineSpeed(config, { locales });
