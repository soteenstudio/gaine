# @gaine/core

The neutral core of Gaine: no React, Next.js, or Vue. Used by `@gaine/nextjs` and `@gaine/vitepress`.

```ts
import {
  cn, reveal, revealInitScript, themeInitScript, applyTheme, toggleTheme, THEME_STORAGE_KEY,
  defineLocales, detectLocale,
} from "@gaine/core";
import { gainePreset, gaineContent } from "@gaine/core/tailwind";
import "@gaine/core/reveal.css";
```

- `gainePreset()` / `gaineContent`: Tailwind preset (color tokens, radius, font, dark mode).
- `reveal.css`: `[data-reveal]` animations.
- `reveal(delay, variant)`: a plain `{ "data-reveal", style }` object (React: use `reveal` from `@gaine/nextjs`; Vue: `v-bind`).
- `themeInitScript` / `revealInitScript`: inline script strings; `applyTheme` / `toggleTheme`: client side.
- `defineLocales`, `detectLocale`: i18n helpers.

UI components (`Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`) live in `@gaine/nextjs`.
Peer dependency: only `tailwindcss` ^3.4.17 (optional, needed only for `@gaine/core/tailwind`).

## Speed (`@gaine/core/speed`)

Framework-neutral speed logic shared by `@gaine/nextjs` and `@gaine/vitepress`: `gaineRuntimeScript`, `speculationRules`,
`optimizeHtml`, `resourceHints`, `hintsToHtml`, `hintsToLinkHeader`, `speedHeaders`, `toHeadersFile`, `toNextHeaders`,
`renderLanguageMenu`, `renderThemeToggle`. Node-only build tooling lives in `@gaine/core/speed/node` (`measureBuild`, `checkBudget`).
CSS: `@gaine/core/speed.css` (`.gaine-defer`) and `@gaine/core/view-transition.css`. See the root README for usage.
Tests: `pnpm --filter @gaine/core build && pnpm --filter @gaine/core test`.
