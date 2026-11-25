# Gaine

Lib UI/tema/i18n mandiri untuk situs berbasis **Next.js 16** atau **VitePress** dengan **Tailwind CSS 3**, diekstrak dari bagian yang kembar di
`soteenstudio` (web utama) dan `policies`.

| Package | Isi | Bergantung pada Next? |
| --- | --- | --- |
| `@gaine/core` | Preset Tailwind (token warna, radius, font, dark mode), `reveal.css`, `Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`, `cn`, `reveal()`, `themeInitScript`, `revealInitScript`, `defineLocales`, `detectLocale` | Tidak |
| `@gaine/nextjs` | `ThemeSync`, `ScrollReveal`, `LanguageSwitcher`, `Logo`, `createLocaleProxy`, `createRobots`, `createSitemap`, `renderOgCover`, `renderOgFallback` | Ya (`next` ^16) |
| `@gaine/vitepress` | Padanan `@gaine/nextjs` untuk VitePress/Vue 3: `ThemeSync`, `ScrollReveal`, `LanguageSwitcher`, `Logo`, `ThemeToggle`, `gaineTheme`, `gaineHead`, `createSeoBuildEnd`, `renderOgCover`. Lihat [packages/vitepress](packages/vitepress/README.md) | Tidak (`vitepress` >=1.5, `vue` ^3.5) |

## Pengembangan

```bash
pnpm install
pnpm build       # tsc per package -> packages/*/dist
pnpm typecheck
```

Build memakai `tsc` (tanpa bundler) supaya direktif `"use client"` tetap utuh di tiap file.

## Setup di aplikasi Next.js 16

```bash
pnpm add @gaine/core @gaine/nextjs lucide-react
pnpm add -D tailwindcss@^3.4.17 postcss autoprefixer
```

`tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

const config: Config = {
  presets: [gainePreset()], // opsi: { light, dark, radius } untuk ganti token/brand
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", ...gaineContent],
};
export default config;
```

`app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`app/[locale]/layout.tsx`

```tsx
import "./globals.css";
import "@gaine/core/reveal.css";
import { revealInitScript, themeInitScript } from "@gaine/core";
import { ScrollReveal, ThemeSync } from "@gaine/nextjs";
```

`next.config.ts`: tambahkan `transpilePackages: ["@gaine/core", "@gaine/nextjs"]`.

`i18n/config.ts`

```ts
import { defineLocales } from "@gaine/core";

export const { locales, defaultLocale, localeLabels, isLocale } = defineLocales({
  locales: ["id", "en"],
  defaultLocale: "id",
  labels: { id: "Bahasa Indonesia", en: "English" },
});
export type Locale = (typeof locales)[number];
```

`proxy.ts` (Next 16 mengganti `middleware.ts` menjadi `proxy.ts`)

```ts
import { createLocaleProxy } from "@gaine/nextjs/proxy";
import { defaultLocale, locales } from "@/i18n/config";

export default createLocaleProxy({ locales, defaultLocale });
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] }; // harus literal
```

Font (`next/font`) sengaja tidak masuk lib: loader-nya harus dipanggil dari file aplikasi.

## Token tema

Semua token (`--background`, `--brand`, dst.) dibuat oleh preset. Ganti aksen brand:

```ts
gainePreset({
  light: { brand: "250 80% 55%", ring: "250 80% 50%" },
  dark: { brand: "250 80% 65%" },
});
```
