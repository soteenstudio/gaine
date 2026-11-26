# @gaine/vitepress

VitePress (Vue 3) integration for Gaine, built on `@gaine/core`.

Docs: [https://gaine.soteenstudio.my.id](https://gaine.soteenstudio.my.id)

```ts
import {
  ThemeSync,
  ScrollReveal,
  LanguageSwitcher,
  Logo,
  ThemeToggle,
  reveal,
  useThemeSync,
  useScrollReveal,
} from "@gaine/vitepress";
import { gaineTheme, gaineLiteTheme } from "@gaine/vitepress/theme";
import { gaineHead, localeRedirectScript } from "@gaine/vitepress/head";
import { createSeoBuildEnd, createRobotsTxt, createSitemap } from "@gaine/vitepress/metadata";
import { renderOgCover, renderOgFallback } from "@gaine/vitepress/og";
```

## What is inside

- **Theme & components**: `gaineTheme`, `gaineLiteTheme`, `Logo`, `ThemeToggle`, `LanguageSwitcher`, `ThemeSync`, `ScrollReveal`, `reveal()`, plus composables (`useThemeSync`, `useScrollReveal`).
- **Routing, SEO & OG**: client locale redirect helpers (`@gaine/vitepress/head`), build-time sitemap/robots (`@gaine/vitepress/metadata`), and PNG OG cover helpers via `satori` + `@resvg/resvg-js` (`@gaine/vitepress/og`).
- **Speed (`@gaine/vitepress/speed`)**: `withGaineSpeed()`, `ThemeToggleLite`, and `LanguageSwitcherLite`.