# @gaine/vitepress

Padanan `@gaine/nextjs` untuk **VitePress** (Vue 3), di atas `@gaine/core`.

| `@gaine/nextjs` | `@gaine/vitepress` |
| --- | --- |
| `ThemeSync` | `ThemeSync` / `useThemeSync()` |
| `ScrollReveal` | `ScrollReveal` / `useScrollReveal()`, plus `reveal()` untuk `v-bind` |
| `LanguageSwitcher` | `LanguageSwitcher` (menu Vue, tanpa Radix) |
| `Logo` | `Logo` (memakai `withBase`) |
| `createLocaleProxy` (`proxy.ts`) | `localeRedirectScript` / `gaineHead` (`./head`), redirect di browser karena situs statis |
| `createRobots`, `createSitemap` | `createRobotsTxt`, `createSitemap`, `sitemapToXml`, `createSeoBuildEnd` (`./metadata`) |
| `renderOgCover`, `renderOgFallback` | idem, hasil PNG via `satori` + `@resvg/resvg-js` (`./og`) |
| `ThemeToggle` (di `@gaine/nextjs`) | `ThemeToggle` |

Komponen UI React (`Button`, `Dropdown*`, dst.) ada di `@gaine/nextjs` dan tidak bisa dipakai di Vue, jadi di sini hanya
komponen yang punya padanan: ditulis ulang sebagai komponen Vue dengan class Tailwind yang sama. Logika tema, i18n,
`cn`, `reveal`, dan token datang dari `@gaine/core` yang netral.

## Setup

```bash
pnpm add @gaine/core @gaine/vitepress
pnpm add -D vitepress vue tailwindcss@^3.4.17 postcss autoprefixer
```

`tailwind.config.ts`: jika memakai tema default VitePress, matikan preflight agar tidak merusak styling bawaannya.

```ts
import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

export default {
  presets: [gainePreset()],
  corePlugins: { preflight: false },
  content: [
    "./.vitepress/theme/**/*.{ts,vue}",
    "./**/*.md",
    ...gaineContent, // sudah mencakup @gaine/vitepress
  ],
} satisfies Config;
```

`postcss.config.js`: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`

`.vitepress/theme/index.ts`

```ts
import "./style.css";
export { gaineTheme as default } from "@gaine/vitepress/theme";
```

`.vitepress/theme/style.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "@gaine/core/reveal.css";
@import "@gaine/vitepress/vitepress.css"; /* opsional: token Gaine -> --vp-* */
```

`.vitepress/config.ts`

```ts
import { defineConfig } from "vitepress";
import { gaineHead } from "@gaine/vitepress/head";
import { createSeoBuildEnd } from "@gaine/vitepress/metadata";
import { locales, defaultLocale } from "./i18n";

const baseUrl = "https://example.com";

export default defineConfig({
  appearance: false, // tema dikelola Gaine (localStorage "theme"), bukan VitePress
  head: gaineHead({ locales, defaultLocale /*, base: "/docs/" */ }),
  buildEnd: createSeoBuildEnd({
    baseUrl,
    locales,
    pages: [{ path: "/", priority: 1 }],
  }),
  locales: {
    id: { label: "Bahasa Indonesia", lang: "id", link: "/id/" },
    en: { label: "English", lang: "en", link: "/en/" },
  },
});
```

`.vitepress/i18n.ts`

```ts
import { defineLocales } from "@gaine/core";

export const { locales, defaultLocale, localeLabels, isLocale } = defineLocales({
  locales: ["id", "en"],
  defaultLocale: "id",
  labels: { id: "Bahasa Indonesia", en: "English" },
});
```

Struktur konten sama dengan versi Next: semua locale berprefiks (`/id/...`, `/en/...`). Buat `index.md` kosong di root
(`---\nlayout: false\n---`) sebagai pintu masuk; `gaineHead` akan mengarahkannya ke locale dari `navigator.languages`.

## Memakai komponen

Dengan `gaineTheme`, komponen terdaftar global dan bisa dipakai di slot layout atau markdown:

```vue
<GaineLogo href="/" label="Beranda" mark="G" primary="Gaine" product="Docs" />
<GaineThemeToggle label="Ganti tema" />
<GaineLanguageSwitcher label="Bahasa" :locales="locales" :locale-labels="localeLabels" />
```

Untuk tema sendiri (bukan `gaineTheme`), impor `ThemeSync`, `ScrollReveal`, dkk. dari `@gaine/vitepress`, lalu render
`ThemeSync` dan `ScrollReveal` sekali di `Layout` (mis. slot `layout-bottom`), atau panggil `useThemeSync()` dan
`useScrollReveal()` di `setup` layout.

Reveal-on-scroll:

```vue
<script setup>
import { reveal } from "@gaine/vitepress";
</script>
<div v-bind="reveal(120, 'left')">...</div>
```

## OG image

```ts
import { readFile, writeFile } from "node:fs/promises";
import { renderOgCover } from "@gaine/vitepress/og";

// di buildEnd (setelah mengisi `fonts` dengan file .ttf/.otf/.woff)
const png = await renderOgCover(
  { brand: "Gaine", title: "Judul", description: "Deskripsi", footerStart: "example.com" },
  { fonts: [{ name: "Inter", data: await readFile("fonts/Inter-Bold.ttf"), weight: 700 }] },
);
await writeFile(join(siteConfig.outDir, "og.png"), png);
```

Referensikan lewat `transformHead`/`head` (`<meta property="og:image" content="https://example.com/og.png">`).
Perlu `satori` dan `@resvg/resvg-js` terpasang; font wajib diberikan.

## Catatan

- VitePress tidak punya server, jadi redirect locale terjadi di client dan `robots.txt`/`sitemap.xml` ditulis saat build.
- `createSeoBuildEnd` menulis `sitemap.xml`; jangan dipakai bersamaan dengan opsi `sitemap` bawaan VitePress.
- Script reveal awal (`revealInitScript`) tidak dipasang karena `head` berjalan sebelum `<body>`; `ScrollReveal` mengamati saat mount.
