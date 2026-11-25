# @gaine/core

Bagian Gaine yang tidak bergantung pada Next.js.

```ts
import {
  cn, reveal, revealInitScript, themeInitScript, applyTheme, toggleTheme,
  defineLocales, detectLocale,
  Button, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  SectionHeading, ThemeToggle,
} from "@gaine/core";
import { gainePreset, gaineContent } from "@gaine/core/tailwind";
import "@gaine/core/reveal.css";
```

Peer dependency: `react` ^19, `react-dom` ^19, `tailwindcss` ^3.4.17, `lucide-react`.

Subpath bebas React (dipakai `@gaine/vitepress`): `@gaine/core/theme`, `@gaine/core/i18n`, `@gaine/core/reveal`, `@gaine/core/utils`. `react`, `react-dom`, dan `lucide-react` adalah peer opsional bila hanya memakai subpath ini atau `@gaine/core/tailwind`.
