# @gaine/vitepress

The **VitePress** (Vue 3) counterpart of `@gaine/nextjs`, built on top of `@gaine/core`.

| `@gaine/nextjs` | `@gaine/vitepress` |
| --- | --- |
| `ThemeSync` | `ThemeSync` / `useThemeSync()` |
| `ScrollReveal` | `ScrollReveal` / `useScrollReveal()`, plus `reveal()` for `v-bind` |
| `LanguageSwitcher` | `LanguageSwitcher` (Vue menu, no Radix) |
| `Logo` | `Logo` (uses `withBase`) |
| `createLocaleProxy` (`proxy.ts`) | `localeRedirectScript` / `gaineHead` (`./head`), redirects in the browser because the site is static |
| `createRobots`, `createSitemap` | `createRobotsTxt`, `createSitemap`, `sitemapToXml`, `createSeoBuildEnd` (`./metadata`) |
| `renderOgCover`, `renderOgFallback` | the same, producing a PNG through `satori` + `@resvg/resvg-js` (`./og`) |
| `ThemeToggle` (in `@gaine/nextjs`) | `ThemeToggle` |

The React UI components (`Button`, `Dropdown*`, etc.) live in `@gaine/nextjs` and cannot be used in Vue, so only the
components that have a counterpart are provided here, rewritten as Vue components with the same Tailwind classes. Theme
logic, i18n, `cn`, `reveal`, and tokens come from the neutral `@gaine/core`.

## Setup

```bash
pnpm add @gaine/core @gaine/vitepress
pnpm add -D vitepress vue tailwindcss@^3.4.17 postcss autoprefixer
```

`tailwind.config.ts`: if you use the default VitePress theme, turn off preflight so it does not break its built-in styling.

```ts
import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

export default {
  presets: [gainePreset()],
  corePlugins: { preflight: false },
  content: [
    "./.vitepress/theme/**/*.{ts,vue}",
    "./**/*.md",
    ...gaineContent, // already includes @gaine/vitepress
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
@import "@gaine/vitepress/vitepress.css"; /* optional: Gaine tokens -> --vp-* */
```

`.vitepress/config.ts`

```ts
import { defineConfig } from "vitepress";
import { gaineHead } from "@gaine/vitepress/head";
import { createSeoBuildEnd } from "@gaine/vitepress/metadata";
import { locales, defaultLocale } from "./i18n";

const baseUrl = "https://example.com";

export default defineConfig({
  appearance: false, // theming is managed by Gaine (localStorage "theme"), not VitePress
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

The content structure matches the Next version: every locale is prefixed (`/id/...`, `/en/...`). Create an empty `index.md` at the
root (`---\nlayout: false\n---`) as the entry point; `gaineHead` redirects it to a locale based on `navigator.languages`.

## Using the components

With `gaineTheme`, the components are registered globally and can be used in layout slots or in markdown:

```vue
<GaineLogo href="/" label="Home" mark="G" primary="Gaine" product="Docs" />
<GaineThemeToggle label="Toggle theme" />
<GaineLanguageSwitcher label="Language" :locales="locales" :locale-labels="localeLabels" />
```

For a custom theme (not `gaineTheme`), import `ThemeSync`, `ScrollReveal`, and the rest from `@gaine/vitepress`, then render
`ThemeSync` and `ScrollReveal` once in `Layout` (for example in the `layout-bottom` slot), or call `useThemeSync()` and
`useScrollReveal()` inside the layout's `setup`.

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

// inside buildEnd (provide `fonts` with a .ttf/.otf/.woff file)
const png = await renderOgCover(
  { brand: "Gaine", title: "Title", description: "Description", footerStart: "example.com" },
  { fonts: [{ name: "Inter", data: await readFile("fonts/Inter-Bold.ttf"), weight: 700 }] },
);
await writeFile(join(siteConfig.outDir, "og.png"), png);
```

Reference it through `transformHead` / `head` (`<meta property="og:image" content="https://example.com/og.png">`).
`satori` and `@resvg/resvg-js` must be installed, and fonts are required.

## Notes

- VitePress has no server, so the locale redirect happens on the client and `robots.txt` / `sitemap.xml` are written at build time.
- `createSeoBuildEnd` writes `sitemap.xml`; do not use it together with VitePress's built-in `sitemap` option.
- The initial reveal script (`revealInitScript`) is not installed because `head` runs before `<body>`; `ScrollReveal` observes on mount.

## Speed

`@gaine/vitepress/speed` exports `withGaineSpeed(config, options)`; `gaineLiteTheme` (from `./theme`) and `ThemeToggleLite` /
`LanguageSwitcherLite` render static markup driven by the inline runtime, so `ThemeSync` and `ScrollReveal` are not needed.
`mode: "mpa"` enables VitePress zero-JS mode plus speculation rules. Details are in the root README.
