# @gaine/core

Inti Gaine yang netral: tanpa React, Next.js, maupun Vue. Dipakai oleh `@gaine/nextjs` dan `@gaine/vitepress`.

```ts
import {
  cn, reveal, revealInitScript, themeInitScript, applyTheme, toggleTheme, THEME_STORAGE_KEY,
  defineLocales, detectLocale,
} from "@gaine/core";
import { gainePreset, gaineContent } from "@gaine/core/tailwind";
import "@gaine/core/reveal.css";
```

- `gainePreset()` / `gaineContent`: preset Tailwind (token warna, radius, font, dark mode).
- `reveal.css`: animasi `[data-reveal]`.
- `reveal(delay, variant)`: objek `{ "data-reveal", style }` polos (React: pakai `reveal` dari `@gaine/nextjs`; Vue: `v-bind`).
- `themeInitScript` / `revealInitScript`: string script inline; `applyTheme` / `toggleTheme`: sisi client.
- `defineLocales`, `detectLocale`: helper i18n.

Komponen UI (`Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`) ada di `@gaine/nextjs`.
Peer dependency: hanya `tailwindcss` ^3.4.17 (opsional, hanya untuk `@gaine/core/tailwind`).
