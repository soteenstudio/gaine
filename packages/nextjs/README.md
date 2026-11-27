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

- **Server-only UI (`@gaine/nextjs/ui`)**: `Button`, `Badge`, `Logo`, `SectionHeading`, `reveal()` with no client modules in the graph, so importing them adds no client JS. Prefer this over the barrel on pages that don't need `DropdownMenu`, `ThemeToggle`, `LanguageSwitcher`, `ThemeSync` or `ScrollReveal`.
- **UI & theme**: `Button`, `Badge`, `DropdownMenu*`, `SectionHeading`, `Logo`, `ThemeToggle`, `LanguageSwitcher`, plus `ThemeSync`, `ScrollReveal`, and `reveal()`.
- **Routing & SEO**: `createLocaleProxy()` for `proxy.ts`, `createRobots()` / `createSitemap()` under `@gaine/nextjs/metadata`, and OG image helpers under `@gaine/nextjs/og`.
- **Speed (`@gaine/nextjs/speed` & `/config`)**: `withGaineSpeed()` for `next.config` and zero-JS server components (`GaineRuntime`, `GaineHead`, `ThemeToggleLite`, `LanguageSwitcherLite`). Skip `ThemeSync` and `ScrollReveal` if `GaineRuntime` is mounted.
## Styles

`@gaine/nextjs` does not ship CSS. Install `@gaine/core` as a direct dependency of your app
and import its styles (for example `@gaine/core/reveal.css` and `@gaine/core/speed.css`);
with pnpm's strict `node_modules`, importing them without a direct dependency fails to resolve.
