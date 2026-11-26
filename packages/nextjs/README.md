# @gaine/nextjs

Lapisan Next.js 16 (App Router) di atas `@gaine/core`.

```ts
import {
  ThemeSync, ScrollReveal, LanguageSwitcher, Logo, reveal,
  Button, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  SectionHeading, ThemeToggle,
} from "@gaine/nextjs";
import { createLocaleProxy } from "@gaine/nextjs/proxy";
import { createRobots, createSitemap } from "@gaine/nextjs/metadata";
import { renderOgCover, renderOgFallback } from "@gaine/nextjs/og";
```

- `createLocaleProxy({ locales, defaultLocale })` untuk `proxy.ts` (redirect berdasarkan `Accept-Language`).
- `LanguageSwitcher` menerima `locales` dan `localeLabels` lewat props.
- `Logo` menerima `href`, `label`, `mark`, `primary`, `secondary?`, `product?`.
- `export const size`/`contentType`/`alt` di file `opengraph-image.tsx` tetap ditulis literal di aplikasi.
- Komponen UI (`Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`) dulunya di `@gaine/core/ui`; kini di sini bersama dependensinya (Radix, cva, lucide-react).
- `reveal()` membungkus `reveal` dari core dengan `suppressHydrationWarning`.
