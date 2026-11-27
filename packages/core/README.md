# @gaine/core

Framework-free core for Gaine (`@gaine/nextjs` and `@gaine/vitepress`), with no React or Vue lock-in.

Docs: [https://gaine.soteenstudio.my.id](https://gaine.soteenstudio.my.id)

```ts
import {
  cn,
  reveal,
  revealInitScript,
  themeInitScript,
  applyTheme,
  toggleTheme,
  defineLocales,
  detectLocale,
} from "@gaine/core";
import { gainePreset, gaineContent } from "@gaine/core/tailwind";
import "@gaine/core/reveal.css";
```

## What is inside

- **Theme & reveal**: `themeInitScript`, `revealInitScript`, `applyTheme`, `toggleTheme`, and `reveal()` (returns `{ "data-reveal", style }`; pair with `reveal.css`).
- **Locale & class helpers**: `defineLocales`, `detectLocale`, and `cn`.
- **Tailwind preset**: `gainePreset()` and `gaineContent` from `@gaine/core/tailwind` (optional `tailwindcss` ^3.4.17 peer dep).
- **Speed (`@gaine/core/speed`)**: Shared performance and header helpers, Node build checks under `@gaine/core/speed/node` (`measureBuild`, `checkBudget`), and optional stylesheets (`speed.css`, `view-transition.css`).
- **Waterdrop (`@gaine/core/waterdrop`)**: Run the Rust Waterdrop engine from Node. It uses the native `waterdrop` binary when available and falls back to a pure-JavaScript engine otherwise.

UI components live in the framework packages (`@gaine/nextjs` and `@gaine/vitepress`). Check the root README for full usage details.

## Dev

```bash
pnpm --filter @gaine/core build && pnpm --filter @gaine/core test
```