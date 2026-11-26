# @gaine/nextjs

The Next.js 16 (App Router) layer on top of `@gaine/core`.

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

- `createLocaleProxy({ locales, defaultLocale })` for `proxy.ts` (redirects based on `Accept-Language`).
- `LanguageSwitcher` takes `locales` and `localeLabels` as props.
- `Logo` takes `href`, `label`, `mark`, `primary`, `secondary?`, `product?`.
- `export const size` / `contentType` / `alt` in an `opengraph-image.tsx` file must still be written as literals in the app.
- The UI components (`Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`) used to live in `@gaine/core/ui`; they now live here together with their dependencies (Radix, cva, lucide-react).
- `reveal()` wraps the core `reveal` with `suppressHydrationWarning`.

## Speed

- `@gaine/nextjs/config`: `withGaineSpeed(config, options)` for `next.config`.
- `@gaine/nextjs/speed`: server components with no client JS: `GaineRuntime`, `GaineHead`, `ThemeToggleLite`, `LanguageSwitcherLite`.

`ThemeSync` and `ScrollReveal` are no longer needed when `GaineRuntime` is on the page. Details are in the root README.
