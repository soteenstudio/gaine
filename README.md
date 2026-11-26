# Gaine

A standalone UI / theme / i18n library for sites built with **Next.js 16** or **VitePress** and **Tailwind CSS 3**, extracted from the twin parts of
`soteenstudio` (main website) and `policies`.

| Package | Contents | Framework dependent? |
| --- | --- | --- |
| `@gaine/core` | Framework-neutral: Tailwind preset (color tokens, radius, font, dark mode), `reveal.css`, `cn`, `reveal()`, `themeInitScript`, `revealInitScript`, `applyTheme`, `toggleTheme`, `defineLocales`, `detectLocale` | No |
| `@gaine/nextjs` | UI (`Button`, `Badge`, `Dropdown*`, `SectionHeading`, `ThemeToggle`), `reveal`, `ThemeSync`, `ScrollReveal`, `LanguageSwitcher`, `Logo`, `createLocaleProxy`, `createRobots`, `createSitemap`, `renderOgCover`, `renderOgFallback` | Yes (`next` ^16) |
| `@gaine/vitepress` | Counterpart of `@gaine/nextjs` for VitePress / Vue 3: `ThemeSync`, `ScrollReveal`, `LanguageSwitcher`, `Logo`, `ThemeToggle`, `gaineTheme`, `gaineHead`, `createSeoBuildEnd`, `renderOgCover`. See [packages/vitepress](packages/vitepress/README.md) | Needs `vitepress` >=1.5 and `vue` ^3.5 |
| `gaine` | Scaffolding CLI with a Vite-style interactive menu (Next.js / VitePress, TypeScript / JavaScript). See [packages/gaine](packages/gaine/README.md) | No |

## Starting a new project

```bash
npx gaine@latest              # interactive menu
npx gaine@latest my-app -f next -l ts   # no menu (next|vitepress, ts|js)
```

## Development

```bash
pnpm install
pnpm build       # tsc per package -> packages/*/dist
pnpm typecheck
```

The build uses `tsc` (no bundler) so the `"use client"` directive stays intact in every file.

## Formatting and license headers

```bash
pnpm install
pnpm format          # strip comments, format with Prettier, prepend the Apache-2.0 header
pnpm format:check    # list files that would change (exit code 1), writes nothing
```

`scripts/format-sources.mjs` processes `.ts/.tsx/.js/.jsx/.mjs/.cjs/.css` (comments removed, header added) and `.json`
(formatting only). Markdown is left alone. Notes:

- The copyright holder and year come from `format.config.json` (or `--holder` / `--year`). Set the holder before running.
- Functional comments are kept (`@ts-ignore`, `@ts-expect-error`, `eslint-*`, `@type`, `/// <reference>`, `#__PURE__`); pass `--strict` to remove them too.
- `packages/gaine/templates` is skipped, because those files are copied into users' projects. Pass `--include-templates` to process them as well.
- The script is idempotent: running it twice changes nothing the second time. Prettier settings live in `.prettierrc.json`.

## Setup in a Next.js 16 app

```bash
pnpm add @gaine/core @gaine/nextjs lucide-react
pnpm add -D tailwindcss@^3.4.17 postcss autoprefixer
```

`tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

const config: Config = {
  presets: [gainePreset()], // options: { light, dark, radius } to change tokens/brand
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
import { ScrollReveal, ThemeSync } from "@gaine/nextjs"; // UI components (Button, etc.) also come from here
```

`next.config.ts`: add `transpilePackages: ["@gaine/core", "@gaine/nextjs"]`.

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

`proxy.ts` (Next 16 renames `middleware.ts` to `proxy.ts`)

```ts
import { createLocaleProxy } from "@gaine/nextjs/proxy";
import { defaultLocale, locales } from "@/i18n/config";

export default createLocaleProxy({ locales, defaultLocale });
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] }; // must be a literal
```

Fonts (`next/font`) are intentionally not part of the library: the loader must be called from an application file.

## Theme tokens

All tokens (`--background`, `--brand`, etc.) are created by the preset. To change the brand accent:

```ts
gainePreset({
  light: { brand: "250 80% 55%", ring: "250 80% 50%" },
  dark: { brand: "250 80% 65%" },
});
```

## License

Apache-2.0. Add the full license text as a `LICENSE` file at the repository root.

## Speed

Astro is fast because it ships HTML and almost no JavaScript. Next.js and VitePress always carry a framework runtime, so Gaine
attacks everything *around* that runtime: the JS it adds itself, render-blocking CSS, request waterfalls, and navigation latency.
The logic lives in `@gaine/core/speed` (no React, Next, or Vue), and the adapters only wire it into each framework.

| Piece (`@gaine/core/speed`) | What it does | Next.js | VitePress |
| --- | --- | --- | --- |
| `gaineRuntimeScript()` | One inline vanilla script (about 0.8 KB gzip by default): theme toggle, reveal-on-scroll with a `MutationObserver` (works across SPA navigation), optional dropdown menu, locale switching, and hover-intent prefetch. Replaces `ThemeSync`, `ScrollReveal`, Radix dropdown, and `usePathname` re-renders | `<GaineRuntime />` | added to `head` by `withGaineSpeed` |
| `renderLanguageMenu()` / `renderThemeToggle()` | Static markup that the runtime drives, so no component is hydrated | `LanguageSwitcherLite`, `ThemeToggleLite` | same names, Vue |
| `speculationRules()` | Declarative prerender/prefetch for real page navigations (Chromium), with a `<link rel=prefetch>` fallback in the runtime | `<GaineHead speculation />` | on in `mpa` mode |
| `optimizeHtml()` | Safe HTML post-processing: `decoding="async"`, `loading="lazy"` after the first images, lazy iframes | n/a (use `next/image`) | `transformHtml` |
| `resourceHints()`, `speedHeaders()` | `preload`/`preconnect` tags, `Link` headers, immutable caching for hashed assets | `withGaineSpeed` (`headers()`) | `_headers` file in `buildEnd` |
| `speed.css`, `view-transition.css` | `content-visibility` helpers (`.gaine-defer`), cross-document view transitions | import in layout | import in theme |
| `measureBuild()`, `checkBudget()` (`@gaine/core/speed/node`) | Gzip weight per page (HTML + the JS and CSS it loads) with a failing budget | static export only | `dist` |

### Next.js

```ts
// next.config.ts
import { withGaineSpeed } from "@gaine/nextjs/config";
export default withGaineSpeed({} /*, { inlineCss: false, immutable: ["fonts"], reactCompiler: true }*/);
```

```tsx
// app/[locale]/layout.tsx
import "@gaine/core/speed.css";
import { GaineHead, GaineRuntime } from "@gaine/nextjs/speed";
// <head>: <GaineHead hints={[fontPreload("/fonts/inter.woff2")]} />
// end of <body>: <GaineRuntime menu locales={locales} />
```

`withGaineSpeed` turns on `optimizePackageImports`, `experimental.inlineCss` (best for Tailwind, an all-or-nothing trade-off against
caching), AVIF/WebP, and removes `X-Powered-By`. Opt-in only: `reactCompiler` (needs `babel-plugin-react-compiler`),
`cacheComponents` (changes the programming model), `viewTransition`. Do not enable `speculation` for links rendered by
`next/link`: the router intercepts those clicks, so a prerendered document would be wasted.

### VitePress

```ts
// .vitepress/config.ts
import { withGaineSpeed } from "@gaine/vitepress/speed";
export default withGaineSpeed(defineConfig({ /* ... */ }), { locales });
```

- Default (`mode: "spa"`): inline runtime, `metaChunk`, lazy images, a modern build target, and a `_headers` file (Netlify / Cloudflare Pages) with immutable caching for `/assets`.
- `mode: "mpa"`: VitePress ships **0 KB of JavaScript** per page and navigation becomes real page loads that speculation rules prerender on hover. This is the only mode that approaches Astro. The default VitePress theme needs JS (mobile menu, local search), so use it for content or marketing sites with a custom layout.

### Measuring

```ts
import { checkBudget, measureBuild } from "@gaine/core/speed/node";
const report = await measureBuild("dist", { base: "/" });
const problems = checkBudget(report, { js: 40_000, css: 15_000, total: 120_000 }); // gzip bytes
if (problems.length) throw new Error(problems.join("\n"));
```

### Limits

- Next.js still ships React and the App Router runtime on every page, and VitePress in SPA mode still ships Vue and its router, so Gaine reduces the gap to Astro but does not close it. Only VitePress `mpa` mode reaches zero JS.
- The language switcher in the Lite components does a full page load (it keeps path, query, and hash), which is what a static site needs; the Radix `LanguageSwitcher` is still available for SPA-style switching.
- The unit tests cover the core logic and config helpers with a fake DOM. They are not browser benchmarks: run Lighthouse or WebPageTest on your own build to get real numbers.

## Local tarballs

```bash
pnpm pack:local                      # build, then write every package to .tarball/*.tgz
pnpm pack:local --no-build           # skip the build step
pnpm pack:local core nextjs          # only some packages (folder or package name)
pnpm pack:local --keep               # do not clear .tarball first
```

Do not install a single `.tgz` with `pnpm add`: `@gaine/nextjs` depends on `@gaine/core@^0.2.0`, which is not on npm, so the
registry lookup fails with a 404. Use the install script instead; it points every `@gaine/*` dependency (including the nested
ones) to the local tarballs, then runs the install. The overrides go to `pnpm-workspace.yaml` on pnpm 10+ (newer pnpm ignores the
`pnpm` field in `package.json`), to `pnpm.overrides` on older pnpm, and to `overrides` on npm:

```bash
cd ../my-app && node ../gaine/scripts/install-local.mjs   # from the target project
pnpm install:local ../my-app                              # or from this repo
pnpm install:local ../my-app nextjs                       # choose libs (core is always included)
pnpm install:local ../my-app --force                      # re-extract after re-packing the same version
pnpm install:local ../my-app --no-install                 # only edit package.json
```

With no library named, it installs `core` plus `nextjs` / `vitepress` depending on whether the project already depends on
`next` / `vitepress` (otherwise all three).

## Releasing

Every package shares one version (lockstep). Releases are fully automated by `.github/workflows/release.yml`:
build, test, publish to npm (with provenance) and a GitHub Release with categorized notes
(Breaking Changes, Features, Bug Fixes, Performance, ..., New Contributors, Full Changelog link).

**One-time setup**

1. Create an npm **Automation** (or granular, publish-enabled) access token and add it as the `NPM_TOKEN` repository secret.
2. Make sure the `@gaine` scope exists on npm and your account/token can publish to it.

**Release**

- Actions → **Release** → *Run workflow* → `patch`, `minor`, `major` or an explicit version (`1.0.0`, `1.1.0-beta.1`).
  Tick *Dry run* first to see the notes and `npm publish --dry-run` output without publishing anything.
- Or bump versions yourself (`node scripts/release.mjs bump minor`), merge, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

Prereleases (`-beta.1`, `-rc.0`, ...) are published under the matching npm dist-tag and marked as pre-release on GitHub.

Release notes are built from [Conventional Commits](https://www.conventionalcommits.org) (`feat(nextjs): ...`, `fix: ...`,
`feat!: ...` or a `BREAKING CHANGE:` footer). Preview them locally with `node scripts/release.mjs notes vX.Y.Z`.
