# Gaine

Shared UI, theming, i18n, SEO, and speed tooling for Next.js and VitePress projects.

Docs: [https://gaine.soteenstudio.my.id](https://gaine.soteenstudio.my.id)

## Quick start

Scaffold a new project with the CLI:

```bash
npx gaine@latest
```

## Packages

| Package | Description |
| --- | --- |
| [`gaine`](./packages/gaine) | Zero-dependency CLI to scaffold Next.js or VitePress projects |
| [`@gaine/core`](./packages/core) | Framework-free core (theme, reveal, i18n, Tailwind preset, speed helpers) |
| [`@gaine/nextjs`](./packages/nextjs) | Next.js 16 (App Router) components, locale proxy, metadata, OG, and speed layer |
| [`@gaine/vitepress`](./packages/vitepress) | VitePress (Vue 3) theme, components, static SEO, OG, and speed layer |

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

This project is licensed under the [Apache-2.0 License](./LICENSE).