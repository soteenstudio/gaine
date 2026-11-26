import { defineConfig } from "vitepress";
import { gaineHead } from "@gaine/vitepress/head";
import { createSeoBuildEnd } from "@gaine/vitepress/metadata";
import { defaultLocale, locales } from "./i18n";

const baseUrl = process.env.SITE_URL ?? "http://localhost:5173";

export default defineConfig({
  title: "{{name}}",
  cleanUrls: true,
  appearance: false, // tema dikelola Gaine (ThemeSync + themeInitScript)
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
    // `root` hanya halaman pintu masuk (index.md); script head mengarahkannya ke /id/ atau /en/.
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
