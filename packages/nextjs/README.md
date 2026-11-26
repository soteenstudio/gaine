# @gaine/nextjs

Next.js 16 (App Router) integration and UI components for Gaine, built on `@gaine/core`.

Docs: [https://gaine.soteenstudio.my.id](https://gaine.soteenstudio.my.id)

```ts
import {
  ThemeSync,
  ScrollReveal,
  LanguageSwitcher,
  Logo,
  reveal,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  SectionHeading,
  ThemeToggle,
} from "@gaine/nextjs";
import { createLocaleProxy } from "@gaine/nextjs/proxy";
import { createRobots, createSitemap } from "@gaine/nextjs/metadata";
import { renderOgCover, renderOgFallback } from "@gaine/nextjs/og";
```

## What is inside

- **UI & theme**: `Button`, `Badge`, `DropdownMenu*`, `SectionHeading`, `Logo`, `ThemeToggle`, `LanguageSwitcher`, plus `ThemeSync`, `ScrollReveal`, and `reveal()`.
- **Routing & SEO**: `createLocaleProxy()` for `proxy.ts`, `createRobots()` / `createSitemap()` under `@gaine/nextjs/metadata`, and OG image helpers under `@gaine/nextjs/og`.
- **Speed (`@gaine/nextjs/speed` & `/config`)**: `withGaineSpeed()` for `next.config` and zero-JS server components (`GaineRuntime`, `GaineHead`, `ThemeToggleLite`, `LanguageSwitcherLite`). Skip `ThemeSync` and `ScrollReveal` if `GaineRuntime` is mounted.